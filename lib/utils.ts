import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isBirthdayVisible(task: { title: string; dueDate?: string }, maxDays = 365): boolean {
  if (!task.dueDate) return true
  const title = (task.title || '').toLowerCase()
  if (title.includes('день рождения') || title.includes('др ') || title.includes('др:') || title.endsWith('др')) {
    if (task.dueDate && task.dueDate.includes('-')) {
      const [year, month, day] = task.dueDate.split('-').map(Number)
      const due = new Date(year, month - 1, day)
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const diffDays = (due.getTime() - now.getTime()) / (1000 * 3600 * 24)
      // Visible if within maxDays or if today
      return diffDays >= 0 && diffDays <= maxDays
    }
  }
  return true
}
