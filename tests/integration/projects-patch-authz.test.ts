import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Integration tests for /api/projects PATCH authorization (audit finding H-2).
 * Old implementation updated ANY project by id without an ownership check,
 * letting any authenticated user rename arbitrary projects and inject
 * themselves into memberIds (IDOR / Broken Access Control).
 */

const OWNER = BigInt(111111)
const MEMBER = BigInt(222222)
const ATTACKER = BigInt(999999)

const { authState, projectDB, projectMember } = vi.hoisted(() => {
  const projectRow = () => ({
    id: 'proj-1',
    title: 'Original title',
    description: null,
    color: '#6366f1',
    status: 'active',
    ownerChatId: BigInt(111111),
    memberIds: [BigInt(111111), BigInt(222222)],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  })
  return {
    authState: { user: null as null | { chatId: string; isRoot: boolean } },
    projectDB: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => projectRow()),
      create: vi.fn(),
      update: vi.fn(async ({ data }: any) => ({ ...projectRow(), ...data })),
      delete: vi.fn(),
    },
    projectMember: {
      // default: caller has NO membership row (owner path short-circuits first)
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  }
})

vi.mock('@/lib/backend/prisma', () => ({
  prisma: Object.assign(
    {
      task: { findMany: vi.fn(async () => []), deleteMany: vi.fn() },
      telegramChat: { findFirst: vi.fn(), findUnique: vi.fn() },
      // Relational membership layer (audit B7):
      projectMember,
      $transaction: vi.fn(async (ops: any) => Promise.all(ops)),
    },
    { projectDB }
  ),
}))

vi.mock('@/lib/backend/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend/auth')>()
  return {
    ...actual,
    getAuthenticatedUser: vi.fn(async () => authState.user),
  }
})

import { PATCH } from '@/app/api/projects/route'

function patchReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/projects', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/projects — ownership enforcement', () => {
  it('NON-OWNER cannot modify a foreign project (no update executed)', async () => {
    authState.user = { chatId: String(ATTACKER), isRoot: false }

    const res = await PATCH(patchReq({ id: 'proj-1', title: 'Hacked title' }))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBeTruthy()
    expect(projectDB.update).not.toHaveBeenCalled()
  })

  it('NON-OWNER cannot self-invite into memberIds of a foreign project', async () => {
    authState.user = { chatId: String(ATTACKER), isRoot: false }

    const res = await PATCH(patchReq({ id: 'proj-1', memberUsernames: ['attacker'] }))

    expect(res.status).toBe(403)
    expect(projectDB.update).not.toHaveBeenCalled()
  })

  it('owner retains full edit rights', async () => {
    authState.user = { chatId: String(OWNER), isRoot: false }

    const res = await PATCH(patchReq({ id: 'proj-1', title: 'Renamed by owner' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.project.title).toBe('Renamed by owner')
    expect(projectDB.update).toHaveBeenCalledTimes(1)
  })

  it('member may edit fields of a shared project', async () => {
    authState.user = { chatId: String(MEMBER), isRoot: false }
    // MEMBER has a ProjectMember row (relational membership, B7)
    projectMember.findFirst.mockResolvedValueOnce({ id: 'pm-1' } as any)

    const res = await PATCH(patchReq({ id: 'proj-1', description: 'member edit' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.project.description).toBe('member edit')
  })

  it('unauthenticated request is rejected before any DB access', async () => {
    authState.user = null

    const res = await PATCH(patchReq({ id: 'proj-1', title: 'anon' }))

    expect(res.status).toBe(401)
    expect(projectDB.update).not.toHaveBeenCalled()
  })

  it('missing id is rejected without DB roundtrip', async () => {
    authState.user = { chatId: String(OWNER), isRoot: false }

    const res = await PATCH(patchReq({ title: 'no id' }))

    expect(res.status).toBe(400)
    expect(projectDB.findUnique).not.toHaveBeenCalled()
  })
})
