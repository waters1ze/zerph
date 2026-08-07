/**
 * Background Cron Runner — Runs every 10 seconds in Node.js process
 *
 * Features:
 * 1. REMINDER: send to ownerChatId only (never broadcast)
 * 2. MORNING GREETING: every day at 08:00 MSK to all registered users
 *    — personalized by their recent tasks + notes via Groq AI
 */

import { getAllTasks, updateTask, getAllNotes } from './db'
import { generateMorningGreeting } from './groq'
import { prisma } from './prisma'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8649326236:AAH0dqSDP4akzWrM-5ncS68wZhlrwZISbxw'

async function sendTelegramMessage(chatId: number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (err) {
    console.error('Telegram send error:', err)
  }
}

// ── Reminder check — per-task owner only ─────────────────────────────────────

// ── Reminder check — per-task owner with configurable multi-stage intervals ──

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

    const currentHour = parseInt(getPart('hour'), 10)
    const currentMin = parseInt(getPart('minute'), 10)
    const currentTotalMin = currentHour * 60 + currentMin
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    const tasks = await getAllTasks()

    for (const task of tasks) {
      if (!task.dueTime) continue
      if (task.status === 'done') continue
      if (task.reminderSent) continue
      if (task.dueDate && task.dueDate !== todayStr) continue

      const [dueH, dueM] = task.dueTime.split(':').map(n => parseInt(n, 10))
      if (isNaN(dueH) || isNaN(dueM)) continue
      const targetTotalMin = dueH * 60 + dueM

      const ownerChatId = task.ownerChatId ? Number(task.ownerChatId) : null

      // Get owner's custom reminder interval settings from DB
      let intervalMinutes = 5
      let repeatCount = 3
      if (ownerChatId) {
        try {
          const userChat = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(ownerChatId) } })
          if (userChat) {
            intervalMinutes = userChat.reminderIntervalMinutes || 5
            repeatCount = userChat.reminderRepeatCount || 3
          }
        } catch {}
      }

      const sentCount = (task as { remindersSentCount?: number }).remindersSentCount || 0
      const remainingStages = repeatCount - 1 - sentCount
      const expectedDiffMin = remainingStages * intervalMinutes
      const actualDiffMin = targetTotalMin - currentTotalMin

      // Check if current time matches the scheduled stage
      if (actualDiffMin <= expectedDiffMin && actualDiffMin >= expectedDiffMin - 1) {
        if (ownerChatId) {
          const isRecipientMsg =
            task.description?.includes('📩 Отправить') ||
            task.title?.toLowerCase().includes('отправь') ||
            task.title?.toLowerCase().includes('напиши')

          let stageText = 'СЕЙЧАС'
          if (actualDiffMin > 0) {
            stageText = `за ${actualDiffMin} мин`
          }

          const text = isRecipientMsg
            ? `📩 *СООБЩЕНИЕ ДЛЯ ПОЛУЧАТЕЛЯ*\n\n` +
              `📌 *Сообщение:* ${task.title}\n` +
              (task.description ? `_«${task.description}»_\n\n` : '\n') +
              `⏰ *Время:* ${task.dueTime}\n` +
              `✨ _Отправлено из Zerf AI_`
            : `⏰ *НАПОМИНАНИЕ (${stageText.toUpperCase()})!*\n\n` +
              `📌 *${task.title}*\n` +
              (task.description ? `\n${task.description}\n\n` : '\n') +
              `📍 *Срок:* ${task.dueTime}\n` +
              `✨ _Отправлено из Zerf AI_`

          await sendTelegramMessage(ownerChatId, text)
        }

        const nextSentCount = sentCount + 1
        const isFinal = nextSentCount >= repeatCount || actualDiffMin <= 0

        if (isFinal && task.repeat) {
          // Advance the date for recurring tasks
          let nextDate = new Date(task.dueDate || todayStr)
          if (task.repeat === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1)
          else if (task.repeat === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
          else if (task.repeat === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
          else if (task.repeat === 'daily') nextDate.setDate(nextDate.getDate() + 1)
          
          const nextYearStr = nextDate.getFullYear()
          const nextMonthStr = String(nextDate.getMonth() + 1).padStart(2, '0')
          const nextDayStr = String(nextDate.getDate()).padStart(2, '0')
          const nextDateStr = `${nextYearStr}-${nextMonthStr}-${nextDayStr}`

          await prisma.task.update({
            where: { id: task.id },
            data: {
              dueDate: nextDateStr,
              remindersSentCount: 0,
              reminderSent: false,
              status: 'todo',
            },
          })
        } else {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              remindersSentCount: nextSentCount,
              reminderSent: isFinal,
              ...(isFinal ? { status: 'done', completedAt: new Date() } : {}),
            },
          })
        }
      }
    }
  } catch (err) {
    console.error('Reminder check error:', err)
  }
}

// ── Morning greeting — 08:00 MSK to all users ────────────────────────────────

// Track which date we've already sent the morning greeting (in-memory, resets on server restart)
let morningGreetingSentDate = ''

async function runMorningGreeting() {
  try {
    const now = new Date()
    const mskFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = mskFormatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

    const hour = getPart('hour')
    const minute = getPart('minute')
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    // Fire at 08:00 MSK, once per day
    if (hour !== '08' || minute !== '00') return
    if (morningGreetingSentDate === todayStr) return
    morningGreetingSentDate = todayStr

    // Get all registered users
    const chats = await prisma.telegramChat.findMany()
    if (!chats.length) return

    // Get context data for personalization (shared pool — tasks & notes)
    const allTasks = await getAllTasks()
    const allNotes = await getAllNotes()

    const recentTaskTitles = allTasks
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(t => t.title)

    const recentNoteTitles = allNotes
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(n => n.title)

    const pendingToday = allTasks
      .filter(t => t.status !== 'done' && t.dueDate === todayStr)
      .map(t => t.title)

    // Send personalized greeting to each user
    for (const chat of chats) {
      try {
        const chatId = Number(chat.chatId)
        const firstName = (chat as { firstName?: string | null }).firstName || 'друг'

        // Per-user: filter tasks where they're the owner (if ownerChatId set)
        const userTasks = allTasks
          .filter(t => {
            const ownerId = (t as { ownerChatId?: bigint | null }).ownerChatId
            return !ownerId || Number(ownerId) === chatId
          })

        const userPending = userTasks
          .filter(t => t.status !== 'done' && t.dueDate === todayStr)
          .map(t => t.title)

        const userRecent = userTasks
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 8)
          .map(t => t.title)

        const greeting = await generateMorningGreeting(
          firstName,
          userRecent.length ? userRecent : recentTaskTitles,
          recentNoteTitles,
          userPending.length ? userPending : pendingToday,
        ).catch(() => null)

        if (greeting) {
          await sendTelegramMessage(chatId, greeting)
        }

        // Small delay between users to avoid rate limiting
        await new Promise(r => setTimeout(r, 300))
      } catch (userErr) {
        console.error('Morning greeting error for user:', userErr)
      }
    }

    console.log(`[Zerf Cron] Morning greeting sent to ${chats.length} users at ${todayStr} 08:00 MSK`)
  } catch (err) {
    console.error('Morning greeting cron error:', err)
  }
}

// ── Global daemon ─────────────────────────────────────────────────────────────

const globalObj = globalThis as unknown as { __reminderCronStarted?: boolean }

if (!globalObj.__reminderCronStarted) {
  globalObj.__reminderCronStarted = true

  // Reminders: every 10 seconds
  setInterval(() => {
    runReminderCheck().catch(() => {})
  }, 10_000)

  // Morning greeting: every 30 seconds check (lightweight, fires only at 08:00)
  setInterval(() => {
    runMorningGreeting().catch(() => {})
  }, 30_000)

  console.log('[Zerf Cron] Reminder + Morning Greeting daemon started.')
}
