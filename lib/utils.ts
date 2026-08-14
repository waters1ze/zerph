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
