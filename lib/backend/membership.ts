import { prisma } from './prisma'

/**
 * Membership layer (audit B7): authoritative relational tables
 * ProjectMember / TeamMember replace the legacy BigInt[] arrays.
 *
 * Contract (expand-contract):
 *  - WRITES are dual: relational row first (authoritative, must succeed),
 *    legacy array updated best-effort for rollback safety.
 *  - READS prefer the table; if a project/team has ZERO rows we assume the
 *    backfill migration has not run yet and fall back to the legacy array.
 */

export type MemberRole = 'owner' | 'admin' | 'member'

// ─── Projects ───────────────────────────────────────────────────────────────

async function projectLegacyMemberIds(projectId: string): Promise<bigint[]> {
  try {
    const p = await (prisma as any).projectDB.findUnique({
      where: { id: projectId },
      select: { memberIds: true },
    })
    return (p?.memberIds || []) as bigint[]
  } catch {
    return []
  }
}

/** All member chatIds of a project (owner included). */
export async function listProjectMemberIds(projectId: string): Promise<bigint[]> {
  const rows = await prisma.projectMember.findMany({
    where: { projectId },
    select: { chatId: true },
  })
  if (rows.length > 0) return rows.map(r => r.chatId)
  // Pre-migration fallback:
  return projectLegacyMemberIds(projectId)
}

/** Owner-or-member check used by every authorization gate. */
export async function isProjectMember(
  chatId: bigint,
  projectId: string,
  ownerChatId?: bigint
): Promise<boolean> {
  if (ownerChatId !== undefined && ownerChatId === chatId) return true
  const row = await prisma.projectMember.findFirst({
    where: { projectId, chatId },
    select: { id: true },
  })
  if (row) return true
  const legacy = await projectLegacyMemberIds(projectId)
  return legacy.includes(chatId)
}

/**
 * Reconciles the membership table with the desired final id set.
 * Keeps roles: existing owner stays owner; new ids become 'member'.
 * Also mirrors the final set into the legacy array (best-effort).
 */
export async function syncProjectMembers(projectId: string, desired: bigint[]): Promise<void> {
  const currentRows = await prisma.projectMember.findMany({
    where: { projectId },
    select: { id: true, chatId: true, role: true },
  })
  const currentById = new Map(currentRows.map(r => [r.chatId, r]))
  const desiredSet = new Set(desired)

  const toAdd = [...desiredSet].filter(id => !currentById.has(id))
  const toRemove = currentRows.filter(r => r.role !== 'owner' && !desiredSet.has(r.chatId))

  await prisma.$transaction([
    ...toAdd.map(id =>
      prisma.projectMember.create({
        data: { projectId, chatId: id, role: 'member' },
      })
    ),
    ...toRemove.map(r => prisma.projectMember.delete({ where: { id: r.id } })),
  ])

  // Legacy mirror (rollback safety) — best-effort.
  try {
    await (prisma as any).projectDB.update({
      where: { id: projectId },
      data: { memberIds: desired },
    })
  } catch (err) {
    console.warn(`[membership] legacy memberIds mirror failed for project ${projectId}:`, err)
  }
}

export async function deleteProjectMembers(projectId: string): Promise<void> {
  await prisma.projectMember.deleteMany({ where: { projectId } })
}

export async function removeProjectEverywhere(chatId: bigint): Promise<void> {
  await prisma.projectMember.deleteMany({ where: { chatId } })
}

// ─── Teams ──────────────────────────────────────────────────────────────────

interface TeamCore {
  id: string
  ownerChatId: bigint
  memberIds: bigint[]
  adminIds: bigint[]
}

async function teamLegacy(teamId: string): Promise<{ members: bigint[]; admins: bigint[] }> {
  try {
    const t = await prisma.team.findUnique({
      where: { id: teamId },
      select: { memberIds: true, adminIds: true },
    })
    return { members: (t?.memberIds || []) as bigint[], admins: (t?.adminIds || []) as bigint[] }
  } catch {
    return { members: [], admins: [] }
  }
}

export interface TeamMembershipEntry {
  chatId: bigint
  role: MemberRole
}

/** Full membership incl. synthesized owner. Table-first, array-fallback. */
export async function listTeamMembers(team: TeamCore): Promise<TeamMembershipEntry[]> {
  const rows = await prisma.teamMember.findMany({
    where: { teamId: team.id },
    select: { chatId: true, role: true },
  })

  let entries: TeamMembershipEntry[]
  if (rows.length > 0) {
    entries = rows.map(r => ({ chatId: r.chatId, role: (r.role as MemberRole) || 'member' }))
  } else {
    // Pre-migration fallback from arrays (original memberIds order):
    entries = team.memberIds.map(id => ({
      chatId: id,
      role: (team.adminIds.includes(id) ? 'admin' : 'member') as MemberRole,
    }))
  }

  // Owner is always present and always owner.
  const withoutOwner = entries.filter(e => e.chatId !== team.ownerChatId)
  return [{ chatId: team.ownerChatId, role: 'owner' }, ...withoutOwner]
}

export async function isTeamMember(team: TeamCore, chatId: bigint): Promise<boolean> {
  if (team.ownerChatId === chatId) return true
  const row = await prisma.teamMember.findFirst({
    where: { teamId: team.id, chatId },
    select: { id: true },
  })
  if (row) return true
  const legacy = await teamLegacy(team.id)
  return legacy.members.includes(chatId)
}

export async function getTeamRole(team: TeamCore, chatId: bigint): Promise<MemberRole | null> {
  if (team.ownerChatId === chatId) return 'owner'
  const row = await prisma.teamMember.findUnique({
    where: { teamId_chatId: { teamId: team.id, chatId } },
    select: { role: true },
  })
  if (row) return ((row.role as MemberRole) === 'owner' ? 'admin' : (row.role as MemberRole))
  const legacy = await teamLegacy(team.id)
  if (!legacy.members.includes(chatId)) return null
  return legacy.admins.includes(chatId) ? 'admin' : 'member'
}

export async function addTeamMember(team: TeamCore, chatId: bigint, role: MemberRole = 'member'): Promise<void> {
  await prisma.teamMember.upsert({
    where: { teamId_chatId: { teamId: team.id, chatId } },
    update: {},
    create: { teamId: team.id, chatId, role },
  })
  // Legacy mirror:
  try {
    const legacy = await teamLegacy(team.id)
    if (!legacy.members.includes(chatId)) {
      await prisma.team.update({
        where: { id: team.id },
        data: { memberIds: { push: chatId } },
      })
    }
  } catch (err) {
    console.warn(`[membership] legacy push failed for team ${team.id}:`, err)
  }
}

export async function setTeamRole(team: TeamCore, chatId: bigint, role: Exclude<MemberRole, 'owner'>): Promise<void> {
  await prisma.teamMember.upsert({
    where: { teamId_chatId: { teamId: team.id, chatId } },
    update: { role },
    create: { teamId: team.id, chatId, role },
  })
  try {
    const legacy = await teamLegacy(team.id)
    const nextMembers = legacy.members.includes(chatId) ? legacy.members : [...legacy.members, chatId]
    const nextAdmins = role === 'admin'
      ? (nextMembers.includes(chatId) ? Array.from(new Set([...legacy.admins, chatId])) : legacy.admins)
      : legacy.admins.filter(a => a !== chatId)
    await prisma.team.update({
      where: { id: team.id },
      data: { memberIds: nextMembers, adminIds: nextAdmins },
    })
  } catch (err) {
    console.warn(`[membership] legacy role mirror failed for team ${team.id}:`, err)
  }
}

export async function removeTeamMember(team: TeamCore, chatId: bigint): Promise<void> {
  await prisma.teamMember.deleteMany({ where: { teamId: team.id, chatId } })
  try {
    await prisma.team.update({
      where: { id: team.id },
      data: {
        memberIds: team.memberIds.filter(m => m !== chatId),
        adminIds: team.adminIds.filter(a => a !== chatId),
      },
    })
  } catch (err) {
    console.warn(`[membership] legacy removal mirror failed for team ${team.id}:`, err)
  }
}

export async function deleteTeamMembers(teamId: string): Promise<void> {
  await prisma.teamMember.deleteMany({ where: { teamId } })
}

export async function removeTeamMembershipEverywhere(chatId: bigint): Promise<void> {
  await prisma.teamMember.deleteMany({ where: { chatId } })
}
