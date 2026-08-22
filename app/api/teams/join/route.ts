import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { isTeamMember, addTeamMember } from '@/lib/backend/membership'

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

    if (await isTeamMember(team as any, numericChatId)) {
      return NextResponse.json({
        success: true,
        alreadyMember: true,
        teamId: team.id,
        name: team.name,
        message: `Вы уже состоите в команде «${team.name}»`,
      })
    }

    // Add user (relational row + legacy array mirror, B7)
    const updated = await prisma.team.update({
      where: { id: team.id },
      data: {
        memberIds: { push: numericChatId },
      },
    }).catch(async () => team)
    await addTeamMember(team as any, numericChatId).catch(err =>
      console.error(`[Teams Join] membership row failed for ${team.id}:`, err)
    )

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
