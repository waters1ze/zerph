import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    const project = await (prisma as any).projectDB.findUnique({
      where: { id },
    })

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' }
    })

    const memberInfos = await Promise.all(
      (project.memberIds || []).map(async (memberId: bigint) => {
        const chat = await prisma.telegramChat.findUnique({
          where: { chatId: memberId },
          select: { chatId: true, firstName: true, username: true }
        })
        return chat
          ? { chatId: String(chat.chatId), name: chat.firstName || ('@' + chat.username) || String(memberId) }
          : { chatId: String(memberId), name: String(memberId) }
      })
    )

    return NextResponse.json({
      project: {
        ...project,
        ownerChatId: String(project.ownerChatId),
        memberIds: (project.memberIds || []).map(String),
        members: memberInfos,
        tasks: tasks.map((t: any) => ({
          ...t,
          ownerChatId: t.ownerChatId ? String(t.ownerChatId) : null,
          authorChatId: t.authorChatId ? String(t.authorChatId) : null,
        }))
      }
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
