/**
 * GET /api/cron/reminders — Scheduled Reminders Endpoint
 * Can be called by Railway Cron or Vercel Cron every minute / few minutes.
 */

import { NextResponse } from 'next/server'
import { getTasksDueNow, getAllChatIds, markReminderSent } from '@/lib/backend/db'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const P_EMOJI: Record<string, string> = {
  urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢',
}

async function sendTg(chatId: number, text: string) {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  })
}

export async function GET() {
  try {
    const dueTasks = await getTasksDueNow()
    if (dueTasks.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const chatIds = await getAllChatIds()
    if (chatIds.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'No registered chat IDs' })
    }

    let sentCount = 0

    for (const task of dueTasks) {
      const timeStr = task.dueTime || 'сейчас'
      const msg = `⏰ *Напоминание!*\n\n` +
        `${P_EMOJI[task.priority] || '⚪'} *${task.title}*\n` +
        (task.description ? `_${task.description.slice(0, 120)}_\n` : '') +
        `\nВремя: *${timeStr}*`

      for (const chatId of chatIds) {
        await sendTg(chatId, msg)
      }

      await markReminderSent(task.id)
      sentCount++
    }

    return NextResponse.json({ ok: true, sent: sentCount })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
