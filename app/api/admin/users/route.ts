import { NextRequest, NextResponse } from 'next/server'
import { planAtLeast, normalizePlan } from '@/lib/backend/plans'
import { isCallerAdmin, ROOT_ADMIN_IDS } from '@/lib/backend/admin'
import { prisma } from '@/lib/backend/prisma'

// Plan prices for MRR calculation
const PLAN_MONTHLY_PRICE: Record<string, number> = {
  plus: 99,
  premium: 99, // legacy name
  pro: 299,
  corp: 0, // custom billing
}

export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await isCallerAdmin(req)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access Denied: Admin role required' }, { status: 403 })
    }

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)

    // Fetch all real authenticated users (excluding system IDs and blank phantom guests)
    const users = await prisma.telegramChat.findMany({
      where: {
        chatId: { notIn: [BigInt(777000), BigInt(1087968824)] },
        OR: [
          { username: { not: null } },
          { firstName: { not: null } },
          { email: { not: null } },
          { googleEmail: { not: null } },
          { vkId: { not: null } },
          { authProvider: { not: null } },
        ],
      },
      orderBy: { lastActiveAt: 'desc' },
    })

    // ─── System stats (one raw query) ────────────────────────────────────────
    let totalTasks = 0, totalGoals = 0, totalNotes = 0
    try {
      const counts = await prisma.$queryRaw<Array<{ tasks: number; goals: number; notes: number }>>`
        SELECT
          (SELECT COUNT(*) FROM "Task" WHERE status <> 'draft')::int AS tasks,
          (SELECT COUNT(*) FROM "Goal")::int AS goals,
          (SELECT COUNT(*) FROM "Note")::int AS notes
      `
      totalTasks = Number(counts[0]?.tasks) || 0
      totalGoals = Number(counts[0]?.goals) || 0
      totalNotes = Number(counts[0]?.notes) || 0
    } catch {}

    // ─── Real Payments & Transactions from Config ────────────────────────────
    let totalRevenue = 0
    const paymentRecords: any[] = []
    const realPaidChatIds = new Set<string>()

    try {
      const dbPaymentConfigs = await prisma.config.findMany({
        where: {
          key: { startsWith: 'payment_record_' },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      })

      for (const item of dbPaymentConfigs) {
        try {
          const parsed = JSON.parse(item.value)
          totalRevenue += Number(parsed.amount) || 0
          if (parsed.chatId) realPaidChatIds.add(String(parsed.chatId))
          paymentRecords.push({
            id: item.key.replace('payment_record_', ''),
            amount: Number(parsed.amount) || 0,
            plan: parsed.plan || 'plus',
            days: parsed.days || 30,
            chatId: parsed.chatId || '',
            isGift: Boolean(parsed.isGift),
            createdAt: parsed.createdAt || item.updatedAt.toISOString(),
          })
        } catch {}
      }
    } catch {}

    // ─── Active subscriptions ────────────────────────────────────────────────
    const nonRootUsers = users.filter(u => !ROOT_ADMIN_IDS.includes(u.chatId.toString()))
    const totalNonRoot = nonRootUsers.length

    const activePremiumUsers = users.filter(u => {
      const chatIdStr = u.chatId.toString()
      if (ROOT_ADMIN_IDS.includes(chatIdStr)) return true
      if (!planAtLeast(u.plan, 'plus')) return false
      if (!u.subscriptionExpiry) return true
      return new Date(u.subscriptionExpiry) >= now
    })
    const activePremiumCount = activePremiumUsers.length

    // Real paying subscribers (users who have paid transactions or active paid plan)
    const realPayingSubscribers = nonRootUsers.filter(u => {
      if (!planAtLeast(u.plan, 'plus')) return false
      if (u.subscriptionExpiry && new Date(u.subscriptionExpiry) < now) return false
      return realPaidChatIds.has(u.chatId.toString())
    })
    const paidSubscribersCount = realPayingSubscribers.length

    // ─── Real MRR Calculation ────────────────────────────────────────────────
    let mrr = 0
    for (const u of realPayingSubscribers) {
      const plan = normalizePlan(u.plan)
      mrr += PLAN_MONTHLY_PRICE[plan] || 0
    }

    // ─── Plan Breakdown ──────────────────────────────────────────────────────
    const planBreakdown = {
      free: nonRootUsers.filter(u => !u.plan || u.plan === 'free' || (u.subscriptionExpiry && new Date(u.subscriptionExpiry) < now)).length,
      plus: nonRootUsers.filter(u => u.plan === 'plus' && (!u.subscriptionExpiry || new Date(u.subscriptionExpiry) >= now)).length,
      pro: nonRootUsers.filter(u => u.plan === 'pro' && (!u.subscriptionExpiry || new Date(u.subscriptionExpiry) >= now)).length,
      corp: nonRootUsers.filter(u => u.plan === 'corp' && (!u.subscriptionExpiry || new Date(u.subscriptionExpiry) >= now)).length,
    }

    // ─── DAU / WAU ───────────────────────────────────────────────────────────
    const dauCount = users.filter(u => {
      if (u.lastResetDate === todayStr) return true
      if (u.lastActiveAt && new Date(u.lastActiveAt) >= todayStart) return true
      return false
    }).length

    const wauCount = users.filter(u =>
      u.lastActiveAt && new Date(u.lastActiveAt) >= sevenDaysAgo
    ).length

    // ─── Retention D1 / D7 ───────────────────────────────────────────────────
    // D1: users who registered 1–2 days ago, how many were active in last 24h
    const regD1 = users.filter(u => {
      const added = new Date(u.addedAt)
      return added >= twoDaysAgo && added < oneDayAgo
    })
    const retD1 = regD1.length > 0
      ? Math.round(
          regD1.filter(u => u.lastActiveAt && new Date(u.lastActiveAt) >= oneDayAgo).length
          / regD1.length * 100
        )
      : null

    // D7: users who registered 7–8 days ago, how many were active in last 7 days
    const regD7 = users.filter(u => {
      const added = new Date(u.addedAt)
      return added >= eightDaysAgo && added < sevenDaysAgo
    })
    const retD7 = regD7.length > 0
      ? Math.round(
          regD7.filter(u => u.lastActiveAt && new Date(u.lastActiveAt) >= sevenDaysAgo).length
          / regD7.length * 100
        )
      : null

    // ─── Conversion free → paid ──────────────────────────────────────────────
    const conversionPct = totalNonRoot > 0
      ? Math.min(100, Math.round(paidSubscribersCount / totalNonRoot * 100))
      : 0

    // ─── Registrations by day (last 30 days) for chart ───────────────────────
    const regByDay: Record<string, number> = {}
    for (let i = 0; i < 30; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      regByDay[d.toISOString().slice(0, 10)] = 0
    }
    for (const u of users) {
      const dayStr = new Date(u.addedAt).toISOString().slice(0, 10)
      if (dayStr in regByDay) regByDay[dayStr]++
    }
    const registrationsChart = Object.entries(regByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // ─── New users last 7 / 30 days ──────────────────────────────────────────
    const newUsersWeek = users.filter(u => new Date(u.addedAt) >= sevenDaysAgo).length
    const newUsersMonth = users.filter(u => new Date(u.addedAt) >= thirtyDaysAgo).length

    // ─── Format user list ────────────────────────────────────────────────────
    const formattedUsers = users.map(u => {
      const chatIdStr = u.chatId.toString()
      const isRoot = ROOT_ADMIN_IDS.includes(chatIdStr)
      const userIsAdmin = isRoot || Boolean(u.isAdmin)
      const normalizedPlan = isRoot ? 'corp' : normalizePlan(u.plan)

      let isSubscriptionActive = false
      let daysRemaining = 0

      if (isRoot) {
        isSubscriptionActive = true
        daysRemaining = 9999
      } else if (planAtLeast(u.plan, 'plus')) {
        if (u.subscriptionExpiry) {
          const expDate = new Date(u.subscriptionExpiry)
          if (expDate >= now) {
            isSubscriptionActive = true
            daysRemaining = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          }
        } else {
          // No expiry set but plan is plus/pro/corp -> lifetime
          isSubscriptionActive = true
          daysRemaining = 9999
        }
      }

      const isTrialActive = Boolean(
        u.trialActivatedAt &&
        new Date(u.trialActivatedAt).getTime() + 86400000 > now.getTime()
      )

      return {
        chatId: chatIdStr,
        firstName: u.firstName || null,
        lastName: u.lastName || null,
        username: u.username ? (u.username.startsWith('@') ? u.username : `@${u.username}`) : null,
        plan: normalizedPlan,
        rawPlan: u.plan || 'free',
        isPremiumActive: isSubscriptionActive,
        daysRemaining,
        subscriptionExpiry: u.subscriptionExpiry?.toISOString() || null,
        trialActivatedAt: u.trialActivatedAt?.toISOString() || null,
        isTrialActive,
        referredBy: u.referredBy ? u.referredBy.toString() : null,
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
        activeToday: dauCount,
        totalTasks,
        totalGoals,
        totalNotes,
      },
      metrics: {
        dau: dauCount,
        wau: wauCount,
        mrr,
        totalRevenue,
        paidSubscribersCount,
        planBreakdown,
        paymentRecords,
        retentionD1: retD1,
        retentionD7: retD7,
        conversionPct,
        newUsersWeek,
        newUsersMonth,
        registrationsChart,
      },
      users: formattedUsers,
    })
  } catch (err: unknown) {
    console.error('Admin users API error:', err)
    return NextResponse.json(
      { success: false, error: 'Не удалось загрузить данные. Попробуйте ещё раз.' },
      { status: 500 }
    )
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
