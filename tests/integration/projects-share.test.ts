import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { NextRequest } from 'next/server'

/**
 * Audit H-1: /api/projects/share previously disclosed full project data
 * (all tasks + member identities) to ANYONE knowing an id. Contract now:
 *  - public access requires a signed capability token (?t=)
 *  - public responses are sanitized (no chatIds)
 *  - owner/members read everything + receive a fresh shareToken
 */

const PEPPER = process.env.AUTH_PEPPER!

function expectedToken(projectId: string): string {
  return crypto
    .createHmac('sha256', PEPPER)
    .update(`project-share:${projectId}`)
    .digest('hex')
    .slice(0, 32)
}

const { authState, projectDB } = vi.hoisted(() => {
  const projectRow = () => ({
    id: 'proj-9',
    title: 'Secret roadmap',
    description: 'classified',
    color: '#ff0000',
    status: 'active',
    ownerChatId: BigInt(111111),
    memberIds: [BigInt(111111)],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  })
  return {
    authState: { user: null as null | { chatId: string; isRoot: boolean } },
    projectDB: {
      findUnique: vi.fn(async () => projectRow()),
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
})

vi.mock('@/lib/backend/prisma', () => ({
  prisma: Object.assign(
    {
      task: {
        findMany: vi.fn(async () => [
          { id: 't-1', title: 'Task', description: 'd', status: 'todo', priority: 'high', dueDate: '2026-09-01', dueTime: '10:00', createdAt: new Date(), updatedAt: new Date(), ownerChatId: BigInt(111111), authorChatId: BigInt(111111) },
        ]),
      },
      telegramChat: { findUnique: vi.fn(async () => ({ chatId: BigInt(111111), firstName: 'Alice', username: 'alice' })) },
      projectMember: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
    },
    { projectDB }
  ),
}))

vi.mock('@/lib/backend/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backend/auth')>()
  return {
    ...actual,
    getAuthenticatedUser: vi.fn(async () => authState.user),
    // getInternalPepper stays REAL (uses seeded AUTH_PEPPER from setup.ts)
  }
})

import { GET } from '@/app/api/projects/share/route'

const getReq = (query = '') =>
  new NextRequest(`http://localhost/api/projects/share${query}`, { method: 'GET' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/projects/share — capability-token access (H-1)', () => {
  it('anonymous request WITHOUT token is refused (403)', async () => {
    const res = await GET(getReq('?id=proj-9'))
    expect(res.status).toBe(403)
  })

  it('anonymous request with a WRONG token is refused (403)', async () => {
    const res = await GET(getReq('?id=proj-9&t=' + '0'.repeat(32)))
    expect(res.status).toBe(403)
  })

  it('valid token grants sanitized public data: no chatIds anywhere', async () => {
    authState.user = null

    const res = await GET(getReq(`?id=proj-9&t=${expectedToken('proj-9')}`))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.project.title).toBe('Secret roadmap')
    expect(json.project.tasks).toHaveLength(1)

    const raw = JSON.stringify(json)
    expect(raw).not.toContain('"ownerChatId"')
    expect(raw).not.toContain('"memberIds"')
    expect(raw).not.toContain('"chatId"')
    expect(raw).not.toContain('@alice')
    expect(raw).not.toContain('111111')

    // display names still available for the shared board
    expect(json.project.members[0].name).toBe('Alice')
    expect(json.shareToken).toBeUndefined()
  })

  it('owner/members get full data plus a fresh shareToken', async () => {
    authState.user = { chatId: '111111', isRoot: false }

    const res = await GET(getReq('?id=proj-9'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.project.ownerChatId).toBe('111111')
    expect(json.project.tasks[0].ownerChatId).toBe('111111')
    expect(json.shareToken).toBe(expectedToken('proj-9'))
  })

  it('archived projects are hidden even from token holders', async () => {
    projectDB.findUnique.mockResolvedValueOnce({
      id: 'proj-9', title: 'x', status: 'archived', ownerChatId: BigInt(111111), memberIds: [],
    } as any)

    const res = await GET(getReq(`?id=proj-9&t=${expectedToken('proj-9')}`))
    expect(res.status).toBe(404)
  })

  it('missing id is rejected with 400', async () => {
    const res = await GET(getReq(''))
    expect(res.status).toBe(400)
  })
})
