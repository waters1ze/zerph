/**
 * Zerf Backend — Database Layer (Prisma + Neon PostgreSQL)
 * Replaces the old JSON file DB with real persistent cloud storage.
 */

import { prisma } from './prisma'
import { ParsedItem, stringSimilarity, generateReminderContext } from './groq'
import { ROOT_ADMIN_IDS } from './admin'

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

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getAllTasks(ownerChatId?: number | bigint | string | null) {
  try {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "repeat" TEXT;`)
    } catch (e) {
      // ignore if it fails or already exists
    }
    
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
              { assignees: { has: strId } }
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

    const seen = new Set<string>()
    const uniqueTasks = allTasks.filter(t => {
      if (isBirthdayTitle(t.title)) {
        const normKey = t.title.replace(/^🎂\s*/, '').trim().toLowerCase()
        if (seen.has(normKey)) return false
        seen.add(normKey)
      }
      return true
    })

    return uniqueTasks.map(t => {
      if (isBirthdayTitle(t.title)) {
        return {
          ...t,
          title: t.title.startsWith('🎂') ? t.title : `🎂 ${t.title}`,
          dueTime: '00:00',
        }
      } else {
        // Strip erroneous 🎂 from non-birthday tasks
        return {
          ...t,
          title: t.title.replace(/^🎂\s*/, ''),
        }
      }
    })
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

function processBirthdayTaskData<T extends { title: string; dueTime?: string | null; repeat?: string | null; tags?: string[] }>(data: T): T {
  const isBirthday = isBirthdayTitle(data.title)

  if (isBirthday) {
    let title = data.title.trim()
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
    let title = data.title.replace(/^🎂\s*/, '').trim()
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

  return prisma.task.create({
    data: {
      title: processed.title,
      description: processed.description || '',
      priority: processed.priority || 'medium',
      status: processed.status || 'todo',
      dueDate: processed.dueDate || new Date().toISOString().slice(0, 10),
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
}

export function calculateNextRecurrenceDate(currentDueDate: string | null | undefined, repeat: string): string {
  const baseDate = currentDueDate ? new Date(currentDueDate) : new Date()
  const nextDate = new Date(baseDate)

  if (repeat === 'yearly') {
    nextDate.setFullYear(nextDate.getFullYear() + 1)
  } else if (repeat === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + 1)
  } else if (repeat === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7)
  } else if (repeat === 'weekdays') {
    const day = nextDate.getDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    if (day === 5) {
      nextDate.setDate(nextDate.getDate() + 3) // Friday -> Monday
    } else if (day === 6) {
      nextDate.setDate(nextDate.getDate() + 2) // Saturday -> Monday
    } else {
      nextDate.setDate(nextDate.getDate() + 1) // Sun-Thu -> next day
    }
  } else if (repeat === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1)
  }

  const nextYearStr = nextDate.getFullYear()
  const nextMonthStr = String(nextDate.getMonth() + 1).padStart(2, '0')
  const nextDayStr = String(nextDate.getDate()).padStart(2, '0')
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
    if (!BOT_TOKEN) return

    const msg = `🎉 *Порученная задача выполнена!*\n\n` +
      `👤 *${doerName}* выполнил(а) задачу:\n` +
      `📌 *«${task.title}»*\n` +
      (task.dueTime ? `⏰ Время: ${task.dueTime}\n` : '') +
      `\n✨ _Уведомление от Zerf AI_`

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(task.authorChatId),
        text: msg,
        parse_mode: 'Markdown',
      }),
    }).catch(() => {})
  } catch (err) {
    console.error('Error notifying author of task completion:', err)
  }
}

export async function updateTask(id: string, data: Partial<{
  status: string
  priority: string
  dueDate: string
  dueTime: string
  reminderSent: boolean
  remindersSentCount: number
  completedAt: Date
}>) {
  if (data.status === 'done') {
    const existing = await prisma.task.findUnique({ where: { id } })
    if (existing && existing.status !== 'done' && existing.repeat) {
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
        }
      })
      // Clear repeat flag on the completed instance so it doesn't get processed again
      data = { ...data, repeat: null } as any
    }

    if (existing && data.status === 'done' && existing.status !== 'done') {
      if (existing.ownerChatId) {
        recordTaskCompletionStreak(existing.ownerChatId).catch(() => {})
      }
      if (existing.authorChatId && existing.ownerChatId && String(existing.authorChatId) !== String(existing.ownerChatId)) {
        notifyAuthorTaskCompleted(existing).catch(() => {})
      }
    }
  }
  return prisma.task.update({ where: { id }, data })
}

export async function completeTask(id: string) {
  return updateTask(id, {
    status: 'done',
    completedAt: new Date(),
    reminderSent: true,
  })
}

export async function recordTaskCompletionStreak(
  ownerChatId?: number | bigint | string | null
): Promise<{ streakDays: number; earnedReward: boolean }> {
  if (!ownerChatId) return { streakDays: 0, earnedReward: false }
  try {
    const cid = BigInt(ownerChatId)
    const { mskDate } = getMskDateTime()
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

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

export async function deleteTask(id: string) {
  try {
    return await prisma.task.deleteMany({ where: { id } })
  } catch {
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
  return prisma.habit.create({
    data: {
      title: data.title,
      icon: data.icon,
      frequency: data.frequency || 'daily',
      ownerChatId: data.ownerChatId ? BigInt(data.ownerChatId) : null,
    },
  })
}

export async function updateHabit(id: string, data: Partial<{
  title: string
  icon: string
  streak: number
  lastCompletedAt: string | null
  frequency: string
}>) {
  return prisma.habit.update({ where: { id }, data })
}

export async function deleteHabit(id: string) {
  try {
    return await prisma.habit.delete({ where: { id } })
  } catch {
    return { count: 0 }
  }
}

/**
 * Find the best matching non-done task by title similarity
 */
export async function completeTaskByTitle(targetTitle: string, ownerChatId?: number | bigint | string | null): Promise<DbTask | null> {
  const whereClause: Record<string, unknown> = { status: { notIn: ['done', 'draft'] } }
  if (ownerChatId) {
    whereClause.OR = [{ ownerChatId: BigInt(ownerChatId) }, { ownerChatId: null }]
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
  })

  let best: { task: DbTask; score: number } | null = null
  for (const task of tasks) {
    const score = stringSimilarity(targetTitle, task.title)
    if (score > 0.3 && (!best || score > best.score)) {
      best = { task: task as DbTask, score }
    }
  }

  if (!best) return null

  const updated = await prisma.task.update({
    where: { id: best.task.id },
    data: { status: 'done', completedAt: new Date() },
  })
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
  return prisma.goal.create({
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
}

export async function updateGoal(id: string, data: object) {
  return prisma.goal.update({ where: { id }, data: data as never })
}

export async function deleteGoal(id: string) {
  try {
    return await prisma.goal.deleteMany({ where: { id } })
  } catch {
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
}>) {
  return prisma.note.update({ where: { id }, data })
}

export async function deleteNote(id: string) {
  try {
    return await prisma.note.deleteMany({ where: { id } })
  } catch {
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
      if (limits.plan === 'premium') {
        return { hasPremium: true, premiumPayerId: cid }
      }
    }

    // Fallback: Check if ANY registered chat in DB has active Premium
    const allPremium = await prisma.telegramChat.findMany({
      where: { plan: 'premium' }
    })

    const activePremium = allPremium.find(p => {
      if (!p.subscriptionExpiry) return true
      return new Date(p.subscriptionExpiry) >= new Date()
    })

    if (activePremium) {
      return { hasPremium: true, premiumPayerId: activePremium.chatId }
    }
  } catch {}
  return { hasPremium: false }
}

/**
 * Deduct usage for group requests:
 * 1. If Root Owner (6136950061) is in the group -> 100% deducted from Owner (infinite limits, members are untouched)
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
        if (limits.plan === 'premium') {
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

  // 1. Verify friendship and allowTasks permission
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { userChatId: vCid, friendChatId: tCid },
        { userChatId: tCid, friendChatId: vCid },
      ]
    }
  })

  const isFriend = friendships.some(f => f.status === 'accepted') || vCid === tCid
  // The toggle "Разрешить задачи от этого человека" must be true for task & schedule sharing
  const allowsTasks = friendships.some(f => f.status === 'accepted' && f.allowTasks === true) || vCid === tCid

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

export async function getExistingItemsContext(ownerChatId?: number | bigint | string | null): Promise<string> {
  try {
    const tasks = await getAllTasks(ownerChatId)
    const goals = await getAllGoals(ownerChatId)
    const notes = await getAllNotes(ownerChatId)

    const activeTasks = tasks.filter(t => t.status !== 'done').slice(0, 15)
    const activeGoals = goals.slice(0, 10)

    const lines: string[] = []

    if (activeGoals.length) {
      lines.push('🎯 ЦЕЛИ ПОЛЬЗОВАТЕЛЯ:')
      activeGoals.forEach(g => {
        lines.push(`- ID: ${g.id} | Название: "${g.title}" | Дедлайн: ${g.deadline || 'не указан'} | Описание: ${g.description || ''}`)
      })
    }

    if (activeTasks.length) {
      lines.push('\n📋 ЗАДАЧИ / НАПОМИНАНИЯ ПОЛЬЗОВАТЕЛЯ:')
      activeTasks.forEach(t => {
        lines.push(`- ID: ${t.id} | Название: "${t.title}" | Дата: ${t.dueDate || 'не указана'} | Время: ${t.dueTime || 'не указано'} | Приоритет: ${t.priority}`)
      })
    }

    if (notes.length) {
      lines.push('\n📌 ВСЕ ЗАМЕТКИ ПОЛЬЗОВАТЕЛЯ (полный текст):')
      notes.slice(0, 20).forEach(n => {
        const bodyText = (n.content || n.originalText || '').replace(/\n+/g, ' ').slice(0, 500)
        lines.push(`- ID: ${n.id} | Заголовок: "${n.title}" | Содержание: "${bodyText}"`)
      })
    }

    return lines.join('\n')
  } catch {
    return ''
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
      const taskToDelete = await prisma.task.findUnique({ where: { id: item.targetId } })
      if (taskToDelete && taskToDelete.title.startsWith('🎂 День рождения:') && taskToDelete.assignees.length >= 2) {
         const friendId = taskToDelete.assignees[1]
         await prisma.telegramChat.update({
           where: { chatId: BigInt(friendId) },
           data: { birthday: null }
         }).catch(() => {})
      }
      await deleteTask(item.targetId)
      await deleteGoal(item.targetId)
      await deleteNote(item.targetId)
      return { item, updatedItem: true }
    } else {
      // Find matching task or goal by title similarity
      const targetName = item.targetTitle || item.title || item.rawText
      const tasks = await getAllTasks(ownerChatId)
      let best: { id: string; score: number } | null = null
      for (const t of tasks) {
        const score = stringSimilarity(targetName, t.title)
        if (score > 0.3 && (!best || score > best.score)) {
          best = { id: t.id, score }
        }
      }
      if (best) {
        const taskToDelete = await prisma.task.findUnique({ where: { id: best.id } })
        if (taskToDelete && taskToDelete.title.startsWith('🎂 День рождения:') && taskToDelete.assignees.length >= 2) {
           const friendId = taskToDelete.assignees[1]
           await prisma.telegramChat.update({
             where: { chatId: BigInt(friendId) },
             data: { birthday: null }
           }).catch(() => {})
        }
        await deleteTask(best.id)
        return { item, updatedItem: true }
      } else {
        // Fallback: Delete most recent note or task if no title match
        if (ownerChatId) {
          const lastNote = await prisma.note.findFirst({
            where: { ownerChatId: BigInt(ownerChatId) },
            orderBy: { createdAt: 'desc' }
          })
          const lastTask = await prisma.task.findFirst({
            where: { ownerChatId: BigInt(ownerChatId) },
            orderBy: { createdAt: 'desc' }
          })
          if (lastNote && (!lastTask || lastNote.createdAt > lastTask.createdAt)) {
            await deleteNote(lastNote.id)
            item.title = `Заметка «${lastNote.title}» удалена`
            return { item, updatedItem: true }
          } else if (lastTask) {
            await deleteTask(lastTask.id)
            item.title = `Задача «${lastTask.title}» удалена`
            return { item, updatedItem: true }
          }
        }
      }
    }
  }

  // Update action
  if (item.action === 'update' && item.targetId) {
    const updateData: Record<string, unknown> = {}
    if (item.title) updateData.title = item.title
    if (item.summary) updateData.description = item.summary
    if (item.dueDate !== undefined) updateData.dueDate = item.dueDate
    if (item.dueTime !== undefined) updateData.dueTime = item.dueTime
    if (item.priority) updateData.priority = item.priority

    // Try updating task first
    try {
      await prisma.task.update({
        where: { id: item.targetId },
        data: updateData as never,
      })
      return { item, updatedItem: true }
    } catch {}

    // Try updating goal
    try {
      const goalUpdateData: Record<string, unknown> = {}
      if (item.title) goalUpdateData.title = item.title
      if (item.summary) goalUpdateData.description = item.summary
      if (item.dueDate !== undefined) goalUpdateData.deadline = item.dueDate
      await prisma.goal.update({
        where: { id: item.targetId },
        data: goalUpdateData as never,
      })
      return { item, updatedItem: true }
    } catch {}

    // Try updating note
    try {
      const noteUpdateData: Record<string, unknown> = {}
      if (item.title) noteUpdateData.title = item.title
      if (item.summary) noteUpdateData.content = item.summary
      await prisma.note.update({
        where: { id: item.targetId },
        data: noteUpdateData as never,
      })
      return { item, updatedItem: true }
    } catch {}
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
    const isExplicitNote = rawLower.startsWith('заметк') || rawLower.includes('запиши заметку') || rawLower.includes('сохрани заметку') || rawLower.includes('в заметки')

    // If it's not explicitly a note request and has dummy placeholder content, treat as task instead!
    if (!isExplicitNote && (item.summary?.includes('Нет информации') || item.title === 'Новая заметка' || !item.summary || item.summary === item.title)) {
      item.type = 'task'
      if (item.title === 'Новая заметка' && item.rawText && item.rawText !== 'Новая заметка') {
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

    const mdContent = item.summary.includes('#')
      ? item.summary
      : `# ${item.title}\n\n${item.summary}`

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

    // Track note usage (so daily limits are enforced per-note)
    if (ownerChatId) {
      await incrementUserUsage(ownerChatId, 'note').catch(() => {})
    }

    const today = new Date().toISOString().slice(0, 10)
    
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
          item.summary.slice(0, 500),
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

    let finalDueDate = item.dueDate || new Date().toISOString().slice(0, 10)
    // If time is set but dueDate was not explicitly given, check if that time has already passed today
    if (!item.dueDate && extractedTime) {
      const now = new Date()
      const [dueH, dueM] = extractedTime.split(':').map(Number)
      const currentH = now.getHours()
      const currentM = now.getMinutes()
      if (currentH > dueH || (currentH === dueH && currentM >= dueM)) {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        finalDueDate = tomorrow.toISOString().slice(0, 10)
      }
    }

    const isYearlyEvent = /(?:^|[^а-яёa-z0-9])(?:день\s*рождения|д\.?\s*р\.?|праздник|годовщин\w*)(?:[^а-яёa-z0-9]|$)/i.test(item.title || item.rawText || '')
    const finalRepeat = item.repeat || (isYearlyEvent ? 'yearly' : null)

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
    const categorizedTags = autoCategorizeTags(item.title, desc, baseTags)

    await createTask({
      title: item.title,
      description: desc,
      priority: item.priority || 'medium',
      dueDate: finalDueDate,
      dueTime: extractedTime,
      repeat: finalRepeat,
      reminderOffsetMinutes: item.reminderOffsetMinutes || 0,
      tags: categorizedTags,
      aiGenerated: true,
      source: item.rawText,
      ownerChatId: ownerChatId || null,
      assignees: item.assignees || [],
      isShared: item.isShared || false,
      subtasks: (item.subtasks || []).map((st, i) => ({
        id: `st_${i}_${Date.now()}`,
        title: st,
        done: false,
      })),
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

async function fetchTelegramUserProfile(chatId: bigint | number): Promise<{ firstName?: string; lastName?: string; username?: string } | null> {
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
      if (firstName || username) {
        await prisma.telegramChat.upsert({
          where: { chatId: BigInt(chatId) },
          update: {
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            username: username || undefined,
          },
          create: {
            chatId: BigInt(chatId),
            firstName: firstName || null,
            lastName: lastName || null,
            username: username || null,
          },
        }).catch(() => {})
        return { firstName, lastName, username }
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
        const friendship = friendships.find(f => 
          (f.userChatId === cid && f.friendChatId === fid) || 
          (f.userChatId === fid && f.friendChatId === cid)
        )

        let chat = chatMap.get(fidStr)

        if (!chat || (!chat.firstName && !chat.username)) {
          const fetched = await fetchTelegramUserProfile(fid)
          if (fetched) {
            chat = {
              chatId: fid,
              firstName: fetched.firstName || null,
              lastName: fetched.lastName || null,
              username: fetched.username || null,
              birthday: chat?.birthday || null,
              reminderIntervalMinutes: 5,
              reminderRepeatCount: 3,
              plan: 'free',
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
        
        return {
          id: fidStr,
          name,
          email: chat?.username ? `@${chat.username}` : '',
          chatId: fidStr,
          username: chat?.username || '',
          status,
          addedAt: new Date().toISOString(),
          birthday: chat?.birthday || null,
          allowTasks: (friendship as any)?.allowTasks ?? (isBot ? true : false),
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

export function parseBirthday(input: string | null | undefined): { month: number; day: number; year?: number; iso: string } | null {
  if (!input) return null
  const cleaned = input.trim()

  // 1. Check YYYY-MM-DD (e.g. 2010-04-03)
  const isoMatch = cleaned.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const day = parseInt(isoMatch[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        year, month, day,
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    }
  }

  // 2. Check DD.MM.YYYY or DD-MM-YYYY or DD/MM/YYYY (e.g. 03.04.2010 or 03-04-2010)
  const ruMatch = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (ruMatch) {
    const day = parseInt(ruMatch[1], 10)
    const month = parseInt(ruMatch[2], 10)
    const year = parseInt(ruMatch[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        year, month, day,
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    }
  }

  // 3. Check DD.MM or DD-MM (e.g. 03.04 or 03-04)
  const shortMatch = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})$/)
  if (shortMatch) {
    const n1 = parseInt(shortMatch[1], 10)
    const n2 = parseInt(shortMatch[2], 10)
    let day = n1
    let month = n2
    if (n1 <= 12 && n2 > 12) {
      month = n1
      day = n2
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        month, day,
        iso: `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    }
  }

  // 4. Natural text in Russian: "3 апреля", "3 апреля 2010", "15 мая", "20 декабря 1995"
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
          return {
            year,
            month: mNum,
            day,
            iso: year
              ? `${year}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              : `${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          }
        }
      }
    }
  }

  return null
}

export async function broadcastMyBirthdayToFriends(myChatId: number | bigint | string): Promise<void> {
  try {
    const cid = BigInt(myChatId)
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userChatId: cid }, { friendChatId: cid }] },
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

    // 1. Get all friends of this user
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userChatId: cid }, { friendChatId: cid }] },
    })

    const friendChatIds = friendships.map(f => f.userChatId === cid ? f.friendChatId : f.userChatId)

    // 2. Find friend profiles with birthday set
    const friendChats = friendChatIds.length > 0
      ? await prisma.telegramChat.findMany({
          where: { chatId: { in: friendChatIds }, birthday: { not: null } },
        })
      : []

    const currentYear = new Date().getFullYear()
    let createdCount = 0

    // 3. Upsert birthday tasks for each friend — one task per friend chatId
    for (const friend of friendChats) {
      if (friend.chatId === cid) continue // Do not create a reminder task to congratulate yourself
      if (!friend.birthday) continue
      const parsed = parseBirthday(friend.birthday)
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
        if (existing.dueDate && existing.dueDate < targetDueDate) {
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
      // Find the friend chatId stored in assignees (not the owner)
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

    // 5. Delete birthday tasks for friends who no longer exist or have no birthday
    const validFriendIds = new Set(friendChats.map(f => String(f.chatId)))
    for (const t of allBdayTasks) {
      const friendId = (t.assignees || []).find((a: string) => a !== String(cid))
      if (friendId && !validFriendIds.has(friendId)) {
        await prisma.task.delete({ where: { id: t.id } }).catch(() => {})
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
    },
  })

  const dueNow: DbTask[] = []
  const nowMs = new Date(`${mskDate}T${mskTime}:00+03:00`).getTime()

  for (const task of allActiveTasks as any[]) {
    if (!task.dueDate) continue
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

    // If current MSK minute matches reminderTriggerMs (within 90s window)
    const diffSeconds = Math.abs((nowMs - reminderTriggerMs) / 1000)
    if (diffSeconds < 90) {
      dueNow.push(task as DbTask)
    }
  }

  return dueNow
}

export async function markReminderSent(id: string) {
  try {
    await prisma.task.update({
      where: { id },
      data: {
        reminderSent: true,
        remindersSentCount: { increment: 1 },
      },
    })
  } catch {}
}

// ── Subscriptions & Daily Usage Limits ─────────────────────────────────────────

export interface UserUsageLimits {
  plan: 'free' | 'premium'
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
  chat: {
    used: number
    max: number
  }
  canSendVoice: boolean
  canCreateNote: boolean
  canSendChatMessage: boolean
}

export async function getUserUsageAndLimits(ownerChatId?: number | bigint | string | null): Promise<UserUsageLimits> {
  const defaultLimits: UserUsageLimits = {
    plan: 'free',
    subscriptionExpiry: null,
    voice: { used: 0, max: 5, secondsUsed: 0, maxSeconds: 180 },
    notes: { used: 0, max: 5 },
    chat: { used: 0, max: 20 },
    canSendVoice: true,
    canCreateNote: true,
    canSendChatMessage: true,
  }

  if (!ownerChatId) return defaultLimits

  try {
    const cid = BigInt(ownerChatId)
    const { mskDate } = getMskDateTime()

    let chat = await prisma.telegramChat.findUnique({ where: { chatId: cid } })

    if (!chat) {
      chat = await prisma.telegramChat.create({
        data: { chatId: cid, lastResetDate: mskDate }
      })
    }

    // Expiry check: ONLY Root Admin (Owner) has permanent unlimited Premium
    const chatIdStr = String(ownerChatId).trim()
    const isRoot = ROOT_ADMIN_IDS.includes(chatIdStr)

    let isPremium = false

    if (isRoot) {
      isPremium = true
    } else if (chat.plan === 'premium' && chat.subscriptionExpiry) {
      if (new Date(chat.subscriptionExpiry) >= new Date()) {
        isPremium = true
      } else {
        // Expired
        isPremium = false
        await prisma.telegramChat.update({
          where: { chatId: cid },
          data: { plan: 'free' }
        }).catch(() => {})
      }
    } else if (chat.plan === 'premium' && !chat.subscriptionExpiry) {
      // Erroneous premium without expiry
      isPremium = false
      await prisma.telegramChat.update({
        where: { chatId: cid },
        data: { plan: 'free' }
      }).catch(() => {})
    }

    // Daily reset check
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

    const voiceMax = isPremium ? Infinity : 5
    const voiceMaxSeconds = isPremium ? 1200 : 300 // 20 min for premium, 5 min for free (1 min per message)
    const notesMax = isPremium ? Infinity : 10
    const chatMax = isPremium ? Infinity : 20

    const canSendVoice = isPremium
      ? (chat.voiceSecondsToday < 1200)
      : (chat.voiceCountToday < 5 && chat.voiceSecondsToday < 300)
    const canCreateNote = isPremium ? true : (chat.notesCountToday < 10)
    const canSendChatMessage = isPremium ? true : (chat.chatMessagesToday < 20)

    return {
      plan: isPremium ? 'premium' : 'free',
      subscriptionExpiry: isRoot ? null : (chat.subscriptionExpiry ? chat.subscriptionExpiry.toISOString() : null),
      voice: {
        used: chat.voiceCountToday,
        max: isPremium ? Infinity : 5,
        secondsUsed: chat.voiceSecondsToday,
        maxSeconds: voiceMaxSeconds,
      },
      notes: {
        used: chat.notesCountToday,
        max: isPremium ? Infinity : 10,
      },
      chat: {
        used: chat.chatMessagesToday,
        max: isPremium ? Infinity : 20,
      },
      canSendVoice,
      canCreateNote,
      canSendChatMessage,
    }
  } catch {
    return defaultLimits
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

export async function activateUserSubscription(ownerChatId: number | bigint | string, days: number = 30) {
  try {
    const cid = BigInt(ownerChatId)
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + days)

    await prisma.telegramChat.upsert({
      where: { chatId: cid },
      update: {
        plan: 'premium',
        subscriptionExpiry: expiry,
      },
      create: {
        chatId: cid,
        plan: 'premium',
        subscriptionExpiry: expiry,
      }
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
  visibility: 'public' | 'private'
) {
  try {
    if (type === 'task') {
      await prisma.task.update({ where: { id }, data: { visibility } })
    } else if (type === 'goal') {
      await prisma.goal.update({ where: { id }, data: { visibility } })
    } else {
      await prisma.note.update({ where: { id }, data: { visibility } })
    }
    return true
  } catch {
    return false
  }
}

// ── Note-Task Linking ──────────────────────────────────────────────────────────

/** Link a note to a task */
export async function linkNoteToTask(taskId: string, noteId: string) {
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) return false
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
export async function unlinkNoteFromTask(taskId: string, noteId: string) {
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } })
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

