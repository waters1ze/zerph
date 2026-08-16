/**
 * GET /api/reminders/check — Checks and pushes due Telegram notifications respecting user timezones
 */

import { NextResponse } from 'next/server'
import { getAllTasks, updateTask } from '@/lib/backend/db'
import { prisma } from '@/lib/backend/prisma'

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

function getUserCurrentTimeAndDate(timezone: string = 'Europe/Moscow') {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
    const currentTimeStr = `${getPart('hour')}:${getPart('minute')}`
    return { todayStr, currentTimeStr }
  } catch {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
    return {
      todayStr: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
      currentTimeStr: `${getPart('hour')}:${getPart('minute')}`
    }
  }
}

export async function GET() {
  try {
    const tasks = await getAllTasks()
    let sentCount = 0

    // Cache user timezones to minimize queries
    const userTimezones = new Map<string, string>()

    for (const task of tasks) {
      if (!task.dueTime) continue
      if (task.status === 'done') continue
      if (task.reminderSent) continue

      const ownerChatId = task.ownerChatId ? String(task.ownerChatId) : null
      if (!ownerChatId) continue

      let tz = userTimezones.get(ownerChatId)
      if (!tz) {
        try {
          const userChat = await prisma.telegramChat.findUnique({
            where: { chatId: BigInt(ownerChatId) },
            select: { timezone: true },
          })
          tz = userChat?.timezone || 'Europe/Moscow'
        } catch {
          tz = 'Europe/Moscow'
        }
        userTimezones.set(ownerChatId, tz)
      }

      const { todayStr, currentTimeStr } = getUserCurrentTimeAndDate(tz)

      if (task.dueTime !== currentTimeStr) continue
      if (task.dueDate && task.dueDate !== todayStr) continue

      const isRecipientMsg =
        task.description?.includes('Отправить') ||
        task.title?.toLowerCase().includes('отправь') ||
        task.title?.toLowerCase().includes('напиши')

      const text = isRecipientMsg
        ? `▪ *СООБЩЕНИЕ ДЛЯ ПОЛУЧАТЕЛЯ*\n\n` +
          `▫ *Сообщение:* ${task.title}\n` +
          (task.description ? `_«${task.description}»_\n\n` : '\n') +
          `⏱ *Время отправки:* ${task.dueTime}\n` +
          `⚡ _Отправлено автоматически через Zerf AI_`
        : `⏱ *НАПОМИНАНИЕ*\n\n` +
          `▪ *${task.title}*\n` +
          (task.description ? `_«${task.description}»_\n\n` : '\n') +
          `▫ *Время:* ${task.dueTime}\n` +
          `⚡ _Zerf AI Assistant_`

      await sendTelegramMessage(Number(ownerChatId), text)
      sentCount++

      await updateTask(task.id, {
        status: 'done',
        reminderSent: true,
        completedAt: new Date(),
      })
    }

    return NextResponse.json({
      success: true,
      notificationsSent: sentCount,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
