import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/backend/prisma', () => ({
  prisma: { userSession: { findUnique: vi.fn() }, telegramChat: { findUnique: vi.fn() } },
}))

import { getSiriUserKeyFull, getSiriUserKey, siriKeyMatches } from '@/app/api/shortcuts/route'

const CHAT = 424242

afterEach(() => {
  delete process.env.SIRI_LEGACY_KEYS_DISABLED
})

describe('Siri capability keys — strength + legacy transition', () => {
  it('issues full-length 64-hex keys for NEW personal URLs', () => {
    const key = getSiriUserKey(CHAT)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(key).toBe(getSiriUserKeyFull(String(CHAT)))
    // different users -> different keys
    expect(getSiriUserKey(424243)).not.toBe(key)
  })

  it('accepts the new full key', () => {
    expect(siriKeyMatches(getSiriUserKeyFull(CHAT)!, CHAT)).toBe(true)
  })

  it('STILL accepts the legacy 10-char key during transition window', () => {
    const legacy = getSiriUserKeyFull(CHAT)!.slice(0, 10)
    expect(siriKeyMatches(legacy, CHAT)).toBe(true)
  })

  it('legacy keys can be hard-disabled via SIRI_LEGACY_KEYS_DISABLED', () => {
    process.env.SIRI_LEGACY_KEYS_DISABLED = 'true'
    expect(getSiriUserKey(CHAT)).toMatch(/^[0-9a-f]{64}$/)

    const legacy = getSiriUserKeyFull(CHAT)!.slice(0, 10)
    expect(siriKeyMatches(legacy, CHAT)).toBe(false)
    expect(siriKeyMatches(getSiriUserKeyFull(CHAT)!, CHAT)).toBe(true)
  })

  it.each([
    ['wrong user key', () => getSiriUserKeyFull(999999)!],
    ['truncated to 9 chars (brute-force edge)', () => getSiriUserKeyFull(CHAT)!.slice(0, 9)],
    ['11-char hybrid', () => getSiriUserKeyFull(CHAT)!.slice(0, 11)],
    ['empty', () => ''],
  ])('rejects %s', (_name, make) => {
    expect(siriKeyMatches(make(), CHAT)).toBe(false)
  })
})
