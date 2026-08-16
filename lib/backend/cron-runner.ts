/**
 * Background Cron Runner — Runs every 10 seconds in Node.js process
 *
 * Features:
 * 1. REMINDER: send to ownerChatId only (never broadcast)
 * 2. MORNING GREETING: every day at 08:00 MSK to all registered users
 *    — personalized by their recent tasks + notes via Groq AI
 */

import { getAllTasks, updateTask, getAllNotes, getConfig, setConfig } from './db'
import { generateMorningGreeting, generateEveningReview } from './groq'
import { prisma } from './prisma'
import { sendCommentReportToAdminsTelegram } from './comment-analyzer'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8649326236:AAH0dqSDP4akzWrM-5ncS68wZhlrwZISbxw'

async function sendTelegramMessage(chatId: number | string | bigint, text: string, replyMarkup?: any) {
  let delivered = false
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
    if (data?.ok) {
      delivered = true
    } else {
      // Retry without Markdown formatting in case entity parsing failed
      payload.parse_mode = undefined
      const retryRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const retryData = await retryRes.json()
      if (retryData?.ok) delivered = true
    }
  } catch (err) {
    console.error('Telegram send error:', err)
  }

  // If not delivered to Telegram (e.g. VK user), deliver to VK
  if (!delivered) {
    try {
      const { sendVkMessage } = await import('./vk')
      const cleanText = text
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
      await sendVkMessage(String(chatId), cleanText)
    } catch {}
  }
}

// In-memory guard to prevent duplicate reminders within 2 minutes for the same task
const lastSentReminderTimestampMap = new Map<string, number>()

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

      // Anti-duplicate timestamp guard (minimum 100 seconds between reminder triggers)
      const lastSentMs = lastSentReminderTimestampMap.get(task.id) || 0
      if (Date.now() - lastSentMs < 100_000) continue

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

      // Check if current time matches scheduled stage or catch up missed overdue reminders (within 15m)
      const isWindowMatch = actualDiffMin <= expectedDiffMin && actualDiffMin >= expectedDiffMin - 1
      const isCatchUp = actualDiffMin <= 0 && actualDiffMin >= -15 && sentCount === 0 && !task.reminderSent

      if (isWindowMatch || isCatchUp) {
        lastSentReminderTimestampMap.set(task.id, Date.now())
        const isRecipientMsg =
          task.description?.includes('📩 Отправить') ||
          task.title?.toLowerCase().includes('отправь') ||
          task.title?.toLowerCase().includes('напиши')

        // For delegated tasks (isShared=true), skip the AI-generated description
        // because it was written by the sender and may say "Ване необходимо..." in third person
        const isSharedTask = (task as any).isShared === true
        const authorChatId = (task as any).authorChatId
        const hasDifferentAuthor = authorChatId && ownerChatId && String(authorChatId) !== String(ownerChatId)

        let stageText = 'СЕЙЧАС'
        if (actualDiffMin > 0) {
          stageText = `за ${actualDiffMin} мин`
        }

        const isGroupTask = task.source && task.source.startsWith('group:')
        const groupHeader = isGroupTask ? '👥 *ГРУППОВОЕ НАПОМИНАНИЕ*\n' : ''

        // Build description line: skip for delegated tasks to avoid third-person text
        const descLine = (!isSharedTask || !hasDifferentAuthor) && task.description
          ? `\n${task.description}\n\n`
          : '\n'

        const text = isRecipientMsg
          ? `📩 *СООБЩЕНИЕ ДЛЯ ПОЛУЧАТЕЛЯ*\n\n` +
            `📌 *Сообщение:* ${task.title}\n` +
            (task.description ? `_«${task.description}»_\n\n` : '\n') +
            `⏰ *Время:* ${task.dueTime}\n` +
            `✨ _Отправлено из Zerf AI_`
          : `${groupHeader}⏰ *НАПОМИНАНИЕ (${stageText.toUpperCase()})!*\n\n` +
            `📌 *${task.title}*` +
            descLine +
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

        // SECURITY FIX: Send reminder ONLY to the task owner (ownerChatId).
        // assignees[] = chatId of whoever delegated the task — they must NOT receive
        // reminders about tasks they assigned to someone else.
        // Group chat gets a separate copy only if task came from a group.
        const recipients = new Set<string | number>()
        if (ownerChatId) recipients.add(ownerChatId)

        if (isGroupTask) {
          const gId = task.source!.replace('group:', '').trim()
          if (gId) recipients.add(gId)
        }

        // NEVER add assignees to reminder recipients — assignees are the delegators, not the doers.
        // Only ownerChatId is the person responsible for this task.

        // Broadcast reminder to all targets
        for (const recipient of Array.from(recipients)) {
          await sendTelegramMessage(recipient, finalText, replyMarkup).catch(() => {})
        }

        const nextSentCount = sentCount + 1
        const isFinal = nextSentCount >= repeatCount || actualDiffMin <= 0

        if (isFinal) {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              remindersSentCount: nextSentCount,
              reminderSent: true,
            }
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

// In-memory locks to prevent duplicate executions within the same process / day
let inMemoryMorningGreetingDate: string | null = null
let inMemoryEveningReviewDate: string | null = null
let inMemoryChannelMorningDate: string | null = null
let inMemoryChannelEveningDate: string | null = null
let inMemoryChannelPollDate: string | null = null

// ── Morning greeting — 08:00-12:00 MSK to all users ────────────────────────────

export async function runMorningGreeting() {
  try {
    const now = new Date()
    const mskFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = mskFormatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

    const hour = parseInt(getPart('hour'), 10)
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    // Fire between 08:00 and 13:00 MSK, exactly once per day (persisted in DB)
    if (hour < 8 || hour >= 13) return
    if (inMemoryMorningGreetingDate === todayStr) return

    const lastSent = await getConfig('last_morning_greeting_date')
    if (lastSent === todayStr) {
      inMemoryMorningGreetingDate = todayStr
      return
    }

    inMemoryMorningGreetingDate = todayStr
    await setConfig('last_morning_greeting_date', todayStr)

    const chats = await prisma.telegramChat.findMany()
    if (!chats.length) return

    const seenChatIds = new Set<string>()
    const uniqueChats = chats.filter(c => {
      const idStr = String(c.chatId)
      if (idStr.startsWith('-') || Number(c.chatId) < 0) return false
      if (seenChatIds.has(idStr)) return false
      seenChatIds.add(idStr)
      return true
    })

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

    for (const chat of uniqueChats) {
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

        await new Promise(r => setTimeout(r, 250))
      } catch (userErr) {
        console.error('Morning greeting error for user:', userErr)
      }
    }

    console.log(`[Zerf Cron] Morning greeting sent to ${chats.length} users at ${todayStr} MSK`)
  } catch (err) {
    console.error('Morning greeting cron error:', err)
  }
}

// ── Evening Review — 21:00-23:59 MSK to all users ────────────────────────────

export async function runEveningReview() {
  try {
    const now = new Date()
    const mskFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = mskFormatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

    const hour = parseInt(getPart('hour'), 10)
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    // Fire starting at 20:00 (8 PM) MSK to 23:59 MSK, exactly once per day (persisted in DB)
    if (hour < 20) return
    if (inMemoryEveningReviewDate === todayStr) return

    const lastSent = await getConfig('last_evening_review_date')
    if (lastSent === todayStr) {
      inMemoryEveningReviewDate = todayStr
      return
    }

    inMemoryEveningReviewDate = todayStr
    await setConfig('last_evening_review_date', todayStr)

    const chats = await prisma.telegramChat.findMany()
    if (!chats.length) return

    const seenChatIds = new Set<string>()
    const uniqueChats = chats.filter(c => {
      const idStr = String(c.chatId)
      if (idStr.startsWith('-') || Number(c.chatId) < 0) return false
      if (seenChatIds.has(idStr)) return false
      seenChatIds.add(idStr)
      return true
    })

    const allTasks = await getAllTasks()

    for (const chat of uniqueChats) {
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

        await new Promise(r => setTimeout(r, 250))
      } catch (userErr) {
        console.error('Evening review error for user:', userErr)
      }
    }

    console.log(`[Zerf Cron] Evening review sent to users at ${todayStr} 21:00 MSK`)
  } catch (err) {
    console.error('Evening review cron error:', err)
  }
}

// ── Sunday Weekly Infographic Report — 20:00-23:59 MSK to all users ───────────
let inMemoryWeeklyReportDate: string | null = null

export async function runWeeklySundayReport() {
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
    const day = getPart('weekday').toLowerCase() // 'sun'
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    // Only fire on Sunday starting at 20:00 MSK
    if (day !== 'sun' || hour < 20) return
    if (inMemoryWeeklyReportDate === todayStr) return

    const lastSent = await getConfig('last_weekly_report_date')
    if (lastSent === todayStr) {
      inMemoryWeeklyReportDate = todayStr
      return
    }

    inMemoryWeeklyReportDate = todayStr
    await setConfig('last_weekly_report_date', todayStr)

    const chats = await prisma.telegramChat.findMany()
    if (!chats.length) return

    const seenChatIds = new Set<string>()
    const uniqueChats = chats.filter(c => {
      const idStr = String(c.chatId)
      if (idStr.startsWith('-') || Number(c.chatId) < 0) return false
      if (seenChatIds.has(idStr)) return false
      seenChatIds.add(idStr)
      return true
    })

    const allTasks = await getAllTasks()
    const allGoals = await prisma.goal.findMany()
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    for (const chat of uniqueChats) {
      try {
        const chatId = Number(chat.chatId)

        const userTasks = allTasks.filter(t => {
          const ownerId = (t as { ownerChatId?: bigint | null }).ownerChatId
          return !ownerId || Number(ownerId) === chatId
        })

        const userGoals = allGoals.filter(g => {
          const ownerId = (g as { ownerChatId?: bigint | null }).ownerChatId
          return !ownerId || Number(ownerId) === chatId
        })

        const weekCompleted = userTasks.filter(t => {
          if (t.status !== 'done') return false
          const compDate = t.completedAt ? new Date(t.completedAt) : (t.updatedAt ? new Date(t.updatedAt) : null)
          return compDate && compDate >= oneWeekAgo
        })

        const weekTotal = userTasks.filter(t => {
          const crDate = new Date(t.createdAt)
          return crDate >= oneWeekAgo || t.status === 'todo'
        })

        const completionPct = weekTotal.length > 0 ? Math.round((weekCompleted.length / weekTotal.length) * 100) : 0
        const hoursSaved = (weekCompleted.length * 0.5).toFixed(1)

        // Count completions by day of week
        const dayCounts: Record<string, number> = { 'Пн': 0, 'Вт': 0, 'Ср': 0, 'Чт': 0, 'Пт': 0, 'Сб': 0, 'Вс': 0 }
        const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
        weekCompleted.forEach(t => {
          const d = t.completedAt ? new Date(t.completedAt).getDay() : new Date().getDay()
          const name = dayNames[d] || 'Пн'
          dayCounts[name] = (dayCounts[name] || 0) + 1
        })

        const topDays = Object.entries(dayCounts)
          .sort((a, b) => b[1] - a[1])
          .filter(e => e[1] > 0)
          .slice(0, 2)
          .map(([d, c], i) => `${i === 0 ? '🥇' : '🥈'} ${d}: ${c} ${c === 1 ? 'задача' : 'задачи'}`)
          .join(', ')

        const filled = Math.min(10, Math.max(0, Math.round(completionPct / 10)))
        const progressBar = `[${'▓'.repeat(filled)}${'░'.repeat(10 - filled)}]`

        const reportMsg =
          `📊 *ТВОЙ ИТОГ НЕДЕЛИ В ZERF AI*\n\n` +
          `🏆 *Продуктивность за 7 дней:*\n` +
          `• Закрыто задач: *${weekCompleted.length}* из ${weekTotal.length}\n` +
          `• Эффективность: ${progressBar} *${completionPct}%*\n` +
          `• Сберегли времени: *~${hoursSaved} ч* фокуса\n` +
          `• Стрик дисциплины: *${(chat as any).streakDays || 1}* дн. подряд 🔥\n\n` +
          (topDays ? `📅 *Пик активности:* ${topDays}\n` : '') +
          (userGoals.length > 0 ? `🎯 *Активных целей:* ${userGoals.length}\n` : '') +
          `\n✨ _Отличная работа! Отдохни и спланируй новую неделю в Zerf AI._`

        await sendTelegramMessage(chatId, reportMsg)
        await new Promise(r => setTimeout(r, 200))
      } catch (userErr) {
        console.error('Weekly report error for user:', userErr)
      }
    }
  } catch (err) {
    console.error('Weekly Sunday report cron error:', err)
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

export async function runFocusCheck() {
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

    // 1. Friday 09:00-20:59 MSK: Weekly Poll on Improvements and New Features
    if (day === 'fri' && hour >= 9 && hour < 21) {
      if (inMemoryChannelPollDate !== todayStr) {
        const lastPoll = await getConfig('last_channel_poll_date')
        if (lastPoll !== todayStr) {
          inMemoryChannelPollDate = todayStr
          await setConfig('last_channel_poll_date', todayStr)
          await postDailyPollToChannel()
        } else {
          inMemoryChannelPollDate = todayStr
        }
      }
    }

    // 2. Daily (Mon-Thu, Sat-Sun) 08:00-14:00 MSK: Morning News Digest
    if (day !== 'fri' && hour >= 8 && hour < 14) {
      if (inMemoryChannelMorningDate !== todayStr) {
        const lastPost = await getConfig('last_channel_morning_post_date')
        if (lastPost !== todayStr) {
          inMemoryChannelMorningDate = todayStr
          await setConfig('last_channel_morning_post_date', todayStr)
          await postDailyMorningPostToChannel()
        } else {
          inMemoryChannelMorningDate = todayStr
        }
      }
    }

    // 3. Friday 21:00-23:59 MSK: Close Weekly Poll & Send Results and Comment Sentiment STRICTLY to Owner & Admins
    if (day === 'fri' && hour >= 21) {
      const lastClose = await getConfig('last_channel_close_poll_date')
      if (lastClose !== todayStr) {
        await setConfig('last_channel_close_poll_date', todayStr)
        await closeDailyPollAndNotifyAdmins()
        await sendCommentReportToAdminsTelegram().catch(() => {})
      }
    }

    // 4. Every Day 20:00 (8 PM) - 23:59 MSK: Evening News Digest & Daily Reflection
    if (hour >= 20) {
      if (inMemoryChannelEveningDate !== todayStr) {
        const lastEvening = await getConfig('last_channel_evening_post_date')
        if (lastEvening !== todayStr) {
          const ok = await postDailyEveningPostToChannel()
          if (ok) {
            inMemoryChannelEveningDate = todayStr
            await setConfig('last_channel_evening_post_date', todayStr)
          }
        } else {
          inMemoryChannelEveningDate = todayStr
        }
      }
    }

    // 5. Friday 00:00-07:59 MSK: AI Autonomous Feature Evolution Proposal to Admins
    if (day === 'fri' && hour >= 0 && hour < 8) {
      const lastProp = await getConfig('last_friday_proposal_date')
      if (lastProp !== todayStr) {
        const ok = await generateAndSendFridayAiProposal()
        if (ok) await setConfig('last_friday_proposal_date', todayStr)
      }
    }
  } catch (err) {
    console.error('Channel cron error:', err)
  }
}

/**
 * Main Cron Entrypoint — Called by /api/cron/reminders and webhook updates
 */
export async function runAllCronTasks() {
  await Promise.allSettled([
    runReminderCheck(),
    runFocusCheck(),
    runMorningGreeting(),
    runEveningReview(),
    runWeeklySundayReport(),
    runChannelAndAiCron(),
  ])
}

// ── Global daemon (Node.js runtime) ──────────────────────────────────────────

const globalObj = globalThis as unknown as { __reminderCronStarted?: boolean }

if (!globalObj.__reminderCronStarted) {
  globalObj.__reminderCronStarted = true

  // Reminders & Focus check: every 10 seconds
  setInterval(() => {
    runReminderCheck().catch(() => {})
    runFocusCheck().catch(() => {})
  }, 10_000)

  // Morning greeting check: every 30 seconds
  setInterval(() => {
    runMorningGreeting().catch(() => {})
  }, 30_000)

  // Evening review & Sunday weekly report check: every 30 seconds
  setInterval(() => {
    runEveningReview().catch(() => {})
    runWeeklySundayReport().catch(() => {})
  }, 30_000)

  // Channel posts, polls & Friday AI proposal: every 30 seconds
  setInterval(() => {
    runChannelAndAiCron().catch(() => {})
  }, 30_000)

  console.log('[Zerf Cron] Reminder + Morning Greeting + Evening Review + Sunday Report + Channel Daemon started.')
}
