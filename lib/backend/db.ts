/**
 * Zerf Backend — Database Layer (Prisma + Neon PostgreSQL)
 * Replaces the old JSON file DB with real persistent cloud storage.
 */

import { prisma } from './prisma'
import { ParsedItem, stringSimilarity, generateReminderContext, extractCleanRecipientAndSharing } from './groq'
import { ROOT_ADMIN_IDS } from './admin'
import { tokenMatchesCandidateName } from './name-aliases'
import { createServerSession } from './auth'
import { PLANS, normalizePlan, planAtLeast, getDailyCount, getLifetimeCount, COUNTERS } from './plans'
import { notifyDataChanged } from './sse'

// ── Type helpers ──────────────────────────────────────────────────────────────

export type DbTask = {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  dueDate: string | null
  dueTime: string | null
  reminderSent: boolean
  tags: string[]
  assignees: string[]
  isShared: boolean
  projectId: string | null
  goalId: string | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  rawText: string | null
  aiGenerated: boolean
  source: string | null
  subtasks: unknown
  ownerChatId: bigint | null  // Telegram chatId of task owner
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getAllTasks(ownerChatId?: number | bigint | string | null) {
  try {
    let allTasks: any[] = []
    
    if (ownerChatId !== undefined && ownerChatId !== null) {
      const num = Number(ownerChatId)
      if (!isNaN(num) && num !== 0) {
        const cid = BigInt(ownerChatId)
        const strId = String(ownerChatId)
        allTasks = await prisma.task.findMany({
          where: {
            status: { not: 'draft' },
            OR: [
              { ownerChatId: cid },
              { authorChatId: cid },
              {
                assignees: { has: strId },
                NOT: { tags: { has: 'день рождения' } }
              }
            ]
          },
          orderBy: { createdAt: 'desc' },
        })
      }
    } else {
      // If no ownerChatId is provided (e.g. cron job), return all tasks
      allTasks = await prisma.task.findMany({
        where: { status: { not: 'draft' } },
        orderBy: { createdAt: 'desc' }
      })
    }

    const strOwnerId = ownerChatId ? String(ownerChatId) : null
    const seenIds = new Set<string>()
    const seenSharedKeys = new Set<string>()
    const uniqueTasks = allTasks.filter(t => {
      if (seenIds.has(t.id)) return false
      seenIds.add(t.id)

      if (isBirthdayTitle(t.title)) {
        // A birthday reminder belongs ONLY to the owner of that task
        if (strOwnerId && t.ownerChatId && String(t.ownerChatId) !== strOwnerId) return false
        const normKey = t.title.replace(/^🎂\s*/, '').trim().toLowerCase()
        if (seenSharedKeys.has(`bday_${normKey}`)) return false
        seenSharedKeys.add(`bday_${normKey}`)
      } else if (t.isShared && t.authorChatId) {
        // Deduplicate identical shared tasks created for author and friend
        const normTitle = t.title.trim().toLowerCase()
        const sharedKey = `shared_${normTitle}_${t.dueDate || ''}_${t.dueTime || ''}_${t.authorChatId}`
        if (seenSharedKeys.has(sharedKey)) return false
        seenSharedKeys.add(sharedKey)
      }
      return true
    })

    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
    const currentTimeStr = `${getPart('hour')}:${getPart('minute')}`

    const autoCompletedIds: string[] = []

    const mappedTasks = uniqueTasks.map(t => {
      let currentStatus = t.status
      let completedAt = t.completedAt

      // Auto-complete tasks whose time range has passed
      if (t.dueTime && currentStatus !== 'done') {
        const parts = t.dueTime.split(/[\s–-]+/)
        if (parts.length >= 2) {
          const endTime = parts[1].trim()
          if (t.dueDate && t.dueDate < todayStr) {
            currentStatus = 'done'
            completedAt = completedAt || now
            autoCompletedIds.push(t.id)
          } else if (t.dueDate === todayStr && currentTimeStr >= endTime) {
            currentStatus = 'done'
            completedAt = completedAt || now
            autoCompletedIds.push(t.id)
          }
        }
      }

      if (isBirthdayTitle(t.title)) {
        return {
          ...t,
          status: currentStatus,
          completedAt,
          title: t.title.startsWith('🎂') ? t.title : `🎂 ${t.title}`,
          dueTime: '00:00',
          repeat: t.repeat || 'yearly',
        }
      } else if (isHolidayTitle(t.title)) {
        return {
          ...t,
          status: currentStatus,
          completedAt,
          title: t.title.startsWith('🎉') ? t.title : `🎉 ${t.title}`,
          dueTime: '00:00',
          repeat: t.repeat || 'yearly',
        }
      } else {
        return {
          ...t,
          status: currentStatus,
          completedAt,
          title: t.title.replace(/^🎂\s*/, ''),
        }
      }
    })

    if (autoCompletedIds.length > 0) {
      prisma.task.updateMany({
        where: { id: { in: autoCompletedIds } },
        data: { status: 'done', completedAt: now },
      }).catch(() => {})
    }

    return mappedTasks
  } catch (err) {
    console.error('getAllTasks error:', err)
    return []
  }
}

export function isBirthdayTitle(title: string | null | undefined): boolean {
  if (!title) return false
  const clean = title.replace(/^🎂\s*/, '').trim()
  // Match "день рождения", "д.р.", "др", but NOT "друзья", "друг", "друзьями", "подарок", etc.
  return /(?:^|[^а-яёa-z0-9])(?:день\s*рождения|д\.?\s*р\.?)(?:[^а-яёa-z0-9]|$)/i.test(clean)
}

export function isHolidayTitle(title: string | null | undefined): boolean {
  if (!title) return false
  const clean = title.replace(/^🎉\s*/, '').trim()
  return /(?:^|[^а-яёa-z0-9])(?:праздник|новый\s*год|день\s*знаний|день\s*победы|день\s*защитника|8\s*марта|рождество|пасха|масленица|день\s*матери|день\s*отца|годовщин\w*)(?:[^а-яёa-z0-9]|$)/i.test(clean)
}

export async function getAllGoals(ownerChatId?: number | bigint | string | null) {
  try {
    if (ownerChatId !== undefined && ownerChatId !== null) {
      const num = Number(ownerChatId)
      if (!isNaN(num) && num !== 0) {
        const cid = BigInt(ownerChatId)
        return await prisma.goal.findMany({
          where: { ownerChatId: cid },
          orderBy: { createdAt: 'desc' },
        })
      }
      return []
    }
    return []
  } catch {
    return []
  }
}

export async function getAllNotes(ownerChatId?: number | bigint | string | null) {
  try {
    if (ownerChatId !== undefined && ownerChatId !== null) {
      const num = Number(ownerChatId)
      if (!isNaN(num) && num !== 0) {
        const cid = BigInt(ownerChatId)
        return await prisma.note.findMany({
          where: { ownerChatId: cid },
          orderBy: { createdAt: 'desc' },
        })
      }
      return []
    }
    return []
  } catch {
    return []
  }
}

export function extractNaturalTime(text: string): string | null {
  if (!text) return null
  const t = text.toLowerCase()

  // 0. Time Range: "с 8 до 15", "с 8:30 до 15:00", "от 8 до 15", "08:00 - 15:00", "с 8 утра до 3 дня"
  const rangeMatch = t.match(/(?:с|от)?\s*(\d{1,2})(?::(\d{2}))?\s*(утра|вечера|дня|ночи)?\s*(?:до|-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(утра|вечера|дня|ночи)?\b/i)
  if (rangeMatch) {
    let h1 = parseInt(rangeMatch[1], 10)
    const m1 = rangeMatch[2] ? rangeMatch[2] : '00'
    const p1 = rangeMatch[3] ? rangeMatch[3].toLowerCase() : ''

    let h2 = parseInt(rangeMatch[4], 10)
    const m2 = rangeMatch[5] ? rangeMatch[5] : '00'
    const p2 = rangeMatch[6] ? rangeMatch[6].toLowerCase() : ''

    if (p1 === 'вечера' || p1 === 'дня') {
      if (h1 < 12) h1 += 12
    }
    if (p2 === 'вечера' || p2 === 'дня') {
      if (h2 < 12) h2 += 12
    } else if (!p2 && h2 < h1 && h2 <= 12) {
      h2 += 12
    }

    if (h1 >= 0 && h1 <= 23 && h2 >= 0 && h2 <= 23) {
      return `${String(h1).padStart(2, '0')}:${m1} - ${String(h2).padStart(2, '0')}:${m2}`
    }
  }

  // 1. Direct HH:MM (e.g. 09:00, 19:30, в 9:00)
  const directMatch = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (directMatch) {
    return `${directMatch[1].padStart(2, '0')}:${directMatch[2]}`
  }

  // 2. "в X утра / вечера / дня / ночи" or "на X утра / вечера" or "к X утра"
  const wordTimeMatch = t.match(/(?:в|на|к|около|до)\s*(\d{1,2})(?::(\d{2}))?\s*(утра|вечера|дня|ночи)?\b/i)
  if (wordTimeMatch) {
    let hours = parseInt(wordTimeMatch[1], 10)
    const minutes = wordTimeMatch[2] ? wordTimeMatch[2] : '00'
    const period = wordTimeMatch[3] ? wordTimeMatch[3].toLowerCase() : ''

    if (period === 'вечера' || period === 'дня') {
      if (hours < 12) hours += 12
    } else if (period === 'ночи') {
      if (hours === 12) hours = 0
    } else if (period === 'утра') {
      if (hours === 12) hours = 0
    }

    if (hours >= 0 && hours <= 23) {
      return `${String(hours).padStart(2, '0')}:${minutes}`
    }
  }

  // 3. Simple "в 9" / "на 9"
  const simpleMatch = t.match(/\b(?:в|на)\s+(\d{1,2})\s*(?:ч|час|часов|утра)?\b/i)
  if (simpleMatch) {
    const hours = parseInt(simpleMatch[1], 10)
    if (hours >= 0 && hours <= 23) {
      return `${String(hours).padStart(2, '0')}:00`
    }
  }

  return null
}

export function sanitizeTaskTitle(rawTitle: string): string {
  if (!rawTitle) return ''
  let clean = rawTitle.trim()
  // Remove parenthesized relative time phrases
  clean = clean.replace(/\s*\(\s*(?:через\s+\d+\s*(?:мин(?:ут[а-я]*)?|ч(?:ас[а-я]*)?)|через\s+полчаса|в\s+\d{1,2}:\d{2}|на\s+\d{1,2}:\d{2})\s*\)/gi, '')
  // Remove trailing unparenthesized relative time phrases
  clean = clean.replace(/\s+(?:через\s+\d+\s*(?:мин(?:ут[а-я]*)?|ч(?:ас[а-я]*)?)|через\s+полчаса)$/gi, '')
  return clean.trim() || rawTitle
}

function processBirthdayTaskData<T extends { title: string; dueTime?: string | null; repeat?: string | null; tags?: string[] }>(data: T): T {
  const isBirthday = isBirthdayTitle(data.title)

  if (isBirthday) {
    let title = sanitizeTaskTitle(data.title).trim()
    if (!title.startsWith('🎂')) {
      title = `🎂 ${title}`
    }
    const tags = data.tags ? [...data.tags] : []
    if (!tags.includes('день рождения')) {
      tags.push('день рождения')
    }
    return {
      ...data,
      title,
      dueTime: '00:00',
      repeat: 'yearly',
      tags,
    }
  } else {
    // If not a birthday, remove accidental 🎂 and "день рождения" tag
    let title = sanitizeTaskTitle(data.title.replace(/^🎂\s*/, '')).trim()
    let tags = data.tags ? data.tags.filter(t => t.toLowerCase() !== 'день рождения') : data.tags
    return {
      ...data,
      title,
      tags,
    }
  }
}

export async function createTask(data: {
  title: string
  description?: string
  priority?: string
  status?: string
  dueDate?: string
  dueTime?: string
  tags?: string[]
  subtasks?: Array<{ id: string; title: string; done: boolean }>
  rawText?: string
  aiGenerated?: boolean
  source?: string
  assignees?: string[]
  isShared?: boolean
  repeat?: string | null
  reminderOffsetMinutes?: number | null
  projectId?: string | null
  parentTaskId?: string | null
  ownerChatId?: number | bigint | string | null   // Telegram chatId of the creator
}) {
  const processed = processBirthdayTaskData(data)

  const created = await prisma.task.create({
    data: {
      title: processed.title,
      description: processed.description || '',
      priority: processed.priority || 'medium',
      status: processed.status || 'todo',
      dueDate: processed.dueDate || null,
      dueTime: processed.dueTime || null,
      repeat: processed.repeat || null,
      reminderOffsetMinutes: processed.reminderOffsetMinutes || 0,
      projectId: processed.projectId || null,
      parentTaskId: processed.parentTaskId || null,
      tags: processed.tags || [],
      assignees: processed.assignees || [],
      isShared: processed.isShared || false,
      subtasks: processed.subtasks || [],
      rawText: processed.rawText || null,
      aiGenerated: processed.aiGenerated || false,
      source: processed.source || null,
      ownerChatId: processed.ownerChatId ? BigInt(processed.ownerChatId) : null,
      authorChatId: (processed as any).authorChatId ? BigInt((processed as any).authorChatId) : (processed.ownerChatId ? BigInt(processed.ownerChatId) : null),
    },
  })

  if (processed.ownerChatId) {
    try { notifyDataChanged(processed.ownerChatId, 'tasks') } catch {}
  }
  if ((processed as any).authorChatId && String((processed as any).authorChatId) !== String(processed.ownerChatId)) {
    try { notifyDataChanged((processed as any).authorChatId, 'tasks') } catch {}
  }

  // Send Web Push notification to the recipient if assigned by another user
  if (processed.ownerChatId && (processed as any).authorChatId && String(processed.ownerChatId) !== String((processed as any).authorChatId)) {
    try {
      const { sendWebPushNotification } = await import('./web-push')
      sendWebPushNotification(processed.ownerChatId, {
        title: '📥 Новая задача от друга',
        body: `Вам поручена новая задача: «${created.title}»`,
        url: '/?view=tasks&tag=inbox',
      }).catch(() => {})
    } catch {}
  }

  return created
}

export function calculateNextRecurrenceDate(currentDueDate: string | null | undefined, repeat: string): string {
  let year: number, month: number, day: number
  if (currentDueDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDueDate)) {
    const parts = currentDueDate.split('-').map(Number)
    year = parts[0]
    month = parts[1] - 1
    day = parts[2]
  } else {
    const now = new Date()
    year = now.getFullYear()
    month = now.getMonth()
    day = now.getDate()
  }

  const nextDate = new Date(Date.UTC(year, month, day, 12, 0, 0))

  if (repeat === 'yearly') {
    nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1)
  } else if (repeat === 'monthly') {
    nextDate.setUTCMonth(nextDate.getUTCMonth() + 1)
  } else if (repeat === 'weekly') {
    nextDate.setUTCDate(nextDate.getUTCDate() + 7)
  } else if (repeat === 'weekdays') {
    const d = nextDate.getUTCDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    if (d === 5) {
      nextDate.setUTCDate(nextDate.getUTCDate() + 3) // Friday -> Monday
    } else if (d === 6) {
      nextDate.setUTCDate(nextDate.getUTCDate() + 2) // Saturday -> Monday
    } else {
      nextDate.setUTCDate(nextDate.getUTCDate() + 1) // Sun-Thu -> next day
    }
  } else if (repeat === 'daily') {
    nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  }

  const nextYearStr = nextDate.getUTCFullYear()
  const nextMonthStr = String(nextDate.getUTCMonth() + 1).padStart(2, '0')
  const nextDayStr = String(nextDate.getUTCDate()).padStart(2, '0')
  return `${nextYearStr}-${nextMonthStr}-${nextDayStr}`
}

export async function notifyAuthorTaskCompleted(task: any) {
  try {
    if (!task || !task.authorChatId || !task.ownerChatId) return
    if (String(task.authorChatId) === String(task.ownerChatId)) return

    const [doer, author] = await Promise.all([
      prisma.telegramChat.findUnique({ where: { chatId: BigInt(task.ownerChatId) } }),
      prisma.telegramChat.findUnique({ where: { chatId: BigInt(task.authorChatId) } }),
    ])

    if (!author) return

    const doerName = doer
      ? [doer.firstName, doer.lastName].filter(Boolean).join(' ') || (doer.username ? `@${doer.username}` : 'Твой друг')
      : 'Твой друг'

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    const authorCidStr = String(task.authorChatId)

    const tags = (task.tags || []).map((x: string) => String(x).toLowerCase())
    const isCommon = tags.includes('общая') || tags.includes('общие') || tags.includes('совместная') || tags.includes('совместно') || tags.includes('совместная задача') || tags.includes('общая задача')
    const isDelegated = tags.includes('поручение') || tags.includes('делегировано') || tags.includes('поручено')

    const taskTypeLabel = (isCommon || !isDelegated) ? 'Общая задача' : 'Порученная задача'

    const msg = `🎉 *${taskTypeLabel} выполнена!*\n\n` +
      `👤 *${doerName}* выполнил(а) задачу:\n` +
      `📌 *«${task.title}»*\n` +
      (task.dueTime ? `⏰ Время: ${task.dueTime}\n` : '') +
      `\n✨ _Уведомление от Zerf AI_`

    let tgSent = false
    if (BOT_TOKEN) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: authorCidStr,
            text: msg,
            parse_mode: 'Markdown',
          }),
        })
        const data = await res.json()
        if (data?.ok) tgSent = true
      } catch {}
    }

    // If author is on VK or TG didn't deliver, notify in VK
    if (!tgSent) {
      try {
        const { sendVkMessage } = await import('./vk')
        const vkMsg = `🎉 ${taskTypeLabel} выполнена!\n\n` +
          `👤 ${doerName} выполнил(а) задачу:\n` +
          `📌 «${task.title}»\n` +
          (task.dueTime ? `⏰ Время: ${task.dueTime}\n` : '') +
          `\n✨ Уведомление от Zerf AI`
        await sendVkMessage(authorCidStr, vkMsg)
      } catch {}
    }
  } catch (err) {
    console.error('Error notifying author of task completion:', err)
  }
}

/**
 * Ownership scope for task mutations. A task is actionable by its owner,
 * author (delegator) or any assignee. When actorChatId is omitted the call is
 * treated as trusted server-side (cron) access.
 */
function taskActorScope(actorChatId?: number | bigint | string | null) {
  if (actorChatId === undefined || actorChatId === null) return undefined
  const str = String(actorChatId).trim()
  if (!/^\d+$/.test(str)) return { ownerChatId: BigInt(-1) }
  try {
    const cid = BigInt(str)
    return { OR: [{ ownerChatId: cid }, { authorChatId: cid }, { assignees: { has: str } }] }
  } catch {
    return { ownerChatId: BigInt(-1) }
  }
}

function ownerActorScope(actorChatId?: number | bigint | string | null) {
  if (actorChatId === undefined || actorChatId === null) return undefined
  const str = String(actorChatId).trim()
  if (!/^\d+$/.test(str)) return { ownerChatId: BigInt(-1) }
  try {
    return { ownerChatId: BigInt(str) }
  } catch {
    return { ownerChatId: BigInt(-1) }
  }
}

export async function updateTask(
  id: string,
  incomingData: Record<string, any>,
  actorChatId?: number | bigint | string | null
) {
  const scope = taskActorScope(actorChatId)
  const existing = scope
    ? await prisma.task.findFirst({ where: { id, ...scope } })
    : await prisma.task.findUnique({ where: { id } })

  if (!existing) {
    throw new Error('Task not found or access denied')
  }

  // Sanitize and whitelist only valid Prisma Task fields
  const cleanData: any = {}
  if (incomingData.title !== undefined) cleanData.title = sanitizeTaskTitle(String(incomingData.title))
  if (incomingData.description !== undefined) cleanData.description = incomingData.description || null
  if (incomingData.status !== undefined) cleanData.status = String(incomingData.status)
  if (incomingData.priority !== undefined) cleanData.priority = String(incomingData.priority)
  if (incomingData.dueDate !== undefined) cleanData.dueDate = incomingData.dueDate || null
  if (incomingData.dueTime !== undefined) cleanData.dueTime = incomingData.dueTime || null
  if (incomingData.parentTaskId !== undefined) cleanData.parentTaskId = incomingData.parentTaskId || null
  if (incomingData.projectId !== undefined) cleanData.projectId = incomingData.projectId || null
  if (incomingData.goalId !== undefined) cleanData.goalId = incomingData.goalId || null
  if (incomingData.habitId !== undefined) cleanData.habitId = incomingData.habitId || null
  if (incomingData.isShared !== undefined) cleanData.isShared = Boolean(incomingData.isShared)
  if (incomingData.visibility !== undefined) cleanData.visibility = String(incomingData.visibility)
  if (Array.isArray(incomingData.assignees)) cleanData.assignees = incomingData.assignees
  if (Array.isArray(incomingData.tags)) cleanData.tags = incomingData.tags
  if (incomingData.subtasks !== undefined) cleanData.subtasks = incomingData.subtasks
  if (incomingData.reminderSent !== undefined) cleanData.reminderSent = Boolean(incomingData.reminderSent)
  if (incomingData.remindersSentCount !== undefined) cleanData.remindersSentCount = Number(incomingData.remindersSentCount)
  if (incomingData.completedAt !== undefined) cleanData.completedAt = incomingData.completedAt ? new Date(incomingData.completedAt) : null
  if (incomingData.repeat !== undefined) cleanData.repeat = incomingData.repeat || null
  if (incomingData.reminderOffsetMinutes !== undefined) cleanData.reminderOffsetMinutes = Number(incomingData.reminderOffsetMinutes)
  if (Array.isArray(incomingData.linkedNoteIds)) cleanData.linkedNoteIds = incomingData.linkedNoteIds
  if (incomingData.completedBy !== undefined) cleanData.completedBy = incomingData.completedBy || null

  if (cleanData.status === 'done') {
    if (existing.status !== 'done') {
      cleanData.completedAt = cleanData.completedAt || new Date()
      cleanData.reminderSent = true
      if (existing.repeat) {
        const nextDateStr = calculateNextRecurrenceDate(existing.dueDate, existing.repeat)
        await prisma.task.create({
          data: {
            title: existing.title,
            description: existing.description,
            priority: existing.priority,
            status: 'todo',
            dueDate: nextDateStr,
            dueTime: existing.dueTime,
            repeat: existing.repeat,
            reminderOffsetMinutes: existing.reminderOffsetMinutes,
            tags: existing.tags,
            assignees: existing.assignees,
            isShared: existing.isShared,
            ownerChatId: existing.ownerChatId,
            authorChatId: existing.authorChatId,
            projectId: existing.projectId,
          },
        })
        cleanData.repeat = null
      }
      if (existing.ownerChatId) {
        recordTaskCompletionStreak(existing.ownerChatId).catch(() => {})
      }
      if (existing.authorChatId && existing.ownerChatId && String(existing.authorChatId) !== String(existing.ownerChatId)) {
        notifyAuthorTaskCompleted(existing).catch(() => {})
      }
    }
  } else if (cleanData.status && cleanData.status !== 'done' && existing.status === 'done') {
    cleanData.completedAt = null
  }

  const updated = await prisma.task.update({ where: { id }, data: cleanData })
  if (updated.ownerChatId) {
    try { notifyDataChanged(updated.ownerChatId, 'tasks') } catch {}
  }
  if (updated.authorChatId && String(updated.authorChatId) !== String(updated.ownerChatId)) {
    try { notifyDataChanged(updated.authorChatId, 'tasks') } catch {}
  }
  return updated
}

export async function completeTask(id: string, actorChatId?: number | bigint | string | null) {
  return updateTask(id, {
    status: 'done',
    completedAt: new Date(),
    reminderSent: true,
  }, actorChatId)
}

export async function recordTaskCompletionStreak(
  ownerChatId?: number | bigint | string | null
): Promise<{ streakDays: number; earnedReward: boolean }> {
  if (!ownerChatId) return { streakDays: 0, earnedReward: false }
  try {
    const cid = BigInt(ownerChatId)
    const { mskDate } = getMskDateTime()
    // "Yesterday" must be computed in MSK too, otherwise the streak breaks
    // between 00:00–03:00 MSK when UTC is still on the previous day
    const mskFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const yesterday = mskFormatter.format(new Date(Date.now() - 24 * 60 * 60 * 1000))

    const chat = await prisma.telegramChat.findUnique({ where: { chatId: cid } })
    if (!chat) return { streakDays: 1, earnedReward: false }

    if (chat.lastStreakDate === mskDate) {
      return { streakDays: chat.streakDays, earnedReward: false }
    }

    let nextStreak = 1
    if (chat.lastStreakDate === yesterday) {
      nextStreak = (chat.streakDays || 0) + 1
    } else {
      nextStreak = 1
    }

    let earnedReward = false
    const updateData: any = {
      streakDays: nextStreak,
      lastStreakDate: mskDate,
    }

    // Reward: Every 14 days of consecutive streak: grant +1 day free Premium!
    if (nextStreak > 0 && nextStreak % 14 === 0) {
      earnedReward = true
      const now = new Date()
      const baseExpiry = chat.subscriptionExpiry && new Date(chat.subscriptionExpiry) > now
        ? new Date(chat.subscriptionExpiry)
        : now
      updateData.plan = 'premium'
      updateData.subscriptionExpiry = new Date(baseExpiry.getTime() + 24 * 60 * 60 * 1000)
    }

    await prisma.telegramChat.update({
      where: { chatId: cid },
      data: updateData,
    })

    return { streakDays: nextStreak, earnedReward }
  } catch (err) {
    console.error('Streak record error:', err)
    return { streakDays: 1, earnedReward: false }
  }
}

export async function getUserProductivityStats(ownerChatId: number | bigint | string) {
  const cid = BigInt(ownerChatId)
  const allTasks = await prisma.task.findMany({
    where: {
      ownerChatId: cid,
      status: { not: 'draft' },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter(t => t.status === 'done')
  const completedCount = completedTasks.length
  const pendingCount = totalTasks - completedCount
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

  const tagCounts: Record<string, number> = {}
  allTasks.forEach(t => {
    if (Array.isArray(t.tags) && t.tags.length > 0) {
      t.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    } else {
      tagCounts['Общее'] = (tagCounts['Общее'] || 0) + 1
    }
  })

  const completedDates = new Set<string>()
  completedTasks.forEach(t => {
    if (t.completedAt) {
      completedDates.add(new Date(t.completedAt).toISOString().slice(0, 10))
    } else if (t.dueDate) {
      completedDates.add(t.dueDate)
    }
  })

  let streak = 0
  const now = new Date()
  for (let d = 0; d < 30; d++) {
    const checkDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    if (completedDates.has(checkDate)) {
      streak++
    } else if (d > 0) {
      break
    }
  }

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  const weekActivity: Record<string, number> = { 'Пн': 0, 'Вт': 0, 'Ср': 0, 'Чт': 0, 'Пт': 0, 'Сб': 0, 'Вс': 0 }

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  completedTasks.forEach(t => {
    if (t.completedAt && new Date(t.completedAt) >= sevenDaysAgo) {
      const dayIdx = (new Date(t.completedAt).getDay() + 6) % 7
      const dayName = weekDays[dayIdx]
      if (dayName) weekActivity[dayName] = (weekActivity[dayName] || 0) + 1
    }
  })

  return {
    totalTasks,
    completedCount,
    pendingCount,
    completionRate,
    streak,
    tagCounts,
    weekActivity,
  }
}

export async function deleteTask(id: string, actorChatId?: number | bigint | string | null) {
  try {
    const scope = taskActorScope(actorChatId)
    const res = await prisma.task.deleteMany({ where: scope ? { id, ...scope } : { id } })
    if (res.count > 0) {
      // Delete any subtasks
      await prisma.task.deleteMany({ where: { parentTaskId: id } }).catch(() => {})
      if (actorChatId) {
        try { notifyDataChanged(actorChatId, 'tasks') } catch {}
      }
    }
    return res
  } catch (err) {
    console.error('deleteTask error:', err)
    return { count: 0 }
  }
}

// ── Habits ────────────────────────────────────────────────────────────────────

export async function getAllHabits(ownerChatId?: number | bigint | string | null) {
  try {
    if (!ownerChatId) return []
    const cid = BigInt(ownerChatId)
    return await prisma.habit.findMany({
      where: { ownerChatId: cid },
      orderBy: { createdAt: 'desc' },
    })
  } catch (err) {
    console.error('getAllHabits error:', err)
    return []
  }
}

export async function createHabit(data: {
  title: string
  icon?: string
  frequency?: string
  ownerChatId?: number | bigint | string | null
}) {
  const habit = await prisma.habit.create({
    data: {
      title: data.title,
      icon: data.icon,
      frequency: data.frequency || 'daily',
      ownerChatId: data.ownerChatId ? BigInt(data.ownerChatId) : null,
    },
  })
  if (data.ownerChatId) {
    try { notifyDataChanged(data.ownerChatId, 'habits') } catch {}
  }
  return habit
}

export async function updateHabit(id: string, data: Partial<{
  title: string
  icon: string
  streak: number
  lastCompletedAt: string | null
  frequency: string
}>, actorChatId?: number | bigint | string | null) {
  const scope = ownerActorScope(actorChatId)
  const existing = scope
    ? await prisma.habit.findFirst({ where: { id, ...scope } })
    : await prisma.habit.findUnique({ where: { id } })
  if (!existing) throw new Error('Habit not found or access denied')
  // Whitelist fields to prevent mass assignment (e.g. ownerChatId from client body)
  const clean: Record<string, unknown> = {}
  if (data.title !== undefined) clean.title = String(data.title)
  if (data.icon !== undefined) clean.icon = data.icon || null
  if (data.streak !== undefined) clean.streak = Math.max(0, Number(data.streak) || 0)
  if (data.lastCompletedAt !== undefined) clean.lastCompletedAt = data.lastCompletedAt || null
  if (data.frequency !== undefined) clean.frequency = String(data.frequency)
  const updated = await prisma.habit.update({ where: { id }, data: clean })
  if (updated.ownerChatId) {
    try { notifyDataChanged(updated.ownerChatId, 'habits') } catch {}
  }
  return updated
}

export async function deleteHabit(id: string, actorChatId?: number | bigint | string | null) {
  try {
    const scope = ownerActorScope(actorChatId)
    const res = await prisma.habit.deleteMany({ where: scope ? { id, ...scope } : { id } })
    if (res.count > 0 && actorChatId) {
      try { notifyDataChanged(actorChatId, 'habits') } catch {}
    }
    return res
  } catch (err) {
    console.error('deleteHabit error:', err)
    return { count: 0 }
  }
}

/**
 * Find the best matching non-done task by title similarity
 */
export async function completeTaskByTitle(targetTitle: string, ownerChatId?: number | bigint | string | null): Promise<DbTask | null> {
  if (!ownerChatId) return null
  const cid = BigInt(ownerChatId)
  const whereClause: Record<string, unknown> = {
    status: { notIn: ['done', 'draft'] },
    OR: [{ ownerChatId: cid }, { authorChatId: cid }, { assignees: { has: String(ownerChatId) } }],
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
  })

  let best: { task: DbTask; score: number } | null = null
  for (const task of tasks) {
    const score = stringSimilarity(targetTitle, task.title)
    if (score >= 0.7 && (!best || score > best.score)) {
      best = { task: task as DbTask, score }
    }
  }

  if (!best) return null

  // Delegate to updateTask so recurring instances are recreated, streaks are
  // recorded and delegators get notified — same behavior as manual completion
  const updated = await updateTask(best.task.id, { status: 'done' }, ownerChatId)
  return updated as DbTask
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function createGoal(data: {
  title: string
  description?: string
  motivation?: string
  deadline?: string
  milestones?: object[]
  color?: string
  ownerChatId?: number | bigint | string | null
}) {
  const goal = await prisma.goal.create({
    data: {
      title: data.title,
      description: data.description || '',
      motivation: data.motivation || null,
      status: 'on_track',
      deadline: data.deadline || null,
      progress: 0,
      color: data.color || '#2d7a4f',
      milestones: data.milestones || [],
      ownerChatId: data.ownerChatId ? BigInt(data.ownerChatId) : null,
    },
  })
  if (data.ownerChatId) {
    try { notifyDataChanged(data.ownerChatId, 'goals') } catch {}
  }
  return goal
}

/** Whitelisted, type-safe goal fields — prevents mass assignment (e.g. ownerChatId). */
export async function updateGoal(
  id: string,
  data: Partial<{
    title: string
    description: string | null
    motivation: string | null
    status: string
    deadline: string | null
    progress: number
    color: string
    milestones: object[]
    visibility: string
  }>,
  actorChatId?: number | bigint | string | null
) {
  const scope = ownerActorScope(actorChatId)
  const existing = scope
    ? await prisma.goal.findFirst({ where: { id, ...scope } })
    : await prisma.goal.findUnique({ where: { id } })
  if (!existing) throw new Error('Goal not found or access denied')
  // Whitelist fields to prevent mass assignment (e.g. ownerChatId from client body)
  const clean: Record<string, unknown> = {}
  if (data.title !== undefined) clean.title = String(data.title)
  if (data.description !== undefined) clean.description = data.description || null
  if (data.motivation !== undefined) clean.motivation = data.motivation || null
  if (data.status !== undefined) clean.status = String(data.status)
  if (data.deadline !== undefined) clean.deadline = data.deadline || null
  if (data.progress !== undefined) clean.progress = Math.max(0, Math.min(100, Number(data.progress) || 0))
  if (data.color !== undefined) clean.color = String(data.color)
  if (Array.isArray(data.milestones)) clean.milestones = data.milestones
  if (data.visibility !== undefined) clean.visibility = String(data.visibility)
  const updated = await prisma.goal.update({ where: { id }, data: clean })
  if (updated.ownerChatId) {
    try { notifyDataChanged(updated.ownerChatId, 'goals') } catch {}
  }
  return updated
}

export async function deleteGoal(id: string, actorChatId?: number | bigint | string | null) {
  try {
    const scope = ownerActorScope(actorChatId)
    const res = await prisma.goal.deleteMany({ where: scope ? { id, ...scope } : { id } })
    if (res.count > 0 && actorChatId) {
      try { notifyDataChanged(actorChatId, 'goals') } catch {}
    }
    return res
  } catch (err) {
    console.error('deleteGoal error:', err)
    return { count: 0 }
  }
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function createNote(data: {
  title: string
  content: string
  originalText?: string
  type?: string
  tags?: string[]
  dueDate?: string | null
  dueTime?: string | null
  aiGenerated?: boolean
  folder?: string | null
  ownerChatId?: number | bigint | string | null
}) {
  const note = await prisma.note.create({
    data: {
      title: data.title,
      content: data.content,
      originalText: data.originalText || null,
      type: data.type || 'note',
      tags: data.tags || [],
      dueDate: data.dueDate || null,
      dueTime: data.dueTime || null,
      aiGenerated: data.aiGenerated || false,
      folder: data.folder || 'Общее',
      ownerChatId: data.ownerChatId ? BigInt(data.ownerChatId) : null,
    },
  })

  if (data.ownerChatId) {
    await incrementUserUsage(data.ownerChatId, 'note').catch(() => {})
    try { notifyDataChanged(data.ownerChatId, 'notes') } catch {}
  }

  return note
}

export async function updateNote(id: string, data: Partial<{
  title: string
  content: string
  type: string
  tags: string[]
  dueDate: string | null
  dueTime: string | null
  pinned: boolean
  folder: string | null
}>, actorChatId?: number | bigint | string | null) {
  const scope = ownerActorScope(actorChatId)
  const existing = scope
    ? await prisma.note.findFirst({ where: { id, ...scope } })
    : await prisma.note.findUnique({ where: { id } })
  if (!existing) throw new Error('Note not found or access denied')
  // Whitelist fields to prevent mass assignment (e.g. ownerChatId from client body)
  const clean: Record<string, unknown> = {}
  if (data.title !== undefined) clean.title = String(data.title)
  if (data.content !== undefined) clean.content = String(data.content)
  if (data.type !== undefined) clean.type = String(data.type)
  if (Array.isArray(data.tags)) clean.tags = data.tags
  if (data.dueDate !== undefined) clean.dueDate = data.dueDate || null
  if (data.dueTime !== undefined) clean.dueTime = data.dueTime || null
  if (data.pinned !== undefined) clean.pinned = Boolean(data.pinned)
  if (data.folder !== undefined) clean.folder = data.folder || null
  const updated = await prisma.note.update({ where: { id }, data: clean })
  if (updated.ownerChatId) {
    try { notifyDataChanged(updated.ownerChatId, 'notes') } catch {}
  }
  return updated
}

export async function deleteNote(id: string, actorChatId?: number | bigint | string | null) {
  try {
    const scope = ownerActorScope(actorChatId)
    const res = await prisma.note.deleteMany({ where: scope ? { id, ...scope } : { id } })
    if (res.count > 0 && actorChatId) {
      try { notifyDataChanged(actorChatId, 'notes') } catch {}
    }
    return res
  } catch (err) {
    console.error('deleteNote error:', err)
    return { count: 0 }
  }
}

// ── Telegram Chat IDs ─────────────────────────────────────────────────────────

export async function registerChatId(
  chatId: number | bigint,
  firstName?: string,
  username?: string,
  lastName?: string
): Promise<{ isNewUser: boolean }> {
  try {
    const cid = BigInt(chatId)
    // Ignore Telegram system notification service (777000) and Anonymous Group Bot (1087968824)
    if (cid === BigInt(777000) || cid === BigInt(1087968824)) {
      return { isNewUser: false }
    }

    const existing = await prisma.telegramChat.findUnique({ where: { chatId: cid } })

    // If no existing record and no name/username given, do not register blank phantom user
    if (!existing && !firstName && !username && !lastName) {
      return { isNewUser: false }
    }

    if (existing) {
      // Preserve custom user firstName and lastName; only update username or fill empty names
      const updateData: { firstName?: string; username?: string; lastName?: string } = {}
      if (username && username !== existing.username) updateData.username = username
      if (!existing.firstName && firstName) updateData.firstName = firstName
      if (!existing.lastName && lastName) updateData.lastName = lastName

      if (Object.keys(updateData).length > 0) {
        await prisma.telegramChat.update({
          where: { chatId: cid },
          data: updateData,
        })
      }
      return { isNewUser: false }
    }

    // New user: grant 1-day free trial Premium!
    const oneDayTrialExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.telegramChat.create({
      data: {
        chatId: cid,
        firstName: firstName || null,
        lastName: lastName || null,
        username: username || null,
        plan: 'premium',
        subscriptionExpiry: oneDayTrialExpiry,
      },
    })
    return { isNewUser: true }
  } catch {
    return { isNewUser: false }
  }
}

export async function checkGroupOrUserHasPremium(
  senderChatId: number | bigint,
  groupChatId?: number | bigint,
  memberChatIds: (number | bigint)[] = []
): Promise<{ hasPremium: boolean; premiumPayerId?: bigint }> {
  try {
    const idsToCheck = [senderChatId, ...memberChatIds].filter(Boolean).map(id => BigInt(id))

    for (const cid of idsToCheck) {
      if (ROOT_ADMIN_IDS.includes(String(cid))) {
        return { hasPremium: true, premiumPayerId: cid }
      }
      const limits = await getUserUsageAndLimits(cid)
      if (planAtLeast(limits.plan, 'plus')) {
        return { hasPremium: true, premiumPayerId: cid }
      }
    }
    // No premium among sender/group members -> locked.
    // (Previously this fell back to "any premium user in the whole DB unlocks
    // the feature for everyone", which bypassed the paywall entirely.)
  } catch {}
  return { hasPremium: false }
}

/**
 * Deduct usage for group requests:
 * 1. If Root Admin is in the group -> 100% deducted from Admin (infinite limits, members are untouched)
 * 2. If Owner is NOT in the group -> divided and deducted evenly among all active Premium members in the group
 * 3. If no Premium members -> distributed evenly among registered members
 */
export async function deductGroupUsage(
  senderChatId: number | bigint | string,
  groupChatId?: number | bigint | string,
  memberChatIds: (number | bigint | string)[] = [],
  type: 'voice' | 'note' | 'chat' = 'voice',
  durationSeconds: number = 15
): Promise<{ payerId: bigint; distributedCount: number; isOwner: boolean }> {
  try {
    const rawIds = [senderChatId, ...memberChatIds].filter(Boolean)
    const uniqueIds = Array.from(new Set(rawIds.map(id => String(id).trim()))).filter(id => !id.startsWith('-'))

    // 1. Check if Root Admin / Owner is in group
    const ownerId = uniqueIds.find(id => ROOT_ADMIN_IDS.includes(id))
    if (ownerId) {
      await incrementUserUsage(ownerId, type, durationSeconds)
      return { payerId: BigInt(ownerId), distributedCount: 1, isOwner: true }
    }

    // 2. Find Premium members
    const premiumMembers: string[] = []
    const freeMembers: string[] = []

    for (const idStr of uniqueIds) {
      try {
        const limits = await getUserUsageAndLimits(idStr)
        if (planAtLeast(limits.plan, 'plus')) {
          premiumMembers.push(idStr)
        } else {
          freeMembers.push(idStr)
        }
      } catch {}
    }

    if (premiumMembers.length > 0) {
      const perUserSec = Math.max(1, Math.ceil(durationSeconds / premiumMembers.length))
      for (const pId of premiumMembers) {
        await incrementUserUsage(pId, type, perUserSec)
      }
      return { payerId: BigInt(premiumMembers[0]), distributedCount: premiumMembers.length, isOwner: false }
    }

    // 3. Fallback to free members
    const targetGroup = freeMembers.length > 0 ? freeMembers : [String(senderChatId)]
    const perUserSec = Math.max(1, Math.ceil(durationSeconds / targetGroup.length))
    for (const fId of targetGroup) {
      await incrementUserUsage(fId, type, perUserSec)
    }
    return { payerId: BigInt(targetGroup[0]), distributedCount: targetGroup.length, isOwner: false }
  } catch (err) {
    console.error('deductGroupUsage error:', err)
    await incrementUserUsage(senderChatId, type, durationSeconds).catch(() => {})
    return { payerId: BigInt(senderChatId), distributedCount: 1, isOwner: false }
  }
}

export async function autoAddFriends(chatId1: number | bigint, chatId2: number | bigint) {
  if (chatId1 === chatId2) return
  const c1 = BigInt(chatId1)
  const c2 = BigInt(chatId2)

  try {
    await prisma.friendship.upsert({
      where: { userChatId_friendChatId: { userChatId: c1, friendChatId: c2 } },
      update: { status: 'accepted' },
      create: { userChatId: c1, friendChatId: c2, status: 'accepted' }
    })
    await prisma.friendship.upsert({
      where: { userChatId_friendChatId: { userChatId: c2, friendChatId: c1 } },
      update: { status: 'accepted' },
      create: { userChatId: c2, friendChatId: c1, status: 'accepted' }
    })
    await syncFriendBirthdays(c1).catch(() => {})
    await syncFriendBirthdays(c2).catch(() => {})
  } catch {}
}

export interface FriendScheduleSlot {
  id: string
  title: string
  dueTime: string | null
  isPrivate: boolean
  priority?: string
  status: string
}

export interface FriendDaySchedule {
  date: string
  dateLabel: string
  slots: FriendScheduleSlot[]
  busySummary: string
  freeWindows: string[]
}

export interface FriendScheduleResult {
  allowed: boolean
  isFriend: boolean
  allowTasks: boolean
  reason?: 'ok' | 'not_friend' | 'tasks_disallowed' | 'not_found'
  friend: {
    chatId: string
    name: string
    username: string | null
  }
  daysCount: number
  days: FriendDaySchedule[]
  date: string
  slots: FriendScheduleSlot[]
  busySummary: string
  freeWindows: string[]
}

export async function getFriendSchedule(
  viewerChatId: number | bigint | string,
  targetFriendChatId: number | bigint | string,
  dateStr?: string,
  daysCount: number = 1
): Promise<FriendScheduleResult | null> {
  const vCid = BigInt(viewerChatId)
  const tCid = BigInt(targetFriendChatId)

  const friendUser = await prisma.telegramChat.findUnique({
    where: { chatId: tCid }
  })
  if (!friendUser) return null

  const friendName = [friendUser.firstName, friendUser.lastName].filter(Boolean).join(' ') || friendUser.firstName || friendUser.username || 'Друг'

  // 1. Verify friendship and permission
  // IMPORTANT: To view Target's schedule, TARGET (tCid) MUST HAVE GIVEN PERMISSION TO VIEWER (vCid).
  const isSelf = vCid === tCid
  let isFriend = isSelf
  let allowsTasks = isSelf

  if (!isSelf) {
    const friendToViewer = await prisma.friendship.findUnique({
      where: {
        userChatId_friendChatId: {
          userChatId: tCid,
          friendChatId: vCid,
        }
      }
    })

    const viewerToFriend = await prisma.friendship.findUnique({
      where: {
        userChatId_friendChatId: {
          userChatId: vCid,
          friendChatId: tCid,
        }
      }
    })

    isFriend = (friendToViewer?.status === 'accepted') || (viewerToFriend?.status === 'accepted')
    // Target friend MUST have accepted and explicitly enabled allowTasks for the viewer
    allowsTasks = Boolean(friendToViewer && friendToViewer.status === 'accepted' && friendToViewer.allowTasks === true)
  }

  if (!isFriend) {
    return {
      allowed: false,
      isFriend: false,
      allowTasks: false,
      reason: 'not_friend',
      friend: {
        chatId: String(friendUser.chatId),
        name: friendName,
        username: friendUser.username ? `@${friendUser.username.replace(/^@/, '')}` : null,
      },
      daysCount: 1,
      days: [],
      date: dateStr || new Date().toISOString().slice(0, 10),
      slots: [],
      busySummary: 'Не в команде',
      freeWindows: []
    }
  }

  if (!allowsTasks) {
    return {
      allowed: false,
      isFriend: true,
      allowTasks: false,
      reason: 'tasks_disallowed',
      friend: {
        chatId: String(friendUser.chatId),
        name: friendName,
        username: friendUser.username ? `@${friendUser.username.replace(/^@/, '')}` : null,
      },
      daysCount: 1,
      days: [],
      date: dateStr || new Date().toISOString().slice(0, 10),
      slots: [],
      busySummary: 'Доступ закрыт',
      freeWindows: []
    }
  }

  // 2. Generate date list
  const count = Math.min(Math.max(1, daysCount || 1), 14)
  const baseDate = dateStr ? new Date(dateStr) : new Date()
  const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate

  const dates: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(validBase)
    d.setDate(validBase.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }

  // 3. Fetch friend's active tasks across all target dates
  const allTasks = await prisma.task.findMany({
    where: {
      ownerChatId: tCid,
      dueDate: { in: dates },
      status: { notIn: ['done', 'draft'] }
    },
    orderBy: { dueTime: 'asc' }
  })

  const todayStr = new Date().toISOString().slice(0, 10)
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = tomorrowDate.toISOString().slice(0, 10)

  const days: FriendDaySchedule[] = dates.map(currentDate => {
    const dayTasks = allTasks.filter(t => t.dueDate === currentDate)

    const slots: FriendScheduleSlot[] = dayTasks.map(t => {
      // Accessible if: task is public, shared, created by viewer, or assigned to viewer
      const isAccessible =
        t.visibility === 'public' ||
        t.isShared ||
        t.authorChatId === vCid ||
        (Array.isArray(t.assignees) && t.assignees.includes(String(vCid)))

      return {
        id: t.id,
        title: isAccessible ? t.title : '🔒 Задача',
        dueTime: t.dueTime || null,
        isPrivate: !isAccessible,
        priority: isAccessible ? t.priority : undefined,
        status: t.status,
      }
    })

    // Calculate free windows between 09:00 and 21:00
    const timedSlots = slots
      .filter(s => s.dueTime && /^\d{2}:\d{2}$/.test(s.dueTime))
      .map(s => {
        const [h, m] = (s.dueTime as string).split(':').map(Number)
        return { start: h * 60 + m, end: h * 60 + m + 60, title: s.title, isPrivate: s.isPrivate }
      })
      .sort((a, b) => a.start - b.start)

    const dayStart = 9 * 60 // 09:00
    const dayEnd = 21 * 60  // 21:00

    const freeWindows: string[] = []
    let currentCursor = dayStart

    for (const slot of timedSlots) {
      if (slot.start > currentCursor + 30) {
        const startH = Math.floor(currentCursor / 60)
        const startM = currentCursor % 60
        const endH = Math.floor(slot.start / 60)
        const endM = slot.start % 60
        freeWindows.push(
          `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')} - ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
        )
      }
      if (slot.end > currentCursor) {
        currentCursor = slot.end
      }
    }

    if (currentCursor < dayEnd) {
      const startH = Math.floor(currentCursor / 60)
      const startM = currentCursor % 60
      freeWindows.push(`после ${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`)
    }

    if (timedSlots.length === 0 && slots.length === 0) {
      freeWindows.push('Весь день свободен')
    }

    let dateLabel = currentDate
    if (currentDate === todayStr) {
      dateLabel = 'Сегодня'
    } else if (currentDate === tomorrowStr) {
      dateLabel = 'Завтра'
    } else {
      const dObj = new Date(currentDate + 'T00:00:00')
      dateLabel = dObj.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
    }

    return {
      date: currentDate,
      dateLabel,
      slots,
      busySummary: slots.length === 0 ? 'Свободен весь день' : `Запланировано ${slots.length} задач(и)`,
      freeWindows
    }
  })

  const firstDay = days[0]

  return {
    allowed: true,
    isFriend: true,
    allowTasks: true,
    reason: 'ok',
    friend: {
      chatId: String(friendUser.chatId),
      name: friendName,
      username: friendUser.username ? `@${friendUser.username.replace(/^@/, '')}` : null,
    },
    daysCount: count,
    days,
    date: firstDay?.date || dates[0],
    slots: firstDay?.slots || [],
    busySummary: firstDay?.busySummary || 'Свободен весь день',
    freeWindows: firstDay?.freeWindows || ['Весь день свободен'],
  }
}

export async function getAllChatIds(): Promise<number[]> {
  const chats = await prisma.telegramChat.findMany()
  return chats.map((c: { chatId: bigint }) => Number(c.chatId))
}

export async function getExistingItemsContext(
  ownerChatId?: number | bigint | string | null,
  userQuery?: string
): Promise<string> {
  try {
    if (!ownerChatId) return ''
    const cid = BigInt(ownerChatId)

    const [tasks, goals, notes, habits] = await Promise.all([
      getAllTasks(ownerChatId),
      getAllGoals(ownerChatId),
      getAllNotes(ownerChatId),
      prisma.habit.findMany({ where: { ownerChatId: cid } }).catch(() => []),
    ])

    // Calculate MSK dates
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const [{ value: day }, , { value: month }, , { value: year }] = formatter.formatToParts(now)
    const todayMsk = `${year}-${month}-${day}`
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const [{ value: tDay }, , { value: tMonth }, , { value: tYear }] = formatter.formatToParts(tomorrowDate)
    const tomorrowMsk = `${tYear}-${tMonth}-${tDay}`

    const q = (userQuery || '').toLowerCase()
    const isAskingTomorrow = q.includes('завтра') || q.includes('завтрашн')
    const isAskingToday = q.includes('сегодня') || q.includes('сегодняшн')

    // Fetch user projects
    let userProjects: any[] = []
    try {
      userProjects = await (prisma as any).projectDB.findMany({
        where: {
          OR: [{ ownerChatId: cid }, { memberIds: { has: cid } }],
          status: { not: 'archived' },
        },
      })
    } catch {}

    // Fetch user teams
    let userTeams: any[] = []
    try {
      const teamMemberships = await (prisma as any).teamMembership.findMany({
        where: { userChatId: cid },
        include: { team: true },
      })
      userTeams = teamMemberships.map((tm: any) => tm.team).filter(Boolean)
    } catch {}

    // Fetch user friends
    let friendsList: any[] = []
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [{ userChatId: cid }, { friendChatId: cid }],
          status: 'accepted',
        },
      })
      const friendCids = friendships.map(f => f.userChatId === cid ? f.friendChatId : f.userChatId)
      if (friendCids.length > 0) {
        const chats = await prisma.telegramChat.findMany({
          where: { chatId: { in: friendCids } },
          select: { chatId: true, firstName: true, lastName: true, username: true },
        })
        const friendshipMap = new Map(friendships.map(f => [
          String(f.userChatId === cid ? f.friendChatId : f.userChatId),
          f.allowTasks,
        ]))
        friendsList = chats.map(c => ({
          ...c,
          allowTasks: friendshipMap.get(String(c.chatId)) ?? false,
        }))
      }
    } catch {}

    const projectMap = new Map(userProjects.map(p => [p.id, p.title]))
    const friendNameMap = new Map(friendsList.map(f => [
      String(f.chatId),
      `${f.firstName || ''} ${f.lastName || ''}`.trim() || (f.username ? `@${f.username}` : `ID ${f.chatId}`),
    ]))

    const lines: string[] = []

    // 1. Target Day Schedule
    if (isAskingTomorrow) {
      const tomorrowTasks = tasks.filter(t => t.dueDate === tomorrowMsk)
        .sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'))

      lines.push(`📅 РАСПИСАНИЕ И ПЛАН НА ЗАВТРА (${tomorrowMsk}) [Всего задач: ${tomorrowTasks.length}]:`)
      if (tomorrowTasks.length === 0) {
        lines.push('На завтра задач не запланировано.')
      } else {
        tomorrowTasks.forEach(t => {
          const time = t.dueTime ? ` в ${t.dueTime}` : ''
          const statusStr = t.status === 'done' ? ' [Выполнено]' : ''
          lines.push(`- ${sanitizeTaskTitle(t.title)}${time}${statusStr}`)
        })
      }
    } else if (isAskingToday) {
      const todayTasks = tasks.filter(t => t.dueDate === todayMsk || !t.dueDate)
        .sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'))

      lines.push(`📅 РАСПИСАНИЕ И ПЛАН НА СЕГОДНЯ (${todayMsk}) [Всего задач: ${todayTasks.length}]:`)
      if (todayTasks.length === 0) {
        lines.push('На сегодня активных задач нет.')
      } else {
        todayTasks.forEach(t => {
          const time = t.dueTime ? ` в ${t.dueTime}` : ''
          const statusStr = t.status === 'done' ? ' [Выполнено]' : ''
          lines.push(`- ${sanitizeTaskTitle(t.title)}${time}${statusStr}`)
        })
      }
    } else {
      // General Context (Fallback)
      if (userProjects.length > 0) {
        lines.push('📁 ПРОЕКТЫ:')
        userProjects.forEach(p => {
          lines.push(`- ${p.title} (${p.status || 'active'})`)
        })
      }
      if (userTeams.length > 0) {
        lines.push('\n🏢 КОМАНДЫ:')
        userTeams.forEach(t => lines.push(`- ${t.name}`))
      }
      if (friendsList.length > 0) {
        lines.push('\n👥 ДРУЗЬЯ:')
        friendsList.forEach(f => {
          const name = `${f.firstName || ''} ${f.lastName || ''}`.trim() || 'Без имени'
          lines.push(`- ${name} ${f.allowTasks ? '(доступ к задачам)' : ''}`)
        })
      }
      const activeTasks = tasks.filter(t => t.status !== 'done').slice(0, 10)
      if (activeTasks.length > 0) {
        lines.push('\n📋 АКТУАЛЬНЫЕ ЗАДАЧИ:')
        activeTasks.forEach(t => {
          lines.push(`- ${sanitizeTaskTitle(t.title)}${t.dueDate ? ` (${t.dueDate})` : ''}`)
        })
      }
    }

    // 2. Goals (compact)
    const activeGoals = goals.slice(0, 5)
    if (activeGoals.length > 0) {
      lines.push('\n🎯 ЦЕЛИ:')
      activeGoals.forEach(g => {
        lines.push(`- ${g.title}${g.deadline ? ` (дедлайн: ${g.deadline})` : ''}`)
      })
    }

    // 3. Notes (compact)
    if (notes.length > 0) {
      lines.push('\n📌 ЗАМЕТКИ:')
      notes.slice(0, 8).forEach(n => {
        lines.push(`- ${n.title}`)
      })
    }

    return lines.join('\n')
  } catch {
    return ''
  }
}

export async function cancelScheduleForDate(
  ownerChatId: number | bigint | string,
  dateStr: string
): Promise<{ count: number; deletedTitles: string[] }> {
  try {
    const cid = BigInt(ownerChatId)
    const tasks = await prisma.task.findMany({
      where: {
        ownerChatId: cid,
        dueDate: dateStr,
      },
    })

    const schoolRegex = /(?:урок|алгебр|геометр|физик|хим|биолог|русск|литератур|истори|обществознан|информатик|английск|немецк|французск|физкультур|физ-р|географ|астрономи|обж|труд|пар[аы]|школ|расписани|заняти)/i

    const tasksToDelete = tasks.filter(t => {
      // NEVER delete holidays or birthdays
      if (isHolidayTitle(t.title) || isBirthdayTitle(t.title) || t.repeat === 'yearly') return false
      const tags = (t.tags || []).map(x => String(x).toLowerCase())
      const isTagged = tags.includes('учеба') || tags.includes('школа') || tags.includes('расписание')
      const isTitleMatch = schoolRegex.test(t.title) || schoolRegex.test(t.description || '')
      return isTagged || isTitleMatch
    })

    if (tasksToDelete.length > 0) {
      const ids = tasksToDelete.map(t => t.id)
      await prisma.task.deleteMany({
        where: {
          id: { in: ids },
        },
      })
    }

    return { count: tasksToDelete.length, deletedTitles: tasksToDelete.map(t => t.title) }
  } catch (err) {
    console.error('cancelScheduleForDate error:', err)
    return { count: 0, deletedTitles: [] }
  }
}

export async function cancelRecurringSchedule(
  ownerChatId: number | bigint | string,
  queryTitle: string,
  fromDateStr: string = new Date().toISOString().slice(0, 10)
): Promise<{ count: number; cancelledTitles: string[] }> {
  try {
    const cid = BigInt(ownerChatId)
    const tasks = await prisma.task.findMany({
      where: {
        ownerChatId: cid,
      },
    })

    const cleanQuery = queryTitle.toLowerCase().replace(/^(?:убери|удали|отмени|расписание|задачу|планы|серию)\s*/i, '').trim()
    const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 2)

    const matchingTasks = tasks.filter(t => {
      if (isHolidayTitle(t.title) || isBirthdayTitle(t.title) || t.repeat === 'yearly') return false
      const titleLower = (t.title || '').toLowerCase()
      const descLower = (t.description || '').toLowerCase()
      const match = queryWords.length > 0
        ? queryWords.some(w => titleLower.includes(w) || descLower.includes(w))
        : (cleanQuery ? titleLower.includes(cleanQuery) : false)
      return match
    })

    let cancelledCount = 0
    const cancelledTitles: string[] = []

    for (const t of matchingTasks) {
      if (t.repeat) {
        if (t.dueDate && t.dueDate < fromDateStr) {
          // Past day: keep the historical record intact, but remove repeat so future occurrences stop
          await prisma.task.update({
            where: { id: t.id },
            data: { repeat: null },
          })
          cancelledCount++
          cancelledTitles.push(t.title)
        } else {
          // Future or today recurring template: delete or remove repeat
          await prisma.task.delete({ where: { id: t.id } })
          cancelledCount++
          cancelledTitles.push(t.title)
        }
      } else if (t.dueDate && t.dueDate >= fromDateStr && t.status !== 'done') {
        // Future non-recurring instance matching the query
        await prisma.task.delete({ where: { id: t.id } })
        cancelledCount++
        cancelledTitles.push(t.title)
      }
    }

    return { count: cancelledCount, cancelledTitles: Array.from(new Set(cancelledTitles)) }
  } catch (err) {
    console.error('cancelRecurringSchedule error:', err)
    return { count: 0, cancelledTitles: [] }
  }
}

// ── High-level: save ParsedItem from Groq AI ──────────────────────────────────

export async function saveParsedItemToDb(
  item: ParsedItem,
  ownerChatId?: number | bigint | string | null,
  authorChatId?: number | bigint | string | null
): Promise<{
  item: ParsedItem
  completedTask?: DbTask | null
  updatedItem?: boolean
}> {
  if (item.type === 'answer' || item.action === 'reply') {
    return { item, updatedItem: false }
  }

  // Cancel schedule / Day off action
  if (item.action === 'cancel_schedule') {
    if (ownerChatId) {
      const targetDate = item.dueDate || new Date().toISOString().slice(0, 10)
      const res = await cancelScheduleForDate(ownerChatId, targetDate)
      return { item, updatedItem: res.count > 0 }
    }
    return { item, updatedItem: false }
  }

  // Cancel recurring schedule routine
  if (item.action === 'cancel_recurring_schedule') {
    if (ownerChatId) {
      const query = item.targetTitle || item.title || item.rawText
      const res = await cancelRecurringSchedule(ownerChatId, query)
      return { item, updatedItem: res.count > 0 }
    }
    return { item, updatedItem: false }
  }

  // Delete all tasks action - STRICT CHECK (prevent accidental deletion from generic "удали")
  const textLower = (item.rawText || item.title || '').toLowerCase().trim()
  const isStrictDeleteAll = /\b(?:удали|удалить|очисти|очистить)\s+(?:все|всё)\s*(?:задачи|дела|заметки|список|тодо)?\b/i.test(textLower)

  if (item.action === 'delete_all') {
    if (isStrictDeleteAll && ownerChatId) {
      await prisma.task.deleteMany({ where: { ownerChatId: BigInt(ownerChatId) } })
      return { item, updatedItem: true }
    } else {
      // If user did NOT explicitly say "удали все", treat it as deleting the single target or most recent item
      item.action = 'delete'
    }
  }

  // Set my birthday action
  if (item.action === 'set_my_birthday') {
    if (ownerChatId && (item.dueDate || item.rawText)) {
      const parsed = parseBirthday(item.dueDate || item.rawText)
      if (parsed) {
        await prisma.telegramChat.update({
          where: { chatId: BigInt(ownerChatId) },
          data: { birthday: parsed.iso }
        }).catch(() => {})
        await broadcastMyBirthdayToFriends(ownerChatId)
        item.title = `День рождения сохранен: ${String(parsed.day).padStart(2, '0')}.${String(parsed.month).padStart(2, '0')}${parsed.year ? `.${parsed.year}` : ''}`
      } else {
        item.title = `Не удалось сохранить дату. Пожалуйста, напишите дату в формате ДД.ММ.ГГГГ.`
      }
    } else {
      item.title = `Не удалось сохранить дату. Пожалуйста, напишите дату в формате ДД.ММ.ГГГГ.`
    }
    return { item, updatedItem: true }
  }

  // Delete specific task/note action
  if (item.action === 'delete') {
    if (item.targetId) {
      // Ownership check: only delete records the owner is allowed to touch
      const taskScope = taskActorScope(ownerChatId)
      const taskToDelete = taskScope
        ? await prisma.task.findFirst({ where: { id: item.targetId, ...taskScope } })
        : await prisma.task.findUnique({ where: { id: item.targetId } })
      if (taskToDelete) {
        if (taskToDelete.title.startsWith('🎂 День рождения:') && taskToDelete.assignees.length >= 2) {
          const friendId = taskToDelete.assignees[1]
          await prisma.telegramChat.update({
            where: { chatId: BigInt(friendId) },
            data: { birthday: null }
          }).catch(() => {})
        }
        await deleteTask(item.targetId, ownerChatId)
        return { item, updatedItem: true }
      }

      const goalScope = ownerActorScope(ownerChatId)
      const goalToDelete = goalScope
        ? await prisma.goal.findFirst({ where: { id: item.targetId, ...goalScope } })
        : await prisma.goal.findUnique({ where: { id: item.targetId } })
      if (goalToDelete) {
        await deleteGoal(item.targetId, ownerChatId)
        return { item, updatedItem: true }
      }

      const noteScope = ownerActorScope(ownerChatId)
      const noteToDelete = noteScope
        ? await prisma.note.findFirst({ where: { id: item.targetId, ...noteScope } })
        : await prisma.note.findUnique({ where: { id: item.targetId } })
      if (noteToDelete) {
        await deleteNote(item.targetId, ownerChatId)
        return { item, updatedItem: true }
      }
      return { item, updatedItem: false }
    } else {
      // Find matching item by type and title similarity
      const targetName = item.targetTitle || item.title || item.rawText
      const isNoteTarget = item.type === 'note' || /заметк|конспект|мысл/i.test(item.rawText || '')
      const isGoalTarget = item.type === 'goal' || /цел[ьи]/i.test(item.rawText || '')

      if (isNoteTarget) {
        const notes = await getAllNotes(ownerChatId)
        let bestNote: { id: string; score: number } | null = null
        for (const n of notes) {
          const score = stringSimilarity(targetName, n.title)
          if (score > 0.25 && (!bestNote || score > bestNote.score)) {
            bestNote = { id: n.id, score }
          }
        }
        if (bestNote) {
          await deleteNote(bestNote.id, ownerChatId)
          return { item, updatedItem: true }
        }
      }

      if (isGoalTarget) {
        const goals = await getAllGoals(ownerChatId)
        let bestGoal: { id: string; score: number } | null = null
        for (const g of goals) {
          const score = stringSimilarity(targetName, g.title)
          if (score > 0.25 && (!bestGoal || score > bestGoal.score)) {
            bestGoal = { id: g.id, score }
          }
        }
        if (bestGoal) {
          await deleteGoal(bestGoal.id, ownerChatId)
          return { item, updatedItem: true }
        }
      }

      // Check tasks
      const tasks = await getAllTasks(ownerChatId)
      let bestTask: { id: string; score: number } | null = null
      for (const t of tasks) {
        const score = stringSimilarity(targetName, t.title)
        if (score > 0.25 && (!bestTask || score > bestTask.score)) {
          bestTask = { id: t.id, score }
        }
      }
      if (bestTask) {
        const taskToDelete = await prisma.task.findUnique({ where: { id: bestTask.id } })
        if (taskToDelete && taskToDelete.title.startsWith('🎂 День рождения:') && taskToDelete.assignees.length >= 2) {
          const friendId = taskToDelete.assignees[1]
          await prisma.telegramChat.update({
            where: { chatId: BigInt(friendId) },
            data: { birthday: null }
          }).catch(() => {})
        }
        await deleteTask(bestTask.id, ownerChatId)
        return { item, updatedItem: true }
      }

      // If not found in tasks, check notes as fallback
      const notes = await getAllNotes(ownerChatId)
      let bestNoteFallback: { id: string; score: number } | null = null
      for (const n of notes) {
        const score = stringSimilarity(targetName, n.title)
        if (score > 0.25 && (!bestNoteFallback || score > bestNoteFallback.score)) {
          bestNoteFallback = { id: n.id, score }
        }
      }
      if (bestNoteFallback) {
        await deleteNote(bestNoteFallback.id, ownerChatId)
        return { item, updatedItem: true }
      }
    }
  }

  // Update action (Notes, Tasks, Reminders, Goals)
  if (item.action === 'update') {
    const targetQuery = (item.targetTitle || item.title || item.rawText || '').trim()

    // 1. If target is a Note (or user asked to update note)
    if (item.type === 'note' || /заметк|конспект|мысл|иде[еяю]/i.test(item.rawText || '')) {
      const notes = await getAllNotes(ownerChatId)
      let matchedNote = item.targetId ? notes.find(n => n.id === item.targetId) : null
      if (!matchedNote && targetQuery) {
        let bestScore = 0
        for (const n of notes) {
          const score = stringSimilarity(targetQuery, n.title)
          if (score > 0.25 && score > bestScore) {
            bestScore = score
            matchedNote = n
          }
        }
      }

      if (matchedNote) {
        const newTitle = item.title && item.title !== item.targetTitle ? item.title : matchedNote.title
        let newContent = matchedNote.content
        if (item.summary) {
          const isAppend = /добавь|дополни|припиши/i.test(item.rawText || '')
          newContent = isAppend ? `${matchedNote.content}\n\n${item.summary}` : item.summary
        }
        const newTags = item.tags && item.tags.length > 0 ? Array.from(new Set([...(matchedNote.tags || []), ...item.tags])) : matchedNote.tags

        await prisma.note.update({
          where: { id: matchedNote.id },
          data: {
            title: newTitle,
            content: newContent,
            tags: newTags,
            updatedAt: new Date(),
          } as never
        })
        item.targetId = matchedNote.id
        item.title = newTitle
        item.summary = newContent
        item.type = 'note'
        return { item, updatedItem: true }
      }
    }

    // 2. If target is a Goal (or user asked to update goal)
    if (item.type === 'goal' || /цел|прогресс|дедлайн/i.test(item.rawText || '')) {
      const goals = await getAllGoals(ownerChatId)
      let matchedGoal = item.targetId ? goals.find(g => g.id === item.targetId) : null
      if (!matchedGoal && targetQuery) {
        let bestScore = 0
        for (const g of goals) {
          const score = stringSimilarity(targetQuery, g.title)
          if (score > 0.25 && score > bestScore) {
            bestScore = score
            matchedGoal = g
          }
        }
      }

      if (matchedGoal) {
        const updateData: Record<string, unknown> = { updatedAt: new Date() }
        if (item.title && item.title !== item.targetTitle) updateData.title = item.title
        if (item.summary) updateData.description = item.summary
        if (item.dueDate !== undefined) updateData.deadline = item.dueDate
        if ((item as any).progress !== undefined) updateData.progress = Number((item as any).progress)

        await prisma.goal.update({
          where: { id: matchedGoal.id },
          data: updateData as never
        })
        item.targetId = matchedGoal.id
        item.type = 'goal'
        return { item, updatedItem: true }
      }
    }

    // 3. Target is a Task or Reminder
    const tasks = await getAllTasks(ownerChatId)
    let matchedTask = item.targetId ? tasks.find(t => t.id === item.targetId) : null
    if (!matchedTask && targetQuery) {
      let bestScore = 0
      for (const t of tasks) {
        const score = stringSimilarity(targetQuery, t.title)
        if (score > 0.25 && score > bestScore) {
          bestScore = score
          matchedTask = t
        }
      }
    }

    if (matchedTask) {
      const updateData: Record<string, unknown> = { updatedAt: new Date() }
      if (item.title && item.title !== item.targetTitle) updateData.title = item.title
      if (item.summary) updateData.description = item.summary
      if (item.dueDate !== undefined) updateData.dueDate = item.dueDate
      if (item.dueTime !== undefined) updateData.dueTime = item.dueTime
      if (item.priority) updateData.priority = item.priority
      if (item.reminderOffsetMinutes !== undefined && item.reminderOffsetMinutes !== null) {
        updateData.reminderOffsetMinutes = item.reminderOffsetMinutes
      }
      if (item.subtasks && item.subtasks.length > 0) {
        const existingSubtasks = Array.isArray(matchedTask.subtasks) ? matchedTask.subtasks : []
        const newSubtasks = item.subtasks.map((st: any, i: number) => ({
          id: `st_${Date.now()}_${i}`,
          title: typeof st === 'string' ? st : st.title,
          done: false,
        }))
        updateData.subtasks = [...existingSubtasks, ...newSubtasks]
      }

      await prisma.task.update({
        where: { id: matchedTask.id },
        data: updateData as never
      })
      item.targetId = matchedTask.id
      item.type = 'task'
      return { item, updatedItem: true }
    }
  }

  // Completion intent — mark existing task done
  if ((item.action === 'completion' || item.type === 'completion') && item.targetTitle) {
    const completed = await completeTaskByTitle(item.targetTitle, ownerChatId)
    return { item, completedTask: completed }
  }

  if (item.type === 'habit') {
    const icon = (item as any).icon || '🔥'
    const frequency = (item as any).frequency || 'daily'
    await createHabit({
      title: item.title,
      icon,
      frequency,
      ownerChatId,
    })
  } else if (item.type === 'project') {
    const rawMembers: string[] = (item as any).members || (item as any).memberNames || (item as any).memberUsernames || []
    if (item.recipientName && !rawMembers.includes(item.recipientName)) {
      rawMembers.push(item.recipientName)
    }

    const cid = ownerChatId ? BigInt(ownerChatId) : null
    let memberIds: bigint[] = cid ? [cid] : []

    for (const name of rawMembers) {
      const clean = name.replace(/^@/, '').trim()
      if (!clean) continue
      const chat = await prisma.telegramChat.findFirst({
        where: {
          OR: [
            { username: { equals: clean, mode: 'insensitive' } },
            { firstName: { equals: clean, mode: 'insensitive' } },
            { lastName: { equals: clean, mode: 'insensitive' } },
          ]
        }
      })
      if (chat && !memberIds.includes(chat.chatId)) {
        memberIds.push(chat.chatId)
      }
    }

    await (prisma as any).projectDB.create({
      data: {
        title: item.title,
        description: item.summary,
        ownerChatId: cid,
        memberIds,
        color: '#F59E0B',
        status: 'active',
      }
    })
  } else if (item.type === 'goal') {
    await createGoal({
      title: item.title,
      description: item.summary,
      motivation: item.motivation,
      deadline: item.dueDate || undefined,
      milestones: (item.milestones || []).map((m, i) => ({
        id: `m_${i}_${Date.now()}`,
        title: m,
        done: false,
      })),
      ownerChatId,
    })
  } else if (item.type === 'note') {
    const rawLower = (item.rawText || item.title || '').toLowerCase().trim()
    const isExplicitNote = /\b(заметк|запиши|сохрани|зафиксируй|мысль|идея|конспект|текст|информация|пароль|список|в заметки|черновик)\b/i.test(rawLower)

    // If it's a question, math problem or calculation, never create a note — treat as answer!
    const isQuestionOrMath = !isExplicitNote && (
      /\b(сколько|как решить|реши|вычисли|сосчитай|объясни|что такое|почему|кто такой|кто такая|в каком году|переведи|найди корень|теорема)\b/i.test(rawLower) ||
      /\?$/.test(rawLower) ||
      /\b\d+\s*[\*\+\-\/×÷^=]\s*\d+\b/.test(rawLower)
    )
    if (isQuestionOrMath) {
      item.type = 'answer'
      item.action = 'reply'
      return { item, updatedItem: false }
    }

    // Only fallback to task if it was NOT explicitly a note and has empty placeholder title/summary
    if (!isExplicitNote && item.title === 'Новая заметка' && (!item.summary || item.summary === 'Нет информации')) {
      item.type = 'task'
      if (item.rawText) {
        item.title = item.rawText
        item.summary = item.rawText
      }
    }
  }

  if (item.type === 'note') {
    if (ownerChatId) {
      const limits = await getUserUsageAndLimits(ownerChatId)
      if (!limits.canCreateNote) {
        item.title = `❌ Дневной лимит бесплатных заметок исчерпан (10 в день). Оформите Zerf Premium для безлимита!`
        return { item, updatedItem: true }
      }
    }

    const summaryText = item.summary || ''
    const mdContent = summaryText.includes('#')
      ? summaryText
      : `# ${item.title}\n\n${summaryText}`

    const createdNote = await createNote({
      title: item.title,
      content: mdContent,
      originalText: item.rawText,
      type: 'note',
      tags: item.tags || [],
      aiGenerated: true,
      folder: (item as any).folder || 'Общее',
      ownerChatId,
    })

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const now = new Date()
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
    const today = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
    
    // Auto-create tasks specified by AI in tasksToCreate
    if (item.tasksToCreate && item.tasksToCreate.length > 0) {
      for (const t of item.tasksToCreate) {
        const createdTask = await createTask({
          title: `📌 ${t.title}`,
          description: `Связано с заметкой: ${item.title}`,
          priority: item.priority || 'medium',
          dueDate: t.dueDate || today,
          dueTime: t.dueTime || undefined,
          tags: ['заметка', ...(item.tags || [])],
          aiGenerated: true,
          source: item.rawText,
          ownerChatId: ownerChatId || null,
        })
        if (createdNote && createdTask) {
          await linkNoteToTask(createdTask.id, createdNote.id).catch(() => {})
        }
      }
    } else {
      // Fallback: legacy auto-reminder if note content contains a time
      const noteText = `${item.title} ${item.summary} ${item.rawText || ''}`
      const timeMatch = noteText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
      const naturalMatch = noteText.match(/в\s+([01]?\d|2[0-3]):([0-5]\d)/i)
      const regexTime = (naturalMatch || timeMatch)
        ? `${((naturalMatch || timeMatch)![1]).padStart(2, '0')}:${(naturalMatch || timeMatch)![2]}`
        : null
      
      const extractedTime = item.dueTime || regexTime

      if (extractedTime) {
        const context = await generateReminderContext(
          item.title,
          (item.summary || '').slice(0, 500),
          extractedTime
        ).catch(() => `Напоминание: «${item.title}» в ${extractedTime}. Готовься! 🎯`)

        const createdTask = await createTask({
          title: `⏰ ${item.title}`,
          description: context,
          priority: item.priority || 'medium',
          dueDate: item.dueDate || today,
          dueTime: extractedTime,
          tags: ['заметка', 'авто-напоминание', ...(item.tags || [])],
          aiGenerated: true,
          source: item.rawText,
          ownerChatId: ownerChatId || null,
        })
        
        if (createdNote && createdTask) {
          await linkNoteToTask(createdTask.id, createdNote.id).catch(() => {})
        }
      }
    }
  } else {
    // Task, reminder, or default
    const desc = item.recipientName
      ? `📩 Отправить ${item.recipientName}: ${item.summary}`
      : item.summary

    const extractedTime = item.dueTime || extractNaturalTime(item.rawText || item.title || item.summary) || undefined
    if (extractedTime && !item.dueTime) {
      item.dueTime = extractedTime
    }

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const now = new Date()
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    let finalDueDate = item.dueDate || todayStr
    // If time is set but dueDate was not explicitly given, check if that time has already passed today
    if (!item.dueDate && extractedTime) {
      const [dueH, dueM] = extractedTime.split(':').map(Number)
      const currentH = parseInt(getPart('hour'), 10)
      const currentM = parseInt(getPart('minute'), 10)
      if (currentH > dueH || (currentH === dueH && currentM >= dueM)) {
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        const tmParts = formatter.formatToParts(tomorrow)
        const getTmPart = (type: string) => tmParts.find(p => p.type === type)?.value || '00'
        finalDueDate = `${getTmPart('year')}-${getTmPart('month')}-${getTmPart('day')}`
      }
    }

    const isHoliday = isHolidayTitle(item.title) || isHolidayTitle(item.rawText)
    const isBirthday = isBirthdayTitle(item.title) || isBirthdayTitle(item.rawText)
    const isYearlyEvent = isHoliday || isBirthday || /(?:^|[^а-яёa-z0-9])(?:день\s*рождения|д\.?\s*р\.?|праздник|годовщин\w*)(?:[^а-яёa-z0-9]|$)/i.test(item.title || item.rawText || '')
    const finalRepeat = item.repeat || (isYearlyEvent ? 'yearly' : null)

    let finalTitle = item.title
    if (isHoliday) {
      if (!finalTitle.startsWith('🎉')) finalTitle = `🎉 ${finalTitle.replace(/^(?:праздник|добавь\s*праздник)\s*/i, '')}`
      item.tags = Array.from(new Set([...(item.tags || []), 'праздник', 'календарь']))
      if (!item.dueTime) item.dueTime = '00:00'
    } else if (isBirthday) {
      if (!finalTitle.startsWith('🎂')) finalTitle = `🎂 ${finalTitle}`
      item.tags = Array.from(new Set([...(item.tags || []), 'день рождения', 'календарь']))
      if (!item.dueTime) item.dueTime = '00:00'
    }

    if (finalRepeat === 'yearly' && finalDueDate) {
      const parts = finalDueDate.split('-')
      if (parts.length === 3) {
        const currentYear = new Date().getFullYear()
        let targetYear = parseInt(parts[0], 10)
        
        if (targetYear <= currentYear) {
           const thisYearDate = new Date(`${currentYear}-${parts[1]}-${parts[2]}T00:00:00`)
           if (thisYearDate.getTime() < Date.now()) {
             targetYear = currentYear + 1
           } else {
             targetYear = currentYear
           }
        }
        finalDueDate = `${targetYear}-${parts[1]}-${parts[2]}`
      }
    }

    const baseTags = item.recipientName ? [...(item.tags || []), item.recipientName] : (item.tags || [])
    const categorizedTags = autoCategorizeTags(finalTitle, desc, baseTags)

    await createTask({
      title: finalTitle,
      description: desc,
      priority: item.priority || 'medium',
      dueDate: finalDueDate,
      dueTime: item.dueTime || extractedTime,
      repeat: finalRepeat,
      reminderOffsetMinutes: item.reminderOffsetMinutes || 0,
      tags: categorizedTags,
      aiGenerated: true,
      source: item.rawText,
      ownerChatId: ownerChatId || null,
      assignees: item.assignees || [],
      subtasks: (item.subtasks || []).map((st: any, i: number) => {
        if (typeof st === 'object' && st !== null) {
          return {
            id: st.id || `st_${i}_${Date.now()}`,
            title: st.title || String(st),
            done: Boolean(st.done),
            dueTime: st.dueTime || null,
            dueDate: st.dueDate || null,
            durationDays: st.durationDays ? Number(st.durationDays) : null,
          }
        }
        return {
          id: `st_${i}_${Date.now()}`,
          title: String(st),
          done: false,
          dueTime: null,
          dueDate: null,
          durationDays: null,
        }
      }),
    })
  }

  return { item }
}

export function autoCategorizeTags(title: string, summary: string = '', currentTags: string[] = []): string[] {
  const fullText = `${title} ${summary} ${currentTags.join(' ')}`.toLowerCase()
  const tagsSet = new Set(currentTags)

  // Sport keywords (including chess as intellectual sport)
  if (/(?:спорт|тренировк|зал|фитнес|бег|пробежк|плавани|бассейн|шахмат|футбол|баскетбол|турник|отжимания|воркаут|матч|растяжк|йог[аеи]|велосипед|гантел|жим)/i.test(fullText)) {
    tagsSet.add('спорт')
  }

  // Study / Education keywords (including chess lessons / classes / tutoring)
  if (/(?:учеб|заняти|урок|домашк|дз|репетитор|экзамен|сесси|лекци|семинар|курс|интенсив|шахмат|английск|язык|книг|чтени|конспект|лабораторн|диплом|курсов)/i.test(fullText)) {
    tagsSet.add('учеба')
  }

  // Work keywords
  if (/(?:работ|созвон|митинг|клиент|отчет|договор|презентаци|дедлайн|коллег|начальник|зарплат|сервер|баг|заказ|код|релиз)/i.test(fullText)) {
    tagsSet.add('работа')
  }

  // Ideas keywords
  if (/(?:иде[яи]|мысл|инсайт|придум|сценари|концепт|стартап|план\sна\sбудущее|задумк)/i.test(fullText)) {
    tagsSet.add('идеи')
  }

  // Urgent keywords
  if (/(?:срочн|важн|горит|немедленно|как\sможно\sбыстрее|asap)/i.test(fullText)) {
    tagsSet.add('срочно')
  }

  // Personal / Life keywords
  if (/(?:покупк|купи|магазин|аптек|врач|поликлиник|семь[яе]|мам[ае]|пап[ае]|дом|уборк|стирк|готовк|ужин|обед|завтрак|друг|др|день\sрождения|подарок)/i.test(fullText)) {
    tagsSet.add('личное')
  }

  return Array.from(tagsSet)
}

async function fetchTelegramUserProfile(chatId: bigint | number): Promise<{ firstName?: string; lastName?: string; username?: string; birthday?: string } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(chatId) }),
    })
    const data = await res.json()
    if (data?.ok && data.result) {
      const u = data.result
      const firstName = u.first_name || ''
      const lastName = u.last_name || ''
      const username = u.username || ''
      
      let birthdayStr: string | undefined
      if (u.birthdate && u.birthdate.day && u.birthdate.month) {
        const bYear = u.birthdate.year || 2000
        const bMonth = String(u.birthdate.month).padStart(2, '0')
        const bDay = String(u.birthdate.day).padStart(2, '0')
        birthdayStr = `${bYear}-${bMonth}-${bDay}`
      }

      if (firstName || username || birthdayStr) {
        await prisma.telegramChat.upsert({
          where: { chatId: BigInt(chatId) },
          update: {
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            username: username || undefined,
            birthday: birthdayStr || undefined,
          },
          create: {
            chatId: BigInt(chatId),
            firstName: firstName || null,
            lastName: lastName || null,
            username: username || null,
            birthday: birthdayStr || null,
          },
        }).catch(() => {})
        return { firstName, lastName, username, birthday: birthdayStr }
      }
    }
  } catch {}
  return null
}

export async function getFriends(ownerChatId?: number | bigint | string | null) {
  try {
    if (!ownerChatId) return []
    const cid = BigInt(ownerChatId)
    const strId = String(ownerChatId)

    const contactIdsSet = new Set<bigint>()

    // 1. Get explicit accepted friendships (bidirectional)
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userChatId: cid, status: 'accepted' },
          { friendChatId: cid, status: 'accepted' },
        ],
      },
    })
    friendships.forEach(f => {
      if (f.userChatId !== cid) contactIdsSet.add(f.userChatId)
      if (f.friendChatId !== cid) contactIdsSet.add(f.friendChatId)
    })

    const friendIds = Array.from(contactIdsSet)
    if (friendIds.length === 0) return []

    const chats = await prisma.telegramChat.findMany({
      where: { chatId: { in: friendIds } },
    })

    const chatMap = new Map(chats.map(c => [String(c.chatId), c]))

    const results = await Promise.all(
      friendIds.map(async fid => {
        const fidStr = String(fid)
        const myFriendship = friendships.find(f => f.userChatId === cid && f.friendChatId === fid)
        const theirFriendship = friendships.find(f => f.userChatId === fid && f.friendChatId === cid)

        let chat = chatMap.get(fidStr)

        if (!chat || (!chat.firstName && !chat.username)) {
          const fetched = await fetchTelegramUserProfile(fid)
          if (fetched) {
            chat = {
              chatId: fid,
              firstName: fetched.firstName || null,
              lastName: fetched.lastName || null,
              username: fetched.username || null,
              email: null,
              passwordHash: null,
              authProvider: null,
              vkId: null,
              googleEmail: null,
              birthday: fetched.birthday || chat?.birthday || null,
              reminderIntervalMinutes: 5,
              reminderRepeatCount: 3,
              plan: 'free',
              timezone: 'Europe/Moscow',
              subscriptionExpiry: null,
              voiceCountToday: 0,
              voiceSecondsToday: 0,
              notesCountToday: 0,
              chatMessagesToday: 0,
              lastResetDate: null,
              lastActiveAt: new Date(),
              referredBy: null,
              referralCount: 0,
              isAdmin: false,
              streakDays: 0,
              lastStreakDate: null,
              ttsEnabled: false,
              referralRewarded: false,
              trialActivatedAt: null,
              googleCalendarToken: null,
              googleCalendarSync: false,
              addedAt: new Date(),
            }
          }
        }

        const name = chat
          ? ([chat.firstName, chat.lastName].filter(Boolean).join(' ') || (chat.username ? `@${chat.username}` : `Участник #${fidStr.slice(-4)}`))
          : `Участник #${fidStr.slice(-4)}`

        let status: 'online' | 'away' | 'offline' = 'offline'
        if (chat && (chat as any).lastActiveAt) {
          const diffMs = Date.now() - new Date((chat as any).lastActiveAt).getTime()
          const diffMins = diffMs / 60000
          if (diffMins <= 5) status = 'online'
          else if (diffMins <= 30) status = 'away'
          else status = 'offline'
        }

        const isBot = (chat?.username || '').toLowerCase().includes('bot') || name.toLowerCase().includes('zerph')
        
        let friendBirthday = chat?.birthday ? (parseBirthday(chat.birthday)?.iso || chat.birthday) : null

        if (!friendBirthday) {
          const bdayTask = await prisma.task.findFirst({
            where: {
              ownerChatId: cid,
              tags: { has: 'день рождения' },
              OR: [
                { assignees: { has: fidStr } },
                { title: { contains: name, mode: 'insensitive' } },
              ],
            },
            select: { dueDate: true }
          })
          if (bdayTask?.dueDate) {
            const parsed = parseBirthday(bdayTask.dueDate)
            if (parsed) {
              friendBirthday = parsed.iso
              await prisma.telegramChat.update({
                where: { chatId: fid },
                data: { birthday: parsed.iso },
              }).catch(() => {})
            }
          }
        }

        return {
          id: fidStr,
          name,
          email: chat?.username ? `@${chat.username}` : '',
          chatId: fidStr,
          username: chat?.username || '',
          status,
          addedAt: new Date().toISOString(),
          birthday: friendBirthday,
          allowTasks: myFriendship ? myFriendship.allowTasks : (isBot ? true : false),
          friendAllowedMe: theirFriendship ? theirFriendship.allowTasks : (isBot ? true : false),
        }
      })
    )

    return results.filter(f => {
      const uname = (f.username || '').toLowerCase()
      const name = (f.name || '').toLowerCase()
      if (uname.includes('bot') || uname === 'groupanonymousbot' || name === 'group') return false
      return true
    })
  } catch (err) {
    console.error('Error in getFriends:', err)
    return []
  }
}

export async function touchUserLastActive(chatId: number | bigint | string) {
  try {
    const cid = BigInt(chatId)
    await (prisma.telegramChat as any).upsert({
      where: { chatId: cid },
      update: { lastActiveAt: new Date() },
      create: { chatId: cid, lastActiveAt: new Date() },
    })
  } catch {}
}

export function parseBirthday(input: string | null | undefined): { month: number; day: number; year?: number; iso: string; display: string } | null {
  if (!input) return null
  const cleaned = input.trim()

  // 1. Check YYYY-MM-DD (e.g. 2000-04-11, 2026-04-11, 2010-04-03)
  const isoMatch = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const day = parseInt(isoMatch[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const monthStr = String(month).padStart(2, '0')
      const dayStr = String(day).padStart(2, '0')
      return {
        year, month, day,
        iso: `${year}-${monthStr}-${dayStr}`,
        display: `${dayStr}.${monthStr}${year && year !== 2000 ? '.' + year : ''}`
      }
    }
  }

  // 2. Check DD.MM.YYYY or DD-MM-YYYY or DD/MM/YYYY (e.g. 11.04.2000 or 11-04-2000 or 03.04.2010)
  const ruMatch = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (ruMatch) {
    const day = parseInt(ruMatch[1], 10)
    const month = parseInt(ruMatch[2], 10)
    const year = parseInt(ruMatch[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const monthStr = String(month).padStart(2, '0')
      const dayStr = String(day).padStart(2, '0')
      return {
        year, month, day,
        iso: `${year}-${monthStr}-${dayStr}`,
        display: `${dayStr}.${monthStr}.${year}`
      }
    }
  }

  // 3a. Russian format with dots: DD.MM (e.g. 11.04 -> Day 11, Month 4 = 11 апреля)
  const dotMatch = cleaned.match(/^(\d{1,2})\.(\d{1,2})$/)
  if (dotMatch) {
    const n1 = parseInt(dotMatch[1], 10)
    const n2 = parseInt(dotMatch[2], 10)
    let day = n1
    let month = n2
    if (n1 <= 12 && n2 > 12) {
      month = n1
      day = n2
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const monthStr = String(month).padStart(2, '0')
      const dayStr = String(day).padStart(2, '0')
      return {
        month, day,
        iso: `2000-${monthStr}-${dayStr}`,
        display: `${dayStr}.${monthStr}`
      }
    }
  }

  // 3b. Hyphen format: MM-DD or DD-MM (e.g. 04-11 from legacy ISO -> Month 4, Day 11 = 11 апреля)
  const hyphenMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})$/)
  if (hyphenMatch) {
    const n1 = parseInt(hyphenMatch[1], 10)
    const n2 = parseInt(hyphenMatch[2], 10)
    let month = n1
    let day = n2
    if (n1 > 12 && n2 <= 12) {
      day = n1
      month = n2
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const monthStr = String(month).padStart(2, '0')
      const dayStr = String(day).padStart(2, '0')
      return {
        month, day,
        iso: `2000-${monthStr}-${dayStr}`,
        display: `${dayStr}.${monthStr}`
      }
    }
  }

  // 4. Natural text in Russian: "11 апреля", "11 апреля 2000", "15 мая", "20 декабря 1995"
  const ruMonths: Record<string, number> = {
    январ: 1, янв: 1,
    феврал: 2, фев: 2,
    март: 3, мар: 3,
    апрел: 4, апр: 4,
    ма: 5, май: 5,
    июн: 6, июнь: 6,
    июл: 7, июль: 7,
    август: 8, авг: 8,
    сентябр: 9, сен: 9,
    октябр: 10, окт: 10,
    ноябр: 11, ноя: 11,
    декабр: 12, дек: 12,
  }
  const textMatch = cleaned.toLowerCase().match(/(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?/)
  if (textMatch) {
    const day = parseInt(textMatch[1], 10)
    const monthWord = textMatch[2]
    const year = textMatch[3] ? parseInt(textMatch[3], 10) : undefined
    for (const [prefix, mNum] of Object.entries(ruMonths)) {
      if (monthWord.startsWith(prefix)) {
        if (mNum >= 1 && mNum <= 12 && day >= 1 && day <= 31) {
          const monthStr = String(mNum).padStart(2, '0')
          const dayStr = String(day).padStart(2, '0')
          return {
            year,
            month: mNum,
            day,
            iso: `${year || 2000}-${monthStr}-${dayStr}`,
            display: `${dayStr}.${monthStr}${year ? '.' + year : ''}`
          }
        }
      }
    }
  }

  return null
}

export async function syncMyOwnBirthday(ownerChatId: number | bigint | string): Promise<void> {
  try {
    const cid = BigInt(ownerChatId)
    const userChat = await prisma.telegramChat.findUnique({
      where: { chatId: cid },
      select: { birthday: true, firstName: true, lastName: true, username: true }
    })

    const ownBdayTasks = await prisma.task.findMany({
      where: {
        ownerChatId: cid,
        OR: [
          { tags: { has: 'мой день рождения' } },
          { title: { startsWith: '🎂 Мой день рождения' } },
          { title: { startsWith: '🎂 День рождения (Я)' } },
        ]
      }
    })

    const myFullName = [userChat?.firstName, userChat?.lastName].filter(Boolean).join(' ')

    // Clean up any old duplicate friend-style tasks for MYSELF on my own account
    const duplicateFriendTasks = await prisma.task.findMany({
      where: {
        ownerChatId: cid,
        tags: { has: 'день рождения' },
        NOT: {
          OR: [
            { tags: { has: 'мой день рождения' } },
            { title: { startsWith: '🎂 Мой день рождения' } },
          ]
        },
        OR: [
          ...(myFullName ? [{ title: { contains: myFullName, mode: 'insensitive' as const } }] : []),
          ...(userChat?.username ? [{ title: { contains: `@${userChat.username}`, mode: 'insensitive' as const } }] : []),
          { assignees: { equals: [String(cid)] } },
          { assignees: { equals: [] } },
        ]
      }
    })
    for (const t of duplicateFriendTasks) {
      await prisma.task.delete({ where: { id: t.id } }).catch(() => {})
    }

    if (!userChat?.birthday) {
      for (const t of ownBdayTasks) {
        await prisma.task.delete({ where: { id: t.id } }).catch(() => {})
      }
      return
    }

    const parsed = parseBirthday(userChat.birthday)
    if (!parsed) return

    const currentYear = new Date().getFullYear()
    const monthStr = String(parsed.month).padStart(2, '0')
    const dayStr = String(parsed.day).padStart(2, '0')
    const taskTitle = '🎂 Мой день рождения'

    const thisYearDate = new Date(`${currentYear}-${monthStr}-${dayStr}T00:00:00`)
    const targetYear = thisYearDate.getTime() < Date.now() ? currentYear + 1 : currentYear
    const targetDueDate = `${targetYear}-${monthStr}-${dayStr}`

    if (ownBdayTasks.length > 0) {
      const primary = ownBdayTasks[0]
      await prisma.task.update({
        where: { id: primary.id },
        data: {
          title: taskTitle,
          description: '🎉 Твой День рождения! Желаем отличного дня и продуктивного года!',
          dueDate: targetDueDate,
          dueTime: '00:00',
          repeat: 'yearly',
          priority: 'urgent',
          tags: ['день рождения', 'мой день рождения', 'праздник'],
          isShared: false,
          status: 'todo',
        }
      })
      for (let i = 1; i < ownBdayTasks.length; i++) {
        await prisma.task.delete({ where: { id: ownBdayTasks[i].id } }).catch(() => {})
      }
    } else {
      await prisma.task.create({
        data: {
          title: taskTitle,
          description: '🎉 Твой День рождения! Желаем отличного дня и продуктивного года!',
          priority: 'urgent',
          status: 'todo',
          dueDate: targetDueDate,
          dueTime: '00:00',
          repeat: 'yearly',
          tags: ['день рождения', 'мой день рождения', 'праздник'],
          isShared: false,
          assignees: [String(cid)],
          ownerChatId: cid,
        }
      })
    }
  } catch (err) {
    console.error('Failed to sync own birthday:', err)
  }
}

export async function broadcastMyBirthdayToFriends(myChatId: number | bigint | string): Promise<void> {
  try {
    const cid = BigInt(myChatId)
    // Only broadcast to MUTUAL ACCEPTED friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userChatId: cid, status: 'accepted' },
          { friendChatId: cid, status: 'accepted' },
        ],
      },
    })

    const friendChatIds = friendships.map(f => f.userChatId === cid ? f.friendChatId : f.userChatId)
    for (const friendId of friendChatIds) {
      await syncFriendBirthdays(friendId)
    }
  } catch (err) {
    console.error('Error broadcasting birthday:', err)
  }
}

export async function syncFriendBirthdays(ownerChatId: number | bigint | string): Promise<number> {
  try {
    const cid = BigInt(ownerChatId)

    // 0. Always ensure user's own birthday is synced to their tasks & calendar
    await syncMyOwnBirthday(cid).catch(() => {})

    // 1. Get ONLY ACCEPTED friends of this user
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userChatId: cid, status: 'accepted' },
          { friendChatId: cid, status: 'accepted' },
        ],
      },
    })

    const friendChatIds = friendships.map(f => f.userChatId === cid ? f.friendChatId : f.userChatId)

    // 2. Find friend profiles with birthday set (excluding self)
    const friendChats = friendChatIds.length > 0
      ? await prisma.telegramChat.findMany({
          where: { chatId: { in: friendChatIds.filter(id => id !== cid) } },
        })
      : []

    const currentYear = new Date().getFullYear()
    let createdCount = 0

    // 3. Upsert birthday tasks for each accepted friend — one task per friend chatId
    for (const friend of friendChats) {
      if (friend.chatId === cid) continue // handled by syncMyOwnBirthday
      
      let friendBday = friend.birthday
      if ((!friendBday || friendBday.length < 10) && process.env.TELEGRAM_BOT_TOKEN) {
        const fetched = await fetchTelegramUserProfile(friend.chatId)
        if (fetched?.birthday) {
          friendBday = fetched.birthday
        }
      }

      if (!friendBday) continue
      const parsed = parseBirthday(friendBday)
      if (!parsed) continue

      const monthStr = String(parsed.month).padStart(2, '0')
      const dayStr = String(parsed.day).padStart(2, '0')
      const friendName = friend.firstName
        ? `${friend.firstName}${friend.lastName ? ' ' + friend.lastName : ''}`
        : (friend.username ? `@${friend.username}` : `Друг #${friend.chatId}`)
      const taskTitle = `🎂 День рождения: ${friendName}`

      const thisYearDate = new Date(`${currentYear}-${monthStr}-${dayStr}T00:00:00`)
      const targetYear = thisYearDate.getTime() < Date.now() ? currentYear + 1 : currentYear
      const targetDueDate = `${targetYear}-${monthStr}-${dayStr}`

      // Use chatId of friend as the unique marker stored in assignees
      const friendCidStr = String(friend.chatId)

      // Find any existing birthday task for THIS friend by their chatId in assignees
      const existing = await prisma.task.findFirst({
        where: {
          ownerChatId: cid,
          tags: { has: 'день рождения' },
          assignees: { has: friendCidStr },
        },
      })

      if (!existing) {
        // Also check for old-style tasks by name (to avoid creating a third copy)
        const oldByName = await prisma.task.findFirst({
          where: {
            ownerChatId: cid,
            tags: { has: 'день рождения' },
            title: { contains: friendName, mode: 'insensitive' },
          },
        })
        if (oldByName) {
          // Update old task to add chatId marker and correct data
          await prisma.task.update({
            where: { id: oldByName.id },
            data: {
              title: taskTitle,
              dueDate: targetDueDate,
              dueTime: '00:00',
              repeat: 'yearly',
              isShared: false,
              assignees: [friendCidStr],
              status: 'todo',
            },
          })
        } else {
          await prisma.task.create({
            data: {
              title: taskTitle,
              description: `Не забудь поздравить ${friendName} с Днём рождения! 🎉`,
              priority: 'urgent',
              status: 'todo',
              dueDate: targetDueDate,
              dueTime: '00:00',
              repeat: 'yearly',
              tags: ['день рождения', 'друзья'],
              isShared: false,
              assignees: [friendCidStr],
              ownerChatId: cid,
            },
          })
          createdCount++
        }
      } else {
        // Update title (name may have changed), date if needed
        const updates: any = {}
        if (existing.title !== taskTitle) updates.title = taskTitle
        if (existing.dueTime !== '00:00') updates.dueTime = '00:00'
        if (existing.dueDate !== targetDueDate) {
          updates.dueDate = targetDueDate
          updates.status = 'todo'
          updates.reminderSent = false
          updates.remindersSentCount = 0
        }
        if (existing.repeat !== 'yearly') updates.repeat = 'yearly'
        if (Object.keys(updates).length > 0) {
          await prisma.task.update({ where: { id: existing.id }, data: updates })
        }
      }
    }

    // 4. DEDUPLICATE: delete extra birthday tasks for the same friend chatId
    const allBdayTasks = await prisma.task.findMany({
      where: { ownerChatId: cid, tags: { has: 'день рождения' } },
      orderBy: { createdAt: 'asc' }, // keep oldest
    })

    const seenFriendId = new Set<string>()
    for (const t of allBdayTasks) {
      const isOwnBday = (t.tags || []).includes('мой день рождения') || t.title.startsWith('🎂 Мой день рождения')
      if (isOwnBday) continue

      const friendId = (t.assignees || []).find((a: string) => a !== String(cid))
      if (friendId) {
        if (seenFriendId.has(friendId)) {
          // Duplicate — delete
          await prisma.task.delete({ where: { id: t.id } }).catch(() => {})
          continue
        }
        seenFriendId.add(friendId)
      }
    }

    // 5. Delete birthday tasks for people who are NOT currently accepted friends (or requests cancelled/pending)
    const validFriendIds = new Set(friendChats.map(f => String(f.chatId)))
    for (const t of allBdayTasks) {
      const isOwnBday = (t.tags || []).includes('мой день рождения') || t.title.startsWith('🎂 Мой день рождения')
      if (isOwnBday) continue

      const friendId = (t.assignees || []).find((a: string) => a !== String(cid))
      if (friendId) {
        if (!validFriendIds.has(friendId)) {
          await prisma.task.delete({ where: { id: t.id } }).catch(() => {})
        }
      } else {
        // Old task without assignee chatId: check if title matches any valid accepted friend
        const matchesValidFriend = friendChats.some(fc => {
          const fn = fc.firstName || fc.username || ''
          return fn && t.title.toLowerCase().includes(fn.toLowerCase())
        })
        if (!matchesValidFriend) {
          await prisma.task.delete({ where: { id: t.id } }).catch(() => {})
        }
      }
    }

    return createdCount
  } catch (err) {
    console.error('Failed to sync friend birthdays:', err)
    return 0
  }
}

// ── Reminders — find tasks due right now ──────────────────────────────────────

export function getMskDateTime() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

  const mskDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
  const mskTime = `${getPart('hour')}:${getPart('minute')}`

  return { mskDate, mskTime }
}

export async function getTasksDueNow(): Promise<DbTask[]> {
  const { mskDate, mskTime } = getMskDateTime()

  const allActiveTasks = await prisma.task.findMany({
    where: {
      status: { notIn: ['done', 'draft'] },
      reminderSent: false,
    },
  })

  const dueNow: DbTask[] = []
  const nowMs = new Date(`${mskDate}T${mskTime}:00+03:00`).getTime()

  for (const task of allActiveTasks as any[]) {
    if (!task.dueDate || task.reminderSent) continue
    const tTime = task.dueTime || '09:00'

    // Determine target year/month/date for task
    let tDate = task.dueDate
    if (task.repeat === 'yearly') {
      const currentYear = mskDate.slice(0, 4)
      const monthDay = task.dueDate.length >= 10 ? task.dueDate.slice(5) : task.dueDate
      tDate = `${currentYear}-${monthDay}`
    }

    const taskTargetMs = new Date(`${tDate}T${tTime}:00+03:00`).getTime()
    const offsetMs = (task.reminderOffsetMinutes || 0) * 60 * 1000
    const reminderTriggerMs = taskTargetMs - offsetMs

    // If current MSK minute matches reminderTriggerMs (within 60s window)
    const diffSeconds = Math.abs((nowMs - reminderTriggerMs) / 1000)
    if (diffSeconds <= 60) {
      dueNow.push(task as DbTask)
    }
  }

  return dueNow
}

export async function markReminderSent(id: string, actorChatId?: number | bigint | string | null) {
  try {
    const scope = taskActorScope(actorChatId)
    await prisma.task.updateMany({
      where: scope ? { id, ...scope } : { id },
      data: {
        reminderSent: true,
        remindersSentCount: { increment: 1 },
      },
    })
  } catch {}
}

// ── Subscriptions & Daily Usage Limits ─────────────────────────────────────────

export function isBirthdayOrHolidayTask(task: { title?: string | null; folder?: string | null; tags?: string[] | null }): boolean {
  const titleLower = (task.title || '').toLowerCase()
  const folderLower = (task.folder || '').toLowerCase()
  const tagsStr = (task.tags || []).join(' ').toLowerCase()
  const fullText = `${titleLower} ${folderLower} ${tagsStr}`

  // Standalone 'др', 'д.р.' or 'др.' check with unicode boundary (avoids false matches like 'друг')
  if (/(?:^|[^а-яёa-z0-9])(?:др|д\.р\.|др\.)(?:$|[^а-яёa-z0-9])/i.test(fullText)) {
    return true
  }

  const keywords = [
    'день рождения', 'день рождение', 'дня рождения', 'дню рождения', 'днем рождения',
    'birthday', 'bday', 'праздник', 'праздники', 'праздником', 'holiday',
    'новый год', '8 марта', '23 февраля', 'пасха', 'рождество', 'юбилей', 'годовщина'
  ]
  return keywords.some(kw => fullText.includes(kw))
}

export async function getActiveRemindersCount(ownerChatId: number | bigint | string): Promise<number> {
  try {
    const cid = BigInt(ownerChatId)
    const tasks = await prisma.task.findMany({
      where: {
        ownerChatId: cid,
        status: { notIn: ['done', 'draft'] },
        OR: [
          { dueTime: { not: null } },
          { dueDate: { not: null } }
        ]
      },
      select: { title: true, tags: true }
    })

    return tasks.filter(t => !isBirthdayOrHolidayTask(t)).length
  } catch {
    return 0
  }
}

export async function getStoredNotesCount(ownerChatId: number | bigint | string): Promise<number> {
  try {
    const cid = BigInt(ownerChatId)
    return await prisma.note.count({ where: { ownerChatId: cid } })
  } catch {
    return 0
  }
}

export interface UserUsageLimits {
  /** Normalized plan id (legacy premium -> plus, unlimited -> corp) */
  plan: 'free' | 'plus' | 'pro' | 'corp'
  /** True while a paid subscription is active (or permanent corp / root admin) */
  isPaid: boolean
  subscriptionExpiry: string | null
  voice: {
    used: number
    max: number
    secondsUsed: number
    maxSeconds: number
  }
  notes: {
    used: number
    max: number
  }
  reminders: {
    used: number
    max: number
  }
  chat: {
    used: number
    max: number
  }
  siri: { used: number; max: number }
  photos: { used: number; max: number }
  goals: { used: number; max: number }
  canSendVoice: boolean
  canCreateNote: boolean
  canCreateReminder: boolean
  canSendChatMessage: boolean
  canUseSiri: boolean
  canUsePhoto: boolean
  canCreateGoal: boolean
}

export async function getUserUsageAndLimits(ownerChatId?: number | bigint | string | null): Promise<UserUsageLimits> {
  const freeLimits = (): UserUsageLimits => ({
    plan: 'free',
    isPaid: false,
    subscriptionExpiry: null,
    voice: { used: 0, max: PLANS.free.voiceSecondsPerDay, secondsUsed: 0, maxSeconds: PLANS.free.voiceSecondsPerDay },
    notes: { used: 0, max: PLANS.free.maxStoredNotes },
    reminders: { used: 0, max: PLANS.free.maxActiveReminders },
    chat: { used: 0, max: PLANS.free.chatMessagesPerDay },
    siri: { used: 0, max: PLANS.free.siriLifetimeRequests },
    photos: { used: 0, max: PLANS.free.photosPerDay },
    goals: { used: 0, max: PLANS.free.goalsPerDay },
    canSendVoice: true,
    canCreateNote: true,
    canCreateReminder: true,
    canSendChatMessage: true,
    canUseSiri: true,
    canUsePhoto: false,
    canCreateGoal: true,
  })

  if (!ownerChatId) return freeLimits()

  try {
    const cid = BigInt(ownerChatId)
    const { mskDate } = getMskDateTime()
    const chatIdStr = String(ownerChatId).trim()
    const isRoot = ROOT_ADMIN_IDS.includes(chatIdStr)

    let chat = await prisma.telegramChat.findUnique({ where: { chatId: cid } })
    if (!chat) {
      return freeLimits()
    }

    // Daily reset
    if (chat.lastResetDate !== mskDate) {
      chat = await prisma.telegramChat.update({
        where: { chatId: cid },
        data: {
          lastResetDate: mskDate,
          voiceCountToday: 0,
          voiceSecondsToday: 0,
          notesCountToday: 0,
          chatMessagesToday: 0,
        }
      })
    }

    // Resolve the ACTIVE plan: corp / unlimited / root admin are permanent
    let planId = normalizePlan(chat.plan)
    if (isRoot) {
      planId = 'corp'
    } else if (planId !== 'free') {
      const isPermanent = planId === 'corp' || !chat.subscriptionExpiry
      const expired = !isPermanent && chat.subscriptionExpiry
        ? new Date(chat.subscriptionExpiry) < new Date()
        : false
      if (expired) {
        planId = 'free'
        await prisma.telegramChat.update({
          where: { chatId: cid },
          data: { plan: 'free' }
        }).catch(() => {})
      }
    }

    const limits = PLANS[planId]

    const [siriLifetimeUsed, siriDailyUsed, photoUsed, totalActiveGoalsCount, activeRemindersCount, storedNotesCount] = await Promise.all([
      getLifetimeCount(COUNTERS.siri, chatIdStr),
      getDailyCount(COUNTERS.siri, chatIdStr),
      getDailyCount(COUNTERS.photo, chatIdStr),
      prisma.task.count({
        where: {
          ownerChatId: cid,
          OR: [
            { tags: { has: 'goal' } },
            { tags: { has: 'цель' } },
          ],
          status: { not: 'completed' },
        }
      }).catch(() => 0),
      getActiveRemindersCount(cid),
      getStoredNotesCount(cid),
    ])

    const canSendVoice = chat.voiceSecondsToday < limits.voiceSecondsPerDay
    const siriUsed = planId === 'free' ? siriLifetimeUsed : siriDailyUsed
    const canUseSiri = siriUsed < limits.siriLifetimeRequests
    const canCreateNote = storedNotesCount < limits.maxStoredNotes
    const canCreateReminder = activeRemindersCount < limits.maxActiveReminders
    const canUsePhoto = limits.photosPerDay > 0 && photoUsed < limits.photosPerDay
    const canCreateGoal = totalActiveGoalsCount < limits.goalsPerDay

    return {
      plan: planId,
      isPaid: planId !== 'free',
      subscriptionExpiry: isRoot ? null : (chat.subscriptionExpiry ? chat.subscriptionExpiry.toISOString() : null),
      voice: {
        used: chat.voiceCountToday,
        max: limits.voiceSecondsPerDay,
        secondsUsed: chat.voiceSecondsToday,
        maxSeconds: limits.voiceSecondsPerDay,
      },
      notes: { used: storedNotesCount, max: limits.maxStoredNotes },
      reminders: { used: activeRemindersCount, max: limits.maxActiveReminders },
      chat: { used: chat.chatMessagesToday, max: limits.chatMessagesPerDay },
      siri: { used: siriUsed, max: limits.siriLifetimeRequests },
      photos: { used: photoUsed, max: limits.photosPerDay },
      goals: { used: totalActiveGoalsCount, max: limits.goalsPerDay },
      canSendVoice,
      canCreateNote,
      canCreateReminder,
      canSendChatMessage: chat.chatMessagesToday < limits.chatMessagesPerDay,
      canUseSiri,
      canUsePhoto,
      canCreateGoal,
    }
  } catch {
    return freeLimits()
  }
}

export async function incrementUserUsage(
  ownerChatId: number | bigint | string,
  type: 'voice' | 'note' | 'chat',
  seconds: number = 0
) {
  try {
    const cid = BigInt(ownerChatId)
    const { mskDate } = getMskDateTime()

    const chat = await prisma.telegramChat.findUnique({ where: { chatId: cid } })
    const isDifferentDay = !chat || chat.lastResetDate !== mskDate

    if (type === 'voice') {
      const addedSec = Math.round(seconds) || 0
      await prisma.telegramChat.upsert({
        where: { chatId: cid },
        update: {
          voiceCountToday: isDifferentDay ? 1 : { increment: 1 },
          voiceSecondsToday: isDifferentDay ? addedSec : { increment: addedSec },
          lastResetDate: mskDate,
        },
        create: {
          chatId: cid,
          voiceCountToday: 1,
          voiceSecondsToday: addedSec,
          lastResetDate: mskDate,
        }
      })
    } else if (type === 'note') {
      await prisma.telegramChat.upsert({
        where: { chatId: cid },
        update: {
          notesCountToday: isDifferentDay ? 1 : { increment: 1 },
          lastResetDate: mskDate,
        },
        create: {
          chatId: cid,
          notesCountToday: 1,
          lastResetDate: mskDate,
        }
      })
    } else if (type === 'chat') {
      await prisma.telegramChat.upsert({
        where: { chatId: cid },
        update: {
          chatMessagesToday: isDifferentDay ? 1 : { increment: 1 },
          lastResetDate: mskDate,
        },
        create: {
          chatId: cid,
          chatMessagesToday: 1,
          lastResetDate: mskDate,
        }
      })
    }
  } catch {}
}

export async function activateUserSubscription(
  ownerChatId: number | bigint | string,
  days: number = 30,
  plan: 'plus' | 'pro' | 'corp' = 'plus'
) {
  try {
    if (!Number.isFinite(days) || days <= 0 || days > 3650) return false
    if (!/^\d{3,20}$/.test(String(ownerChatId))) return false
    const cid = BigInt(ownerChatId)

    // Never downgrade an active corp subscription
    const existing = await prisma.telegramChat.findUnique({
      where: { chatId: cid },
      select: { plan: true, subscriptionExpiry: true },
    })
    if (existing && normalizePlan(existing.plan) === 'corp' && plan !== 'corp') return true

    // Extend from the current expiry when the subscription is still active,
    // so repeat payments stack instead of replacing remaining time.
    const now = new Date()
    const base = existing?.subscriptionExpiry && new Date(existing.subscriptionExpiry) > now
      ? new Date(existing.subscriptionExpiry)
      : now
    const expiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)

    await prisma.telegramChat.upsert({
      where: { chatId: cid },
      update: { plan, subscriptionExpiry: expiry },
      create: { chatId: cid, plan, subscriptionExpiry: expiry }
    })
    return true
  } catch {
    return false
  }
}

// ── Visibility ─────────────────────────────────────────────────────────────────

/** Return public tasks/goals for a user (for /schedule command) */
export async function getPublicItemsByUser(chatId: number | bigint | string) {
  try {
    const cid = BigInt(chatId)
    const [tasks, goals, notes] = await Promise.all([
      prisma.task.findMany({
        where: { ownerChatId: cid, visibility: 'public', status: { not: 'done' } },
        orderBy: { dueDate: 'asc' }
      }),
      prisma.goal.findMany({
        where: { ownerChatId: cid, visibility: 'public' },
        orderBy: { deadline: 'asc' }
      }),
      prisma.note.findMany({
        where: { ownerChatId: cid, visibility: 'public' },
        orderBy: { createdAt: 'desc' }
      }),
    ])
    return { tasks, goals, notes }
  } catch {
    return { tasks: [], goals: [], notes: [] }
  }
}

/** Set visibility of a task / goal / note */
export async function setItemVisibility(
  id: string,
  type: 'task' | 'goal' | 'note',
  visibility: 'public' | 'private',
  actorChatId?: number | bigint | string | null
) {
  try {
    if (type === 'task') {
      const scope = taskActorScope(actorChatId)
      const allowed = scope ? await prisma.task.findFirst({ where: { id, ...scope } }) : true
      if (!allowed) return false
      await prisma.task.update({ where: { id }, data: { visibility } })
    } else if (type === 'goal') {
      const scope = ownerActorScope(actorChatId)
      const allowed = scope ? await prisma.goal.findFirst({ where: { id, ...scope } }) : true
      if (!allowed) return false
      await prisma.goal.update({ where: { id }, data: { visibility } })
    } else {
      const scope = ownerActorScope(actorChatId)
      const allowed = scope ? await prisma.note.findFirst({ where: { id, ...scope } }) : true
      if (!allowed) return false
      await prisma.note.update({ where: { id }, data: { visibility } })
    }
    return true
  } catch {
    return false
  }
}

// ── Note-Task Linking ──────────────────────────────────────────────────────────

/** Link a note to a task (both must belong to the actor) */
export async function linkNoteToTask(taskId: string, noteId: string, actorChatId?: number | bigint | string | null) {
  try {
    const taskScope = taskActorScope(actorChatId)
    const task = taskScope
      ? await prisma.task.findFirst({ where: { id: taskId, ...taskScope } })
      : await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) return false
    if (actorChatId != null) {
      const noteAllowed = await prisma.note.findFirst({
        where: { id: noteId, ownerChatId: BigInt(actorChatId) }
      })
      if (!noteAllowed) return false
    }
    const current = (task as any).linkedNoteIds as string[] || []
    if (current.includes(noteId)) return true
    await prisma.task.update({
      where: { id: taskId },
      data: { linkedNoteIds: [...current, noteId] } as any
    })
    return true
  } catch {
    return false
  }
}

/** Unlink a note from a task */
export async function unlinkNoteFromTask(taskId: string, noteId: string, actorChatId?: number | bigint | string | null) {
  try {
    const taskScope = taskActorScope(actorChatId)
    const task = taskScope
      ? await prisma.task.findFirst({ where: { id: taskId, ...taskScope } })
      : await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) return false
    const current = (task as any).linkedNoteIds as string[] || []
    await prisma.task.update({
      where: { id: taskId },
      data: { linkedNoteIds: current.filter(id => id !== noteId) } as any
    })
    return true
  } catch {
    return false
  }
}

// ── Config ─────────────────────────────────────────────────────────────────────

/** Get a configuration value by key */
export async function getConfig(key: string): Promise<string | null> {
  try {
    const config = await prisma.config.findUnique({ where: { key } })
    return config?.value ?? null
  } catch {
    return null
  }
}

/** Set a configuration value */
export async function setConfig(key: string, value: string): Promise<boolean> {
  try {
    await prisma.config.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    })
    return true
  } catch {
    return false
  }
}

/** Cascade update user's name across profile and all friends' birthday reminders */
export async function updateUserNameCascade(chatId: string | bigint, newFirstName: string, newLastName?: string | null) {
  try {
    const cid = BigInt(chatId)
    const firstName = newFirstName.trim()
    const lastName = newLastName?.trim() || null
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || firstName

    // 1. Update TelegramChat table
    await prisma.telegramChat.upsert({
      where: { chatId: cid },
      update: { firstName, lastName },
      create: { chatId: cid, firstName, lastName },
    })

    // 2. Cascade update all birthday tasks across the whole system where this user is the friend
    const friendCidStr = String(cid)
    const bdayTasks = await prisma.task.findMany({
      where: {
        tags: { has: 'день рождения' },
        assignees: { has: friendCidStr },
      }
    })

    for (const t of bdayTasks) {
      await prisma.task.update({
        where: { id: t.id },
        data: {
          title: `🎂 День рождения: ${fullName}`,
          description: `Не забудь поздравить ${fullName} с Днём рождения! 🎉`,
        }
      }).catch(() => {})
    }

    return { success: true, fullName }
  } catch (err) {
    console.error('updateUserNameCascade error:', err)
    return { success: false, error: String(err) }
  }
}

export interface FriendMatch {
  friend: any
  isAllowed: boolean
  reason: string
}

/**
 * Universal intelligent friend matcher across friendships, shared groups, and shared projects
 * Supports exact name, first/last name, username, Russian name clusters and case endings
 */
export async function findFriendMatches(
  userChatId: number | bigint | string,
  recipientName: string
): Promise<FriendMatch[]> {
  const cid = BigInt(userChatId)

  // 1. Get all friendships
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userChatId: cid }, { friendChatId: cid }] }
  })
  const friendIds = new Set<bigint>()
  friendships.forEach((f: any) => friendIds.add(f.userChatId === cid ? f.friendChatId : f.userChatId))

  // 2. Get all group members (shared groups)
  const userGroups = await prisma.groupMembership.findMany({
    where: { memberChatId: cid }
  })
  const groupChatIds = userGroups.map((g: any) => g.groupChatId)
  if (groupChatIds.length > 0) {
    const sharedGroupMembers = await prisma.groupMembership.findMany({
      where: { groupChatId: { in: groupChatIds } }
    })
    sharedGroupMembers.forEach((m: any) => {
      if (m.memberChatId !== cid) friendIds.add(m.memberChatId)
    })
  }

  // 3. Get all project members (shared projects)
  try {
    const userProjects = await prisma.projectDB.findMany({
      where: {
        OR: [
          { ownerChatId: cid },
          { memberIds: { has: cid } }
        ]
      }
    })
    userProjects.forEach((p: any) => {
      if (p.ownerChatId !== cid) friendIds.add(p.ownerChatId)
      p.memberIds.forEach((mId: bigint) => {
        if (mId !== cid) friendIds.add(mId)
      })
    })
  } catch (e) {}

  if (friendIds.size === 0) return []

  const friendChats = await prisma.telegramChat.findMany({
    where: { chatId: { in: Array.from(friendIds) } }
  })

  const rawQuery = recipientName.toLowerCase().trim().replace(/^@/, '')
  const queryTokens = rawQuery.split(/\s+/).filter(Boolean)

  const matchedChats = new Set<any>()

  for (const f of friendChats) {
    const fn = (f.firstName || '').toLowerCase()
    const ln = (f.lastName || '').toLowerCase()
    const un = (f.username || '').toLowerCase().replace(/^@/, '')
    const fullName = `${fn} ${ln}`.trim()
    const candidateNames = [fn, ln, un, fullName].filter(Boolean)

    let isMatch = false
    if (fullName.includes(rawQuery) || fn.includes(rawQuery) || ln.includes(rawQuery) || (un && un.includes(rawQuery))) {
      isMatch = true
    } else {
      // If multi-word query (e.g. "вовчик береговой" / "вовчику береговому")
      if (queryTokens.length >= 2) {
        const matchToken1 = tokenMatchesCandidateName(queryTokens[0], [fn, un]) || fn.includes(queryTokens[0])
        const matchToken2 = tokenMatchesCandidateName(queryTokens[1], [ln, un]) || ln.includes(queryTokens[1])
        if (matchToken1 && matchToken2) {
          isMatch = true
        }
      }

      if (!isMatch) {
        for (const token of queryTokens) {
          if (fn.includes(token) || ln.includes(token) || (un && un.includes(token))) {
            isMatch = true; break
          }
          if ((fn.length >= 3 && (token.includes(fn) || token.startsWith(fn.slice(0, 3)) || fn.startsWith(token.slice(0, 3)))) ||
              (ln.length >= 3 && (token.includes(ln) || token.startsWith(ln.slice(0, 3)) || ln.startsWith(token.slice(0, 3))))) {
            isMatch = true; break
          }

          // Cluster-based matching via comprehensive name-aliases.ts
          if (tokenMatchesCandidateName(token, candidateNames)) {
            isMatch = true; break
          }
        }
      }
    }

    if (isMatch) matchedChats.add(f)
  }

  const results: FriendMatch[] = []
  for (const friend of Array.from(matchedChats)) {
    const fId = friend.chatId
    let isAllowed = false
    let reason = ''

    // Target friend (fId) MUST have allowTasks=true for the sender (cid).
    const fs = friendships.find((f: any) =>
      f.userChatId === fId && f.friendChatId === cid
    )
    if (fs && fs.status === 'accepted' && fs.allowTasks === true) {
      isAllowed = true
      reason = 'friendship'
    }

    results.push({ friend, isAllowed, reason })
  }

  return results
}

/**
 * Universal processor for parsed items supporting shared tasks, delegation, and personal tasks
 */
export async function processParsedItemWithDelegation(
  item: ParsedItem,
  authorChatId?: number | bigint | string | null
): Promise<{ item: ParsedItem; delegated?: boolean; isBothShared?: boolean; friendName?: string; completedTask?: any }> {
  if (!authorChatId) {
    const res = await saveParsedItemToDb(item, null)
    return { item: res.item, completedTask: res.completedTask }
  }

  const cid = BigInt(authorChatId)
  const { recipientName: cleanRecName, isBothShared: cleanIsBothShared } = extractCleanRecipientAndSharing(
    item.rawText || item.title || '',
    item.recipientName,
    item.isBothShared
  )

  if (cleanRecName || item.type === 'delegate') {
    const recName = cleanRecName || item.recipientName
    if (recName) {
      const matches = await findFriendMatches(cid, recName)
      const allowedMatch = matches.find(m => m.isAllowed)

      if (allowedMatch) {
        const friend = allowedMatch.friend
        const friendChatId = BigInt(friend.chatId)
        const isBothShared = cleanIsBothShared

        // Create task for Friend
        const newTask = await prisma.task.create({
          data: {
            title: item.title,
            description: item.summary || '',
            priority: item.priority || 'medium',
            status: 'todo',
            dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
            dueTime: item.dueTime || null,
            repeat: item.repeat || null,
            tags: isBothShared ? ['общая', ...(item.tags || [])] : ['поручение', ...(item.tags || [])],
            ownerChatId: friendChatId,
            authorChatId: cid,
            assignees: [String(cid)],
            isShared: true,
            aiGenerated: true,
            source: item.rawText,
          } as any
        })

        // If shared for both, also create linked copy for author
        if (isBothShared) {
          await prisma.task.create({
            data: {
              title: item.title,
              description: item.summary || '',
              priority: item.priority || 'medium',
              status: 'todo',
              dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
              dueTime: item.dueTime || null,
              repeat: item.repeat || null,
              tags: ['общая', ...(item.tags || [])],
              ownerChatId: cid,
              authorChatId: cid,
              assignees: [String(friendChatId)],
              isShared: true,
              aiGenerated: true,
              source: item.rawText,
            } as any
          })
        }

        // Send Telegram notification to friend if bot token is present
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (botToken && friend.chatId) {
          const sender = await prisma.telegramChat.findUnique({ where: { chatId: cid } })
          const senderName = [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || sender?.firstName || 'Коллега'
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zerph.vercel.app'

          let notifyMsg = isBothShared
            ? `🤝 *${senderName}* создал(а) общую задачу для вас двоих!\n\n`
            : `🤝 *${senderName}* поручил(а) тебе задачу!\n\n`
          notifyMsg += `📌 *Задача:* ${item.title}\n`
          if (item.summary && item.summary !== item.title) {
            notifyMsg += `📝 *Описание:* ${item.summary}\n`
          }
          if (item.dueTime) {
            notifyMsg += `⏰ *Время:* ${item.dueTime}\n`
          }
          notifyMsg += isBothShared
            ? `\n_Общая задача добавлена вам обоим в «Входящие» и календарь в Zerf AI_`
            : `\n_Задача добавлена в ваши «Входящие» и календарь в Zerf AI_`

          let webAppUrl = `${appUrl}/tg?chatId=${friend.chatId}`
          try {
            const sessionToken = await createServerSession(friend.chatId, 'Delegation Notification')
            if (sessionToken) {
              webAppUrl = `${appUrl}/tg?chat_id=${friend.chatId}&auth_token=${sessionToken}`
            }
          } catch (e) {}

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: Number(friend.chatId),
              text: notifyMsg,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📱 Открыть в Zerf App', web_app: { url: webAppUrl } }],
                  [
                    { text: '✓ Принять', callback_data: `delegate_accept_${newTask.id}` },
                    { text: '✗ Отклонить', callback_data: `delegate_decline_${newTask.id}` }
                  ]
                ]
              }
            })
          }).catch(() => {})
        }

        return {
          item: {
            ...item,
            isBothShared,
            recipientName: friend.firstName || recName,
          },
          delegated: true,
          isBothShared,
          friendName: friend.firstName || recName,
        }
      }
    }
  }

  // Otherwise, standard personal save
  const res = await saveParsedItemToDb(item, authorChatId)
  return { item: res.item, completedTask: res.completedTask }
}

/**
 * Completely and irreversibly deletes a user account and all associated data from the database.
 * Cascades removal across Tasks, Notes, Goals, Habits, Friendships, Sessions, Group Memberships,
 * Project/Team assignments, and User Configurations.
 */
export async function deleteUserAccountPermanently(chatId: bigint | string | number): Promise<boolean> {
  try {
    const cid = BigInt(chatId)
    const strCid = String(chatId)

    // 1. Delete all tasks where user is owner or author
    await prisma.task.deleteMany({
      where: { OR: [{ ownerChatId: cid }, { authorChatId: cid }] }
    }).catch(() => {})

    // 2. Delete notes, goals, habits
    await prisma.note.deleteMany({ where: { ownerChatId: cid } }).catch(() => {})
    await prisma.goal.deleteMany({ where: { ownerChatId: cid } }).catch(() => {})
    await prisma.habit.deleteMany({ where: { ownerChatId: cid } }).catch(() => {})

    // 3. Delete friendships in both directions
    await prisma.friendship.deleteMany({
      where: { OR: [{ userChatId: cid }, { friendChatId: cid }] }
    }).catch(() => {})

    // 4. Delete user sessions, group memberships, channel comments
    await prisma.userSession.deleteMany({ where: { chatId: cid } }).catch(() => {})
    await prisma.groupMembership.deleteMany({ where: { memberChatId: cid } }).catch(() => {})
    await prisma.channelComment.deleteMany({ where: { chatId: cid } }).catch(() => {})

    // 5. Delete projects owned by user; remove user from memberIds in other projects
    try {
      const ownedProjects = await (prisma as any).projectDB.findMany({ where: { ownerChatId: cid }, select: { id: true } })
      if (ownedProjects.length > 0) {
        const pIds = ownedProjects.map((p: any) => p.id)
        await prisma.task.deleteMany({ where: { projectDbId: { in: pIds } } }).catch(() => {})
        await (prisma as any).projectDB.deleteMany({ where: { ownerChatId: cid } }).catch(() => {})
      }
      const memberProjects = await (prisma as any).projectDB.findMany({
        where: { memberIds: { has: cid } }
      }).catch(() => [])
      for (const p of memberProjects) {
        const filteredMembers = (p.memberIds || []).filter((m: bigint) => m !== cid)
        await (prisma as any).projectDB.update({
          where: { id: p.id },
          data: { memberIds: filteredMembers }
        }).catch(() => {})
      }
    } catch {}

    // 6. Delete teams owned by user; remove from teams where user is member/admin
    try {
      await prisma.team.deleteMany({ where: { ownerChatId: cid } }).catch(() => {})
      const memberTeams = await prisma.team.findMany({
        where: { memberIds: { has: cid } }
      }).catch(() => [])
      for (const t of memberTeams) {
        const filteredMembers = t.memberIds.filter(m => m !== cid)
        const filteredAdmins = t.adminIds.filter(a => a !== cid)
        await prisma.team.update({
          where: { id: t.id },
          data: { memberIds: filteredMembers, adminIds: filteredAdmins }
        }).catch(() => {})
      }
    } catch {}

    // 7. Delete user configurations.
    // DATA SAFETY: must be an EXACT segment match — a naive `contains: _${cid}`
    // would also delete configs of other users whose IDs contain this ID
    // (e.g. deleting account 123 would wipe configs of user 1234).
    try {
      const candidateKeys = await prisma.config.findMany({
        where: {
          OR: [
            { key: { startsWith: 'cnt_' } },
            { key: { startsWith: 'cron_' } },
            { key: { startsWith: 'news_disabled_' } },
            { key: { startsWith: 'user_' } },
          ],
        },
        select: { key: true },
      })
      const ownedKeys = candidateKeys
        .map(r => r.key)
        .filter(key => key.split('_').includes(strCid))
      if (ownedKeys.length > 0) {
        await prisma.config.deleteMany({ where: { key: { in: ownedKeys } } })
      }
    } catch {}

    // 8. Delete TelegramChat record
    await prisma.telegramChat.deleteMany({ where: { chatId: cid } }).catch(() => {})

    return true
  } catch (err) {
    console.error(`[DeleteUserAccount] Error deleting account ${chatId}:`, err)
    return false
  }
}

/**
 * Periodically cleans up inactive accounts based on user-configured or default retention periods.
 * Default retention: 6 months (180 days). Users can select 1 month (30d), 3 months (90d), 6 months (180d), or 12 months (365d).
 * Accounts inactive longer than their configured threshold are permanently purged with all their notes, tasks and history.
 */
export async function cleanupInactiveAccounts(): Promise<{ deletedCount: number; checkedCount: number }> {
  try {
    const { ROOT_ADMIN_IDS } = await import('./admin')
    const now = new Date()

    const users = await prisma.telegramChat.findMany({
      where: {
        chatId: { notIn: [BigInt(777000), BigInt(1087968824)] },
      },
      select: {
        chatId: true,
        lastActiveAt: true,
        addedAt: true,
        plan: true,
      }
    })

    let deletedCount = 0
    let checkedCount = 0

    for (const user of users) {
      checkedCount++
      const cidStr = user.chatId.toString()
      // Never delete Root Admins or system accounts
      if (ROOT_ADMIN_IDS.includes(cidStr)) continue

      // Look up user's configured auto-delete retention period (in months: 1, 3, 6, 12 or 0 for never)
      let retentionMonths = 6 // Default: 6 months
      try {
        const conf = await prisma.config.findUnique({ where: { key: `user_auto_delete_${cidStr}` } })
        if (conf?.value !== undefined && conf.value !== null) {
          const parsed = Number(conf.value)
          if (!isNaN(parsed)) retentionMonths = parsed
        }
      } catch {}

      // 0 means disabled / never delete
      if (retentionMonths <= 0) continue

      const retentionDays = retentionMonths === 1 ? 30 : retentionMonths === 3 ? 90 : retentionMonths === 6 ? 180 : retentionMonths * 30
      const cutoffTime = now.getTime() - retentionDays * 24 * 60 * 60 * 1000

      const lastActivity = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : user.addedAt ? new Date(user.addedAt).getTime() : 0

      // If user has not been active since before the cutoff date -> delete account completely
      if (lastActivity > 0 && lastActivity < cutoffTime) {
        console.log(`[AutoDelete] Account ${cidStr} inactive for > ${retentionMonths} month(s) (last active: ${new Date(lastActivity).toISOString()}). Deleting permanently...`)
        const deleted = await deleteUserAccountPermanently(user.chatId)
        if (deleted) deletedCount++
      }
    }

    return { deletedCount, checkedCount }
  } catch (err) {
    console.error('[CleanupInactiveAccounts] Error:', err)
    return { deletedCount: 0, checkedCount: 0 }
  }
}

/**
 * Automatically compacts completed tasks older than 7 days without deleting them.
 * Trims bulky descriptions, strips rawText, clears subtasks and reminder flags
 * so they occupy minimum database storage while preserving all metadata for profiles,
 * weekly graphs, streak analytics, and knowledge graph history!
 */
export async function compactOldCompletedTasks(chatId?: number | bigint | string | null): Promise<{ compactedCount: number }> {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const oneWeekAgoDateStr = oneWeekAgo.toISOString().slice(0, 10)

    const whereClause: any = {
      status: 'done',
      OR: [
        { completedAt: { lt: oneWeekAgo } },
        { dueDate: { lt: oneWeekAgoDateStr } },
        { updatedAt: { lt: oneWeekAgo } },
      ],
    }

    if (chatId) {
      const cid = BigInt(chatId)
      whereClause.OR = [
        { ownerChatId: cid, completedAt: { lt: oneWeekAgo } },
        { ownerChatId: cid, dueDate: { lt: oneWeekAgoDateStr } },
        { ownerChatId: cid, updatedAt: { lt: oneWeekAgo } },
      ]
    }

    const oldDoneTasks = await prisma.task.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        rawText: true,
        subtasks: true,
      },
    })

    let compactedCount = 0

    for (const task of oldDoneTasks) {
      const hasBulkyDesc = task.description && task.description.length > 60
      const hasRawText = Boolean(task.rawText)
      const hasBulkySubtasks = Array.isArray(task.subtasks) && task.subtasks.length > 0

      if (hasBulkyDesc || hasRawText || hasBulkySubtasks) {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            description: task.description ? task.description.slice(0, 60) : '',
            rawText: null,
            subtasks: [],
            reminderOffsetMinutes: 0,
          },
        }).catch(() => {})
        compactedCount++
      }
    }

    return { compactedCount }
  } catch (err) {
    console.error('[compactOldCompletedTasks] Error:', err)
    return { compactedCount: 0 }
  }
}

