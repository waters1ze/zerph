/**
 * Admin API — manage user subscriptions
 *
 * GET    /api/admin/subscription?chatId=XXX  — get user status
 * POST   /api/admin/subscription  { chatId, action: "grant"|"revoke", days?: 30 }
 *
 * Protected by ADMIN_SECRET env var. Pass as header: Authorization: Bearer <ADMIN_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { activateUserSubscription, getUserUsageAndLimits } from '@/lib/backend/db'
import { prisma } from '@/lib/backend/prisma'
import { isCallerAdmin } from '@/lib/backend/admin'

export async function GET(req: NextRequest) {
  const { isAdmin } = await isCallerAdmin(req)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin role required' }, { status: 401 })
  }

  const chatId = new URL(req.url).searchParams.get('chatId')
  if (!chatId) {
    // List all users with subscriptions
    try {
      const users = await prisma.telegramChat.findMany({
        select: {
          chatId: true,
          firstName: true,
          lastName: true,
          username: true,
          plan: true,
          subscriptionExpiry: true,
          voiceCountToday: true,
          notesCountToday: true,
          chatMessagesToday: true,
          lastResetDate: true,
          lastActiveAt: true,
          addedAt: true,
        },
        orderBy: { addedAt: 'desc' },
      })
      return NextResponse.json({
        users: users.map(u => ({
          ...u,
          chatId: u.chatId.toString(),
          username: u.username ? `@${u.username.replace(/^@/, '')}` : null,
          subscriptionExpiry: u.subscriptionExpiry?.toISOString() ?? null,
        }))
      })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  try {
    const usage = await getUserUsageAndLimits(chatId)
    return NextResponse.json({ chatId, ...usage })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { isAdmin } = await isCallerAdmin(req)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin role required' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { chatId, action, days = 30 } = body

    if (!chatId || !action) {
      return NextResponse.json({ error: 'chatId and action are required' }, { status: 400 })
    }

    const cid = BigInt(chatId)

    if (action === 'grant') {
      await activateUserSubscription(chatId, days)
      return NextResponse.json({
        success: true,
        message: `✅ Подписка Premium выдана пользователю ${chatId} на ${days} дней`,
      })
    }

    if (action === 'revoke') {
      await prisma.telegramChat.upsert({
        where: { chatId: cid },
        update: { plan: 'free', subscriptionExpiry: null },
        create: { chatId: cid, plan: 'free' },
      })
      return NextResponse.json({
        success: true,
        message: `🚫 Подписка Premium у пользователя ${chatId} отозвана`,
      })
    }

    if (action === 'reset_usage') {
      await prisma.telegramChat.update({
        where: { chatId: cid },
        data: {
          voiceCountToday: 0,
          voiceSecondsToday: 0,
          notesCountToday: 0,
          chatMessagesToday: 0,
        },
      })
      return NextResponse.json({
        success: true,
        message: `🔄 Дневные лимиты пользователя ${chatId} сброшены`,
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
