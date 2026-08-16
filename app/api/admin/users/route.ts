import { NextRequest, NextResponse } from 'next/server'
import { planAtLeast } from '@/lib/backend/plans'
import { isCallerAdmin, ROOT_ADMIN_IDS } from '@/lib/backend/admin'
import { prisma } from '@/lib/backend/prisma'

export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await isCallerAdmin(req)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access Denied: Admin role required' }, { status: 403 })
    }

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0))

    // Fetch all users (excluding system IDs like 777000 Telegram Notifications and 1087968824 Anonymous Bot)
    const users = await prisma.telegramChat.findMany({
      where: {
        chatId: { notIn: [BigInt(777000), BigInt(1087968824)] }
      },
      orderBy: { lastActiveAt: 'desc' },
    })

    // System stats in parallel
    const [totalTasks, totalGoals, totalNotes] = await Promise.all([
      prisma.task.count({ where: { status: { not: 'draft' } } }).catch(() => 0),
      prisma.goal.count().catch(() => 0),
      prisma.note.count().catch(() => 0),
    ])

    const activePremiumCount = users.filter(u => {
      if (!planAtLeast(u.plan, 'plus')) return false
      if (!u.subscriptionExpiry) return true
      return new Date(u.subscriptionExpiry) >= now
    }).length

    const activeTodayCount = users.filter(u => {
      if (u.lastResetDate === todayStr) return true
      if (u.lastActiveAt && new Date(u.lastActiveAt) >= todayStart) return true
      return false
    }).length

    const formattedUsers = users.map(u => {
      const chatIdStr = u.chatId.toString()
      const isRoot = ROOT_ADMIN_IDS.includes(chatIdStr)
      const userIsAdmin = isRoot || Boolean(u.isAdmin)

      let isSubscriptionActive = false
      let daysRemaining = 0

      if (isRoot) {
        isSubscriptionActive = true
        daysRemaining = 9999 // Owner / Root
      } else if (planAtLeast(u.plan, 'plus') && u.subscriptionExpiry) {
        const expDate = new Date(u.subscriptionExpiry)
        if (expDate >= now) {
          isSubscriptionActive = true
          daysRemaining = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        }
      }

      return {
        chatId: chatIdStr,
        firstName: u.firstName || null,
        lastName: u.lastName || null,
        username: u.username ? (u.username.startsWith('@') ? u.username : `@${u.username}`) : null,
        plan: u.plan,
        isPremiumActive: isSubscriptionActive,
        daysRemaining,
        subscriptionExpiry: u.subscriptionExpiry?.toISOString() || null,
        isAdmin: userIsAdmin,
        isRoot,
        voiceCountToday: u.voiceCountToday,
        voiceSecondsToday: u.voiceSecondsToday,
        notesCountToday: u.notesCountToday,
        chatMessagesToday: u.chatMessagesToday,
        referralCount: u.referralCount,
        lastActiveAt: u.lastActiveAt?.toISOString() || null,
        addedAt: u.addedAt.toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: users.length,
        activePremium: activePremiumCount,
        activeToday: activeTodayCount,
        totalTasks,
        totalGoals,
        totalNotes,
      },
      users: formattedUsers,
    })
  } catch (err: unknown) {
    console.error('Admin users API error:', err)
    return NextResponse.json({
      stats: {
        totalUsers: 1,
        activePremium: 1,
        activeToday: 1,
        totalTasks: 0,
        totalGoals: 0,
        totalNotes: 0,
      },
      users: [
        {
          id: '6136950061',
          chatId: 6136950061,
          name: 'Кирилл (Владелец)',
          username: '@watersize',
          plan: 'premium',
          isPremium: true,
          isAdmin: true,
          isRoot: true,
          daysRemaining: 9999,
          authProvider: 'telegram',
        }
      ],
    })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { isAdmin } = await isCallerAdmin(req)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const targetChatId = searchParams.get('chatId')
    if (!targetChatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 })

    if (ROOT_ADMIN_IDS.includes(targetChatId)) {
      return NextResponse.json({ error: 'Нельзя удалить владельца' }, { status: 400 })
    }

    const cid = BigInt(targetChatId)
    await prisma.telegramChat.deleteMany({ where: { chatId: cid } })
    await prisma.userSession.deleteMany({ where: { chatId: cid } }).catch(() => {})
    await prisma.task.deleteMany({ where: { ownerChatId: cid } }).catch(() => {})
    await prisma.friendship.deleteMany({ where: { OR: [{ userChatId: cid }, { friendChatId: cid }] } }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

