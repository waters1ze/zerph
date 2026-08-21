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
  | 'eisenhower'
  | 'notes'
  | 'graph'
  | 'calendar'
  | 'clock'
  | 'chat'
  | 'stats'
  | 'friends'
  | 'teams'
  | 'extensions'
  | 'entropy'
  | 'live'
  | 'settings'
  | 'admin'

export interface ScheduleLesson {
  id: string
  name: string
  startTime: string
  endTime: string
  room?: string
  teacher?: string
  note?: string
  color?: string
}

export interface DaySchedule {
  dayOfWeek: number // 1 = Пн, 2 = Вт, 3 = Ср, 4 = Чт, 5 = Пт, 6 = Сб, 7 = Вс
  enabled: boolean
  lessons: ScheduleLesson[]
}

export interface ScheduleGroup {
  id: string
  title: string
  icon: string
  color: string
  description?: string
  days: DaySchedule[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  description?: string
  priority: Priority
  status: TaskStatus
  dueDate?: string
  dueTime?: string             // HH:MM — for timed reminders e.g. "12:00"
  repeat?: string | null       // 'yearly' | 'monthly' | 'weekly' | 'weekdays' | 'daily'
  reminderSent?: boolean       // true after TG notification sent
  targetContact?: string       // Telegram username or ChatID of the contact to message (e.g. "@artem")
  recipientName?: string       // Name of the recipient (e.g. "Артем")
  authorChatId?: string
  ownerChatId?: string
  completedBy?: string
  parentTaskId?: string
  projectId?: string
  goalId?: string
  habitId?: string
  tags: string[]
  assignees: string[]
  isShared: boolean
  createdAt: string
  updatedAt: string
  completedAt?: string
  aiGenerated?: boolean
  source?: string
  summary?: string             // AI detailed explanation & context
  rawText?: string             // Original raw voice transcript
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
  visibility?: 'private' | 'public'
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
  habitId?: string
  taskIds?: string[]
  createdAt: string
  updatedAt: string
  aiGenerated?: boolean
  pinned?: boolean
  folder?: string
  visibility?: 'private' | 'public'
}

export interface Friend {
  id: string
  name: string
  email: string
  chatId?: string
  username?: string
  avatar?: string
  status: 'online' | 'offline' | 'away'
  addedAt: string
  allowTasks?: boolean
  friendAllowedMe?: boolean
  birthday?: string | null
}

export interface SharedTask extends Task {
  createdBy: string
  collaborators: string[]
}

export interface ChatAction {
  type: 'task_created' | 'goal_created' | 'note_created' | 'task_completed' | 'task_deleted' | 'task_updated' | 'stats_summary' | 'schedule_view'
  targetId?: string
  targetType?: 'today' | 'tasks' | 'goals' | 'notes' | 'calendar' | 'stats' | 'friends' | 'clock'
  title?: string
  priority?: string
  dueTime?: string | null
  dueDate?: string | null
  tags?: string[]
  item?: any
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  references?: string[]
  action?: ChatAction
}

export interface UserSettings {
  /**
   * Визуальный пресет. Legacy-значения (light/dark/system) приходят из
   * старого localStorage и нормализуются в lib/theme-presets.ts.
   */
  theme: 'strict' | 'warm' | 'blue' | 'vivid' | 'paper' | 'light' | 'dark' | 'system'
  name: string
  email: string
  avatar?: string
  /** 'default' (собственный акцент темы) | id из палитры lib/theme-presets.ts */
  accentColor: string
  /** Размер текста: -1..3 шагов (14–19px), 0 — стандарт */
  textScale?: -1 | 0 | 1 | 2 | 3
  /** Плотность интерфейса */
  density?: 'compact' | 'default' | 'comfortable'
  /** Радиусы скруглений */
  borderRadius?: 'sharp' | 'default' | 'rounded'
  /** true — круглые элементы (по умолчанию), false — сглаженно-квадратные */
  roundShapes?: boolean
  /** Кастомный CSS код (анимации, glow-эффекты, переопределения переменных) из GitHub тем */
  customCss?: string
  /** ID активного расширения темы (если выбрана тема из маркетплейса/GitHub) */
  activeThemeExtensionId?: string
  /** URL репозитория GitHub темы */
  activeThemeGithubUrl?: string
  /** Локализация / переопределения текстов из темы */
  themeI18n?: Record<string, any>
  notifications: {
    desktop: boolean
    web?: boolean
    telegram?: boolean
    vk?: boolean
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
    apiKey?: string
    groqApiKey?: string
    openaiKey?: string
    anthropicKey?: string
    geminiKey?: string
    customAiEnabled?: boolean
    customAiProvider?: string
    customAiApiKey?: string
    customAiBaseUrl?: string
    customAiModel?: string
    aiTaskModels?: {
      chat?: string
      parser?: string
      goals?: string
      reschedule?: string
      analytics?: string
      siri?: string
      extensions?: string
    }
    siriMode?: 'fast' | 'full'
  }
  weekStartsOn: 0 | 1
  focusModeEnabled: boolean
  userPlan: 'free' | 'premium'
  focusSettings?: {
    defaultDurationMinutes: number
    breakDurationMinutes: number
  }
  eveningReview?: {
    enabled: boolean
    time: string
  }
  voiceSettings?: {
    ttsResponseEnabled: boolean
  }
  /** Период неактивности для полного удаления аккаунта и данных из БД (в месяцах: 1, 3, 6, 12 или 0 для отключения). По умолчанию: 6 */
  autoDeleteMonths?: number
}

export type StatPeriod = '7d' | '30d' | '90d' | '1y'

export interface Habit {
  id: string
  title: string
  icon?: string
  streak: number
  lastCompletedAt?: string
  frequency: string
  ownerChatId?: string
  createdAt: string
  updatedAt: string
}
