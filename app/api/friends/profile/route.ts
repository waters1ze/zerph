import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const targetId = searchParams.get('chatId') || searchParams.get('friendId')
  if (!targetId) {
    return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
  }

  try {
    let targetCid: bigint
    try {
      targetCid = BigInt(targetId)
    } catch {
      return NextResponse.json({ error: 'Invalid chatId' }, { status: 400 })
    }

    const myCid = BigInt(authUser.chatId)
    const isSelf = myCid === targetCid

    const targetUser = await prisma.telegramChat.findUnique({
      where: { chatId: targetCid },
      select: {
        chatId: true,
        firstName: true,
        lastName: true,
        username: true,
        birthday: true,
        streakDays: true,
        streakVisible: true,
        addedAt: true,
        lastActiveAt: true,
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Check friendship and permission: Target (targetCid) MUST have enabled allowTasks for Viewer (myCid)
    let isFriend = isSelf
    let allowTasks = isSelf

    if (!isSelf) {
      const targetToMe = await prisma.friendship.findUnique({
        where: {
          userChatId_friendChatId: {
            userChatId: targetCid,
            friendChatId: myCid,
          }
        }
      })
      const meToTarget = await prisma.friendship.findUnique({
        where: {
          userChatId_friendChatId: {
            userChatId: myCid,
            friendChatId: targetCid,
          }
        }
      })

      isFriend = (targetToMe?.status === 'accepted') || (meToTarget?.status === 'accepted')
      allowTasks = isFriend && Boolean(targetToMe && targetToMe.status === 'accepted' && targetToMe.allowTasks === true)
    }

    // Calculate public stats
    const totalCompletedTasks = await prisma.task.count({
      where: {
        ownerChatId: targetCid,
        status: 'done',
      }
    })

    // If allowed, get shared / public tasks
    let sharedTasks: any[] = []
    if (allowTasks) {
      sharedTasks = await prisma.task.findMany({
        where: {
          ownerChatId: targetCid,
          status: { notIn: ['draft'] },
          OR: [
            { isShared: true },
            { authorChatId: myCid },
            { visibility: 'public' }
          ]
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          dueTime: true,
          priority: true,
          isShared: true,
        },
        orderBy: { dueDate: 'asc' },
        take: 20,
      })
    }

    return NextResponse.json({
      user: {
        chatId: String(targetUser.chatId),
        name: [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || 'Пользователь Zerf',
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        username: targetUser.username ? `@${targetUser.username.replace(/^@/, '')}` : null,
        birthday: targetUser.birthday,
        // SOCIAL LAYER PRIVACY (feature: friend streaks): a user may hide
        // their streak from friends; self-view is always allowed.
        streakDays: isSelf || targetUser.streakVisible ? (targetUser.streakDays || 0) : null,
        streakVisible: targetUser.streakVisible,
        createdAt: targetUser.addedAt,
        totalCompletedTasks,
      },
      isSelf,
      isFriend,
      allowTasks,
      sharedTasks,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
