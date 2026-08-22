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

import { runReminderCheck } from './cron-runner'

export async function checkAndSendReminders() {
  try {
    await runReminderCheck()
  } catch (err) {
    console.error('Error in reminder scheduler:', err)
  }
}

// Start interval if running on a dedicated daemon process.
// RELIABILITY (audit H-9): the previous gate also accepted the mere presence
// of TELEGRAM_BOT_TOKEN, which silently turned every warm serverless lambda
// importing any route that calls startReminderScheduler() into a 20s daemon
// issuing DB scans and Telegram sends outside request scope. Now the ticker
// starts ONLY when explicitly opted in via RUN_CRON_DAEMON=true.
let isRunning = false
export function startReminderScheduler(force = false) {
  if (isRunning) return
  if (!force && process.env.RUN_CRON_DAEMON !== 'true') return
  isRunning = true
  console.log('⏰ Reminder scheduler interval started (checks every 20s)')
  checkAndSendReminders().catch(() => {})
  const timer = setInterval(() => {
    checkAndSendReminders().catch(() => {})
  }, 20000)
  // Never keep the event loop alive just for the scheduler (serverless safety).
  timer.unref?.()
}
