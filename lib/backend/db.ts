/**
 * Zerf Backend — Database Layer (Prisma + Neon PostgreSQL)
 * Replaces the old JSON file DB with real persistent cloud storage.
 */

import { prisma } from './prisma'
import { ParsedItem, stringSimilarity, generateReminderContext } from './groq'

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
        orderBy: { createdAt: 'desc' }
      })
    }

    const seen = new Set<string>()
    const uniqueTasks = allTasks.filter(t => {
      const lower = (t.title || '').toLowerCase()
      if (lower.includes('день рождения') || lower.includes('др')) {
        const normKey = t.title.replace(/^🎂\s*/, '').trim().toLowerCase()
        if (seen.has(normKey)) return false
        seen.add(normKey)
      }
      return true
    })

    return uniqueTasks.map(t => {
      if (t.title && t.title.includes('День рождения')) {
        return {
          ...t,
          title: t.title.startsWith('🎂') ? t.title : `🎂 ${t.title}`,
          dueTime: '00:00',
        }
      }
      return t
    })
  } catch (err) {
    console.error('getAllTasks error:', err)
    return []
  }
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

function processBirthdayTaskData<T extends { title: string; dueTime?: string | null; repeat?: string | null; tags?: string[] }>(data: T): T {
  const lower = (data.title || '').toLowerCase()
  const isBirthday = lower.includes('день рождения') || lower.includes('др ') || lower.includes('др:') || lower.endsWith('др')

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
  }
  return data
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
      tags: processed.tags || [],
      assignees: processed.assignees || [],
      isShared: processed.isShared || false,
      subtasks: processed.subtasks || [],
      rawText: processed.rawText || null,
      aiGenerated: processed.aiGenerated || false,
      source: processed.source || null,
      ownerChatId: processed.ownerChatId ? BigInt(processed.ownerChatId) : null,
    },
  })
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
      let nextDate = new Date(existing.dueDate || new Date().toISOString().slice(0, 10))
      if (existing.repeat === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1)
      else if (existing.repeat === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
      else if (existing.repeat === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
      else if (existing.repeat === 'daily') nextDate.setDate(nextDate.getDate() + 1)
      
      const nextYearStr = nextDate.getFullYear()
      const nextMonthStr = String(nextDate.getMonth() + 1).padStart(2, '0')
      const nextDayStr = String(nextDate.getDate()).padStart(2, '0')
      const nextDateStr = `${nextYearStr}-${nextMonthStr}-${nextDayStr}`

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
          projectId: existing.projectId
        }
      })
      // Clear repeat flag on the completed instance so it doesn't get processed again
      data = { ...data, repeat: null } as any
    }
  }
  return prisma.task.update({ where: { id }, data })
}

export async function deleteTask(id: string) {
  try {
    return await prisma.task.deleteMany({ where: { id } })
  } catch {
    return { count: 0 }
  }
}

/**
 * Find the best matching non-done task by title similarity
 */
export async function completeTaskByTitle(targetTitle: string, ownerChatId?: number | bigint | string | null): Promise<DbTask | null> {
  const whereClause: Record<string, unknown> = { status: { not: 'done' } }
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
  ownerChatId?: number | bigint | string | null
}) {
  return prisma.note.create({
    data: {
      title: data.title,
      content: data.content,
      originalText: data.originalText || null,
      type: data.type || 'note',
      tags: data.tags || [],
      dueDate: data.dueDate || null,
      dueTime: data.dueTime || null,
      aiGenerated: data.aiGenerated || false,
      ownerChatId: data.ownerChatId ? BigInt(data.ownerChatId) : null,
    },
  })
}

export async function updateNote(id: string, data: Partial<{
  title: string
  content: string
  type: string
  tags: string[]
  dueDate: string | null
  dueTime: string | null
  pinned: boolean
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
) {
  try {
    const cid = BigInt(chatId)
    const updateData: { firstName?: string; username?: string; lastName?: string } = {}
    if (firstName) updateData.firstName = firstName
    if (username) updateData.username = username
    if (lastName) updateData.lastName = lastName

    await prisma.telegramChat.upsert({
      where: { chatId: cid },
      update: updateData,
      create: {
        chatId: cid,
        firstName: firstName || null,
        lastName: lastName || null,
        username: username || null,
      },
    })
  } catch {}
}

export async function checkGroupOrUserHasPremium(
  senderChatId: number | bigint,
  groupChatId?: number | bigint,
  memberChatIds: (number | bigint)[] = []
): Promise<{ hasPremium: boolean; premiumPayerId?: bigint }> {
  try {
    const idsToCheck = [senderChatId, ...memberChatIds].filter(Boolean).map(id => BigInt(id))

    for (const cid of idsToCheck) {
      if (String(cid) === '6136950061') {
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
  } catch {}
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
  ownerChatId?: number | bigint | string | null
): Promise<{
  item: ParsedItem
  completedTask?: DbTask | null
  updatedItem?: boolean
}> {
  // Delete all tasks action
  const textLower = (item.rawText || item.title || '').toLowerCase().trim()
  if (item.action === 'delete_all' || textLower.includes('удали все') || textLower.includes('очисти все') || textLower.includes('удали всё') || textLower.includes('очистить все')) {
    if (ownerChatId) {
      await prisma.task.deleteMany({ where: { ownerChatId: BigInt(ownerChatId) } })
    }
    return { item, updatedItem: true }
  }

  // Delete specific task action
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

  if (item.type === 'goal') {
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
    const mdContent = item.summary.includes('#')
      ? item.summary
      : `# ${item.title}\n\n${item.summary}`

    await createNote({
      title: item.title,
      content: mdContent,
      originalText: item.rawText,
      type: 'note',
      tags: item.tags || [],
      aiGenerated: true,
      ownerChatId,
    })

    // ── Auto-reminder: if note content contains a time, create a companion task ──
    const noteText = `${item.title} ${item.summary} ${item.rawText || ''}`
    const timeMatch = noteText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
    const naturalMatch = noteText.match(/в\s+([01]?\d|2[0-3]):([0-5]\d)/i)
    const extractedTime = (naturalMatch || timeMatch)
      ? `${((naturalMatch || timeMatch)![1]).padStart(2, '0')}:${(naturalMatch || timeMatch)![2]}`
      : null

    if (extractedTime) {
      const today = new Date().toISOString().slice(0, 10)
      // Generate a warm AI context message
      const context = await generateReminderContext(
        item.title,
        item.summary.slice(0, 500),
        extractedTime
      ).catch(() => `Напоминание: «${item.title}» в ${extractedTime}. Готовься! 🎯`)

      await createTask({
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
    }
  } else {
    // Task, reminder, or default
    const desc = item.recipientName
      ? `📩 Отправить ${item.recipientName}: ${item.summary}`
      : item.summary

    let finalDueDate = item.dueDate || new Date().toISOString().slice(0, 10)
    const finalRepeat = item.repeat || ((item.title || item.rawText || '').toLowerCase().match(/день рожд|др|праздник|годовщин/) ? 'yearly' : null)

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

    await createTask({
      title: item.title,
      description: desc,
      priority: item.priority || 'medium',
      dueDate: finalDueDate,
      dueTime: item.dueTime || undefined,
      repeat: finalRepeat,
      reminderOffsetMinutes: item.reminderOffsetMinutes || 0,
      tags: item.recipientName ? [...(item.tags || []), item.recipientName] : item.tags,
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

    // 1. Get explicit friendships (bidirectional)
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ userChatId: cid }, { friendChatId: cid }],
      },
    })
    friendships.forEach(f => {
      if (f.userChatId !== cid) contactIdsSet.add(f.userChatId)
      if (f.friendChatId !== cid) contactIdsSet.add(f.friendChatId)
    })

    // 2. Find all co-assignees from shared tasks
    const sharedTasks = await prisma.task.findMany({
      where: {
        OR: [{ ownerChatId: cid }, { assignees: { has: strId } }],
      },
      select: { assignees: true, ownerChatId: true },
    })

    sharedTasks.forEach(t => {
      if (t.ownerChatId && t.ownerChatId !== cid) contactIdsSet.add(t.ownerChatId)
      t.assignees.forEach(a => {
        try {
          const aCid = BigInt(a)
          if (aCid !== cid) contactIdsSet.add(aCid)
        } catch {}
      })
    })

    // 3. Find all co-members from GroupMembership table (all members of any group this user is in)
    try {
      const userGroups = await prisma.groupMembership.findMany({
        where: { memberChatId: cid },
        select: { groupChatId: true },
      })
      if (userGroups.length > 0) {
        const groupIds = userGroups.map(g => g.groupChatId)
        const groupMembers = await prisma.groupMembership.findMany({
          where: { groupChatId: { in: groupIds } },
          select: { memberChatId: true },
        })
        groupMembers.forEach(m => {
          if (m.memberChatId !== cid) contactIdsSet.add(m.memberChatId)
        })
      }
    } catch {}

    // Auto-create bidirectional friendship records in DB for all discovered contacts
    for (const fid of contactIdsSet) {
      if (fid !== cid) {
        autoAddFriends(cid, fid).catch(() => {})
      }
    }

    const friendIds = Array.from(contactIdsSet)
    if (friendIds.length === 0) return []

    const chats = await prisma.telegramChat.findMany({
      where: { chatId: { in: friendIds } },
    })

    const chatMap = new Map(chats.map(c => [String(c.chatId), c]))

    const results = await Promise.all(
      friendIds.map(async fid => {
        const fidStr = String(fid)
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

        return {
          id: fidStr,
          name,
          email: chat?.username ? `@${chat.username}` : '',
          chatId: fidStr,
          username: chat?.username || '',
          status,
          addedAt: new Date().toISOString(),
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

export async function syncFriendBirthdays(ownerChatId: number | bigint | string): Promise<number> {
  try {
    const cid = BigInt(ownerChatId)

    // 1. Get all friends of this user
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userChatId: cid }, { friendChatId: cid }] },
    })

    const friendChatIds = friendships.map(f => f.userChatId === cid ? f.friendChatId : f.userChatId)
    if (friendChatIds.length === 0) return 0

    // 2. Find friend profile records that have birthday set
    const friendChats = await prisma.telegramChat.findMany({
      where: {
        chatId: { in: friendChatIds },
        birthday: { not: null },
      },
    })

    if (friendChats.length === 0) return 0

    const currentYear = new Date().getFullYear()
    let createdCount = 0

    for (const friend of friendChats) {
      if (!friend.birthday) continue

      const parts = friend.birthday.split('-')
      let monthStr = ''
      let dayStr = ''

      if (parts.length === 3) {
        monthStr = parts[1]
        dayStr = parts[2]
      } else if (parts.length === 2) {
        monthStr = parts[0]
        dayStr = parts[1]
      } else {
        continue
      }

      const friendName = friend.firstName ? `${friend.firstName}${friend.lastName ? ' ' + friend.lastName : ''}` : (friend.username ? `@${friend.username}` : `Друг #${friend.chatId}`)
      const taskTitle = `🎂 День рождения: ${friendName}`
      
      const thisYearDate = new Date(`${currentYear}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}T00:00:00`)
      let targetYear = currentYear
      if (thisYearDate.getTime() < Date.now()) {
        targetYear = currentYear + 1
      }
      const targetDueDate = `${targetYear}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`

      const existing = await prisma.task.findFirst({
        where: {
          ownerChatId: cid,
          OR: [
            { title: taskTitle },
            { title: `День рождения: ${friendName}` },
            { title: { contains: friendName, mode: 'insensitive' } },
          ],
        },
      })

      if (!existing) {
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
            isShared: true,
            assignees: [String(cid), String(friend.chatId)],
            ownerChatId: cid,
          },
        })
        createdCount++
      } else {
        let needsUpdate = false
        const updates: any = {}
        
        if (existing.dueTime !== '00:00') {
          updates.dueTime = '00:00'
          needsUpdate = true
        }
        if (existing.dueDate && existing.dueDate < targetDueDate) {
          updates.dueDate = targetDueDate
          updates.status = 'todo'
          updates.reminderSent = false
          updates.remindersSentCount = 0
          needsUpdate = true
        }
        if (existing.repeat !== 'yearly') {
          updates.repeat = 'yearly'
          needsUpdate = true
        }

        if (needsUpdate) {
          await prisma.task.update({
            where: { id: existing.id },
            data: updates,
          })
        }
      }
    }

    // Force all existing birthday tasks (manual + auto) in DB to 00:00, yearly repeat, and 🎂 prefix + DEDUPLICATE
    try {
      const allBdayTasks = await prisma.task.findMany({
        where: {
          ownerChatId: cid,
          OR: [
            { title: { contains: 'День рождения', mode: 'insensitive' } },
            { title: { contains: 'ДР', mode: 'insensitive' } },
            { tags: { has: 'день рождения' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      })

      const seen = new Set<string>()
      for (const t of allBdayTasks) {
        const normKey = t.title.replace(/^🎂\s*/, '').trim().toLowerCase()
        if (seen.has(normKey)) {
          await prisma.task.delete({ where: { id: t.id } }).catch(() => {})
          continue
        }
        seen.add(normKey)

        let newTitle = t.title.trim()
        if (!newTitle.startsWith('🎂')) {
          newTitle = `🎂 ${newTitle}`
        }
        let tags = t.tags || []
        if (!tags.includes('день рождения')) {
          tags = [...tags, 'день рождения']
        }

        if (newTitle !== t.title || t.dueTime !== '00:00' || t.repeat !== 'yearly') {
          await prisma.task.update({
            where: { id: t.id },
            data: {
              title: newTitle,
              dueTime: '00:00',
              repeat: 'yearly',
              tags,
            },
          })
        }
      }
    } catch {}

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
      status: { not: 'done' },
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
    voice: { used: 0, max: 2, secondsUsed: 0, maxSeconds: Infinity },
    notes: { used: 0, max: 2 },
    chat: { used: 0, max: 10 },
    canSendVoice: true,
    canCreateNote: true,
    canSendChatMessage: true,
  }

  if (!ownerChatId) return defaultLimits

  if (String(ownerChatId) === '6136950061') {
    return {
      plan: 'premium',
      subscriptionExpiry: null,
      voice: { used: 0, max: Infinity, secondsUsed: 0, maxSeconds: Infinity },
      notes: { used: 0, max: Infinity },
      chat: { used: 0, max: Infinity },
      canSendVoice: true,
      canCreateNote: true,
      canSendChatMessage: true,
    }
  }

  try {
    const cid = BigInt(ownerChatId)
    const { mskDate } = getMskDateTime()

    let chat = await prisma.telegramChat.findUnique({ where: { chatId: cid } })

    if (!chat) {
      chat = await prisma.telegramChat.create({
        data: { chatId: cid, lastResetDate: mskDate }
      })
    }

    // Expiry check
    let isPremium = chat.plan === 'premium'
    if (isPremium && chat.subscriptionExpiry && new Date(chat.subscriptionExpiry) < new Date()) {
      isPremium = false
      await prisma.telegramChat.update({
        where: { chatId: cid },
        data: { plan: 'free' }
      })
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

    const voiceMax = isPremium ? Infinity : 2
    const voiceMaxSeconds = isPremium ? 600 : Infinity // 10 min = 600s for premium
    const notesMax = isPremium ? Infinity : 2
    const chatMax = isPremium ? Infinity : 10

    const canSendVoice = isPremium
      ? (chat.voiceSecondsToday < 600)
      : (chat.voiceCountToday < 2)

    const canCreateNote = isPremium ? true : (chat.notesCountToday < 2)
    const canSendChatMessage = isPremium ? true : (chat.chatMessagesToday < 10)

    return {
      plan: isPremium ? 'premium' : 'free',
      subscriptionExpiry: chat.subscriptionExpiry ? chat.subscriptionExpiry.toISOString() : null,
      voice: {
        used: chat.voiceCountToday,
        max: voiceMax,
        secondsUsed: chat.voiceSecondsToday,
        maxSeconds: voiceMaxSeconds,
      },
      notes: {
        used: chat.notesCountToday,
        max: notesMax,
      },
      chat: {
        used: chat.chatMessagesToday,
        max: chatMax,
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
    if (!chat) return

    const isDifferentDay = chat.lastResetDate !== mskDate

    if (type === 'voice') {
      await prisma.telegramChat.update({
        where: { chatId: cid },
        data: {
          voiceCountToday: isDifferentDay ? 1 : { increment: 1 },
          voiceSecondsToday: isDifferentDay ? Math.round(seconds) : { increment: Math.round(seconds) },
          lastResetDate: mskDate,
        }
      })
    } else if (type === 'note') {
      await prisma.telegramChat.update({
        where: { chatId: cid },
        data: {
          notesCountToday: isDifferentDay ? 1 : { increment: 1 },
          lastResetDate: mskDate,
        }
      })
    } else if (type === 'chat') {
      await prisma.telegramChat.update({
        where: { chatId: cid },
        data: {
          chatMessagesToday: isDifferentDay ? 1 : { increment: 1 },
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
