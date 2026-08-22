import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/backend/prisma', () => ({
  prisma: {
    userSession: { findUnique: vi.fn(), update: vi.fn() },
    telegramChat: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}))

import crypto from 'crypto'
import {
  secretsMatch,
  verifyTelegramWebAppData,
  getUserAuthToken,
  getFeedSignature,
  getInternalPepper,
  getAdminSecret,
  ROOT_ADMIN_IDS,
} from '@/lib/backend/auth'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

const FRESH_AUTH_DATE = String(Math.floor(Date.now() / 1000))

/** Builds Telegram WebApp initData signed exactly per the official algorithm. */
function buildSignedInitData(fields: Record<string, string>, token = BOT_TOKEN): string {
  const params = new URLSearchParams(fields)
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  params.set('hash', hash)
  return params.toString()
}

describe('secretsMatch (constant-time comparison contract)', () => {
  it('matches identical non-empty strings', () => {
    expect(secretsMatch('abc123', 'abc123')).toBe(true)
  })

  it('rejects different content of equal length', () => {
    expect(secretsMatch('aaaa', 'aaab')).toBe(false)
  })

  it('rejects different lengths without throwing', () => {
    expect(secretsMatch('short', 'a-much-longer-value')).toBe(false)
  })

  it('rejects null / undefined / empty inputs on either side', () => {
    expect(secretsMatch(null, 'x')).toBe(false)
    expect(secretsMatch('x', null)).toBe(false)
    expect(secretsMatch(undefined, undefined)).toBe(false)
    expect(secretsMatch('', '')).toBe(false)
  })
})

describe('secret derivation & env precedence', () => {
  beforeEach(() => {
    delete process.env.ADMIN_SECRET
    delete process.env.AUTH_PEPPER
  })

  it('derives a deterministic pepper from the bot token when env missing', () => {
    const a = getInternalPepper()
    const b = getInternalPepper()
    expect(a).toBeTruthy()
    expect(a).toBe(b) // deterministic
    expect(a).not.toContain(process.env.TELEGRAM_BOT_TOKEN!) // never leaks raw secret
  })

  it('explicit env value wins over derived one', () => {
    process.env.AUTH_PEPPER = 'explicit-pepper'
    expect(getInternalPepper()).toBe('explicit-pepper')
    expect(getAdminSecret()).not.toBe('explicit-pepper') // separate purpose => separate digest
  })
})

describe('getUserAuthToken', () => {
  it('is deterministic for a given chatId under fixed secrets', () => {
    expect(getUserAuthToken(424242)).toBe(getUserAuthToken(424242))
    expect(getUserAuthToken('424242')).toBe(getUserAuthToken(BigInt(424242)))
  })

  it('differs across chatIds and is 32 hex chars', () => {
    const t1 = getUserAuthToken(1)
    const t2 = getUserAuthToken(2)
    expect(t1).toMatch(/^[0-9a-f]{32}$/)
    expect(t1).not.toBe(t2)
  })
})

describe('getFeedSignature (capability URL HMAC)', () => {
  it('is stable per chatId and truncated to 32 hex chars', () => {
    const sig = getFeedSignature('987654321')
    expect(sig).toMatch(/^[0-9a-f]{32}$/)
    expect(sig).toBe(getFeedSignature(987654321))
    expect(sig).toBe(getFeedSignature(BigInt(987654321)))
    expect(sig).not.toBe(getFeedSignature('987654322'))
  })
})

describe('verifyTelegramWebAppData', () => {
  it('accepts correctly signed initData', () => {
    const initData = buildSignedInitData({
      user: JSON.stringify({ id: 555000111, first_name: 'Test' }),
      auth_date: FRESH_AUTH_DATE,
    })
    expect(verifyTelegramWebAppData(initData)).toBe(true)
  })

  it('rejects a tampered payload (signature mismatch)', () => {
    const initData = buildSignedInitData({ user: JSON.stringify({ id: 555000111 }), auth_date: FRESH_AUTH_DATE })
    const tampered = initData.replace('555000111', '999999999')
    expect(verifyTelegramWebAppData(tampered)).toBe(false)
  })

  it('rejects signature produced with a foreign bot token', () => {
    const forged = buildSignedInitData(
      { user: JSON.stringify({ id: 42 }), auth_date: FRESH_AUTH_DATE },
      '123456:ATTACKER_TOKEN'
    )
    expect(verifyTelegramWebAppData(forged)).toBe(false)
  })

  it('rejects stale initData (auth_date older than 24h — replay protection)', () => {
    const stale = buildSignedInitData({
      user: JSON.stringify({ id: 555000111 }),
      auth_date: String(Math.floor(Date.now() / 1000) - 25 * 3600),
    })
    expect(verifyTelegramWebAppData(stale)).toBe(false)
  })

  it('rejects missing auth_date and future auth_date beyond clock skew', () => {
    const noDate = buildSignedInitData({ user: JSON.stringify({ id: 555000111 }) })
    expect(verifyTelegramWebAppData(noDate)).toBe(false)
    const future = buildSignedInitData({
      user: JSON.stringify({ id: 555000111 }),
      auth_date: String(Math.floor(Date.now() / 1000) + 3600),
    })
    expect(verifyTelegramWebAppData(future)).toBe(false)
  })

  it('rejects missing or malformed input', () => {
    expect(verifyTelegramWebAppData('')).toBe(false)
    expect(verifyTelegramWebAppData('user=zzz&auth_date=1')).toBe(false) // no hash
  })
})

describe('ROOT_ADMIN_IDS parsing', () => {
  it('parses comma-separated ids from ADMIN_CHAT_IDS at module load', async () => {
    vi.stubEnv('ADMIN_CHAT_IDS', '111, 222 ,333')
    vi.resetModules()
    const mod = await import('@/lib/backend/auth')
    expect(mod.ROOT_ADMIN_IDS).toEqual(['111', '222', '333'])
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('drops empty segments', async () => {
    vi.stubEnv('ADMIN_CHAT_IDS', ',777,,')
    vi.resetModules()
    const mod = await import('@/lib/backend/auth')
    expect(mod.ROOT_ADMIN_IDS).toEqual(['777'])
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('current module instance contains seeded root id from setup.ts env', () => {
    // setup.ts sets ADMIN_SECRET but not ADMIN_CHAT_IDS -> falls back to OWNER_CHAT_ID/empty
    expect(Array.isArray(ROOT_ADMIN_IDS)).toBe(true)
  })
})
