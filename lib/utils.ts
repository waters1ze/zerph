import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isBirthdayTask(task: { title?: string; tags?: string[] }): boolean {
  if (!task) return false
  const title = (task.title || '').toLowerCase()
  const tags = (task.tags || []).map(t => String(t).toLowerCase())
  return (
    title.startsWith('🎂') ||
    title.includes('день рождения') ||
    title.includes('др:') ||
    title.includes('мой др') ||
    title.endsWith('др') ||
    tags.includes('день рождения') ||
    tags.includes('др')
  )
}

export function isHolidayTask(task: { title?: string; tags?: string[]; repeat?: string | null }): boolean {
  if (!task) return false
  const title = (task.title || '').toLowerCase()
  const tags = (task.tags || []).map(t => String(t).toLowerCase())
  return (
    title.startsWith('🎉') ||
    title.includes('праздник') ||
    title.includes('новый год') ||
    title.includes('день знаний') ||
    title.includes('день победы') ||
    title.includes('день защитника') ||
    title.includes('8 марта') ||
    title.includes('рождество') ||
    title.includes('пасха') ||
    title.includes('масленица') ||
    title.includes('день матери') ||
    title.includes('день отца') ||
    title.includes('годовщин') ||
    tags.includes('праздник') ||
    tags.includes('праздники') ||
    tags.includes('holiday')
  )
}

export function isYearlyEventTask(task: { title?: string; tags?: string[]; repeat?: string | null }): boolean {
  if (!task) return false
  return (
    task.repeat === 'yearly' ||
    isBirthdayTask(task) ||
    isHolidayTask(task) ||
    /(?:^|[^а-яёa-z0-9])(?:день\s*рождения|д\.?\s*р\.?|праздник|годовщин\w*)(?:[^а-яёa-z0-9]|$)/i.test(task.title || '')
  )
}

export function isBirthdayVisible(task: { title?: string; dueDate?: string | null; tags?: string[] }, maxDays = 7): boolean {
  if (!task || !isBirthdayTask(task)) return true
  if (!task.dueDate || !task.dueDate.includes('-')) return false

  const parts = task.dueDate.split('-').map(Number)
  const month = parts.length === 3 ? parts[1] : parts[0]
  const day = parts.length === 3 ? parts[2] : parts[1]
  if (!month || !day) return false

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const currentYear = now.getFullYear()

  // Target birthday this year
  let due = new Date(currentYear, month - 1, day)
  due.setHours(0, 0, 0, 0)
  let diffDays = (due.getTime() - now.getTime()) / (1000 * 3600 * 24)

  // If birthday already passed this year, check next year
  if (diffDays < 0) {
    due = new Date(currentYear + 1, month - 1, day)
    due.setHours(0, 0, 0, 0)
    diffDays = (due.getTime() - now.getTime()) / (1000 * 3600 * 24)
  }

  return diffDays >= 0 && diffDays <= maxDays
}

export function isHolidayVisible(task: { title?: string; dueDate?: string | null; tags?: string[] }, maxDays = 14): boolean {
  if (!task || !isHolidayTask(task)) return true
  if (!task.dueDate || !task.dueDate.includes('-')) return false

  const parts = task.dueDate.split('-').map(Number)
  const month = parts.length === 3 ? parts[1] : parts[0]
  const day = parts.length === 3 ? parts[2] : parts[1]
  if (!month || !day) return false

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const currentYear = now.getFullYear()

  // Target holiday this year
  let due = new Date(currentYear, month - 1, day)
  due.setHours(0, 0, 0, 0)
  let diffDays = (due.getTime() - now.getTime()) / (1000 * 3600 * 24)

  // If holiday already passed this year, check next year
  if (diffDays < 0) {
    due = new Date(currentYear + 1, month - 1, day)
    due.setHours(0, 0, 0, 0)
    diffDays = (due.getTime() - now.getTime()) / (1000 * 3600 * 24)
  }

  return diffDays >= 0 && diffDays <= maxDays
}

export interface TaskDateGroupItem<T> {
  dateKey: string
  label: string
  isToday: boolean
  isTomorrow: boolean
  isOverdue: boolean
  tasks: T[]
}

export function getLocalTodayDateString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function groupTasksByDate<T extends { dueDate?: string | null; dueTime?: string | null; createdAt?: string; status?: string }>(tasks: T[]): TaskDateGroupItem<T>[] {
  const now = new Date()
  const today = getLocalTodayDateString()

  const tom = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const tomorrow = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, '0')}-${String(tom.getDate()).padStart(2, '0')}`

  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const yesterday = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`

  const groupsMap = new Map<string, T[]>()

  for (const task of tasks) {
    const key = task.dueDate || 'no-date'
    if (!groupsMap.has(key)) {
      groupsMap.set(key, [])
    }
    groupsMap.get(key)!.push(task)
  }

  // Sort tasks within each date group by dueTime (earliest time first)
  for (const [, groupTaskList] of groupsMap.entries()) {
    groupTaskList.sort((a, b) => {
      if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime)
      if (a.dueTime && !b.dueTime) return -1
      if (!a.dueTime && b.dueTime) return 1
      return 0
    })
  }

  // Sort keys:
  // 1. TODAY (key === today) -> ALWAYS FIRST at the very top!
  // 2. TOMORROW (key === tomorrow) & upcoming future dates (key > today) -> chronological order
  // 3. OVERDUE / YESTERDAY / PAST dates (key < today) -> reverse chronological order (yesterday, then earlier)
  // 4. NO-DATE ('no-date') -> at the very bottom
  const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => {
    if (a === b) return 0
    if (a === today) return -1
    if (b === today) return 1

    if (a === 'no-date') return 1
    if (b === 'no-date') return -1

    const aIsFuture = a > today
    const bIsFuture = b > today

    if (aIsFuture && bIsFuture) {
      return a.localeCompare(b)
    }
    if (aIsFuture && !bIsFuture) {
      return -1
    }
    if (!aIsFuture && bIsFuture) {
      return 1
    }

    // Both are past dates: closest past date first (yesterday before last week)
    return b.localeCompare(a)
  })

  return sortedKeys.map(key => {
    let label = ''
    let isTodayFlag = false
    let isTomorrowFlag = false
    let isOverdueFlag = false

    if (key === 'no-date') {
      label = 'Без даты'
    } else if (key === today) {
      isTodayFlag = true
      const formatted = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(key + 'T00:00:00'))
      label = `Сегодня · ${formatted}`
    } else if (key === tomorrow) {
      isTomorrowFlag = true
      const formatted = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(key + 'T00:00:00'))
      label = `Завтра · ${formatted}`
    } else if (key === yesterday) {
      const formatted = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(key + 'T00:00:00'))
      label = `Вчера · ${formatted}`
    } else {
      try {
        const d = new Date(key + 'T00:00:00')
        const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(d)
        const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)
        const dateStr = new Intl.DateTimeFormat('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        }).format(d)
        label = `${capitalizedWeekday} · ${dateStr}`
        if (key < today) {
          isOverdueFlag = true
        }
      } catch {
        label = key
      }
    }

    return {
      dateKey: key,
      label,
      isToday: isTodayFlag,
      isTomorrow: isTomorrowFlag,
      isOverdue: isOverdueFlag,
      tasks: groupsMap.get(key)!,
    }
  })
}
