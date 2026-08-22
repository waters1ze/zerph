import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * buildMemoryContext contract: budget respected, sections in priority order,
 * relevance search filters by question keywords.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    telegramChat: { findUnique: vi.fn(async () => ({ timezone: 'Europe/Moscow' })) },
    userPortrait: { findUnique: vi.fn(async () => null) },
    timeDigest: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    task: { findMany: vi.fn(async () => []) },
  },
}))

vi.mock('@/lib/backend/prisma', () => ({ prisma: prismaMock }))
// lazyEnsureRecent must not fire LLMs in this suite:
vi.mock('@/lib/backend/digests', () => ({
  generateDayDigest: vi.fn(async () => 'built'),
  generateWeekDigest: vi.fn(async () => 'children-missing'),
  generateMonthDigest: vi.fn(async () => 'children-missing'),
  getUserTzSafe: vi.fn(async (_c: bigint) => 'Europe/Moscow'),
}))

import { buildMemoryContext } from '@/lib/backend/memory-context'
import { monthPeriod, weekPeriod, dayPeriod, yearPeriod, mondayOf } from '@/lib/backend/tz'

beforeEach(() => {
  prismaMock.timeDigest.findUnique.mockClear()
  prismaMock.timeDigest.findMany.mockClear()
})

describe('buildMemoryContext — budgeting', () => {
  it('returns empty block when there is no data at all', async () => {
    const ctx = await buildMemoryContext(BigInt(1))
    expect(ctx.systemBlock).toContain('Память пользователя Zerf')
    expect(ctx.sections).toHaveLength(0)
    expect(ctx.usedTokens).toBe(0)
  })

  it('clips oversized digest text to the section budget', async () => {
    (prismaMock.userPortrait.findUnique as any).mockResolvedValueOnce({
      ownerChatId: BigInt(1),
      core: { x: 'y'.repeat(10_000) },
      recent: {},
      version: 3,
      updatedAt: new Date(),
    })

    // Compute REAL period starts for a FIXED "today" (deterministic tests!)
    const FIXED_NOW = new Date('2026-08-22T12:00:00Z')
    const bigMonthText = 'месяц '.repeat(2000)
    const starts = new Map<string, string>()
    const assign = (name: string, d: Date) => starts.set(d.toISOString(), name)
    assign('Итоги года', yearPeriod(2026, 'Europe/Moscow').start)
    assign('Итоги месяца', monthPeriod(2026, 8, 'Europe/Moscow').start)
    assign('Итоги недели', weekPeriod(mondayOf('2026-08-22'), 'Europe/Moscow').start)
    assign('Вчера', dayPeriod('2026-08-21', 'Europe/Moscow').start)

    ;(prismaMock.timeDigest.findUnique as any).mockImplementation(({ where }: any) => {
      const s = new Date(where.ownerChatId_level_periodStart.periodStart).toISOString()
      const name = starts.get(s)
      if (!name) return Promise.resolve(null)
      if (name === 'Итоги года') return Promise.resolve({ text: 'год ок', model: 'm' })
      if (name === 'Итоги месяца') return Promise.resolve({ text: bigMonthText, model: 'm' })
      if (name === 'Итоги недели') return Promise.resolve({ text: 'неделя ок', model: 'm' })
      return Promise.resolve({ text: `${name} ок`, model: 'm' })
    })

    const ctx = await buildMemoryContext(BigInt(1), { budgetTokens: 1200, now: FIXED_NOW })

    const monthSection = ctx.sections.find(s => s.name === 'Итоги месяца')
    expect(monthSection).toBeTruthy()
    expect(monthSection!.tokens).toBeLessThanOrEqual(500)

    expect(ctx.usedTokens).toBeLessThanOrEqual(1200 + 20)
    const raw = ctx.systemBlock
    expect(raw).toContain('год ок')
    expect(raw).toContain('Вчера ок')
  })
})

describe('buildMemoryContext — relevance', () => {
  it('includes only keyword-matching past digests when a question is given', async () => {
    ;(prismaMock.timeDigest.findMany as any).mockResolvedValueOnce([
      { periodStart: new Date('2026-05-04T00:00:00Z'), level: 'week', text: 'Неделя отпуска в Сочи, задач мало' },
      { periodStart: new Date('2026-06-01T00:00:00Z'), level: 'month', text: 'Месяц прошёл под знаком дедлайнами и релизов' },
    ])

    const ctx = await buildMemoryContext(BigInt(2), {
      question: 'как я справлялся с дедлайнами?',
      budgetTokens: 1500,
      now: new Date('2026-08-22T12:00:00Z'),
    })

    expect(ctx.systemBlock).toContain('дедлайнами')
    expect(ctx.systemBlock).not.toContain('Сочи')
  })

  it('skips relevance entirely without a question', async () => {
    await buildMemoryContext(BigInt(3), {})
    expect(prismaMock.timeDigest.findMany).not.toHaveBeenCalled()
  })
})
