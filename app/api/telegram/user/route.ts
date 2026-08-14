/**
 * GET  /api/telegram/user — Returns connected Telegram profile
 * POST /api/telegram/user — Updates user's own birthday date and syncs to all friends
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { verifyUserAuth } from '@/lib/backend/auth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const headerChatId = req.headers.get('x-chat-id')
    const queryChatId = searchParams.get('chatId') || searchParams.get('chat_id')
    const cid = queryChatId || headerChatId
    const token = req.headers.get('x-auth-token') || searchParams.get('token')
    const initData = req.headers.get('x-tg-init-data')

    if (!cid || !verifyUserAuth(cid, token, initData)) {
      return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 })
    }

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
    const { searchParams } = new URL(req.url)
    const headerChatId = req.headers.get('x-chat-id')
    const queryChatId = searchParams.get('chatId') || searchParams.get('chat_id')
    const cid = queryChatId || headerChatId
    const token = req.headers.get('x-auth-token') || searchParams.get('token')
    const initData = req.headers.get('x-tg-init-data')

    if (!cid || !verifyUserAuth(cid, token, initData)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { birthday, name } = await req.json()
    const userCid = BigInt(cid)

    const updateData: any = {}
    if (birthday !== undefined) updateData.birthday = birthday || null
    if (name !== undefined) {
      const trimmed = name.trim()
      const parts = trimmed.split(/\s+/)
      updateData.firstName = parts[0] || trimmed
      updateData.lastName = parts.slice(1).join(' ') || null
    }

    await prisma.telegramChat.upsert({
      where: { chatId: userCid },
      update: updateData,
      create: { chatId: userCid, ...updateData },
    })

    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userChatId: userCid }, { friendChatId: userCid }] },
    })

    const { syncFriendBirthdays } = await import('@/lib/backend/db')
    for (const f of friendships) {
      const friendId = f.userChatId === userCid ? f.friendChatId : f.userChatId
      await syncFriendBirthdays(friendId)
    }

    return NextResponse.json({ success: true, birthday })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
