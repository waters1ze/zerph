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

export async function getAllTasks() {
  try {
    return await prisma.task.findMany({ orderBy: { createdAt: 'desc' } })
  } catch {
    return []
  }
}

export async function getAllGoals() {
  try {
    return await prisma.goal.findMany({ orderBy: { createdAt: 'desc' } })
  } catch {
    return []
  }
}

export async function getAllNotes() {
  try {
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
  ownerChatId?: number | null   // Telegram chatId of the creator
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
  return prisma.task.delete({ where: { id } })
}

/**
 * Find the best matching non-done task by title similarity
 */
export async function completeTaskByTitle(targetTitle: string): Promise<DbTask | null> {
  const tasks = await prisma.task.findMany({
    where: { status: { not: 'done' } },
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
    },
  })
}

export async function updateGoal(id: string, data: object) {
  return prisma.goal.update({ where: { id }, data: data as never })
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function createNote(data: {
  title: string
  content: string
  originalText?: string
  type?: string
  tags?: string[]
  aiGenerated?: boolean
}) {
  return prisma.note.create({
    data: {
      title: data.title,
      content: data.content,
      originalText: data.originalText || null,
      type: data.type || 'note',
      tags: data.tags || [],
      aiGenerated: data.aiGenerated || false,
    },
  })
}

export async function deleteNote(id: string) {
  return prisma.note.delete({ where: { id } })
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

// ── High-level: save ParsedItem from Groq AI ──────────────────────────────────

export async function saveParsedItemToDb(
  item: ParsedItem,
  ownerChatId?: number | null
): Promise<{
  item: ParsedItem
  completedTask?: DbTask | null
}> {
  // Completion intent — mark existing task done
  if (item.type === 'completion' && item.targetTitle) {
    const completed = await completeTaskByTitle(item.targetTitle)
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

export async function getTasksDueNow(): Promise<DbTask[]> {
  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const todayStr = now.toISOString().slice(0, 10)

  const tasks = await prisma.task.findMany({
    where: {
      dueTime: timeStr,
      dueDate: todayStr,
      status: { not: 'done' },
      reminderSent: false,
    },
  })
  return tasks as DbTask[]
}

export async function markReminderSent(id: string) {
  return prisma.task.update({ where: { id }, data: { reminderSent: true } })
}
