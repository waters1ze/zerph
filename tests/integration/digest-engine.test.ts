import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration contract of the memory engine:
 *  - N raw days -> exactly N LLM day calls; closed week -> exactly ONE week
 *    call (+1 portrait-recent refresh); empty day NEVER reaches the LLM;
 *  - rerunning completed periods makes ZERO additional Groq calls.
 */

const { prismaMock, groqMock, rawState } = vi.hoisted(() => {
  // In-memory TimeDigest table keyed by owner|level|startIso
  const digests = new Map<string, any>()
  return {
    rawState: { empty: false },
    groqMock: { calls: 0 },
    prismaMock: {
      _digests: digests,
      telegramChat: { findUnique: vi.fn(async () => ({ timezone: 'Europe/Moscow' })) },
      task: {
        count: vi.fn(async () => (rawState.empty ? 0 : 2)),
        findMany: vi.fn(async () => (rawState.empty ? [] : [{ title: 'Task A', tags: ['работа'] }])),
      },
      note: { count: vi.fn(async () => (rawState.empty ? 0 : 1)) },
      habit: { findMany: vi.fn(async () => (rawState.empty ? [] : [{ title: 'Зарядка' }])) },
      appActionLog: { create: vi.fn(async () => ({})) },
      timeDigest: {
        upsert: vi.fn(async ({ where, create }: any) => {
          const w = where.ownerChatId_level_periodStart
          const k = `${w.ownerChatId}|${w.level}|${new Date(w.periodStart).toISOString()}`
          digests.set(k, create)
          return { ...create }
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          const w = where.ownerChatId_level_periodStart
          const k = `${w.ownerChatId}|${w.level}|${new Date(w.periodStart).toISOString()}`
          return digests.get(k) || null
        }),
        findMany: vi.fn(async ({ where }: any) => {
          const out: any[] = []
          for (const [k, v] of digests.entries()) {
            const [owner, level, startIso] = k.split('|')
            if (where?.ownerChatId !== undefined && BigInt(owner) !== where.ownerChatId) continue
            if (where?.level) {
              const inArr = Array.isArray(where.level.in)
              if (inArr ? !where.level.in.includes(level) : where.level !== level) continue
            }
            if (where?.periodStart?.in) {
              const wanted = where.periodStart.in.map((d: Date) => new Date(d).toISOString())
              if (!wanted.includes(startIso)) continue
            }
            out.push({ periodStart: new Date(startIso), content: v.content })
          }
          return out
        }),
      },
      userPortrait: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async ({ create }: any) => create),
      },
    },
  }
})

vi.mock('@/lib/backend/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/backend/groq-pool', () => ({
  callGroqChatCompletion: vi.fn(async () => {
    groqMock.calls++
    return {
      content: JSON.stringify({
        made: ['Task A'],
        moved: [],
        missed: [],
        patterns: ['работа вечером'],
        topTags: ['работа'],
        oneLiner: 'Продуктивный день: закрыл Task A',
        stats: { created: 2, completed: 1, missed: 0 },
        markdown: '**Итог:** 1 выполнена.',
      }),
      model: 'test-model',
    }
  }),
}))

import { generateDayDigest, generateWeekDigest } from '@/lib/backend/digests'

const OWNER = BigInt(101)
const D = (d: number) => `2026-08-${String(d).padStart(2, '0')}`

beforeEach(() => {
  groqMock.calls = 0
  rawState.empty = false
})

describe('memory engine — pyramid & idempotency', () => {
  it('raw days cost one call each; EMPTY day costs ZERO (marker instead)', async () => {
    await generateDayDigest(OWNER, D(17))
    await generateDayDigest(OWNER, D(18))
    await generateDayDigest(OWNER, D(19))
    expect(groqMock.calls).toBe(3)

    rawState.empty = true
    const res = await generateDayDigest(OWNER, D(20))
    expect(res).toBe('empty')
    expect(groqMock.calls).toBe(3)

    // Week is not buildable until all 7 slots exist
    const weekRes = await generateWeekDigest(OWNER, D(17))
    expect(weekRes).toBe('children-missing')
  })

  it('full pyramid: 6 non-empty + 1 empty day -> week built from CHILD digests', async () => {
    // owner-specific namespace keeps this test independent
    const O = BigInt(102)
    for (let d = 17; d <= 23; d++) {
      rawState.empty = d === 20 // Thursday empty marker
      await generateDayDigest(O, D(d))
    }
    const before = groqMock.calls
    expect(before).toBe(6) // six real days; Thursday was free

    const res = await generateWeekDigest(O, D(17))
    expect(res).toBe('built')
    // +1 week summary, +1 weekly portrait refresh — children were NOT re-summarized
    expect(groqMock.calls).toBe(before + 2)
  })

  it('IDEMPOTENCY: rerunning completed periods triggers ZERO extra LLM calls', async () => {
    const O = BigInt(103)
    for (let d = 17; d <= 23; d++) {
      rawState.empty = d === 20
      await generateDayDigest(O, D(d))
    }
    await generateWeekDigest(O, D(17))
    const before = groqMock.calls

    for (let d = 17; d <= 23; d++) await generateDayDigest(O, D(d))
    await generateWeekDigest(O, D(17))

    expect(groqMock.calls).toBe(before)
  })

  it('tokens accounting writes an AppActionLog row per non-empty digest', async () => {
    const beforeCalls = prismaMock.appActionLog.create.mock.calls.length
    rawState.empty = false
    await generateDayDigest(BigInt(201), D(25))
    expect(prismaMock.appActionLog.create.mock.calls.length).toBe(beforeCalls + 1)

    rawState.empty = true
    await generateDayDigest(BigInt(201), D(26))
    expect(prismaMock.appActionLog.create.mock.calls.length).toBe(beforeCalls + 1) // unchanged
  })
})
