/**
 * /api/projects — Full Projects CRUD API
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

async function getChatId(req: NextRequest): Promise<bigint | null> {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) return null
  try { return BigInt(authUser.chatId) } catch { return null }
}

export async function GET(req: NextRequest) {
  const chatId = await getChatId(req)
  if (!chatId) return NextResponse.json({ projects: [] })

  try {
    const projects = await (prisma as any).projectDB.findMany({
      where: {
        OR: [{ ownerChatId: chatId }, { memberIds: { has: chatId } }],
        status: { not: 'archived' },
      },
      orderBy: { createdAt: 'desc' },
    })

    const projectsWithTasks = await Promise.all(
      projects.map(async (project: any) => {
        const tasks = await prisma.task.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' } })
        const memberInfos = await Promise.all(
          (project.memberIds || []).map(async (memberId: bigint) => {
            const chat = await prisma.telegramChat.findUnique({ where: { chatId: memberId }, select: { chatId: true, firstName: true, username: true } })
            return chat ? { chatId: String(chat.chatId), name: chat.firstName || ('@' + chat.username) || String(memberId) } : { chatId: String(memberId), name: String(memberId) }
          })
        )
        return { ...project, ownerChatId: String(project.ownerChatId), memberIds: (project.memberIds||[]).map(String), members: memberInfos, tasks: tasks.map((t: any) => ({ ...t, ownerChatId: t.ownerChatId ? String(t.ownerChatId) : null, authorChatId: t.authorChatId ? String(t.authorChatId) : null })) }
      })
    )
    return NextResponse.json({ projects: projectsWithTasks })
  } catch (err) {
    return NextResponse.json({ projects: [], error: String(err) })
  }
}

export async function POST(req: NextRequest) {
  const chatId = await getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
  try {
    const { title, description, color, memberUsernames } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
    let memberIds: bigint[] = [chatId]
    if (memberUsernames?.length) {
      for (const username of memberUsernames) {
        const chat = await prisma.telegramChat.findFirst({ where: { username: { equals: username.replace('@','').trim(), mode: 'insensitive' } } })
        if (chat && !memberIds.includes(chat.chatId)) memberIds.push(chat.chatId)
      }
    }
    const project = await (prisma as any).projectDB.create({ data: { title: title.trim(), description: description?.trim() || null, ownerChatId: chatId, memberIds, color: color || '#6366f1', status: 'active' } })
    return NextResponse.json({ project: { ...project, ownerChatId: String(project.ownerChatId), memberIds: project.memberIds.map(String), tasks: [], members: [] } })
  } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  const chatId = await getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
  try {
    const { id, title, description, color, status, memberUsernames } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const updateData: any = { updatedAt: new Date() }
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (color !== undefined) updateData.color = color
    if (status !== undefined) updateData.status = status
    if (memberUsernames?.length) {
      const existing = await (prisma as any).projectDB.findUnique({ where: { id } })
      let newIds = [...(existing?.memberIds || [])]
      for (const u of memberUsernames) {
        const chat = await prisma.telegramChat.findFirst({ where: { username: { equals: u.replace('@','').trim(), mode: 'insensitive' } } })
        if (chat && !newIds.includes(chat.chatId)) newIds.push(chat.chatId)
      }
      updateData.memberIds = newIds
    }
    const updated = await (prisma as any).projectDB.update({ where: { id }, data: updateData })
    return NextResponse.json({ project: { ...updated, ownerChatId: String(updated.ownerChatId), memberIds: updated.memberIds.map(String) } })
  } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const chatId = await getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const project = await (prisma as any).projectDB.findUnique({ where: { id } })
    if (!project) return NextResponse.json({ ok: true })

    const isOwner = project.ownerChatId === chatId
    if (isOwner) {
      // Owner deletes project -> delete associated tasks and the project record
      await prisma.task.deleteMany({ where: { projectId: id } })
      await (prisma as any).projectDB.delete({ where: { id } })
    } else {
      // Member leaves/removes project -> remove member from memberIds
      const updatedMembers = (project.memberIds || []).filter((m: bigint) => m !== chatId)
      await (prisma as any).projectDB.update({ where: { id }, data: { memberIds: updatedMembers } })
    }

    return NextResponse.json({ ok: true })
  } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }) }
}


