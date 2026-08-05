/**
 * GET /api/reminders/check — Checks and pushes due Telegram notifications (MSK / Europe/Moscow timezone)
 *
 * FIXED: Sends only to ownerChatId of each task, not to all registered chats.
 */

import { NextResponse } from 'next/server'
import { getAllTasks, updateTask } from '@/lib/backend/db'

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

    const tasks = await getAllTasks()

    let sentCount = 0

    for (const task of tasks) {
      if (!task.dueTime) continue
      if (task.status === 'done') continue
      if (task.reminderSent) continue
      if (task.dueTime !== currentTimeStr) continue
      if (task.dueDate && task.dueDate !== todayStr) continue

      // ── CRITICAL FIX: send ONLY to the task owner, not to everyone ──
      const ownerChatId = task.ownerChatId ? Number(task.ownerChatId) : null

      if (ownerChatId) {
        const isRecipientMsg =
          task.description?.includes('📩 Отправить') ||
          task.title?.toLowerCase().includes('отправь') ||
          task.title?.toLowerCase().includes('напиши')

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

        await sendTelegramMessage(ownerChatId, text)
        sentCount++
      }

      // Always mark as done + reminderSent to prevent future triggers
      await updateTask(task.id, {
        status: 'done',
        reminderSent: true,
        completedAt: new Date(),
      })
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
