/**
 * GET /api/reminders/check — Checks and pushes due Telegram notifications (MSK / Europe/Moscow timezone)
 */

import { NextResponse } from 'next/server'
import { getAllTasks, updateTask, getAllChatIds } from '@/lib/backend/db'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8649326236:AAH0dqSDP4akzWrM-5ncS68wZhlrwZISbxw'

async function sendTelegramMessage(chatId: number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    })
  } catch (err) {
    console.error('Failed to send Telegram message:', err)
  }
}

export async function GET() {
  try {
    // Current time in Moscow / MSK (UTC+3)
    const now = new Date()
    const mskOffset = 3 * 60 * 60 * 1000
    const mskDate = new Date(now.getTime() + mskOffset)
    
    const todayStr = mskDate.toISOString().slice(0, 10)
    const hours = String(mskDate.getUTCHours()).padStart(2, '0')
    const minutes = String(mskDate.getUTCMinutes()).padStart(2, '0')
    const currentTimeStr = `${hours}:${minutes}`

    // Fetch pending tasks with dueTime matching current time or slightly past
    const tasks = await getAllTasks()
    const pendingTasks = tasks.filter((t: { status: string; dueDate?: string | null; dueTime?: string | null }) =>
      t.status !== 'done' && t.dueDate === todayStr && !!t.dueTime
    )

    const chatIds = await getAllChatIds()

    let sentCount = 0

    for (const task of pendingTasks) {
      if (!task.dueTime) continue

      // Check if time matches or is past within 5 minutes
      if (task.dueTime <= currentTimeStr) {
        for (const chatId of chatIds) {
          const isRecipientMsg = task.description?.includes('📩 Отправить') || task.title?.toLowerCase().includes('отправь') || task.title?.toLowerCase().includes('напиши')
          
          const text = isRecipientMsg
            ? `📩 *СООБЩЕНИЕ ДЛЯ ПОЛУЧАТЕЛЯ*\n\n` +
              `📌 *Сообщение:* ${task.title}\n` +
              (task.description ? `_«${task.description}»_\n\n` : '\n') +
              `⏰ *Время отправки:* ${task.dueTime}\n` +
              `✨ _Отправлено автоматически через Zerf AI_`
            : `⏰ *НАПОМИНАНИЕ!*\n\n` +
              `📌 *${task.title}*\n` +
              (task.description ? `_«${task.description}»_\n\n` : '\n') +
              `📍 *Время:* ${task.dueTime}\n` +
              `✨ _Отправлено из Zerf AI_`

          await sendTelegramMessage(chatId, text)
          sentCount++
        }

        // Clear dueTime so it won't trigger twice
        await updateTask(task.id, { dueTime: undefined })
      }
    }

    return NextResponse.json({
      success: true,
      currentTimeMSK: currentTimeStr,
      todayDateMSK: todayStr,
      notificationsSent: sentCount,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
