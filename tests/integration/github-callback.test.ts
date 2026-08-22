import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { NextRequest } from 'next/server'

/**
 * Audit C-1: the GitHub OAuth callback previously accepted an arbitrary
 * base64 state {chatId:"<victim>"} and minted a session cookie for the
 * VICTIM's account — full account takeover. Contract now:
 *  - state must be HMAC-signed by /api/auth/github and fresh (15 min)
 *  - LINK mode additionally requires a verified session matching the state
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

function signState(payloadObj: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url')
  const sig = crypto.createHmac('sha256', `gh-oauth-state:${BOT_TOKEN}`).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

const unsignedLegacyState = Buffer.from(JSON.stringify({ chatId: '999', origin: 'https://x' })).toString('base64')

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    config: {
      findFirst: vi.fn(async () => null),
      upsert: vi.fn(async () => ({})),
      create: vi.fn(),
      delete: vi.fn(),
    },
    telegramChat: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => ({ chatId: BigInt(1) })), // id-clash loop breaker
      upsert: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
      update: vi.fn(),
    },
  },
  authMock: {
    sessionUser: null as null | { chatId: string; isRoot: boolean },
    createdSessionFor: null as string | null,
  },
}))

vi.mock('@/lib/backend/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/backend/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend/auth')>()
  return {
    ...actual,
    getAuthenticatedUser: vi.fn(async () => authMock.sessionUser),
    createServerSession: vi.fn(async (cid: bigint) => {
      authMock.createdSessionFor = String(cid)
      return 's'.repeat(64)
    }),
  }
})

import { GET } from '@/app/api/auth/github/callback/route'

function stubGithubApis() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL) => {
      const u = String(url)
      if (u.includes('/login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'gho_test_token' }), { status: 200 })
      }
      if (u.includes('api.github.com/user')) {
        return new Response(JSON.stringify({ login: 'attacker', name: 'Attacker' }), { status: 200 })
      }
      throw new Error(`unexpected fetch ${u}`)
    })
  )
}

function callbackReq(state: string | null): NextRequest {
  const q = new URLSearchParams({ code: 'oauth-code' })
  if (state) q.set('state', state)
  return new NextRequest(`http://localhost/api/auth/github/callback?${q.toString()}`)
}

function cookiesOf(res: Response): string[] {
  const anyHeaders = res.headers as any
  if (typeof anyHeaders.getSetCookie === 'function') return anyHeaders.getSetCookie()
  const single = res.headers.get('set-cookie')
  return single ? [single] : []
}

beforeEach(() => {
  stubGithubApis()
})

afterEach(() => {
  vi.unstubAllGlobals()
  authMock.sessionUser = null
  authMock.createdSessionFor = null
})

describe('GitHub OAuth callback — signed state enforcement (C-1)', () => {
  it('LEGACY UNSIGNED state claiming a victim chatId must NOT mint a victim session', async () => {
    // This is the exact attack payload from the audit:
    const res = await GET(callbackReq(unsignedLegacyState))

    expect(res.status).toBe(307)
    // login path must have actually RUN (fresh attacker account created):
    expect(prismaMock.telegramChat.create).toHaveBeenCalledTimes(1)
    const chatCookie = cookiesOf(res).find((c) => c.startsWith('zerf_chat_id='))
    if (chatCookie) {
      const claimed = chatCookie.split(';')[0].split('=')[1]
      expect(claimed).not.toBe('999') // never the attacker-chosen chatId
    }
    expect(authMock.createdSessionFor).not.toBe('999')
    expect(authMock.createdSessionFor).not.toBeNull() // attacker got THEIR OWN session
    expect(prismaMock.telegramChat.update).not.toHaveBeenCalledWith({
      where: { chatId: BigInt(999) },
      data: expect.objectContaining({ username: 'attacker' }),
    })
  })

  it('SIGNED link-state REPLAYED without a verified session falls back to login mode', async () => {
    const victimSigned = signState({ mode: 'link', chatId: '999', origin: 'https://x', iat: Date.now() })

    await GET(callbackReq(victimSigned))

    // login-mode ran (new account created), but never for the victim id:
    expect(prismaMock.telegramChat.create).toHaveBeenCalledTimes(1)
    expect(authMock.createdSessionFor).not.toBe('999')
  })

  it('EXPIRED signed state (>15 min) is rejected like garbage', async () => {
    const expired = signState({ mode: 'link', chatId: '999', origin: 'https://x', iat: Date.now() - 16 * 60_000 })
    authMock.sessionUser = { chatId: '999', isRoot: false }

    await GET(callbackReq(expired))

    // identity not established -> no session for 999
    expect(authMock.createdSessionFor).not.toBe('999')
  })

  it('TAMPERED signature is rejected even with a matching verified session', async () => {
    const legit = signState({ mode: 'link', chatId: '999', origin: 'https://x', iat: Date.now() })
    const tampered = `${legit.slice(0, -4)}AAAA`
    authMock.sessionUser = { chatId: '999', isRoot: false }

    await GET(callbackReq(tampered))

    expect(authMock.createdSessionFor).not.toBe('999')
  })

  it('VALID signed state + MATCHING verified session links the account', async () => {
    const good = signState({ mode: 'link', chatId: '999', origin: 'https://x', iat: Date.now() })
    authMock.sessionUser = { chatId: '999', isRoot: false }

    const res = await GET(callbackReq(good))
    const json: any = res

    expect(authMock.createdSessionFor).toBe('999')
    const chatCookie = cookiesOf(res).find((c) => c.startsWith('zerf_chat_id='))
    expect(chatCookie).toBeTruthy()
    expect(chatCookie!.split(';')[0]).toBe('zerf_chat_id=999')
    // github link persisted for the verified account
    expect(prismaMock.config.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'user_github_999' },
        update: { value: 'attacker' },
      })
    )
  })

  it('missing code redirects with error and touches nothing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/auth/github/callback?state=x'))
    expect(res.status).toBe(307)
    expect(String(res.headers.get('location'))).toContain('github_auth_error=no_code')
    expect(authMock.createdSessionFor).toBeNull()
  })
})
