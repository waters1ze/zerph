import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: teamId } = await params
    const numericChatId = BigInt(authUser.chatId)

    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team || (!team.memberIds.includes(numericChatId) && team.ownerChatId !== numericChatId && !authUser.isRoot)) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    }

    // Tasks that belong to this team (projectDbId = teamId or isShared with team members)
    const tasks = await prisma.task.findMany({
      where: {
        projectDbId: teamId,
      },
      orderBy: { createdAt: 'desc' },
    })

    const formattedTasks = tasks.map(t => ({
      ...t,
      ownerChatId: t.ownerChatId?.toString(),
      authorChatId: t.authorChatId?.toString(),
    }))

    return NextResponse.json({
      success: true,
      tasks: formattedTasks,
    })
  } catch (error: any) {
    console.error('[Team Tasks GET] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки задач команды' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: teamId } = await params
    const numericChatId = BigInt(authUser.chatId)

    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team || (!team.memberIds.includes(numericChatId) && team.ownerChatId !== numericChatId && !authUser.isRoot)) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const title = (body.title || '').trim()

    if (!title) {
      return NextResponse.json({ error: 'Укажите название задачи' }, { status: 400 })
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: body.description || null,
        priority: body.priority || 'medium',
        status: body.status || 'todo',
        dueDate: body.dueDate || null,
        dueTime: body.dueTime || null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        assignees: Array.isArray(body.assignees) ? body.assignees : [],
        isShared: true,
        projectDbId: teamId,
        ownerChatId: numericChatId,
        authorChatId: numericChatId,
      },
    })

    return NextResponse.json({
      success: true,
      task: {
        ...task,
        ownerChatId: task.ownerChatId?.toString(),
        authorChatId: task.authorChatId?.toString(),
      },
      message: 'Командная задача создана',
    })
  } catch (error: any) {
    console.error('[Team Tasks POST] Error:', error)
    return NextResponse.json({ error: 'Ошибка создания командной задачи' }, { status: 500 })
  }
}
