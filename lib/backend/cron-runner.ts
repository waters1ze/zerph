/**
 * Background Cron Runner — Runs scheduled tasks with strict multi-layer deduplication
 *
 * Features:
 * 1. REMINDER: send to ownerChatId only with strict cooldown
 * 2. MORNING GREETING: once per day per user (08:00-13:00 MSK)
 * 3. EVENING REVIEW: once per day per user (20:00-23:59 MSK)
 * 4. SUNDAY REPORT: once per week on Sunday (20:00-23:59 MSK)
 * 5. CHANNEL DIGESTS & POLLS: once per scheduled day
 */

import { getAllTasks, updateTask, getAllNotes, getConfig, setConfig, getUserUsageAndLimits, parseBirthday } from './db'
import { PLANS, getDailyCount, incrementDailyCount, COUNTERS, isNewsDisabled, planAtLeast } from './plans'
import { generateMorningGreeting, generateEveningReview } from './groq'
import { prisma } from './prisma'
import { sendCommentReportToAdminsTelegram } from './comment-analyzer'
import {
  isCronAlreadyDoneToday,
  markCronDoneToday,
  tryAcquireCronLock,
  isUserCronDoneToday,
  markUserCronDoneToday,
  isReminderInCooldown,
  markReminderSent,
} from './cron-lock'
import {
  postDailyPollToChannel,
  closeDailyPollAndNotifyAdmins,
  postDailyMorningPostToChannel,
  postDailyEveningPostToChannel,
  generateAndSendFridayAiProposal
} from './channel-poster'
import { syncGoogleCalendar } from './google-calendar'
import { sendWebPushNotification } from './web-push'
import { broadcastToUser } from './sse'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

function isTaskForUser(t: any, chatId: number): boolean {
  if (t.ownerChatId && Number(t.ownerChatId) === chatId) return true
  if (Array.isArray(t.assignees) && t.assignees.some((a: any) => String(a) === String(chatId))) return true
  return false
}

function isNoteForUser(n: any, chatId: number): boolean {
  return Boolean(n.ownerChatId && Number(n.ownerChatId) === chatId)
}

function isGoalForUser(g: any, chatId: number): boolean {
  return Boolean(g.ownerChatId && Number(g.ownerChatId) === chatId)
}

async function sendTelegramMessage(chatId: number | string | bigint, text: string, replyMarkup?: any): Promise<boolean> {
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

  // Mirror as Web Push Notification to user's web browsers and devices
  try {
    const clean = text.replace(/[*_`#]/g, '').trim()
    const firstLine = clean.split('\n')[0] || 'Zerf Note'
    const body = clean.split('\n').slice(1).join('\n').trim() || firstLine
    sendWebPushNotification(chatId, {
      title: firstLine,
      body: body,
      url: '/',
    }).catch(() => {})
  } catch {}

  // If not delivered to Telegram (e.g. VK user), deliver to VK
  if (!delivered) {
    try {
      const { sendVkMessage } = await import('./vk')
      const cleanText = text
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
      const vkRes = await sendVkMessage(String(chatId), cleanText)
      if (vkRes) delivered = true
    } catch {}
  }

  return delivered
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

    const currentHour = parseInt(getPart('hour'), 10)
    const currentMin = parseInt(getPart('minute'), 10)
    const currentTotalMin = currentHour * 60 + currentMin
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    const allTasks = await getAllTasks()
    if (!allTasks.length) return

    // Per-run cache of daily reminder quota per owner (free plan: 5/day)
    const reminderQuota = new Map<string, { used: number; max: number }>()
    const getQuota = async (chatId: number): Promise<{ used: number; max: number } | null> => {
      if (!chatId) return null
      const key = String(chatId)
      let q = reminderQuota.get(key)
      if (!q) {
        try {
          const limits = await getUserUsageAndLimits(chatId)
          q = { used: await getDailyCount(COUNTERS.reminder, key), max: PLANS[limits.plan].maxActiveReminders }
        } catch {
          q = { used: 0, max: PLANS.free.maxActiveReminders }
        }
        reminderQuota.set(key, q)
      }
      return q
    }

    for (const task of allTasks) {
      if (task.status === 'done' || task.status === 'draft') continue
      if (task.reminderSent) continue
      if (!task.dueDate || task.dueDate !== todayStr) continue
      if (!task.dueTime) continue

      const [dueHStr, dueMStr] = task.dueTime.split(':')
      const dueH = parseInt(dueHStr, 10)
      const dueM = parseInt(dueMStr, 10)
      if (isNaN(dueH) || isNaN(dueM)) continue

      const taskDueTotalMin = dueH * 60 + dueM
      const actualDiffMin = taskDueTotalMin - currentTotalMin

      const ownerChatId = (task as any).ownerChatId ? Number((task as any).ownerChatId) : null
      let intervalMin = (task as any).reminderIntervalMinutes ?? 5
      let repeatCount = (task as any).reminderRepeatCount ?? 3

      if (intervalMin <= 0) intervalMin = 5
      if (repeatCount <= 0) repeatCount = 3

      const sentCount = (task as any).remindersSentCount || 0
      if (sentCount >= repeatCount) continue

      let shouldFire = false
      let stageKey = 'due'
      let stageHeader = '⏰ ВРЕМЯ НАСТУПИЛО!'
      let stageText = 'прямо сейчас'
      let targetSentCount = sentCount

      // STAGE 1: Advance reminder (e.g. 1 to intervalMin minutes before due time)
      if (actualDiffMin > 0 && actualDiffMin <= intervalMin) {
        if (sentCount === 0 && !isReminderInCooldown(task.id, 'advance', 10 * 60 * 1000)) {
          stageKey = 'advance'
          stageHeader = `⏰ НАПОМИНАНИЕ (ЧЕРЕЗ ${actualDiffMin} МИН)!`
          stageText = `через ${actualDiffMin} мин`
          shouldFire = true
          targetSentCount = 0 // Does not count towards repeat quota
        }
      }
      // STAGE 2: Exact due time reminder (at 00:00 / 0 min remaining or within -1 min)
      else if (actualDiffMin <= 0 && actualDiffMin >= -2) {
        if (sentCount === 0 && !isReminderInCooldown(task.id, 'due', 10 * 60 * 1000)) {
          stageKey = 'due'
          stageHeader = '⏰ ВРЕМЯ НАСТУПИЛО (ПРЯМО СЕЙЧАС)!'
          stageText = 'прямо сейчас'
          shouldFire = true
          targetSentCount = 1
        }
      }
      // STAGE 3: Overdue repeat reminders (after due time, only next unfulfilled repeat r)
      else if (actualDiffMin < -2) {
        const nextRepeatIndex = Math.max(1, sentCount) + 1
        if (nextRepeatIndex <= repeatCount) {
          const expectedPastMin = (nextRepeatIndex - 1) * intervalMin
          if (actualDiffMin <= -expectedPastMin && actualDiffMin >= -(expectedPastMin + intervalMin)) {
            stageKey = `repeat_${nextRepeatIndex - 1}`
            stageHeader = `⏰ НАПОМИНАНИЕ (ПРОСРОЧЕНО НА ${Math.abs(actualDiffMin)} МИН)!`
            stageText = `повтор #${nextRepeatIndex - 1} из ${repeatCount}`
            if (!isReminderInCooldown(task.id, stageKey, (intervalMin - 1) * 60 * 1000)) {
              shouldFire = true
              targetSentCount = nextRepeatIndex
            }
          }
        }
      }

      if (shouldFire) {
        // Daily reminder cap for the task owner (free tier)
        if (ownerChatId) {
          const quota = await getQuota(ownerChatId)
          if (quota && quota.used >= quota.max) {
            continue
          }
        }

        // Strict cooldown per task and distinct stageKey
        markReminderSent(task.id, stageKey as any)

        const isGroupTask = (task as any).source?.startsWith('group:')
        const groupHeader = isGroupTask ? `👥 *Групповая задача*\n\n` : ''
        const descLine = task.description ? `\n📝 ${task.description}\n` : '\n'
        const isQuickNote = task.tags?.includes('заметка') || task.tags?.includes('быстрое')

        const text = isQuickNote
          ? `${groupHeader}💬 *НАПОМИНАНИЕ О ЗАМЕТКЕ!*\n\n` +
            `📌 *Сообщение:* ${task.title}\n` +
            (task.description ? `_«${task.description}»_\n\n` : '\n') +
            `⏰ *Время:* ${task.dueTime}\n` +
            `✨ _Отправлено из Zerf AI_`
          : `${groupHeader}${stageHeader}\n\n` +
            `📌 *${task.title}*` +
            descLine +
            `📍 *Срок:* ${task.dueTime} (${stageText})\n` +
            `✨ _Отправлено из Zerf AI_`

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '✅ Выполнено', callback_data: `rem_done_${task.id}` },
              { text: '⏳ +15 мин', callback_data: `rem_snooze_${task.id}_15` },
              { text: '⏳ +1 час', callback_data: `rem_snooze_${task.id}_60` },
            ]
          ]
        }

        const recipients = new Set<string | number>()
        if (ownerChatId) recipients.add(ownerChatId)

        if (isGroupTask) {
          const gId = (task as any).source!.replace('group:', '').trim()
          if (gId) recipients.add(gId)
        }

        for (const recipient of Array.from(recipients)) {
          // 1. Deliver to Telegram / VK
          await sendTelegramMessage(recipient, text, replyMarkup).catch(() => {})

          // 2. Deliver via Browser Web Push (even if browser tab is closed / mobile screen locked)
          sendWebPushNotification(recipient, {
            title: isQuickNote ? '💬 Напоминание о заметке' : `⏰ ${stageHeader}`,
            body: `${task.title}${task.description ? ` — ${task.description}` : ''} (${task.dueTime})`,
            icon: '/icon-192.png',
            url: `/?task=${task.id}`,
            tag: `rem_${task.id}_${stageKey}`,
          }).catch(() => {})

          // 3. Deliver via real-time SSE stream if client is actively open
          broadcastToUser(recipient, 'reminder', {
            taskId: task.id,
            title: task.title,
            dueTime: task.dueTime,
            stageText,
            timestamp: Date.now(),
          })

          // Count the pushed reminder against the daily quota
          if (ownerChatId) {
            const quota = await getQuota(ownerChatId)
            if (quota) {
              quota.used += 1
              incrementDailyCount(COUNTERS.reminder, String(ownerChatId)).catch(() => {})
            }
          }
        }

        const isFinal = targetSentCount >= repeatCount

        try {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              remindersSentCount: targetSentCount,
              reminderSent: isFinal,
            }
          })
        } catch {}
      }
    }
  } catch (err) {
    console.error('Reminder check error:', err)
  }
}

// ── Morning greeting — 08:00-13:00 MSK to all users ────────────────────────────

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

    if (hour < 8 || hour >= 14) return

    // Global lock check
    const isDone = await isCronAlreadyDoneToday('morning_greeting_global', todayStr)
    if (isDone) return

    // Mark AFTER we know we will actually start sending (not before, to avoid silent failures)
    // We mark it optimistically here to prevent concurrent runs, but catch errors per-user
    await markCronDoneToday('morning_greeting_global', todayStr)

    let chats: any[] = []
    try {
      chats = await prisma.telegramChat.findMany()
    } catch {}
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
    const todayMonthDay = `${getPart('month')}-${getPart('day')}` // e.g. "08-19"

    for (const chat of uniqueChats) {
      try {
        const chatId = Number(chat.chatId)
        if (await isUserCronDoneToday('morning_greeting', chatId, todayStr)) {
          continue
        }

        // Plus+ users can disable news digests
        if (await isNewsDisabled(chatId) && planAtLeast(chat.plan, 'plus')) {
          // Mark as done so we don't retry, but don't send
          await markUserCronDoneToday('morning_greeting', chatId, todayStr)
          continue
        }

        const firstName = (chat as { firstName?: string | null }).firstName || 'друг'

        // Strictly isolate tasks and notes belonging to this user
        const userTasks = allTasks.filter(t => isTaskForUser(t, chatId))
        const userNotes = allNotes.filter(n => isNoteForUser(n, chatId))

        // Detect birthdays happening strictly TODAY
        const todayBirthdays: string[] = []
        if (chat.birthday) {
          const parsedBday = parseBirthday(chat.birthday)
          if (parsedBday) {
            const bMonthDay = `${String(parsedBday.month).padStart(2, '0')}-${String(parsedBday.day).padStart(2, '0')}`
            if (bMonthDay === todayMonthDay) {
              todayBirthdays.push('Твой День рождения сегодня! 🎉')
            }
          }
        }

        // Mutual friend birthdays occurring strictly TODAY
        const friendBdaysToday = userTasks.filter(t =>
          t.dueDate === todayStr &&
          (t.tags?.includes('день рождения') || t.title.startsWith('🎂')) &&
          !t.title.includes('Мой день рождения')
        )
        for (const bt of friendBdaysToday) {
          todayBirthdays.push(bt.title.replace(/^🎂\s*/, ''))
        }

        const isBdayTask = (t: any) =>
          Boolean(t.tags?.includes('день рождения') || t.tags?.includes('мой день рождения') || t.title.startsWith('🎂'))

        // User's regular pending tasks for today (strictly active and scheduled for today)
        const userPending = userTasks
          .filter(t => t.status !== 'done' && t.status !== 'draft' && t.dueDate === todayStr && !isBdayTask(t))
          .map(t => `${t.title}${t.dueTime ? ` (в ${t.dueTime})` : ''}`)

        const greeting = await generateMorningGreeting(
          firstName,
          userPending,
          todayBirthdays
        ).catch(() => null)

        if (greeting) {
          const sent = await sendTelegramMessage(chatId, greeting)
          if (sent) {
            await markUserCronDoneToday('morning_greeting', chatId, todayStr)
          }
        } else {
          // Fallback immediately
          const bdayLine = todayBirthdays.length ? `🎂 *Праздники сегодня:*\n${todayBirthdays.map(b => `▪ ${b}`).join('\n')}\n\n` : ''
          const fallbackGreeting = `✦ *Доброе утро, ${firstName}!*\n\n` +
            `Сегодня ${todayStr}.\n\n` +
            bdayLine +
            (userPending.length
              ? `📋 *На сегодня (${userPending.length}):*\n` + userPending.slice(0, 5).map(t => `▪ ${t}`).join('\n') + `\n\n`
              : `✓ На сегодня задач нет — отличная возможность спланировать день!\n\n`) +
            `_Продуктивного дня! ✦_`
          const sent = await sendTelegramMessage(chatId, fallbackGreeting)
          if (sent) {
            await markUserCronDoneToday('morning_greeting', chatId, todayStr)
          }
        }

        await new Promise(r => setTimeout(r, 300))
      } catch (userErr) {
        console.error('Morning greeting error for user:', userErr)
      }
    }

    console.log(`[Zerf Cron] Morning greeting sent to ${uniqueChats.length} users at ${todayStr} MSK`)
  } catch (err) {
    console.error('Morning greeting cron error:', err)
  }
}

// ── Evening Review — 20:00-23:59 MSK to all users ────────────────────────────

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

    if (hour < 20) return

    // Global lock check: strictly once per day across all lambdas/processes
    const isDone = await isCronAlreadyDoneToday('evening_review_global', todayStr)
    if (isDone) return

    await markCronDoneToday('evening_review_global', todayStr)

    let chats: any[] = []
    try {
      chats = await prisma.telegramChat.findMany()
    } catch {}
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

    const isBdayTask = (t: any) =>
      Boolean(t.tags?.includes('день рождения') || t.tags?.includes('мой день рождения') || t.title.startsWith('🎂'))

    for (const chat of uniqueChats) {
      try {
        const chatId = Number(chat.chatId)

        // Per-user lock check: strictly once per user per day.
        // The lock is marked AFTER a successful send (like morning greeting),
        // so a network failure doesn't silently skip the user for the whole day.
        if (await isUserCronDoneToday('evening_review', chatId, todayStr)) {
          continue
        }

        // Plus+ users can disable news digests
        if (await isNewsDisabled(chatId) && planAtLeast(chat.plan, 'plus')) {
          continue
        }

        const firstName = (chat as { firstName?: string | null }).firstName || 'друг'

        const userTasks = allTasks.filter(t => isTaskForUser(t, chatId) && !isBdayTask(t))

        const completedToday = userTasks
          .filter(t => t.status === 'done' && (
            (t.completedAt && new Date(t.completedAt).toISOString().slice(0, 10) === todayStr) ||
            t.dueDate === todayStr
          ))
          .map(t => t.title)

        const pendingToday = userTasks
          .filter(t => t.status !== 'done' && t.status !== 'draft' && (t.dueDate === todayStr || (!t.dueDate && t.createdAt && new Date(t.createdAt).toISOString().slice(0, 10) === todayStr)))
          .map(t => t.title)

        // Calculate tomorrow MSK date and extract real scheduled tasks for tomorrow
        const tomorrowDate = new Date(new Date(todayStr + 'T12:00:00Z').getTime() + 24 * 60 * 60 * 1000)
        const tomorrowStr = tomorrowDate.toISOString().slice(0, 10)
        const tomorrowTasks = userTasks
          .filter(t => t.status !== 'done' && t.status !== 'draft' && t.dueDate === tomorrowStr)
          .map(t => t.title)

        if (completedToday.length === 0 && pendingToday.length === 0 && tomorrowTasks.length === 0) continue

        const reviewText = await generateEveningReview(
          firstName,
          completedToday,
          pendingToday,
          tomorrowTasks
        ).catch(() => null)

        if (reviewText) {
          const replyMarkup = pendingToday.length > 0 ? {
            inline_keyboard: [
              [{ text: '📅 Перенести оставшиеся на завтра', callback_data: 'postpone_today' }]
            ]
          } : undefined

          await sendTelegramMessage(chatId, reviewText, replyMarkup)
          await markUserCronDoneToday('evening_review', chatId, todayStr)
        }

        await new Promise(r => setTimeout(r, 250))
      } catch (userErr) {
        console.error('Evening review error for user:', userErr)
      }
    }

    console.log(`[Zerf Cron] Evening review sent to users at ${todayStr} MSK`)
  } catch (err) {
    console.error('Evening review cron error:', err)
  }
}

// ── Sunday Weekly Infographic Report — 20:00-23:59 MSK to all users ───────────

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

    if (day !== 'sun' || hour < 20) return

    // Global lock check
    const isDone = await isCronAlreadyDoneToday('weekly_sunday_report', todayStr)
    if (isDone) return

    await markCronDoneToday('weekly_sunday_report', todayStr)

    let chats: any[] = []
    try {
      chats = await prisma.telegramChat.findMany()
    } catch {}
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
    let allGoals: any[] = []
    try {
      allGoals = await prisma.goal.findMany()
    } catch {}
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const isBdayTask = (t: any) =>
      Boolean(t.tags?.includes('день рождения') || t.tags?.includes('мой день рождения') || t.title.startsWith('🎂'))

    for (const chat of uniqueChats) {
      try {
        const chatId = Number(chat.chatId)
        if (await isUserCronDoneToday('weekly_sunday_report', chatId, todayStr)) {
          continue
        }
        await markUserCronDoneToday('weekly_sunday_report', chatId, todayStr)

        const userTasks = allTasks.filter(t => isTaskForUser(t, chatId) && !isBdayTask(t))
        const userGoals = allGoals.filter(g => isGoalForUser(g, chatId))

        const weekCompleted = userTasks.filter(t => {
          if (t.status !== 'done') return false
          const compDate = t.completedAt ? new Date(t.completedAt) : (t.updatedAt ? new Date(t.updatedAt) : null)
          return compDate && compDate >= oneWeekAgo
        })

        // weekTotal must be a superset of weekCompleted, otherwise the
        // completion percentage can exceed 100% (tasks completed this week but
        // created earlier were counted in the numerator but not denominator).
        const weekCompletedIds = new Set(weekCompleted.map(t => t.id))
        const weekTotal = userTasks.filter(t => {
          if (weekCompletedIds.has(t.id)) return true
          const crDate = new Date(t.createdAt)
          return crDate >= oneWeekAgo || t.status === 'todo'
        })

        const completionPct = weekTotal.length > 0 ? Math.min(100, Math.round((weekCompleted.length / weekTotal.length) * 100)) : 0
        const hoursSaved = (weekCompleted.length * 0.5).toFixed(1)

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
  expiresAt: number
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

    // 1. Friday 09:00-20:59 MSK: Weekly Poll on Improvements
    if (day === 'fri' && hour >= 9 && hour < 21) {
      const isDone = await isCronAlreadyDoneToday('channel_poll', todayStr)
      if (!isDone) {
        await postDailyPollToChannel()
      }
    }

    // 2. Daily (Every day Mon-Sun) 08:00-14:00 MSK: Morning News Digest & Daily Groq Model Sync
    if (hour >= 8 && hour < 14) {
      const acquired = await tryAcquireCronLock('channel_morning_post', todayStr)
      if (acquired) {
        const { syncLiveGroqModelsFromGroq } = await import('./groq-pool')
        await Promise.allSettled([
          postDailyMorningPostToChannel(undefined, true),
          syncLiveGroqModelsFromGroq(),
        ])
      }
    }

    // 3. Friday 21:00-23:59 MSK: Close Weekly Poll
    if (day === 'fri' && hour >= 21) {
      const acquired = await tryAcquireCronLock('channel_close_poll', todayStr)
      if (acquired) {
        await closeDailyPollAndNotifyAdmins()
        await sendCommentReportToAdminsTelegram().catch(() => {})
      }
    }

    // 4. Every Day 20:00 (8 PM) - 23:59 MSK: Evening News Digest & Daily Reflection
    if (hour >= 20) {
      const acquired = await tryAcquireCronLock('channel_evening_post', todayStr)
      if (acquired) {
        await postDailyEveningPostToChannel(undefined, true)
      }
    }

    // 5. Friday 00:00-07:59 MSK: AI Autonomous Feature Evolution Proposal to Admins
    if (day === 'fri' && hour >= 0 && hour < 8) {
      const isDone = await isCronAlreadyDoneToday('friday_ai_proposal', todayStr)
      if (!isDone) {
        await markCronDoneToday('friday_ai_proposal', todayStr)
        await generateAndSendFridayAiProposal()
      }
    }
  } catch (err) {
    console.error('Channel cron error:', err)
  }
}

/**
 * Force-send morning greeting to all users regardless of time window or lock state.
 * Used by admin via ?action=force_morning_greeting to recover from missed sends.
 */
export async function runForceMorningGreeting() {
  try {
    const now = new Date()
    const mskFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = mskFormatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    // Reset global lock so runMorningGreeting won't early-exit
    // We do this by directly clearing the DB record
    try {
      await prisma.config.deleteMany({
        where: { key: { startsWith: 'cron_last_morning_greeting_global' } }
      })
    } catch {}

    // Clear per-user locks for today so everyone gets the greeting
    try {
      await prisma.config.deleteMany({
        where: { key: { startsWith: 'cron_morning_greeting_u_' } }
      })
    } catch {}

    // Clear in-memory lock set for morning_greeting keys
    const globalState = globalThis as unknown as { __cronSentKeys?: Set<string> }
    if (globalState.__cronSentKeys) {
      for (const key of Array.from(globalState.__cronSentKeys)) {
        if (key.includes('morning_greeting')) {
          globalState.__cronSentKeys.delete(key)
        }
      }
    }

    console.log(`[Zerf Cron] Force morning greeting triggered for ${todayStr}`)

    // Now fetch all users and send
    let chats: any[] = []
    try { chats = await prisma.telegramChat.findMany() } catch {}
    if (!chats.length) return

    const allTasks = await getAllTasks()
    const allNotes = await getAllNotes()
    const todayMonthDay = `${getPart('month')}-${getPart('day')}` // e.g. "08-19"

    const seenChatIds = new Set<string>()
    for (const chat of chats) {
      try {
        const idStr = String(chat.chatId)
        if (idStr.startsWith('-') || Number(chat.chatId) < 0) continue
        if (seenChatIds.has(idStr)) continue
        seenChatIds.add(idStr)

        const chatId = Number(chat.chatId)
        const firstName = (chat as any).firstName || 'друг'

        const userTasks = allTasks.filter(t => isTaskForUser(t, chatId))
        const userNotes = allNotes.filter(n => isNoteForUser(n, chatId))

        // Detect birthdays happening strictly TODAY
        const todayBirthdays: string[] = []
        if (chat.birthday) {
          const parsedBday = parseBirthday(chat.birthday)
          if (parsedBday) {
            const bMonthDay = `${String(parsedBday.month).padStart(2, '0')}-${String(parsedBday.day).padStart(2, '0')}`
            if (bMonthDay === todayMonthDay) {
              todayBirthdays.push('Твой День рождения сегодня! 🎉')
            }
          }
        }

        const friendBdaysToday = userTasks.filter(t =>
          t.dueDate === todayStr &&
          (t.tags?.includes('день рождения') || t.title.startsWith('🎂')) &&
          !t.title.includes('Мой день рождения')
        )
        for (const bt of friendBdaysToday) {
          todayBirthdays.push(bt.title.replace(/^🎂\s*/, ''))
        }

        const isBdayTask = (t: any) =>
          Boolean(t.tags?.includes('день рождения') || t.tags?.includes('мой день рождения') || t.title.startsWith('🎂'))

        const userPending = userTasks
          .filter(t => t.status !== 'done' && t.status !== 'draft' && t.dueDate === todayStr && !isBdayTask(t))
          .map(t => `${t.title}${t.dueTime ? ` (в ${t.dueTime})` : ''}`)

        const greeting = await generateMorningGreeting(
          firstName,
          userPending,
          todayBirthdays
        ).catch(() => null)

        const bdayLine = todayBirthdays.length ? `🎂 *Праздники сегодня:*\n${todayBirthdays.map(b => `▪ ${b}`).join('\n')}\n\n` : ''
        const text = greeting || (
          `✦ *Доброе утро, ${firstName}!*\n\n` +
          `Сегодня ${todayStr}.\n\n` +
          bdayLine +
          (userPending.length
            ? `📋 *На сегодня (${userPending.length}):*\n` + userPending.slice(0, 5).map(t => `▪ ${t}`).join('\n') + '\n\n'
            : `✓ На сегодня задач нет — отличная возможность спланировать день!\n\n`) +
          `_Продуктивного дня! ✦_`
        )

        await sendTelegramMessage(chatId, text)
        await markUserCronDoneToday('morning_greeting', chatId, todayStr)
        await new Promise(r => setTimeout(r, 300))
      } catch (e) {
        console.error('[Force Morning Greeting] user error:', e)
      }
    }

    await markCronDoneToday('morning_greeting_global', todayStr)
    console.log(`[Zerf Cron] Force morning greeting done — sent to ${seenChatIds.size} users`)
  } catch (err) {
    console.error('[Force Morning Greeting] error:', err)
  }
}

export async function runGoogleCalendarPeriodicSync() {
  try {
    const gcalUsers = await prisma.telegramChat.findMany({
      where: { googleCalendarSync: true },
      select: { chatId: true },
      take: 50,
    })
    for (const u of gcalUsers) {
      await syncGoogleCalendar(u.chatId).catch(() => {})
    }
  } catch {}
}

/**
 * Daily Inactive Accounts Auto-Deletion Check
 * Runs once every 24 hours to delete accounts inactive for > 6 months (or user's selected 1/3/6/12 months).
 */
export async function runInactiveAccountsCleanup() {
  const todayStr = new Date().toISOString().slice(0, 10)
  if (await isCronAlreadyDoneToday('inactive_accounts_cleanup', todayStr)) {
    return
  }
  const lockAcquired = await tryAcquireCronLock('inactive_accounts_cleanup', todayStr)
  if (!lockAcquired) return

  try {
    const { cleanupInactiveAccounts } = await import('./db')
    const result = await cleanupInactiveAccounts()
    if (result.deletedCount > 0) {
      console.log(`[AutoDelete Cron] Cleaned up ${result.deletedCount} inactive account(s) out of ${result.checkedCount} checked.`)
    }
    await markCronDoneToday('inactive_accounts_cleanup', todayStr)
  } catch (err) {
    console.error('[AutoDelete Cron] Error:', err)
  }
}

/**
 * Main Cron Entrypoint — Called by /api/cron/reminders
 */
export async function runAllCronTasks() {
  await Promise.allSettled([
    runReminderCheck(),
    runFocusCheck(),
    runMorningGreeting(),
    runEveningReview(),
    runWeeklySundayReport(),
    runChannelAndAiCron(),
    runGoogleCalendarPeriodicSync(),
    runInactiveAccountsCleanup(),
    (async () => {
      const { getLiveGroqModels } = await import('./groq-pool')
      await getLiveGroqModels().catch(() => {})
    })(),
  ])
}

// Global daemon for continuous Node.js processes (e.g. server/bot.ts)
const globalObj = globalThis as unknown as { __reminderCronStarted?: boolean }

if (process.env.RUN_CRON_DAEMON === 'true' && !globalObj.__reminderCronStarted) {
  globalObj.__reminderCronStarted = true

  setInterval(() => {
    runReminderCheck().catch(() => {})
    runFocusCheck().catch(() => {})
  }, 10_000)

  setInterval(() => {
    runMorningGreeting().catch(() => {})
  }, 30_000)

  setInterval(() => {
    runEveningReview().catch(() => {})
    runWeeklySundayReport().catch(() => {})
    runGoogleCalendarPeriodicSync().catch(() => {})
    import('@/lib/backend/db').then(m => m.compactOldCompletedTasks()).catch(() => {})
  }, 60_000)

  setInterval(() => {
    runChannelAndAiCron().catch(() => {})
  }, 30_000)

  console.log('[Zerf Cron] Dedicated Daemon active.')
}
