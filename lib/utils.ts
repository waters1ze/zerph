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

export function isSchoolTask(task: { title?: string; tags?: string[]; description?: string; projectId?: string; category?: string }): boolean {
  if (!task) return false
  const tags = (task.tags || []).map(x => String(x).toLowerCase())
  if (tags.includes('школа') || tags.includes('школьное расписание') || tags.includes('школьные уроки')) {
    return true
  }
  const cat = String(task.category || '').toLowerCase()
  if (cat === 'школа' || cat === 'школьное расписание') {
    return true
  }
  const title = String(task.title || '').trim()
  if (/^\[(?:школа|школьное расписание)\]/i.test(title)) {
    return true
  }
  // School diary schedule imported with lesson number prefix e.g. "1. Алгебра", "2. Физика", "3. Химия"
  if (/^\d+\s*[\.\)]\s*(?:алгебр|геометр|физик|хим|биолог|русск|литератур|обществознан|информатик|английск|немецк|французск|физкультур|географ|астрономи|обж)/i.test(title)) {
    return true
  }
  return false
}

export function isTaskOnDate(t: { dueDate?: string | null; repeat?: string | null; title?: string; tags?: string[] }, targetDateStr: string, realTodayYMD: string): boolean {
  if (!t.dueDate || !t.dueDate.includes('-')) return false
  if (t.dueDate === targetDateStr) return true

  // Yearly events (birthdays, holidays)
  if (isYearlyEventTask(t)) {
    const [, tm, td] = t.dueDate.split('-').map(Number)
    const [, sm, sd] = targetDateStr.split('-').map(Number)
    return sm === tm && sd === td && targetDateStr >= realTodayYMD
  }

  // Weekly repeating events (e.g. "каждую пятницу плавание")
  if (t.repeat === 'weekly') {
    const origDate = new Date(t.dueDate + 'T12:00:00')
    const targetDate = new Date(targetDateStr + 'T12:00:00')
    return origDate.getDay() === targetDate.getDay() && targetDateStr >= t.dueDate
  }

  // Daily repeating events
  if (t.repeat === 'daily') {
    return targetDateStr >= t.dueDate
  }

  // Weekday repeating events (Mon-Fri)
  if (t.repeat === 'weekdays') {
    const targetDate = new Date(targetDateStr + 'T12:00:00')
    const day = targetDate.getDay()
    return day >= 1 && day <= 5 && targetDateStr >= t.dueDate
  }

  // Monthly repeating events
  if (t.repeat === 'monthly') {
    const [, , td] = t.dueDate.split('-').map(Number)
    const [, , sd] = targetDateStr.split('-').map(Number)
    return sd === td && targetDateStr >= t.dueDate
  }

  return false
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

export function isHolidayVisible(task: { title?: string; dueDate?: string | null; tags?: string[] }, maxDays = 7): boolean {
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

export function isTaskVisibleInMainList(
  task: { title?: string; dueDate?: string | null; repeat?: string | null; tags?: string[]; status?: string },
  maxDays = 7,
  includePastDone = false
): boolean {
  if (!task) return false
  const today = getLocalTodayDateString()
  // Completed tasks from past days are completely hidden from the main active task list
  if (!includePastDone && task.status === 'done' && task.dueDate && task.dueDate < today) {
    return false
  }
  if (isYearlyEventTask(task)) {
    return isBirthdayVisible(task, maxDays)
  }
  return true
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

  // Sort tasks within each date group:
  // Active/todo tasks FIRST by dueTime, then completed tasks at the bottom
  for (const [, groupTaskList] of groupsMap.entries()) {
    groupTaskList.sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0
      const bDone = b.status === 'done' ? 1 : 0
      if (aDone !== bDone) return aDone - bDone

      if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime)
      if (a.dueTime && !b.dueTime) return -1
      if (!a.dueTime && b.dueTime) return 1
      return 0
    })
  }

  // Sort keys:
  // 1. TODAY (key === today) -> ALWAYS FIRST at the very top!
  // 2. TOMORROW (key === tomorrow) -> SECOND
  // 3. FUTURE DAYS (key > today) -> Chronologically DOWNWARDS (closest future to far future)
  // 4. NO-DATE ('no-date')
  // 5. PAST DAYS (key < today) -> Overdue (yesterday, then older past days)
  const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => {
    if (a === b) return 0
    if (a === today) return -1
    if (b === today) return 1

    if (a === tomorrow) return -1
    if (b === tomorrow) return 1

    const aIsFuture = a > today && a !== 'no-date'
    const bIsFuture = b > today && b !== 'no-date'

    // Both are future dates: closest date first (e.g. 24 Aug before 25 Aug)
    if (aIsFuture && bIsFuture) {
      return a.localeCompare(b)
    }

    // Future dates always come before no-date and past days
    if (aIsFuture && !bIsFuture) return -1
    if (!aIsFuture && bIsFuture) return 1

    if (a === 'no-date') return -1
    if (b === 'no-date') return 1

    // If both are past dates: closest past first (yesterday before last week)
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

/**
 * Calculates the user's real productivity streak (consecutive active days).
 * Takes into account completed tasks, dates of completion, notes, and habit streaks.
 */
export function calculateStreakInfo(
  tasks: any[] = [],
  habits: any[] = [],
  notes: any[] = []
): { streak: number; hasActivityToday: boolean } {
  if (!Array.isArray(tasks)) tasks = []
  if (!Array.isArray(habits)) habits = []
  if (!Array.isArray(notes)) notes = []

  const completedDates = new Set<string>()

  // Helper to format local YYYY-MM-DD
  const toLocalYMD = (dInput: any): string => {
    try {
      const d = new Date(dInput)
      if (isNaN(d.getTime())) return ''
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    } catch {
      return ''
    }
  }

  // 1. Gather all completion dates from tasks
  tasks.forEach(t => {
    if (t && t.status === 'done') {
      if (t.completedAt) {
        const k = toLocalYMD(t.completedAt)
        if (k) completedDates.add(k)
      }
      if (t.dueDate && typeof t.dueDate === 'string') {
        completedDates.add(t.dueDate.slice(0, 10))
      }
      if (t.updatedAt && !t.completedAt && !t.dueDate) {
        const k = toLocalYMD(t.updatedAt)
        if (k) completedDates.add(k)
      }
    }
  })

  // 2. Gather dates from notes
  notes.forEach(n => {
    if (n) {
      if (n.dueDate) {
        completedDates.add(n.dueDate.slice(0, 10))
      } else if (n.createdAt) {
        const k = toLocalYMD(n.createdAt)
        if (k) completedDates.add(k)
      } else if (n.updatedAt) {
        const k = toLocalYMD(n.updatedAt)
        if (k) completedDates.add(k)
      }
    }
  })

  // 3. Gather completion dates from habits
  habits.forEach(h => {
    if (h && h.lastCompletedAt) {
      const k = toLocalYMD(h.lastCompletedAt)
      if (k) completedDates.add(k)
    }
  })

  const now = new Date()
  const todayStr = toLocalYMD(now)
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const yesterdayStr = toLocalYMD(yesterdayDate)

  let streak = 0
  const hasDoneToday = completedDates.has(todayStr)
  const hasDoneYesterday = completedDates.has(yesterdayStr)

  if (hasDoneToday || hasDoneYesterday) {
    let checkDate = new Date(hasDoneToday ? now : yesterdayDate)
    while (true) {
      const dateStr = toLocalYMD(checkDate)
      if (completedDates.has(dateStr)) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  // Fallback to maximum habit streak if larger
  const maxHabitStreak = habits.reduce((max, h) => Math.max(max, Number(h?.streak) || 0), 0)
  const finalStreak = Math.max(streak, maxHabitStreak)

  return {
    streak: finalStreak,
    hasActivityToday: hasDoneToday,
  }
}

export function calculateRealStreak(tasks: any[] = [], habits: any[] = [], notes: any[] = []): number {
  return calculateStreakInfo(tasks, habits, notes).streak
}


