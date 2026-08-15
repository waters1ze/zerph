/**
 * GET  /api/telegram/user — Returns connected Telegram profile
 * POST /api/telegram/user — Updates user's own birthday date and syncs to all friends
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 })
    }
    const cid = authUser.chatId

    const chat = await prisma.telegramChat.findUnique({
      where: { chatId: BigInt(cid) },
    })

    if (chat) {
      const now = new Date()
      let isPremium = chat.plan === 'premium'
      if (isPremium && chat.subscriptionExpiry && new Date(chat.subscriptionExpiry) < now) {
        isPremium = false
      }

      const fullName = [chat.firstName, chat.lastName].filter(Boolean).join(' ') || chat.firstName || 'Telegram Пользователь'

      return NextResponse.json({
        connected: true,
        chatId: Number(chat.chatId),
        name: fullName,
        firstName: chat.firstName,
        lastName: chat.lastName,
        username: chat.username ? `@${chat.username.replace(/^@/, '')}` : null,
        birthday: chat.birthday || null,
        plan: isPremium ? 'premium' : 'free',
        isPremium,
        subscriptionExpiry: chat.subscriptionExpiry?.toISOString() || null,
        isAdmin: Boolean(chat.isAdmin),
      })
    }

    return NextResponse.json({ connected: false })
  } catch (err: unknown) {
    return NextResponse.json({ connected: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const cid = authUser.chatId

    const { birthday, name } = await req.json()
    const userCid = BigInt(cid)

    const { parseBirthday, broadcastMyBirthdayToFriends, updateUserNameCascade } = await import('@/lib/backend/db')

    const updateData: any = {}
    if (birthday !== undefined) {
      const parsed = parseBirthday(birthday)
      updateData.birthday = parsed ? parsed.iso : (birthday || null)
    }

    if (name !== undefined) {
      const trimmed = name.trim()
      const parts = trimmed.split(/\s+/)
      const firstName = parts[0] || trimmed
      const lastName = parts.slice(1).join(' ') || null
      await updateUserNameCascade(userCid, firstName, lastName)
    }

    if (updateData.birthday !== undefined) {
      await prisma.telegramChat.upsert({
        where: { chatId: userCid },
        update: updateData,
        create: { chatId: userCid, ...updateData },
      })
      if (updateData.birthday) {
        await broadcastMyBirthdayToFriends(userCid)
      }
    }

    return NextResponse.json({ success: true, birthday: updateData.birthday || null })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
