/**
 * Background Cron Runner — Runs every 10 seconds in Node.js process
 *
 * Features:
 * 1. REMINDER: send to ownerChatId only (never broadcast)
 * 2. MORNING GREETING: every day at 08:00 MSK to all registered users
 *    — personalized by their recent tasks + notes via Groq AI
 */

import { getAllTasks, updateTask, getAllNotes } from './db'
import { generateMorningGreeting, generateEveningReview } from './groq'
import { prisma } from './prisma'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8649326236:AAH0dqSDP4akzWrM-5ncS68wZhlrwZISbxw'

async function sendTelegramMessage(chatId: number | string | bigint, text: string, replyMarkup?: any) {
  try {
    const payload: Record<string, any> = {
      chat_id: String(chatId),
      text,
      parse_mode: 'Markdown'
    }
    if (replyMarkup) payload.reply_markup = replyMarkup

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!data.ok) {
      // Retry without Markdown formatting in case entity parsing failed
      payload.parse_mode = undefined
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
  } catch (err) {
    console.error('Telegram send error:', err)
  }
}

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
      if (task.status === 'done' || task.status === 'draft') continue
      if (task.reminderSent) continue
      if (task.dueDate && task.dueDate !== todayStr) continue

      const [dueH, dueM] = task.dueTime.split(':').map((n: string) => parseInt(n, 10))
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
        const isRecipientMsg =
          task.description?.includes('📩 Отправить') ||
          task.title?.toLowerCase().includes('отправь') ||
          task.title?.toLowerCase().includes('напиши')

        let stageText = 'СЕЙЧАС'
        if (actualDiffMin > 0) {
          stageText = `за ${actualDiffMin} мин`
        }

        const isGroupTask = task.source && task.source.startsWith('group:')
        const groupHeader = isGroupTask ? '👥 *ГРУППОВОЕ НАПОМИНАНИЕ*\n' : ''

        const text = isRecipientMsg
          ? `📩 *СООБЩЕНИЕ ДЛЯ ПОЛУЧАТЕЛЯ*\n\n` +
            `📌 *Сообщение:* ${task.title}\n` +
            (task.description ? `_«${task.description}»_\n\n` : '\n') +
            `⏰ *Время:* ${task.dueTime}\n` +
            `✨ _Отправлено из Zerf AI_`
          : `${groupHeader}⏰ *НАПОМИНАНИЕ (${stageText.toUpperCase()})!*\n\n` +
            `📌 *${task.title}*\n` +
            (task.description ? `\n${task.description}\n\n` : '\n') +
            `📍 *Срок:* ${task.dueTime}\n` +
            `✨ _Отправлено из Zerf AI_`

        // Check for linked notes
        const linkedNoteIds = (task as any).linkedNoteIds as string[] || []
        let linkedNotesText = ''
        if (linkedNoteIds.length > 0) {
          try {
            const notes = await prisma.note.findMany({
              where: { id: { in: linkedNoteIds } },
              select: { id: true, title: true }
            })
            if (notes.length > 0) {
              linkedNotesText = `\n\n📎 *Связанные заметки:*\n` + notes.map((n: any) => `• ${n.title}`).join('\n')
            }
          } catch {}
        }

        const finalText = text + linkedNotesText
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '✅ Выполнено', callback_data: `rem_done_${task.id}` },
              { text: '⏳ +15 мин', callback_data: `rem_snooze_${task.id}_15` },
              { text: '⏳ +1 час', callback_data: `rem_snooze_${task.id}_60` },
            ]
          ]
        }

        // Collect all recipients: Group chat + Owner + all assignees
        const recipients = new Set<string | number>()
        if (ownerChatId) recipients.add(ownerChatId)

        if (isGroupTask) {
          const gId = task.source!.replace('group:', '').trim()
          if (gId) recipients.add(gId)
        }

        if (Array.isArray(task.assignees)) {
          for (const a of task.assignees) {
            if (a && a !== 'undefined' && a !== 'null') {
              recipients.add(a)
            }
          }
        }

        // Broadcast reminder to all targets
        for (const recipient of Array.from(recipients)) {
          await sendTelegramMessage(recipient, finalText, replyMarkup).catch(() => {})
        }

        const nextSentCount = sentCount + 1
        const isFinal = nextSentCount >= repeatCount || actualDiffMin <= 0

        if (isFinal) {
          await updateTask(task.id, {
            remindersSentCount: nextSentCount,
            reminderSent: true,
            status: 'done',
            completedAt: new Date()
          })
        } else {
          await prisma.task.update({
            where: { id: task.id },
            data: { remindersSentCount: nextSentCount, reminderSent: false }
          })
        }
      }
    }
  } catch (err) {
    console.error('Reminder check error:', err)
  }
}

// ── Morning greeting — 08:00 MSK to all users ────────────────────────────────

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

    // Fire at 09:00 MSK, once per day
    if (hour !== '09' || minute !== '00') return
    if (morningGreetingSentDate === todayStr) return
    morningGreetingSentDate = todayStr

    const chats = await prisma.telegramChat.findMany()
    if (!chats.length) return

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

    for (const chat of chats) {
      try {
        const chatId = Number(chat.chatId)
        const firstName = (chat as { firstName?: string | null }).firstName || 'друг'

        const userTasks = allTasks.filter(t => {
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

// ── Evening Review — 21:00 MSK to all users ──────────────────────────────────

let eveningReviewSentDate = ''

async function runEveningReview() {
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

    // Fire at 21:00 MSK, once per day
    if (hour !== '21' || minute !== '00') return
    if (eveningReviewSentDate === todayStr) return
    eveningReviewSentDate = todayStr

    const chats = await prisma.telegramChat.findMany()
    if (!chats.length) return

    const allTasks = await getAllTasks()

    for (const chat of chats) {
      try {
        const chatId = Number(chat.chatId)
        const firstName = (chat as { firstName?: string | null }).firstName || 'друг'

        const userTasks = allTasks.filter(t => {
          const ownerId = (t as { ownerChatId?: bigint | null }).ownerChatId
          return !ownerId || Number(ownerId) === chatId
        })

        const completedToday = userTasks
          .filter(t => t.status === 'done' && (
            (t.completedAt && new Date(t.completedAt).toISOString().slice(0, 10) === todayStr) ||
            t.dueDate === todayStr
          ))
          .map(t => t.title)

        const pendingToday = userTasks
          .filter(t => t.status !== 'done' && t.status !== 'draft' && (t.dueDate === todayStr || !t.dueDate))
          .map(t => t.title)

        // Only send if the user had activity today or has tasks
        if (completedToday.length === 0 && pendingToday.length === 0) continue

        const reviewText = await generateEveningReview(
          firstName,
          completedToday,
          pendingToday
        ).catch(() => null)

        if (reviewText) {
          const replyMarkup = pendingToday.length > 0 ? {
            inline_keyboard: [
              [{ text: '📅 Перенести оставшиеся на завтра', callback_data: 'postpone_today' }]
            ]
          } : undefined

          await sendTelegramMessage(chatId, reviewText, replyMarkup)
        }

        await new Promise(r => setTimeout(r, 300))
      } catch (userErr) {
        console.error('Evening review error for user:', userErr)
      }
    }

    console.log(`[Zerf Cron] Evening review sent to users at ${todayStr} 21:00 MSK`)
  } catch (err) {
    console.error('Evening review cron error:', err)
  }
}

// ── Focus / Pomodoro Session Tracking ─────────────────────────────────────────

interface FocusSession {
  chatId: number
  expiresAt: number // timestamp ms
  minutes: number
  taskTitle?: string
}

const activeFocusSessions = new Map<number, FocusSession>()

export function startFocusSession(chatId: number, minutes: number, taskTitle?: string) {
  activeFocusSessions.set(chatId, {
    chatId,
    minutes,
    expiresAt: Date.now() + minutes * 60 * 1000,
    taskTitle,
  })
}

export function stopFocusSession(chatId: number): boolean {
  return activeFocusSessions.delete(chatId)
}

export function getFocusSession(chatId: number): FocusSession | undefined {
  return activeFocusSessions.get(chatId)
}

async function runFocusCheck() {
  const now = Date.now()
  for (const [chatId, session] of Array.from(activeFocusSessions.entries())) {
    if (now >= session.expiresAt) {
      activeFocusSessions.delete(chatId)
      const taskMsg = session.taskTitle ? `\n📌 Задача: *${session.taskTitle}*` : ''
      const msg = `🔔 *Время фокус-сессии (${session.minutes} мин) истекло!*\n\n` +
        `🏆 Отличная работа и глубокая концентрация!${taskMsg}\n\n` +
        `☕ Рекомендуем сделать 5-минутный перерыв для отдыха глаз и разминки.`

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '☕ Начать отдых (5 мин)', callback_data: 'start_break_5' },
            { text: '🔥 Новый фокус (25 мин)', callback_data: 'start_focus_25' }
          ]
        ]
      }
      await sendTelegramMessage(chatId, msg, replyMarkup)
    }
  }
}

import {
  postDailyPollToChannel,
  closeDailyPollAndNotifyAdmins,
  postDailyMorningPostToChannel,
  postDailyEveningPostToChannel,
  generateAndSendFridayAiProposal
} from './channel-poster'

let lastChannelPollDate = ''
let lastMorningPostDate = ''
let lastClosePollDate = ''
let lastEveningPostDate = ''
let lastFridayProposalDate = ''

export async function runChannelAndAiCron() {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short',
      hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

    const hour = parseInt(getPart('hour'), 10)
    const day = getPart('weekday').toLowerCase() // 'fri', 'mon', etc.
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    // 1. Friday 09:00 MSK: Weekly Poll on Improvements and New Features
    if (day === 'fri' && hour === 9 && lastChannelPollDate !== todayStr) {
      lastChannelPollDate = todayStr
      postDailyPollToChannel().catch(() => {})
    }

    // 2. Monday-Thursday & Saturday-Sunday 09:00 MSK: Morning News Digest (2 posts/day schedule)
    if (day !== 'fri' && hour === 9 && lastMorningPostDate !== todayStr) {
      lastMorningPostDate = todayStr
      postDailyMorningPostToChannel().catch(() => {})
    }

    // 3. Friday 21:00 MSK (9:00 вечера): Close Weekly Poll & Send Results STRICTLY to Owner & Admins
    if (day === 'fri' && hour === 21 && lastClosePollDate !== todayStr) {
      lastClosePollDate = todayStr
      closeDailyPollAndNotifyAdmins().catch(() => {})
    }

    // 4. Every Day 21:00 MSK: Evening News Digest & Daily Reflection (on Friday it's the 1x news post)
    if (hour === 21 && lastEveningPostDate !== todayStr) {
      lastEveningPostDate = todayStr
      postDailyEveningPostToChannel().catch(() => {})
    }

    // 5. Friday 00:00 MSK: AI Autonomous Feature Evolution Proposal to Admins
    if (day === 'fri' && hour === 0 && lastFridayProposalDate !== todayStr) {
      lastFridayProposalDate = todayStr
      generateAndSendFridayAiProposal().catch(() => {})
    }
  } catch (err) {
    console.error('Channel cron error:', err)
  }
}

// ── Global daemon ─────────────────────────────────────────────────────────────

const globalObj = globalThis as unknown as { __reminderCronStarted?: boolean }

if (!globalObj.__reminderCronStarted) {
  globalObj.__reminderCronStarted = true

  // Reminders & Focus check: every 10 seconds
  setInterval(() => {
    runReminderCheck().catch(() => {})
    runFocusCheck().catch(() => {})
  }, 10_000)

  // Morning greeting check: every 30 seconds (fires at 08:00 MSK)
  setInterval(() => {
    runMorningGreeting().catch(() => {})
  }, 30_000)

  // Evening review check: every 30 seconds (fires at 21:00 MSK)
  setInterval(() => {
    runEveningReview().catch(() => {})
  }, 30_000)

  // Channel posts, polls & Friday AI proposal: every 30 seconds
  setInterval(() => {
    runChannelAndAiCron().catch(() => {})
  }, 30_000)

  console.log('[Zerf Cron] Reminder + Morning Greeting + Evening Review + Channel Daemon started.')
}
