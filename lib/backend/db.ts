/**
 * Zerf Backend — Per-User Database (isolated by Telegram chatId)
 * Each user gets their own zerf-db-{chatId}.json file
 * Users without chatId share a "guest" db
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
  dueTime?: string
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
  content: string
  originalText?: string
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

export interface DbUser {
  chatId: number
  name: string
  username?: string
  firstName?: string
  registeredAt: string
}

export interface DbSchema {
  tasks: DbTask[]
  goals: DbGoal[]
  notes: DbNote[]
  chatIds: number[]
  users: DbUser[]
}

// Registry: maps chatId -> file path
const DATA_DIR = path.join(process.cwd(), 'zerf-data')
const REGISTRY_FILE = path.join(DATA_DIR, 'registry.json')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function getDbFile(chatId?: number | string | null): string {
  ensureDataDir()
  if (chatId) return path.join(DATA_DIR, `db-${chatId}.json`)
  // Legacy fallback — guest db
  return path.join(process.cwd(), 'zerf-db.json')
}

export function getDb(chatId?: number | string | null): DbSchema {
  const file = getDbFile(chatId)
  try {
    if (!fs.existsSync(file)) {
      const initial: DbSchema = { tasks: [], goals: [], notes: [], chatIds: chatId ? [Number(chatId)] : [], users: [] }
      fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8')
      return initial
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (!parsed.chatIds) parsed.chatIds = []
    if (!parsed.users) parsed.users = []
    return parsed
  } catch {
    return { tasks: [], goals: [], notes: [], chatIds: [], users: [] }
  }
}

export function saveDb(db: DbSchema, chatId?: number | string | null): void {
  const file = getDbFile(chatId)
  ensureDataDir()
  fs.writeFileSync(file, JSON.stringify(db, null, 2), 'utf-8')
}

/**
 * Register / update a Telegram user profile
 */
export function registerChatId(chatId: number, firstName?: string, username?: string): void {
  ensureDataDir()
  const db = getDb(chatId)
  const now = new Date().toISOString()

  // Update user profile in their own db
  const existing = db.users.find(u => u.chatId === chatId)
  if (existing) {
    existing.name = firstName || existing.name
    existing.username = username || existing.username
  } else {
    db.users.push({
      chatId,
      name: firstName || `User_${chatId}`,
      username,
      firstName,
      registeredAt: now,
    })
  }
  if (!db.chatIds.includes(chatId)) db.chatIds.push(chatId)
  saveDb(db, chatId)

  // Also update global registry
  try {
    let registry: { chatId: number; name: string; username?: string; registeredAt: string }[] = []
    if (fs.existsSync(REGISTRY_FILE)) {
      registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'))
    }
    const idx = registry.findIndex(r => r.chatId === chatId)
    const entry = { chatId, name: firstName || `User_${chatId}`, username, registeredAt: now }
    if (idx >= 0) registry[idx] = entry
    else registry.push(entry)
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8')
  } catch {}
}

/**
 * Get user profile by chatId (from registry)
 */
export function getUserProfile(chatId: number): DbUser | null {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return null
    const registry: { chatId: number; name: string; username?: string; registeredAt: string }[] = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'))
    const user = registry.find(r => r.chatId === chatId)
    if (!user) return null
    return { chatId: user.chatId, name: user.name, username: user.username, registeredAt: user.registeredAt }
  } catch { return null }
}

/**
 * Get all registered chatIds (for reminders)
 */
export function getAllChatIds(): number[] {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) return []
    const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'))
    return registry.map((r: { chatId: number }) => r.chatId)
  } catch { return [] }
}

export function findSimilarTask(
  targetTitle: string,
  db: DbSchema
): { task: DbTask; index: number; score: number } | null {
  let best: { task: DbTask; index: number; score: number } | null = null
  db.tasks.forEach((task, index) => {
    if (task.status === 'done') return
    const score = stringSimilarity(targetTitle, task.title)
    if (score > 0.3 && (!best || score > best.score)) {
      best = { task, index, score }
    }
  })
  return best
}

export function completeTaskByTitle(targetTitle: string, chatId?: number | string | null): DbTask | null {
  const db = getDb(chatId)
  const match = findSimilarTask(targetTitle, db)
  if (!match) return null
  const now = new Date().toISOString()
  db.tasks[match.index] = { ...db.tasks[match.index], status: 'done', completedAt: now, updatedAt: now }
  saveDb(db, chatId)
  return db.tasks[match.index]
}

export function saveParsedItemToDb(item: ParsedItem, chatId?: number | string | null): { item: ParsedItem; completedTask?: DbTask | null } {
  const db = getDb(chatId)
  const now = new Date().toISOString()
  const id = 'z_' + Math.random().toString(36).substring(2, 9)

  if (item.type === 'completion' && item.targetTitle) {
    const completed = completeTaskByTitle(item.targetTitle, chatId)
    return { item, completedTask: completed }
  }

  if (item.type === 'goal') {
    db.goals.unshift({
      id, title: item.title, description: item.summary, motivation: item.motivation || undefined,
      status: 'on_track', deadline: item.dueDate || undefined, progress: 0, color: '#2d7a4f',
      milestones: (item.milestones || []).map((m, i) => ({ id: `m_${id}_${i}`, title: m, done: false })),
      createdAt: now, updatedAt: now,
    })
  } else if (item.type === 'note') {
    const mdContent = item.summary.includes('#') ? item.summary : `# ${item.title}\n\n${item.summary}`
    db.notes.unshift({
      id, title: item.title, content: mdContent, originalText: item.rawText,
      type: 'note', tags: item.tags || [], createdAt: now, updatedAt: now, aiGenerated: true,
    })
  } else {
    db.tasks.unshift({
      id, title: item.title, description: item.summary, priority: item.priority || 'medium',
      status: 'todo', dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
      dueTime: item.dueTime || undefined, tags: item.tags || [],
      assignees: [], isShared: false, createdAt: now, updatedAt: now,
      rawText: item.rawText, aiGenerated: true,
      subtasks: (item.subtasks || []).map((st, i) => ({ id: `st_${id}_${i}`, title: st, done: false })),
    })
  }

  saveDb(db, chatId)
  return { item }
}
