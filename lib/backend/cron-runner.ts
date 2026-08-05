/**
 * Background Cron Runner — Runs every 10 seconds in Node.js process
 *
 * FIXED: Each task now has an ownerChatId field.
 * Reminders are sent ONLY to the task owner, never to all registered chats.
 */

import { getAllTasks, updateTask } from './db'

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

export async function runReminderCheck() {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

    const currentTimeStr = `${getPart('hour')}:${getPart('minute')}`
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    const tasks = await getAllTasks()

    for (const task of tasks) {
      if (!task.dueTime) continue
      if (task.status === 'done') continue
      if (task.reminderSent) continue

      // Trigger ONLY when dueTime matches exact current minute AND today's date
      if (task.dueTime !== currentTimeStr) continue
      if (task.dueDate && task.dueDate !== todayStr) continue

      // ── CRITICAL FIX: only send to the OWNER of this specific task ──
      // If task has no ownerChatId, it was created via web app (no Telegram), skip Telegram notification
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
      }

      // Mark as done + reminderSent regardless (even if no chatId, prevent future triggers)
      await updateTask(task.id, {
        status: 'done',
        reminderSent: true,
        completedAt: new Date(),
      })
    }
  } catch (err) {
    console.error('Reminder check error:', err)
  }
}

// Global daemon initialization — runs once per server process lifetime
const globalObj = globalThis as unknown as { __reminderCronStarted?: boolean }
if (!globalObj.__reminderCronStarted) {
  globalObj.__reminderCronStarted = true
  setInterval(() => {
    runReminderCheck().catch(() => {})
  }, 10000)
}
