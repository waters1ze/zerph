import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Audit C-2: POST /api/auth/google previously MERGED the account owning a
 * client-supplied email into the caller's account (transferring all content)
 * and DELETED the victim row. Contract now: clash → 409, zero destructive
 * writes; linking only proceeds when the email is free.
 */

const { prismaMock, authState } = vi.hoisted(() => ({
  prismaMock: {
    telegramChat: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    task: { updateMany: vi.fn() },
    note: { updateMany: vi.fn() },
    goal: { updateMany: vi.fn() },
    habit: { updateMany: vi.fn() },
  },
  authState: { user: null as null | { chatId: string; isRoot: boolean } },
}))

vi.mock('@/lib/backend/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/backend/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend/auth')>()
  return { ...actual, getAuthenticatedUser: vi.fn(async () => authState.user) }
})

import { POST } from '@/app/api/auth/google/route'

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/google', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { chatId: '111111', isRoot: false }
})

describe('POST /api/auth/google — email claim protection (C-2)', () => {
  it('REFUSES to merge when the email belongs to another account (409)', async () => {
    prismaMock.telegramChat.findFirst.mockResolvedValue({ chatId: BigInt(666666) })

    const res = await POST(postReq({ email: 'victim@example.com' }))
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.code).toBe('email_taken')

    // The destructive cascade must NEVER fire:
    expect(prismaMock.task.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.note.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.goal.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.habit.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.telegramChat.delete).not.toHaveBeenCalled()

    // And the victim's googleEmail must not be overwritten either:
    expect(prismaMock.telegramChat.update).not.toHaveBeenCalled()
  })

  it('links the email when it is free', async () => {
    prismaMock.telegramChat.findFirst.mockResolvedValue(null)

    const res = await POST(postReq({ email: 'free@example.com' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prismaMock.telegramChat.update).toHaveBeenCalledWith({
      where: { chatId: BigInt(111111) },
      data: { googleEmail: 'free@example.com' },
    })
    expect(prismaMock.telegramChat.delete).not.toHaveBeenCalled()
  })

  it.each([
    ['missing @', 'not-an-email'],
    ['double @', 'a@@b.com'],
    ['spaces', 'a b@c.com'],
    ['non-string', 12345],
  ])('rejects malformed email (%s) with 400', async (_name, raw) => {
    const res = await POST(postReq({ email: raw as any }))
    expect(res.status).toBe(400)
    expect(prismaMock.telegramChat.findFirst).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON body with 400 instead of crashing', async () => {
    const req = new NextRequest('http://localhost/api/auth/google', {
      method: 'POST',
      body: '{broken',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('requires authentication (401 + requiresOAuth hint)', async () => {
    authState.user = null
    const res = await POST(postReq({ email: 'x@example.com' }))
    const json = await res.json()
    expect(res.status).toBe(401)
    expect(json.requiresOAuth).toBe(true)
  })
})
