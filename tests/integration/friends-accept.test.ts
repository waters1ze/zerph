import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Audit H-3 + M-2: friendship accept previously created mutual accepted
 * rows from thin air (self-"accept" with any chatId), and PATCH allowed
 * rewriting ANY user's birthday. Both require ownership/pending proof now.
 */

const { prismaMock, authState, dbMock } = vi.hoisted(() => ({
  prismaMock: {
    friendship: {
      findUnique: vi.fn(),
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(),
    },
    telegramChat: {
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
      findFirst: vi.fn(),
    },
  },
  authState: { user: null as null | { chatId: string; isRoot: boolean } },
  dbMock: {
    getFriends: vi.fn(async () => []),
    syncFriendBirthdays: vi.fn(async () => {}),
    parseBirthday: vi.fn((v: string) => ({ iso: v })),
    broadcastMyBirthdayToFriends: vi.fn(async () => {}),
  },
}))

vi.mock('@/lib/backend/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/backend/db', () => dbMock)

vi.mock('@/lib/backend/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend/auth')>()
  return { ...actual, getAuthenticatedUser: vi.fn(async () => authState.user) }
})

import { PUT, PATCH } from '@/app/api/friends/route'

function putReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/friends', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function patchReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/friends', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { chatId: '111111', isRoot: false }
  // The route fires a Telegram notification on accept — never hit the network.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PUT /api/friends — accept requires a real pending request (H-3)', () => {
  it('FORGED accept without any incoming request is refused (404)', async () => {
    prismaMock.friendship.findUnique.mockResolvedValue(null)

    const res = await PUT(putReq({ fromChatId: '999999', action: 'accept' }))

    expect(res.status).toBe(404)
    // No friendship rows may be created:
    expect(prismaMock.friendship.upsert).not.toHaveBeenCalled()
  })

  it('accepts a genuinely pending request in both directions', async () => {
    prismaMock.friendship.findUnique.mockResolvedValue({ status: 'pending' })

    const res = await PUT(putReq({ fromChatId: '222222', action: 'accept' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prismaMock.friendship.upsert).toHaveBeenCalledTimes(2)
    expect(prismaMock.friendship.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userChatId_friendChatId: { userChatId: BigInt(222222), friendChatId: BigInt(111111) } },
      })
    )
    expect(prismaMock.friendship.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userChatId_friendChatId: { userChatId: BigInt(111111), friendChatId: BigInt(222222) } },
      })
    )
  })

  it('double-accept is idempotent success without new writes', async () => {
    prismaMock.friendship.findUnique.mockResolvedValue({ status: 'accepted' })

    const res = await PUT(putReq({ fromChatId: '222222', action: 'accept' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prismaMock.friendship.upsert).not.toHaveBeenCalled()
  })

  it('requires authentication', async () => {
    authState.user = null
    const res = await PUT(putReq({ fromChatId: '1', action: 'accept' }))
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/friends — birthday write scoping (M-2)', () => {
  it('FORBIDS changing another user\'s birthday (403)', async () => {
    const res = await PATCH(patchReq({ friendId: '999999', birthday: '2000-01-01' }))

    expect(res.status).toBe(403)
    expect(prismaMock.telegramChat.update).not.toHaveBeenCalled()
    expect(dbMock.broadcastMyBirthdayToFriends).not.toHaveBeenCalled()
  })

  it('allows setting own birthday and triggers broadcast', async () => {
    const res = await PATCH(patchReq({ friendId: '111111', birthday: '2000-01-01' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(prismaMock.telegramChat.update).toHaveBeenCalledWith({
      where: { chatId: BigInt(111111) },
      data: { birthday: '2000-01-01' },
    })
    expect(dbMock.broadcastMyBirthdayToFriends).toHaveBeenCalledWith(BigInt(111111))
  })
})
