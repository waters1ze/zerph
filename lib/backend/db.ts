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
    if (ownerChatId !== undefined && ownerChatId !== null) {
      const num = Number(ownerChatId)
      if (!isNaN(num) && num !== 0) {
        const cid = BigInt(ownerChatId)
        return await prisma.task.findMany({
          where: { ownerChatId: cid },
          orderBy: { createdAt: 'desc' },
        })
      }
      return []
    }
    return await prisma.task.findMany({ orderBy: { createdAt: 'desc' } })
  } catch {
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
    return await prisma.goal.findMany({ orderBy: { createdAt: 'desc' } })
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
    return await prisma.note.findMany({ orderBy: { createdAt: 'desc' } })
  } catch {
    return []
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
  subtasks?: object[]
  rawText?: string
  aiGenerated?: boolean
  source?: string
  ownerChatId?: number | bigint | string | null   // Telegram chatId of the creator
}) {
  return prisma.task.create({
    data: {
      title: data.title,
      description: data.description || '',
      priority: data.priority || 'medium',
      status: data.status || 'todo',
      dueDate: data.dueDate || new Date().toISOString().slice(0, 10),
      dueTime: data.dueTime || null,
      tags: data.tags || [],
      assignees: [],
      subtasks: data.subtasks || [],
      rawText: data.rawText || null,
      aiGenerated: data.aiGenerated || false,
      source: data.source || null,
      ownerChatId: data.ownerChatId ? BigInt(data.ownerChatId) : null,
    },
  })
}

export async function updateTask(id: string, data: Partial<{
  status: string
  priority: string
  dueDate: string
  dueTime: string
  reminderSent: boolean
  completedAt: Date
}>) {
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

export async function registerChatId(chatId: number, firstName?: string) {
  await prisma.telegramChat.upsert({
    where: { chatId: BigInt(chatId) },
    update: {},
    create: { chatId: BigInt(chatId), firstName: firstName || null },
  })
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
    const activeNotes = notes.slice(0, 5)

    const lines: string[] = []

    if (activeGoals.length) {
      lines.push('🎯 ЦЕЛИ:')
      activeGoals.forEach(g => {
        lines.push(`- ID: ${g.id} | Название: "${g.title}" | Дедлайн: ${g.deadline || 'не указан'} | Описание: ${g.description || ''}`)
      })
    }

    if (activeTasks.length) {
      lines.push('\n📋 ЗАДАЧИ / НАПОМИНАНИЯ:')
      activeTasks.forEach(t => {
        lines.push(`- ID: ${t.id} | Название: "${t.title}" | Дата: ${t.dueDate || 'не указана'} | Время: ${t.dueTime || 'не указано'} | Приоритет: ${t.priority}`)
      })
    }

    if (activeNotes.length) {
      lines.push('\n📌 ЗАМЕТКИ:')
      activeNotes.forEach(n => {
        lines.push(`- ID: ${n.id} | Заголовок: "${n.title}"`)
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
  // Delete action
  if (item.action === 'delete' && item.targetId) {
    await deleteTask(item.targetId)
    await deleteGoal(item.targetId)
    await deleteNote(item.targetId)
    return { item, updatedItem: true }
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

    await createTask({
      title: item.title,
      description: desc,
      priority: item.priority || 'medium',
      dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
      dueTime: item.dueTime || undefined,
      tags: item.recipientName ? [...(item.tags || []), item.recipientName] : item.tags,
      aiGenerated: true,
      source: item.rawText,
      ownerChatId: ownerChatId || null,   // Store the owner's chatId
      subtasks: (item.subtasks || []).map((st, i) => ({
        id: `st_${i}_${Date.now()}`,
        title: st,
        done: false,
      })),
    })
  }

  return { item }
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

  const tasks = await prisma.task.findMany({
    where: {
      dueTime: mskTime,
      dueDate: mskDate,
      status: { not: 'done' },
      reminderSent: false,
    },
  })
  return tasks as DbTask[]
}

export async function markReminderSent(id: string) {
  return prisma.task.update({ where: { id }, data: { reminderSent: true } })
}
