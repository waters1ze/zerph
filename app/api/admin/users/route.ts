import { NextRequest, NextResponse } from 'next/server'
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

    // Fetch all users
    const users = await prisma.telegramChat.findMany({
      orderBy: { lastActiveAt: 'desc' },
    })

    // System stats in parallel
    const [totalTasks, totalGoals, totalNotes] = await Promise.all([
      prisma.task.count({ where: { status: { not: 'draft' } } }).catch(() => 0),
      prisma.goal.count().catch(() => 0),
      prisma.note.count().catch(() => 0),
    ])

    const activePremiumCount = users.filter(u => {
      if (u.plan !== 'premium') return false
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

      if (u.plan === 'premium') {
        if (!u.subscriptionExpiry) {
          isSubscriptionActive = true
          daysRemaining = 9999 // Lifetime / Admin
        } else {
          const expDate = new Date(u.subscriptionExpiry)
          if (expDate >= now) {
            isSubscriptionActive = true
            daysRemaining = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          }
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
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
