import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const numericChatId = BigInt(authUser.chatId)
    const body = await req.json().catch(() => ({}))
    const inviteCode = (body.inviteCode || '').trim().toLowerCase()

    if (!inviteCode) {
      return NextResponse.json({ error: 'Введите код приглашения' }, { status: 400 })
    }

    const team = await prisma.team.findUnique({
      where: { inviteCode },
    })

    if (!team) {
      return NextResponse.json({ error: 'Команда с таким кодом не найдена' }, { status: 404 })
    }

    if (team.memberIds.includes(numericChatId)) {
      return NextResponse.json({
        success: true,
        alreadyMember: true,
        teamId: team.id,
        name: team.name,
        message: `Вы уже состоите в команде «${team.name}»`,
      })
    }

    // Add user to memberIds
    const updated = await prisma.team.update({
      where: { id: team.id },
      data: {
        memberIds: { push: numericChatId },
      },
    })

    return NextResponse.json({
      success: true,
      teamId: updated.id,
      name: updated.name,
      message: `Вы успешно присоединились к команде «${updated.name}»!`,
    })
  } catch (error: any) {
    console.error('[Teams Join] Error:', error)
    return NextResponse.json({ error: 'Ошибка присоединения к команде' }, { status: 500 })
  }
}
