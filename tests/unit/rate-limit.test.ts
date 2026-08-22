import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkInMemoryRateLimit, getClientIp } from '@/lib/backend/rate-limit'

describe('checkInMemoryRateLimit', () => {
  beforeEach(() => {
    // unique key namespace per test => isolation without exposing internals
  })

  it('allows up to maxReqs within window, then blocks', () => {
    const key = `rl:${Math.random()}`
    expect(checkInMemoryRateLimit(key, 3, 60_000)).toBe(true)
    expect(checkInMemoryRateLimit(key, 3, 60_000)).toBe(true)
    expect(checkInMemoryRateLimit(key, 3, 60_000)).toBe(true)
    expect(checkInMemoryRateLimit(key, 3, 60_000)).toBe(false)
  })

  it('resets the window after expiry', () => {
    const key = `rl:${Math.random()}`
    expect(checkInMemoryRateLimit(key, 1, 5)).toBe(true)
    expect(checkInMemoryRateLimit(key, 1, 5)).toBe(false)
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(checkInMemoryRateLimit(key, 1, 5)).toBe(true)
        resolve()
      }, 10)
    })
  })

  it('tracks keys independently (no cross-key bleed)', () => {
    const a = `rl:a:${Math.random()}`
    const b = `rl:b:${Math.random()}`
    checkInMemoryRateLimit(a, 1, 60_000)
    expect(checkInMemoryRateLimit(a, 1, 60_000)).toBe(false)
    expect(checkInMemoryRateLimit(b, 1, 60_000)).toBe(true)
  })
})

describe('getClientIp', () => {
  const makeReq = (headers: Record<string, string>) =>
    new Request('https://example.com/api', { headers })

  it('returns first hop of x-forwarded-for', () => {
    const req = makeReq({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })
    expect(getClientIp(req)).toBe('203.0.113.7')
  })

  it('trims whitespace around the first hop', () => {
    const req = makeReq({ 'x-forwarded-for': '  198.51.100.22 , 10.0.0.1' })
    expect(getClientIp(req)).toBe('198.51.100.22')
  })

  it('falls back to x-real-ip', () => {
    expect(getClientIp(makeReq({ 'x-real-ip': '192.0.2.9' }))).toBe('192.0.2.9')
  })

  it('returns "unknown" when no proxy headers present', () => {
    expect(getClientIp(makeReq({}))).toBe('unknown')
  })

  it('treats empty x-forwarded-for as absent', () => {
    const req = makeReq({ 'x-forwarded-for': '', 'x-real-ip': '192.0.2.5' })
    expect(getClientIp(req)).toBe('192.0.2.5')
  })
})

describe('cleanup ticker (bounded-memory contract)', () => {
  /**
   * The module registers a 5-minute purge interval at load time, so the test
   * re-imports a FRESH module instance under fake timers to capture it.
   * Observable contract:
   *  - entries whose window expired are REMOVED from the store;
   *  - entries still inside their window survive the tick.
   */
  it('removes expired windows and keeps live ones across the tick', async () => {
    vi.useFakeTimers()
    vi.resetModules()
    try {
      const mod = await import('@/lib/backend/rate-limit')

      const deadKey = `rl:purge-dead:${Math.random()}` // expires in 1s
      const liveKey = `rl:purge-live:${Math.random()}` // window longer than the tick

      expect(mod.checkInMemoryRateLimit(deadKey, 1, 1_000)).toBe(true)
      expect(mod.checkInMemoryRateLimit(deadKey, 1, 1_000)).toBe(false)
      expect(mod.checkInMemoryRateLimit(liveKey, 1, 10 * 60_000)).toBe(true)

      await vi.advanceTimersByTimeAsync(5 * 60_000 + 10)

      // expired entry: brand-new window starts again
      expect(mod.checkInMemoryRateLimit(deadKey, 1, 1_000)).toBe(true)
      // live entry: still blocked — its counter survived the purge tick
      expect(mod.checkInMemoryRateLimit(liveKey, 1, 10 * 60_000)).toBe(false)
    } finally {
      vi.useRealTimers()
      vi.resetModules()
    }
  })
})
