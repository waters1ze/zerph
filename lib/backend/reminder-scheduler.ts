/**
 * Background Reminder Scheduler
 * Checks every 60 seconds for tasks matching the current time and sends Telegram notifications.
 */

import { getTasksDueNow, getAllChatIds, markReminderSent } from './db'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const P_EMOJI: Record<string, string> = {
  urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢',
}

async function sendTgNotification(chatId: number, text: string) {
  if (!BOT_TOKEN) return
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
    console.error('Failed to send TG notification:', err)
  }
}

export async function checkAndSendReminders() {
  try {
    const dueTasks = await getTasksDueNow()
    if (dueTasks.length === 0) return

    const chatIds = await getAllChatIds()
    if (chatIds.length === 0) return

    for (const task of dueTasks) {
      const timeStr = task.dueTime || 'сейчас'
      const msg = `⏰ *Напоминание!*\n\n` +
        `${P_EMOJI[task.priority] || '⚪'} *${task.title}*\n` +
        (task.description ? `_${task.description.slice(0, 120)}_\n` : '') +
        `\nВремя: *${timeStr}*`

      for (const chatId of chatIds) {
        await sendTgNotification(chatId, msg)
      }

      await markReminderSent(task.id)
    }
  } catch (err) {
    console.error('Error in reminder scheduler:', err)
  }
}

// Start interval if running on server
let isRunning = false
export function startReminderScheduler() {
  if (isRunning) return
  isRunning = true
  setInterval(() => {
    checkAndSendReminders()
  }, 60000)
}
