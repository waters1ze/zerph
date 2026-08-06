export type Priority = 'urgent' | 'high' | 'medium' | 'low'
export type TaskStatus = 'todo' | 'inprogress' | 'done' | 'overdue'
export type GoalStatus = 'on_track' | 'at_risk' | 'delayed' | 'completed'
export type NoteType = 'note' | 'journal' | 'meeting'
export type View =
  | 'today'
  | 'inbox'
  | 'tasks'
  | 'goals'
  | 'projects'
  | 'notes'
  | 'calendar'
  | 'chat'
  | 'stats'
  | 'friends'
  | 'settings'

export interface Task {
  id: string
  title: string
  description?: string
  priority: Priority
  status: TaskStatus
  dueDate?: string
  dueTime?: string             // HH:MM — for timed reminders e.g. "12:00"
  reminderSent?: boolean       // true after TG notification sent
  targetContact?: string       // Telegram username or ChatID of the contact to message (e.g. "@artem")
  recipientName?: string       // Name of the recipient (e.g. "Артем")
  projectId?: string
  goalId?: string
  tags: string[]
  assignees: string[]
  isShared: boolean
  createdAt: string
  updatedAt: string
  completedAt?: string
  aiGenerated?: boolean
  source?: string
  progress?: number
  subtasks?: SubTask[]
}

export interface SubTask {
  id: string
  title: string
  done: boolean
}

export interface Goal {
  id: string
  title: string
  description?: string
  motivation?: string
  metric?: string
  status: GoalStatus
  deadline?: string
  progress: number
  milestones: Milestone[]
  projectIds: string[]
  noteIds: string[]
  createdAt: string
  updatedAt: string
  color?: string
}

export interface Milestone {
  id: string
  title: string
  done: boolean
  dueDate?: string
}

export interface Project {
  id: string
  title: string
  description?: string
  goalId?: string
  color: string
  icon?: string
  taskIds: string[]
  noteIds: string[]
  createdAt: string
  updatedAt: string
  archived: boolean
}

export interface Note {
  id: string
  title: string
  content: string              // AI-structured Markdown
  originalText?: string        // Raw voice transcript or user input
  type: NoteType
  tags: string[]
  dueDate?: string             // Optional linked date (YYYY-MM-DD)
  dueTime?: string             // Optional linked time (HH:MM)
  projectId?: string
  goalId?: string
  taskIds?: string[]
  createdAt: string
  updatedAt: string
  aiGenerated?: boolean
  pinned?: boolean
}

export interface Friend {
  id: string
  name: string
  email: string
  avatar?: string
  status: 'online' | 'offline' | 'away'
  addedAt: string
}

export interface SharedTask extends Task {
  createdBy: string
  collaborators: string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  references?: string[]
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  name: string
  email: string
  avatar?: string
  accentColor: string
  notifications: {
    desktop: boolean
    email: boolean
    dueReminders: boolean
    teamUpdates: boolean
    reminderIntervalMinutes: number
    reminderRepeatCount: number
  }
  integrations: {
    telegram: boolean
    telegramChatId?: string
    telegramBotToken?: string
    aiApiKey?: string
    aiModel: string
    groqApiKey?: string
  }
  weekStartsOn: 0 | 1
  focusModeEnabled: boolean
}

export type StatPeriod = '7d' | '30d' | '90d' | '1y'
