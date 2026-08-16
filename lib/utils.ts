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

export interface TaskDateGroupItem<T> {
  dateKey: string
  label: string
  isToday: boolean
  isTomorrow: boolean
  isOverdue: boolean
  tasks: T[]
}

export function groupTasksByDate<T extends { dueDate?: string | null; createdAt?: string; status?: string }>(tasks: T[]): TaskDateGroupItem<T>[] {
  const today = new Date().toISOString().slice(0, 10)
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const tomorrow = tomorrowDate.toISOString().slice(0, 10)
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const yesterday = yesterdayDate.toISOString().slice(0, 10)

  const groupsMap = new Map<string, T[]>()

  for (const task of tasks) {
    const key = task.dueDate || 'no-date'
    if (!groupsMap.has(key)) {
      groupsMap.set(key, [])
    }
    groupsMap.get(key)!.push(task)
  }

  // Sort keys: Overdue / past dates first, then Today, then Tomorrow, then upcoming dates in ascending order, and 'no-date' last
  const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => {
    if (a === 'no-date') return 1
    if (b === 'no-date') return -1
    return a.localeCompare(b)
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
