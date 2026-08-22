import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { NextRequest } from 'next/server'

/**
 * Security suite for the authentication resolver `getAuthenticatedUser`.
 * Contract under test (lib/backend/auth.ts):
 *   priority: admin secret -> Telegram WebApp HMAC -> DB session token ->
 *             bot-issued HMAC token -> signed VK launch params ->
 *             legacy unverified chatId (opt-in only).
 * A bare `x-chat-id` must NEVER authenticate a user (IDOR regression guard).
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    userSession: {
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
    },
    telegramChat: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/backend/prisma', () => ({ prisma: prismaMock }))

import {
  getAuthenticatedUser,
  getUserAuthToken,
  generateOnetimeToken,
  secretsMatch,
  verifyVkLaunchParams,
  getTelegramUserIdFromInitData,
  isUserAdmin,
  createServerSession,
} from '@/lib/backend/auth'

const ADMIN_SECRET = process.env.ADMIN_SECRET!
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

const BASE = 'http://localhost/api/tasks'

function req(opts: {
  method?: string
  url?: string
  headers?: Record<string, string>
} = {}): NextRequest {
  return new NextRequest(opts.url || BASE, {
    method: opts.method || 'GET',
    headers: opts.headers || {},
  })
}

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

/** Replicates the official VK Mini App signature algorithm. */
function vkSign(launchParams: string, appSecret: string, algo: 'hmac' | 'md5'): string {
  const urlParams = new URLSearchParams(launchParams)
  const vkParams: Array<[string, string]> = []
  urlParams.forEach((value, key) => {
    if (key.startsWith('vk_')) vkParams.push([key, value])
  })
  vkParams.sort(([a], [b]) => a.localeCompare(b))
  if (algo === 'hmac') {
    const qs = vkParams.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return crypto.createHmac('sha256', appSecret).update(qs).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const pairs = vkParams.map(([k, v]) => `${k}=${v}`).join('')
  return crypto.createHash('md5').update(pairs + appSecret).digest('hex')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('priority 1: server-to-server admin secret', () => {
  it('authenticates via Bearer secret and honors explicit x-chat-id as root', async () => {
    const res = await getAuthenticatedUser(req({
      headers: { authorization: `Bearer ${ADMIN_SECRET}`, 'x-chat-id': '424242' },
    }))
    expect(res).toEqual({ chatId: '424242', isRoot: true })
  })

  it('accepts x-admin-secret header variant', async () => {
    const res = await getAuthenticatedUser(req({
      headers: { 'x-admin-secret': ADMIN_SECRET },
    }))
    expect(res?.isRoot).toBe(true)
    expect(res?.chatId).toBeTruthy()
  })

  it('rejects a wrong secret completely', async () => {
    const res = await getAuthenticatedUser(req({
      headers: { authorization: 'Bearer wrong-secret-value', 'x-chat-id': '1' },
    }))
    expect(res).toBeNull()
  })

  it('secret comparison is safe against malformed bearer prefixes', async () => {
    // "Bearer" scheme missing / doubled spaces — must not throw or match
    const r1 = await getAuthenticatedUser(req({ headers: { authorization: ADMIN_SECRET } }))
    expect(r1?.isRoot).toBe(true)
    const r2 = await getAuthenticatedUser(req({ headers: { authorization: `Bearer   ${ADMIN_SECRET}` } }))
    expect(r2?.isRoot).toBe(true)
  })
})

describe('priority 2: Telegram WebApp initData HMAC', () => {
  it('authenticates a properly signed payload and extracts the real user id', async () => {
    const initData = buildSignedInitData({
      user: JSON.stringify({ id: 555000111, first_name: 'Tg' }),
      auth_date: '1700000000',
    })
    const res = await getAuthenticatedUser(req({ headers: { 'x-tg-init-data': initData } }))
    expect(res).toEqual({ chatId: '555000111', isRoot: false })
  })

  it('rejects a tampered payload instead of trusting client user field', async () => {
    const legit = buildSignedInitData({ user: JSON.stringify({ id: 555000111 }), auth_date: '1700000000' })
    const forged = legit.replace('555000111', '999') // re-signed payload mismatch
    const res = await getAuthenticatedUser(req({ headers: { 'x-tg-init-data': forged } }))
    expect(res).toBeNull()
  })

  it('rejects signed payload that lacks the user field', async () => {
    const initData = buildSignedInitData({ auth_date: '1700000000' })
    const res = await getAuthenticatedUser(req({ headers: { 'x-tg-init-data': initData } }))
    expect(res).toBeNull()
  })
})

describe('priority 3: DB session token (identity comes ONLY from the session row)', () => {
  const freshSession = (chatId: bigint) => ({
    id: 'sess-1',
    chatId,
    sessionToken: 'a'.repeat(32),
    isRevoked: false,
    createdAt: new Date(Date.now() - 60_000),
  })

  it('resolves identity from the DB row, ignoring a spoofed x-chat-id header', async () => {
    prismaMock.userSession.findUnique.mockResolvedValue(freshSession(BigInt(777)))

    const res = await getAuthenticatedUser(req({
      headers: { 'x-auth-token': 'a'.repeat(32), 'x-chat-id': '999' }, // claims to be 999!
    }))

    expect(res).toEqual({ chatId: '777', isRoot: false }) // session wins over header
    expect(prismaMock.userSession.findUnique).toHaveBeenCalledWith({
      where: { sessionToken: 'a'.repeat(32) },
    })
  })

  it('rejects revoked sessions', async () => {
    prismaMock.userSession.findUnique.mockResolvedValue({ ...freshSession(BigInt(777)), isRevoked: true })
    const res = await getAuthenticatedUser(req({ headers: { 'x-auth-token': 'a'.repeat(32) } }))
    expect(res).toBeNull()
  })

  it('rejects sessions older than SESSION_MAX_AGE (100 days)', async () => {
    prismaMock.userSession.findUnique.mockResolvedValue({
      ...freshSession(BigInt(777)),
      createdAt: new Date(Date.now() - 101 * 24 * 3600 * 1000),
    })
    const res = await getAuthenticatedUser(req({ headers: { 'x-auth-token': 'a'.repeat(32) } }))
    expect(res).toBeNull()
  })

  it('reads the token from the zerf_auth_token cookie as well', async () => {
    prismaMock.userSession.findUnique.mockResolvedValue(freshSession(BigInt(888)))
    const res = await getAuthenticatedUser(req({
      headers: { cookie: `zerf_auth_token=${'b'.repeat(32)}` },
    }))
    expect(res?.chatId).toBe('888')
    expect(prismaMock.userSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionToken: 'b'.repeat(32) } })
    )
  })

  it('DB lookup failure does NOT authenticate the caller', async () => {
    prismaMock.userSession.findUnique.mockRejectedValue(new Error('db down'))
    const res = await getAuthenticatedUser(req({ headers: { 'x-auth-token': 'c'.repeat(20) } }))
    expect(res).toBeNull()
  })
})

describe('priority 3.1: bot-issued deterministic HMAC token', () => {
  it('authenticates when the token equals getUserAuthToken(chatId)', async () => {
    const expected = getUserAuthToken('121212')
    const res = await getAuthenticatedUser(req({
      headers: { 'x-auth-token': expected, 'x-chat-id': '121212' },
    }))
    expect(res).toEqual({ chatId: '121212', isRoot: false })
    expect(prismaMock.userSession.create).toHaveBeenCalledTimes(1) // auto-minted session
  })

  it('rejects a valid-looking token paired with a DIFFERENT chatId', async () => {
    const tokenForA = getUserAuthToken('111')
    const res = await getAuthenticatedUser(req({
      headers: { 'x-auth-token': tokenForA, 'x-chat-id': '222' }, // token/user mismatch
    }))
    expect(res).toBeNull()
  })

  it('rejects non-numeric chatId injection attempts', async () => {
    const expected = getUserAuthToken('333')
    const res = await getAuthenticatedUser(req({
      headers: { 'x-auth-token': expected, 'x-chat-id': '333 OR 1=1' },
    }))
    expect(res).toBeNull()
  })
})

describe('CRITICAL REGRESSION GUARD: bare x-chat-id never authenticates', () => {
  it.each([
    ['header only', { 'x-chat-id': '424242' }],
    ['query param only', {}],
  ])('returns null for %s when no verifiable credential present', async (_name, headers) => {
    prismaMock.telegramChat.findUnique.mockResolvedValue({ isAdmin: true })
    const url = `${BASE}?chatId=424242`
    const res = await getAuthenticatedUser(req({ url, headers }))
    expect(res).toBeNull()
  })

  it('legacy opt-in mode authenticates only REGISTERED chat ids', async () => {
    vi.stubEnv('ALLOW_UNVERIFIED_CHATID_AUTH', 'true')
    try {
      // registered user passes
      prismaMock.telegramChat.findUnique.mockResolvedValueOnce({ chatId: true })
      const ok = await getAuthenticatedUser(req({
        url: `${BASE}?chat_id=424242`,
        headers: {},
      }))
      expect(ok).toEqual({ chatId: '424242', isRoot: false })

      // unknown chat id is refused even in legacy mode
      prismaMock.telegramChat.findUnique.mockResolvedValueOnce(null)
      const unknown = await getAuthenticatedUser(req({
        url: `${BASE}?chat_id=1`,
        headers: {},
      }))
      expect(unknown).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('priority 4: signed VK Mini App launch params', () => {
  const APP_SECRET = 'vk-test-app-secret'
  const rawParams = 'vk_user_id=4242&vk_app_id=512&vk_ts=1700000000'

  afterEach(() => vi.unstubAllEnvs())

  it('verifyVkLaunchParams accepts the official HMAC signature', () => {
    vi.stubEnv('VK_APP_SECRET', APP_SECRET)
    const sign = vkSign(rawParams, APP_SECRET, 'hmac')
    const verified = verifyVkLaunchParams(`${rawParams}&sign=${sign}`)
    expect(verified).toEqual({ vkUserId: '4242', isRoot: false })
  })

  it('verifyVkLaunchParams accepts the legacy MD5 signature', () => {
    vi.stubEnv('VK_APP_SECRET', APP_SECRET)
    const sign = vkSign(rawParams, APP_SECRET, 'md5')
    const verified = verifyVkLaunchParams(`${rawParams}&sign=${sign}`)
    expect(verified).toEqual({ vkUserId: '4242', isRoot: false })
  })

  it('verifyVkLaunchParams fails closed without configured app secret', () => {
    delete process.env.VK_APP_SECRET
    const sign = vkSign(rawParams, APP_SECRET, 'hmac')
    expect(verifyVkLaunchParams(`${rawParams}&sign=${sign}`)).toBeNull()
  })

  it('verifyVkLaunchParams rejects forged signatures and missing user id', () => {
    vi.stubEnv('VK_APP_SECRET', APP_SECRET)
    expect(verifyVkLaunchParams(`${rawParams}&sign=deadbeef`)).toBeNull()

    const noUser = 'vk_app_id=512&vk_ts=1'
    const signNoUser = vkSign(noUser, APP_SECRET, 'hmac')
    expect(verifyVkLaunchParams(`${noUser}&sign=${signNoUser}`)).toBeNull()
  })

  it('getAuthenticatedUser resolves through the x-vk-launch header', async () => {
    vi.stubEnv('VK_APP_SECRET', APP_SECRET)
    const sign = vkSign(rawParams, APP_SECRET, 'hmac')
    const res = await getAuthenticatedUser(req({
      headers: { 'x-vk-launch': `${rawParams}&sign=${sign}` },
    }))
    expect(res).toEqual({ chatId: '4242', isRoot: false })
  })
})

describe('helpers', () => {
  it('generateOnetimeToken yields 64 hex chars and unique values', () => {
    const t1 = generateOnetimeToken()
    const t2 = generateOnetimeToken()
    expect(t1).toMatch(/^[0-9a-f]{64}$/)
    expect(t1).not.toBe(t2)
  })

  it('getTelegramUserIdFromInitData parses id, tolerates garbage', () => {
    const good = buildSignedInitData({ user: JSON.stringify({ id: 12345 }), auth_date: '1' })
    expect(getTelegramUserIdFromInitData(good)).toBe('12345')
    expect(getTelegramUserIdFromInitData('user=%7Bbroken')).toBeNull()
    expect(getTelegramUserIdFromInitData('auth_date=1')).toBeNull()
  })

  it('isUserAdmin consults the DB flag for numeric ids and survives DB errors', async () => {
    prismaMock.telegramChat.findUnique.mockResolvedValueOnce({ isAdmin: true })
    expect(await isUserAdmin('5000')).toBe(true)

    prismaMock.telegramChat.findUnique.mockResolvedValueOnce({ isAdmin: false })
    expect(await isUserAdmin('5001')).toBe(false)

    prismaMock.telegramChat.findUnique.mockRejectedValueOnce(new Error('db'))
    expect(await isUserAdmin('5002')).toBe(false)

    // non-numeric id: DB is not consulted at all
    prismaMock.telegramChat.findUnique.mockClear()
    expect(await isUserAdmin('not-a-number')).toBe(false)
    expect(prismaMock.telegramChat.findUnique).not.toHaveBeenCalled()

    expect(await isUserAdmin(null)).toBe(false)
    expect(await isUserAdmin('')).toBe(false)
  })

  it('createServerSession persists a 64-hex token bound to the chatId', async () => {
    const token = await createServerSession('909090', 'CI Browser', 'web', '127.0.0.1', 'vitest')
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(prismaMock.userSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chatId: BigInt(909090),
        deviceName: 'CI Browser',
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    })
  })

  it('secretsMatch remains the constant-time primitive used across flows', () => {
    expect(secretsMatch(ADMIN_SECRET, ADMIN_SECRET)).toBe(true)
    expect(secretsMatch(ADMIN_SECRET, ADMIN_SECRET.slice(0, -1))).toBe(false)
  })
})
