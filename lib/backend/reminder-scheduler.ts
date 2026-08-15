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

let lastReportSentDate = ''

async function checkAndSendSundayWeeklyReport() {
  const mskOffset = 3 * 60 * 60 * 1000
  const mskNow = new Date(Date.now() + mskOffset)
  const day = mskNow.getUTCDay() // 0 = Sunday
  const hour = mskNow.getUTCHours()
  const dateStr = mskNow.toISOString().slice(0, 10)

  // Trigger Sunday weekly report at 08:00 MSK
  if (day === 0 && hour === 8 && lastReportSentDate !== dateStr) {
    lastReportSentDate = dateStr
    try {
      const chatIds = await getAllChatIds()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      for (const cid of chatIds) {
        fetch(`${appUrl}/api/weekly-report?chatId=${cid}`).catch(() => {})
      }
    } catch (e) {
      console.error('Error triggering Sunday weekly report:', e)
    }
  }
}

export async function checkAndSendReminders() {
  try {
    await checkAndSendSundayWeeklyReport()
    const dueTasks = await getTasksDueNow()
    if (dueTasks.length === 0) return

    for (const task of dueTasks) {
      const ownerChatId = task.ownerChatId ? Number(task.ownerChatId) : null
      if (!ownerChatId || isNaN(ownerChatId) || ownerChatId === 0) {
        // No valid owner to notify
        await markReminderSent(task.id)
        continue
      }

      const timeStr = task.dueTime || 'сейчас'
      let msg = `⏰ *НАПОМИНАНИЕ*\n\n` +
        `📌 *${task.title}*\n`
      if (task.description) {
        msg += `\n${task.description.slice(0, 200)}\n`
      }
      msg += `\n📍 *Время:* ${timeStr}\n` +
        `✨ _Отправлено из Zerf AI_`

      // Send STRICTLY to the owner of the task ONLY
      await sendTgNotification(ownerChatId, msg)

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
