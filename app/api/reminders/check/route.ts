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
    // Bulletproof MSK time extraction (Europe/Moscow)
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
    const currentTimeStr = `${getPart('hour')}:${getPart('minute')}`

    // Fetch pending tasks with dueTime matching current time or past due
    const tasks = await getAllTasks()
    const pendingTasks = tasks.filter((t: { status: string; dueTime?: string | null }) =>
      t.status !== 'done' && !!t.dueTime
    )

    const chatIds = await getAllChatIds()

    let sentCount = 0

    for (const task of pendingTasks) {
      if (!task.dueTime) continue

      // Trigger ONLY when dueTime matches exact current minute and not yet sent
      if (task.dueTime === currentTimeStr && !task.reminderSent) {
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

        // Mark task as completed and reminderSent to prevent duplicate/delayed spam
        await updateTask(task.id, {
          status: 'done',
          reminderSent: true,
          dueTime: undefined,
          completedAt: new Date(),
        })
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
