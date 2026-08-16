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

    const { id } = await params
    const numericChatId = BigInt(authUser.chatId)

    const team = await prisma.team.findUnique({
      where: { id },
    })

    if (!team) {
      return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 })
    }

    const isMember = team.ownerChatId === numericChatId || team.memberIds.includes(numericChatId)
    if (!isMember && !authUser.isRoot) {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    }

    // Fetch user profiles for all memberIds
    const memberUsers = await prisma.telegramChat.findMany({
      where: {
        chatId: { in: team.memberIds },
      },
      select: {
        chatId: true,
        firstName: true,
        lastName: true,
        username: true,
        plan: true,
        lastActiveAt: true,
      },
    })

    const isOwner = team.ownerChatId === numericChatId
    const isAdmin = isOwner || team.adminIds.includes(numericChatId)

    const members = team.memberIds.map(mId => {
      const u = memberUsers.find(user => user.chatId === mId)
      const isMemOwner = team.ownerChatId === mId
      const isMemAdmin = isMemOwner || team.adminIds.includes(mId)
      const role = isMemOwner ? 'owner' : isMemAdmin ? 'admin' : 'member'

      return {
        chatId: mId.toString(),
        firstName: u?.firstName || null,
        lastName: u?.lastName || null,
        username: u?.username ? (u.username.startsWith('@') ? u.username : `@${u.username}`) : null,
        plan: u?.plan || 'free',
        role,
        isMe: mId === numericChatId,
      }
    })

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        ownerChatId: team.ownerChatId.toString(),
        plan: team.plan,
        inviteCode: team.inviteCode,
        inviteUrl: `https://t.me/zerph_bot?start=team_${team.inviteCode}`,
        myRole: isOwner ? 'owner' : isAdmin ? 'admin' : 'member',
        isOwner,
        isAdmin,
        members,
        createdAt: team.createdAt.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[Team Detail GET] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки данных команды' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const numericChatId = BigInt(authUser.chatId)

    const team = await prisma.team.findUnique({
      where: { id },
    })

    if (!team) {
      return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 })
    }

    const isOwner = team.ownerChatId === numericChatId
    const isAdmin = isOwner || team.adminIds.includes(numericChatId)

    if (!isAdmin && !authUser.isRoot) {
      return NextResponse.json({ error: 'Требуются права администратора команды' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))

    // 1. Rename team
    if (body.name && typeof body.name === 'string') {
      const updated = await prisma.team.update({
        where: { id },
        data: { name: body.name.trim() },
      })
      return NextResponse.json({ success: true, name: updated.name, message: 'Название команды обновлено' })
    }

    // 2. Change member role (promote/demote admin)
    if (body.targetChatId && body.role) {
      if (!isOwner && !authUser.isRoot) {
        return NextResponse.json({ error: 'Только владелец команды может менять роли' }, { status: 403 })
      }
      const targetId = BigInt(body.targetChatId)
      if (targetId === team.ownerChatId) {
        return NextResponse.json({ error: 'Нельзя изменить роль владельца' }, { status: 400 })
      }

      let nextAdmins = [...team.adminIds]
      if (body.role === 'admin' && !nextAdmins.includes(targetId)) {
        nextAdmins.push(targetId)
      } else if (body.role === 'member') {
        nextAdmins = nextAdmins.filter(aId => aId !== targetId)
      }

      await prisma.team.update({
        where: { id },
        data: { adminIds: nextAdmins },
      })

      return NextResponse.json({ success: true, message: 'Роль участника обновлена' })
    }

    // 3. Remove/kick member
    if (body.kickChatId) {
      const kickId = BigInt(body.kickChatId)
      if (kickId === team.ownerChatId) {
        return NextResponse.json({ error: 'Нельзя исключить владельца' }, { status: 400 })
      }

      const nextMembers = team.memberIds.filter(mId => mId !== kickId)
      const nextAdmins = team.adminIds.filter(mId => mId !== kickId)

      await prisma.team.update({
        where: { id },
        data: {
          memberIds: nextMembers,
          adminIds: nextAdmins,
        },
      })

      return NextResponse.json({ success: true, message: 'Участник исключен из команды' })
    }

    return NextResponse.json({ error: 'Нет параметров для обновления' }, { status: 400 })
  } catch (error: any) {
    console.error('[Team Detail PATCH] Error:', error)
    return NextResponse.json({ error: 'Ошибка обновления команды' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const numericChatId = BigInt(authUser.chatId)

    const team = await prisma.team.findUnique({
      where: { id },
    })

    if (!team) {
      return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 })
    }

    const isOwner = team.ownerChatId === numericChatId

    if (isOwner || authUser.isRoot) {
      // Owner deletes whole team
      await prisma.team.delete({ where: { id } })
      return NextResponse.json({ success: true, message: 'Команда удалена' })
    } else {
      // Member leaves team
      const nextMembers = team.memberIds.filter(mId => mId !== numericChatId)
      const nextAdmins = team.adminIds.filter(mId => mId !== numericChatId)
      await prisma.team.update({
        where: { id },
        data: {
          memberIds: nextMembers,
          adminIds: nextAdmins,
        },
      })
      return NextResponse.json({ success: true, message: 'Вы покинули команду' })
    }
  } catch (error: any) {
    console.error('[Team Detail DELETE] Error:', error)
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
