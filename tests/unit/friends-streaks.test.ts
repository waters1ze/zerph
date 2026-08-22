import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/backend/prisma', () => ({
  prisma: {
    friendship: { findMany: vi.fn(async () => []) },
    telegramChat: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}))

import {
  getFriendsLeaderboard,
  buildStreakNudges,
  LeaderboardEntry,
} from '@/lib/backend/friends-streaks'
import { prisma } from '@/lib/backend/prisma'
import { cardSignature } from '@/lib/backend/cards'

const ME = BigInt(100)
const entry = (over: Partial<LeaderboardEntry>): LeaderboardEntry => ({
  chatId: '1', name: 'X', streak: 0, rank: null, isMe: false, ...over,
})

describe('buildStreakNudges — social pressure copy (pure)', () => {
  it('nudges when a friend is ahead', () => {
    const list = [
      entry({ name: 'Маша', streak: 12 }),
      entry({ name: 'Я', streak: 7, isMe: true }),
    ]
    const n = buildStreakNudges(list)
    expect(n).toHaveLength(1)
    expect(n[0]).toContain('Маша')
    expect(n[0]).toContain('12')
    expect(n[0]).toContain('7')
  })

  it('encourages a cold start when me=0 and friends are burning', () => {
    const n = buildStreakNudges([
      entry({ name: 'Петя', streak: 5 }),
      entry({ name: 'Я', streak: 0, isMe: true }),
    ])
    expect(n[0]).toContain('Петя')
    expect(n[0]).toContain('начни сегодня')
  })

  it('praises when ahead of >=3 friends with streak>=3', () => {
    const n = buildStreakNudges([
      entry({ name: 'A', streak: 1 }),
      entry({ name: 'B', streak: 2 }),
      entry({ name: 'Я', streak: 6, isMe: true }),
    ])
    expect(n.some(x => x.includes('впереди'))).toBe(true)
  })

  it('silent without self or when self streak hidden by privacy', () => {
    expect(buildStreakNudges([entry({ name: 'A' })])).toEqual([])
    expect(buildStreakNudges([entry({ name: 'Я', streak: null, isMe: true })])).toEqual([])
  })
})

describe('getFriendsLeaderboard — privacy + ranking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hides streaks of friends who opted out; self always visible', async () => {
    ;(prisma.friendship.findMany as any).mockResolvedValue([
      { friendChatId: BigInt(200) },
      { friendChatId: BigInt(300) },
    ])
    ;(prisma.telegramChat.findMany as any).mockResolvedValue([
      { chatId: ME, firstName: 'Я', streakDays: 7, streakVisible: true },
      { chatId: BigInt(200), firstName: 'Скрытный', streakDays: 30, streakVisible: false },
      { chatId: BigInt(300), firstName: 'Открытый', streakDays: 3, streakVisible: true },
    ])

    const { entries } = await getFriendsLeaderboard(ME)

    const hidden = entries.find(e => e.name === 'Скрытный')!
    expect(hidden.streak).toBeNull()
    expect(hidden.rank).toBeNull()

    // ranks skip hidden entries
    const visible = entries.filter(e => e.streak !== null)
    expect(visible.map(e => e.rank)).toEqual([1, 2])
    expect(visible[0].isMe).toBe(true)
  })

  it('works for a user with zero friends (self only)', async () => {
    ;(prisma.friendship.findMany as any).mockResolvedValue([])
    ;(prisma.telegramChat.findMany as any).mockResolvedValue([
      { chatId: ME, firstName: 'Одиночка', streakDays: 2, streakVisible: false },
    ])

    const { entries, nudges } = await getFriendsLeaderboard(ME)
    expect(entries).toHaveLength(1)
    expect(entries[0].streak).toBe(2) // self sees own streak even if hidden from others
    expect(entries[0].rank).toBe(1)
    expect(nudges).toEqual([])
  })
})

describe('card capability signature — bot/route contract', () => {
  it('is deterministic per kind+chatId and differs across kinds', () => {
    const a = cardSignature('weekly', '555')
    const b = cardSignature('weekly', BigInt(555))
    const c = cardSignature('yearly', '555')

    expect(a).toBe(b) // string vs bigint chatId must agree
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(c)
  })
})
