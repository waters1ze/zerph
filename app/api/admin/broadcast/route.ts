import { NextRequest, NextResponse } from 'next/server'
import { planAtLeast } from '@/lib/backend/plans'
import { isCallerAdmin } from '@/lib/backend/admin'
import { prisma } from '@/lib/backend/prisma'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await isCallerAdmin(req)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access Denied: Admin role required' }, { status: 403 })
    }

    if (!BOT_TOKEN) {
      return NextResponse.json({ error: 'Telegram Bot Token not configured' }, { status: 500 })
    }

    const body = await req.json()
    const { text, targetGroup = 'all' } = body // 'all' | 'premium' | 'free'

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 })
    }

    const now = new Date()
    let whereClause: any = {}

    if (targetGroup === 'premium' || targetGroup === 'paid') {
      whereClause = {
        plan: 'premium',
        OR: [
          { subscriptionExpiry: null },
          { subscriptionExpiry: { gte: now } },
        ],
      }
    } else if (targetGroup === 'free') {
      whereClause = {
        OR: [
          { plan: 'free' },
          { plan: 'premium', subscriptionExpiry: { lt: now } },
        ],
      }
    }

    const users = await prisma.telegramChat.findMany({
      where: whereClause,
      select: { chatId: true },
    })

    let sentCount = 0
    let failCount = 0

    // Send in chunks with delay to avoid rate limiting
    for (const u of users) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: u.chatId.toString(),
            text,
            parse_mode: 'Markdown',
          }),
        })
        const data = await res.json()
        if (data.ok) sentCount++
        else failCount++
      } catch {
        failCount++
      }
      // Small pause to be gentle on Telegram API
      await new Promise(r => setTimeout(r, 40))
    }

    return NextResponse.json({
      success: true,
      sentCount,
      failCount,
      totalTargeted: users.length,
      message: `Рассылка завершена: отправлено ${sentCount} из ${users.length}`,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
