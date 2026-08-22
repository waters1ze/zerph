import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/backend/prisma', () => ({
  prisma: {
    userSession: { findUnique: vi.fn() },
    telegramChat: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}))

import crypto from 'crypto'
import {
  hashPassword,
  verifyPassword,
  isLegacyPasswordHash,
  generateEmailChatId,
} from '@/lib/backend/passwords'

describe('hashPassword / verifyPassword (current format)', () => {
  it('verifies the correct password and rejects a wrong one', () => {
    const stored = hashPassword('S3cure-Pass!вот-так')
    expect(verifyPassword('S3cure-Pass!вот-так', stored)).toBe(true)
    expect(verifyPassword('wrong', stored)).toBe(false)
  })

  it('produces a per-hash random salt (two hashes of same password differ)', () => {
    const h1 = hashPassword('same-password')
    const h2 = hashPassword('same-password')
    expect(h1).not.toBe(h2)
    const salt1 = h1.split('$')[2]
    const salt2 = h2.split('$')[2]
    expect(salt1).not.toBe(salt2)
  })

  it('uses the documented format pbkdf2$<iter>$<saltHex>$<hashHex> with 600k iterations', () => {
    const parts = hashPassword('x').split('$')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('pbkdf2')
    expect(parseInt(parts[1], 10)).toBe(600_000)
    expect(parts[2]).toMatch(/^[0-9a-f]{32}$/) // 16 random bytes
    expect(parts[3]).toMatch(/^[0-9a-f]{64}$/) // 32-byte digest
  })

  it('supports unicode and empty-string passwords deterministically', () => {
    expect(verifyPassword('', hashPassword(''))).toBe(true)
    const emoji = 'пароль🔑'
    expect(verifyPassword(emoji, hashPassword(emoji))).toBe(true)
  })
})

describe('verifyPassword (legacy static-salt format)', () => {
  const legacyHash = (pw: string) =>
    crypto.pbkdf2Sync(pw, 'zerf_salt_2026', 1000, 32, 'sha256').toString('hex')

  it('still verifies legacy hashes for migration window', () => {
    const legacy = legacyHash('old-password')
    expect(isLegacyPasswordHash(legacy)).toBe(true)
    expect(verifyPassword('old-password', legacy)).toBe(true)
    expect(verifyPassword('not-it', legacy)).toBe(false)
  })

  it('flags modern hashes as non-legacy', () => {
    expect(isLegacyPasswordHash(hashPassword('x'))).toBe(false)
  })
})

describe('verifyPassword (malformed / hostile stored values)', () => {
  it.each([
    [null],
    [undefined],
    [''],
    ['pbkdf2$'], // truncated
    ['pbkdf2$abc$salt$hash'], // non-numeric iterations
    ['pbkdf2$0$abcd$' + 'ab'.repeat(32)], // zero iterations
    ['pbkdf2$600000$zzzz$' + 'ab'.repeat(32)], // invalid hex salt
    ['pbkdf2$600000$' + 'ab'.repeat(16) + '$nothex'],
  ])('returns false without throwing for %j', (stored) => {
    expect(() => verifyPassword('pw', stored as string)).not.toThrow()
    expect(verifyPassword('pw', stored as string)).toBe(false)
  })
})

describe('generateEmailChatId', () => {
  it('always yields a bigint in the 90xxxxxxxx range', () => {
    for (let i = 0; i < 200; i++) {
      const id = generateEmailChatId()
      expect(typeof id).toBe('bigint')
      const s = id.toString()
      expect(s).toMatch(/^90\d{8}$/)
      expect(BigInt(s)).toBeLessThan(BigInt('9100000000'))
    }
  })
})
