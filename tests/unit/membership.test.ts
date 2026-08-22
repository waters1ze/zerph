import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit contract for the relational membership layer (audit B7):
 *  - table-first reads with legacy-array fallback (pre-migration safety)
 *  - dual writes: authoritative row + best-effort legacy mirror
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    projectMember: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    teamMember: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    projectDB: {
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
    },
    team: {
      findUnique: vi.fn(),
      update: vi.fn(async () => ({})),
    },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  },
}))

vi.mock('@/lib/backend/prisma', () => ({ prisma: prismaMock }))

import {
  listProjectMemberIds,
  isProjectMember,
  syncProjectMembers,
  listTeamMembers,
  getTeamRole,
  addTeamMember,
  setTeamRole,
  removeTeamMember,
} from '@/lib/backend/membership'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('project membership', () => {
  it('listProjectMemberIds prefers the relational table', async () => {
    prismaMock.projectMember.findMany.mockResolvedValue([{ chatId: BigInt(11) }, { chatId: BigInt(22) }])
    const ids = await listProjectMemberIds('p1')
    expect(ids).toEqual([BigInt(11), BigInt(22)])
    expect(prismaMock.projectDB.findUnique).not.toHaveBeenCalled() // no fallback
  })

  it('listProjectMemberIds FALLS BACK to the legacy array when table is empty', async () => {
    prismaMock.projectMember.findMany.mockResolvedValue([])
    prismaMock.projectDB.findUnique.mockResolvedValue({ memberIds: [BigInt(33)] })

    expect(await listProjectMemberIds('p2')).toEqual([BigInt(33)])
  })

  it('isProjectMember: owner short-circuits without queries', async () => {
    expect(await isProjectMember(BigInt(1), 'p', BigInt(1))).toBe(true)
    expect(prismaMock.projectMember.findFirst).not.toHaveBeenCalled()
  })

  it('isProjectMember: row hit -> true; miss + array hit -> true; neither -> false', async () => {
    prismaMock.projectMember.findFirst.mockResolvedValueOnce({ id: 'r1' })
    expect(await isProjectMember(BigInt(9), 'p')).toBe(true)

    prismaMock.projectMember.findFirst.mockResolvedValueOnce(null)
    prismaMock.projectDB.findUnique.mockResolvedValueOnce({ memberIds: [BigInt(9)] })
    expect(await isProjectMember(BigInt(9), 'p')).toBe(true)

    prismaMock.projectMember.findFirst.mockResolvedValueOnce(null)
    prismaMock.projectDB.findUnique.mockResolvedValueOnce({ memberIds: [] })
    expect(await isProjectMember(BigInt(42), 'p')).toBe(false)
  })

  it('syncProjectMembers adds missing rows and removes non-owner extras transactionally', async () => {
    prismaMock.projectMember.findMany.mockResolvedValue([
      { id: 'row-a', chatId: BigInt(1), role: 'owner' },
      { id: 'row-b', chatId: BigInt(2), role: 'member' }, // no longer desired
    ])

    await syncProjectMembers('p1', [BigInt(1), BigInt(3)])

    // one tx containing: create(3) + delete(row-b); owner row untouched
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    const ops = prismaMock.$transaction.mock.calls[0][0]
    expect(ops).toHaveLength(2)

    // legacy mirror updated to the desired set
    expect(prismaMock.projectDB.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { memberIds: [BigInt(1), BigInt(3)] },
    })
  })
})

describe('team membership', () => {
  const team = {
    id: 't1',
    ownerChatId: BigInt(1),
    memberIds: [BigInt(1), BigInt(2), BigInt(3)],
    adminIds: [BigInt(2)],
  }

  it('listTeamMembers synthesizes the owner and preserves roles from table', async () => {
    prismaMock.teamMember.findMany.mockResolvedValue([
      { chatId: BigInt(3), role: 'member' },
      { chatId: BigInt(2), role: 'admin' },
    ])

    const members = await listTeamMembers(team as any)
    expect(members[0]).toEqual({ chatId: BigInt(1), role: 'owner' })
    // owner always first; the rest keep table insertion order
    expect(members.slice(1)).toEqual([
      { chatId: BigInt(3), role: 'member' },
      { chatId: BigInt(2), role: 'admin' },
    ])
  })

  it('listTeamMembers falls back to arrays pre-migration', async () => {
    prismaMock.teamMember.findMany.mockResolvedValue([])
    const members = await listTeamMembers(team as any)
    expect(members).toEqual([
      { chatId: BigInt(1), role: 'owner' },
      { chatId: BigInt(2), role: 'admin' },
      { chatId: BigInt(3), role: 'member' },
    ])
  })

  it('getTeamRole resolves owner / admin / member / null', async () => {
    expect(await getTeamRole(team as any, BigInt(1))).toBe('owner')

    prismaMock.teamMember.findUnique.mockResolvedValueOnce({ role: 'admin' })
    expect(await getTeamRole(team as any, BigInt(5))).toBe('admin')

    prismaMock.teamMember.findUnique.mockResolvedValueOnce(null)
    prismaMock.team.findUnique.mockResolvedValueOnce({ memberIds: team.memberIds, adminIds: [BigInt(2)] })
    expect(await getTeamRole(team as any, BigInt(3))).toBe('member') // array fallback

    prismaMock.teamMember.findUnique.mockResolvedValueOnce(null)
    prismaMock.team.findUnique.mockResolvedValueOnce({ memberIds: [], adminIds: [] })
    expect(await getTeamRole(team as any, BigInt(99))).toBeNull()
  })

  it('addTeamMember upserts the row and mirrors into the legacy array once', async () => {
    prismaMock.team.findUnique.mockResolvedValue({ memberIds: [BigInt(1)], adminIds: [BigInt(1)] })

    await addTeamMember(team as any, BigInt(7))

    expect(prismaMock.teamMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId_chatId: { teamId: 't1', chatId: BigInt(7) } },
        create: { teamId: 't1', chatId: BigInt(7), role: 'member' },
      })
    )
    expect(prismaMock.team.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { memberIds: { push: BigInt(7) } },
    })
  })

  it('setTeamRole promotes/demotes in both stores', async () => {
    prismaMock.team.findUnique.mockResolvedValue({ memberIds: team.memberIds, adminIds: [BigInt(2)] })

    await setTeamRole(team as any, BigInt(3), 'admin')
    expect(prismaMock.team.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { memberIds: team.memberIds, adminIds: [BigInt(2), BigInt(3)] },
    })

    await setTeamRole(team as any, BigInt(2), 'member')
    expect(prismaMock.team.update).toHaveBeenLastCalledWith({
      where: { id: 't1' },
      data: { memberIds: team.memberIds, adminIds: [] },
    })
  })

  it('removeTeamMember deletes the row and filters both arrays', async () => {
    await removeTeamMember(team as any, BigInt(2))

    expect(prismaMock.teamMember.deleteMany).toHaveBeenCalledWith({
      where: { teamId: 't1', chatId: BigInt(2) },
    })
    expect(prismaMock.team.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { memberIds: [BigInt(1), BigInt(3)], adminIds: [] },
    })
  })
})
