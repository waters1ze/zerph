/**
 * Zerf Backend — Database & Persistence Store
 * Local file-backed JSON DB — zero cost, offline, instant.
 */

import fs from 'fs'
import path from 'path'
import { ParsedItem, stringSimilarity } from './groq'

export interface DbTask {
  id: string
  title: string
  description?: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  status: 'todo' | 'inprogress' | 'done' | 'overdue'
  dueDate?: string
  dueTime?: string          // HH:MM for timed reminders
  reminderSent?: boolean
  projectId?: string
  goalId?: string
  tags: string[]
  assignees: string[]
  isShared: boolean
  createdAt: string
  updatedAt: string
  completedAt?: string
  subtasks?: Array<{ id: string; title: string; done: boolean }>
  rawText?: string
  aiGenerated?: boolean
}

export interface DbNote {
  id: string
  title: string
  content: string         // AI-structured Markdown
  originalText?: string   // raw voice transcript
  type: 'note' | 'journal' | 'meeting'
  tags: string[]
  createdAt: string
  updatedAt: string
  aiGenerated?: boolean
  pinned?: boolean
}

export interface DbGoal {
  id: string
  title: string
  description?: string
  motivation?: string
  status: 'on_track' | 'at_risk' | 'delayed' | 'completed'
  deadline?: string
  progress: number
  color?: string
  milestones: Array<{ id: string; title: string; done: boolean; dueDate?: string }>
  createdAt: string
  updatedAt: string
}

export interface DbSchema {
  tasks: DbTask[]
  goals: DbGoal[]
  notes: DbNote[]
  chatIds: number[]     // Telegram chat IDs for reminders
}

const DB_FILE = path.join(process.cwd(), 'zerf-db.json')

export function getDb(): DbSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial: DbSchema = { tasks: [], goals: [], notes: [], chatIds: [] }
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8')
      return initial
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    // Ensure chatIds field exists
    if (!parsed.chatIds) parsed.chatIds = []
    return parsed
  } catch {
    return { tasks: [], goals: [], notes: [], chatIds: [] }
  }
}

export function saveDb(db: DbSchema): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

/**
 * Register a Telegram chat ID for reminder notifications
 */
export function registerChatId(chatId: number, firstName?: string): void {
  const db = getDb()
  if (!db.chatIds.includes(chatId)) {
    db.chatIds.push(chatId)
    saveDb(db)
  }
}

/**
 * Find the best matching task by fuzzy title similarity
 * Returns { task, index, score } or null if no good match
 */
export function findSimilarTask(
  targetTitle: string,
  db: DbSchema
): { task: DbTask; index: number; score: number } | null {
  let best: { task: DbTask; index: number; score: number } | null = null

  db.tasks.forEach((task, index) => {
    if (task.status === 'done') return  // skip already done
    const score = stringSimilarity(targetTitle, task.title)
    if (score > 0.3 && (!best || score > best.score)) {
      best = { task, index, score }
    }
  })

  return best
}

/**
 * Mark a task as completed by fuzzy matching the title.
 * Returns the matched task or null.
 */
export function completeTaskByTitle(targetTitle: string): DbTask | null {
  const db = getDb()
  const match = findSimilarTask(targetTitle, db)
  if (!match) return null

  const now = new Date().toISOString()
  db.tasks[match.index] = {
    ...db.tasks[match.index],
    status: 'done',
    completedAt: now,
    updatedAt: now,
  }
  saveDb(db)
  return db.tasks[match.index]
}

/**
 * Save a ParsedItem from Groq AI into the database
 */
export function saveParsedItemToDb(item: ParsedItem): { item: ParsedItem; completedTask?: DbTask | null } {
  const db = getDb()
  const now = new Date().toISOString()
  const id = 'z_' + Math.random().toString(36).substring(2, 9)

  // Handle completion intent — mark existing task done
  if (item.type === 'completion' && item.targetTitle) {
    const completed = completeTaskByTitle(item.targetTitle)
    return { item, completedTask: completed }
  }

  if (item.type === 'goal') {
    db.goals.unshift({
      id,
      title: item.title,
      description: item.summary,
      motivation: item.motivation || undefined,
      status: 'on_track',
      deadline: item.dueDate || undefined,
      progress: 0,
      color: '#2d7a4f',
      milestones: (item.milestones || []).map((m, i) => ({
        id: `m_${id}_${i}`,
        title: m,
        done: false,
      })),
      createdAt: now,
      updatedAt: now,
    })
  } else if (item.type === 'note') {
    // AI generates the structured content, store original separately
    const mdContent = item.summary.includes('#')
      ? item.summary
      : `# ${item.title}\n\n${item.summary}`

    db.notes.unshift({
      id,
      title: item.title,
      content: mdContent,
      originalText: item.rawText,
      type: 'note',
      tags: item.tags || [],
      createdAt: now,
      updatedAt: now,
      aiGenerated: true,
    })
  } else {
    // task / reminder
    db.tasks.unshift({
      id,
      title: item.title,
      description: item.summary,
      priority: item.priority || 'medium',
      status: 'todo',
      dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
      dueTime: item.dueTime || undefined,
      tags: item.tags || [],
      assignees: [],
      isShared: false,
      createdAt: now,
      updatedAt: now,
      rawText: item.rawText,
      aiGenerated: true,
      subtasks: (item.subtasks || []).map((st, i) => ({
        id: `st_${id}_${i}`,
        title: st,
        done: false,
      })),
    })
  }

  saveDb(db)
  return { item }
}
