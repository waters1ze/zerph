import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/backend/prisma', () => ({
  prisma: { userSession: { findUnique: vi.fn() }, telegramChat: { findUnique: vi.fn() } },
}))

import { encryptJson, decryptJson, parseStoredCard } from '@/lib/backend/crypto-box'

describe('crypto-box — envelope encryption at rest (M-5)', () => {
  it('roundtrips arbitrary payout payloads', () => {
    const payload = {
      payoutType: 'card',
      cardNumber: '4111111111111111',
      phone: '+79991234567',
      bankName: 'Tinkoff',
      recipientName: 'Ivan I',
    }
    const sealed = encryptJson(payload)
    expect(sealed).toMatch(/^enc1\./)

    // The envelope must NOT contain the plaintext number:
    expect(sealed!).not.toContain('4111')

    expect(decryptJson(sealed)).toEqual(payload)
  })

  it('uses a fresh IV per encryption (no deterministic ciphertext)', () => {
    const a = encryptJson({ n: '4111111111111111' })
    const b = encryptJson({ n: '4111111111111111' })
    expect(a).not.toBe(b)
  })

  it('rejects tampered ciphertext (GCM auth) and garbage input', () => {
    const sealed = encryptJson({ secret: 1 })!
    const tampered = sealed.slice(0, -4) + 'AAAA'
    expect(decryptJson(tampered)).toBeNull()
    expect(decryptJson('not-an-envelope')).toBeNull()
    expect(decryptJson(null)).toBeNull()
    expect(decryptJson('')).toBeNull()
  })

  it('parseStoredCard: transparent legacy-plaintext migration path', () => {
    const legacy = JSON.stringify({ cardNumber: '5555444433332222', bankName: 'X' })
    expect(parseStoredCard(legacy)).toEqual({ cardNumber: '5555444433332222', bankName: 'X' })

    const sealed = encryptJson({ cardNumber: '5555444433332222' })!
    expect(parseStoredCard(sealed)).toEqual({ cardNumber: '5555444433332222' })

    expect(parseStoredCard(null)).toBeNull()
    expect(parseStoredCard('{{{')).toBeNull()
  })
})
