import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/backend/prisma', () => ({
  prisma: {
    task: { count: vi.fn(), findMany: vi.fn() },
    note: { count: vi.fn() },
    goal: { count: vi.fn() },
    habit: { findMany: vi.fn(async () => []) },
    telegramChat: { findUnique: vi.fn() },
    friendship: { findMany: vi.fn(async () => []) },
  },
}))

import { computePortrait, collectWeeklyStats } from '@/lib/backend/cards'
import { prisma } from '@/lib/backend/prisma'

describe('computePortrait — deterministic classifier', () => {
  const base = {
    tasksCompleted: 10,
    tasksCreated: 12,
    notesCreated: 3,
    goalsUpdated: 2,
    activeDaysLast30: 20,
    distinctProjects: 1,
    delegatedToFriends: 0,
  }

  it('daily regularity dominates -> Марафонец', () => {
    expect(computePortrait({ ...base, activeDaysLast30: 30 }).title).toBe('Марафонец')
  })

  it('finisher rate dominates -> Завершатель', () => {
    const p = computePortrait({
      ...base,
      tasksCompleted: 30,
      tasksCreated: 30,
      activeDaysLast30: 5,
      notesCreated: 0,
      goalsUpdated: 0,
    })
    expect(p.title).toBe('Завершатель')
  })

  it('planning activity dominates -> Архитектор порядка', () => {
    const p = computePortrait({ ...base, notesCreated: 8, goalsUpdated: 4, activeDaysLast30: 3 })
    expect(p.title).toBe('Архитектор порядка')
  })

  it('axes stay within [5..100] for extreme inputs (property/edge)', () => {
    const extremes = [
      { ...base, tasksCreated: 0 },
      { ...base, tasksCreated: -5, activeDaysLast30: 999, delegatedToFriends: -100 },
      { ...base, tasksCompleted: Number.MAX_SAFE_INTEGER },
    ]
    for (const input of extremes) {
      const { axes } = computePortrait(input)
      for (const v of Object.values(axes)) {
        expect(v).toBeGreaterThanOrEqual(5)
        expect(v).toBeLessThanOrEqual(100)
        expect(Number.isFinite(v)).toBe(true)
      }
    }
  })

  it('is deterministic: same input -> same output (no flaky cards)', () => {
    expect(computePortrait(base)).toEqual(computePortrait(base))
  })
})

describe('collectWeeklyStats — window math', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aggregates counters and picks the best weekday', async () => {
    ;(prisma.task.count as any)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(5)
    ;(prisma.note.count as any).mockResolvedValue(2)
    ;(prisma.telegramChat.findUnique as any).mockResolvedValue({ streakDays: 9 })
    const wed = new Date('2026-08-19T12:00:00Z') // Wednesday
    const thu = new Date('2026-08-20T12:00:00Z')
    ;(prisma.task.findMany as any).mockResolvedValue([
      { completedAt: wed }, { completedAt: wed }, { completedAt: thu },
    ])

    const s = await collectWeeklyStats(BigInt(1))
    expect(s.tasksCreated).toBe(7)
    expect(s.tasksCompleted).toBe(5)
    expect(s.notesCreated).toBe(2)
    expect(s.streakDays).toBe(9)
    expect(s.bestDay).toBe('Среда')
    expect(s.bestDayCount).toBe(2)
    expect(s.weekLabel).toMatch(/^\d{2}\.\d{2}\.\d{4}/)
  })

  it('empty week yields dashes without throwing', async () => {
    ;(prisma.task.count as any).mockResolvedValue(0)
    ;(prisma.note.count as any).mockResolvedValue(0)
    ;(prisma.telegramChat.findUnique as any).mockResolvedValue(null)
    ;(prisma.task.findMany as any).mockResolvedValue([])

    const s = await collectWeeklyStats(BigInt(1))
    expect(s.bestDay).toBe('—')
    expect(s.streakDays).toBe(0)
  })
})
