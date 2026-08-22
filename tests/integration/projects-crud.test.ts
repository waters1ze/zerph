import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * CRUD coverage for /api/projects (GET / POST / DELETE) — complements the
 * PATCH authorization suite. Documents current response contracts, including
 * the misleading "200 + empty" degraded-mode behaviors flagged as L-11.
 */

const OWNER = BigInt(111111)
const MEMBER = BigInt(666666)

const { authState, projectDB, taskMock, chatMock } = vi.hoisted(() => ({
  authState: { user: null as null | { chatId: string; isRoot: boolean } },
  projectDB: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  taskMock: { findMany: vi.fn(), deleteMany: vi.fn() },
  chatMock: { findFirst: vi.fn(), findUnique: vi.fn() },
}))

vi.mock('@/lib/backend/prisma', () => ({
  prisma: Object.assign(
    {
      task: taskMock,
      telegramChat: chatMock,
      // Relational membership layer (audit B7):
      projectMember: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
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

import { GET, POST, DELETE } from '@/app/api/projects/route'
import { prisma } from '@/lib/backend/prisma'

const projectRow = () => ({
  id: 'proj-1',
  title: 'Roadmap',
  description: null,
  color: '#6366f1',
  status: 'active',
  ownerChatId: OWNER,
  memberIds: [OWNER],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
})

const getReq = (url = 'http://localhost/api/projects') =>
  new NextRequest(url, { method: 'GET' })

function postReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/projects', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const delReq = (id?: string) =>
  new NextRequest(`http://localhost/api/projects${id ? `?id=${id}` : ''}`, { method: 'DELETE' })

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { chatId: String(OWNER), isRoot: false }
})

describe('GET /api/projects', () => {
  it('returns projects with stringified ids, member info and tasks', async () => {
    projectDB.findMany.mockResolvedValue([projectRow()])
    taskMock.findMany.mockResolvedValue([
      { id: 't-1', title: 'Ship audit', ownerChatId: OWNER, authorChatId: null, projectId: 'proj-1' },
    ])
    chatMock.findUnique.mockResolvedValue({ chatId: OWNER, firstName: 'Alice', username: 'alice' })
    // relational membership (B7): one member row for the owner
    ;(prisma as any).projectMember.findMany.mockResolvedValue([{ chatId: OWNER }])

    const res = await GET(getReq())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.projects).toHaveLength(1)
    expect(json.projects[0].ownerChatId).toBe(String(OWNER))
    expect(json.projects[0].tasks[0].title).toBe('Ship audit')
    expect(json.projects[0].tasks[0].ownerChatId).toBe(String(OWNER))
    expect(json.projects[0].members[0]).toEqual({
      chatId: String(OWNER),
      name: 'Alice',
    })
    expect(projectDB.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'archived' } }),
      })
    )
  })

  it('degrades to empty list on DB failure (characterization: L-11 misleading success)', async () => {
    projectDB.findMany.mockRejectedValue(new Error('pool exhausted'))

    const res = await GET(getReq())
    const json = await res.json()

    // Documented CURRENT behavior — a client cannot distinguish "no projects"
    // from "database down". Flagged in the audit; kept green intentionally.
    expect(res.status).toBe(200)
    expect(json.projects).toEqual([])
    expect(json.error).toContain('pool exhausted')
  })
})

describe('POST /api/projects', () => {
  it('rejects unauthenticated creation', async () => {
    authState.user = null
    const res = await POST(postReq({ title: 'X' }))
    expect(res.status).toBe(401)
    expect(projectDB.create).not.toHaveBeenCalled()
  })

  it('rejects missing title without creating anything', async () => {
    const res = await POST(postReq({ title: '   ' }))
    expect(res.status).toBe(400)
    expect(projectDB.create).not.toHaveBeenCalled()
  })

  it('creates the project owned by the caller and resolves @usernames to members', async () => {
    projectDB.create.mockImplementation(async ({ data }: any) => ({ id: 'new-1', ...data }))
    chatMock.findFirst
      .mockResolvedValueOnce({ chatId: MEMBER })          // @bob found
      .mockResolvedValueOnce(null)                        // @ghost not found -> skipped

    const res = await POST(postReq({ title: 'Team plan', memberUsernames: ['@Bob', '@ghost'] }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(projectDB.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Team plan',
        ownerChatId: OWNER,
        memberIds: [OWNER, MEMBER], // caller deduped, ghost skipped
        color: '#6366f1',
        status: 'active',
      }),
    })
    expect(json.project.ownerChatId).toBe(String(OWNER))
  })
})

describe('DELETE /api/projects', () => {
  it('owner deletion removes associated tasks and the project itself', async () => {
    projectDB.findUnique.mockResolvedValue(projectRow())
    projectDB.delete.mockResolvedValue(projectRow())
    taskMock.deleteMany.mockResolvedValue({ count: 3 })

    const res = await DELETE(delReq('proj-1'))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(taskMock.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'proj-1' } })
    expect(projectDB.delete).toHaveBeenCalledWith({ where: { id: 'proj-1' } })
  })

  it('a member leaves: membership removed, project and tasks preserved', async () => {
    authState.user = { chatId: String(MEMBER), isRoot: false }
    projectDB.findUnique.mockResolvedValue({ ...projectRow(), memberIds: [OWNER, MEMBER] })
    projectDB.update.mockResolvedValue({ ...projectRow(), memberIds: [OWNER] })

    const res = await DELETE(delReq('proj-1'))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(taskMock.deleteMany).not.toHaveBeenCalled()
    expect(projectDB.delete).not.toHaveBeenCalled()
    expect(projectDB.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: { memberIds: [OWNER] },
    })
  })

  it('an outsider triggers neither delete nor membership write (403)', async () => {
    authState.user = { chatId: '999999', isRoot: false }
    projectDB.findUnique.mockResolvedValue(projectRow())

    const res = await DELETE(delReq('proj-1'))

    expect(res.status).toBe(403)
    expect(projectDB.delete).not.toHaveBeenCalled()
    expect(projectDB.update).not.toHaveBeenCalled()
    expect(taskMock.deleteMany).not.toHaveBeenCalled()
  })

  it('unknown id responds ok:true without destructive calls', async () => {
    projectDB.findUnique.mockResolvedValue(null)

    const res = await DELETE(delReq('missing'))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(projectDB.delete).not.toHaveBeenCalled()
  })

  it('missing id parameter is rejected with 400', async () => {
    const res = await DELETE(delReq(undefined))
    expect(res.status).toBe(400)
  })
})
