/**
 * GET /api/telegram/user — Returns the connected Telegram user profile from Neon DB
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const headerChatId = req.headers.get('x-chat-id')
    const queryChatId = searchParams.get('chatId') || searchParams.get('chat_id')
    const cid = queryChatId || headerChatId

    if (cid) {
      const chat = await prisma.telegramChat.findUnique({
        where: { chatId: BigInt(cid) },
      })
      if (chat) {
        return NextResponse.json({
          connected: true,
          chatId: Number(chat.chatId),
          name: chat.firstName || 'Telegram Пользователь',
        })
      }
    }

    // Fallback: return the latest registered chat profile
    const latestChat = await prisma.telegramChat.findFirst({
      orderBy: { addedAt: 'desc' },
    })

    if (!latestChat) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      chatId: Number(latestChat.chatId),
      name: latestChat.firstName || 'Telegram Пользователь',
    })
  } catch (err: unknown) {
    return NextResponse.json({ connected: false, error: String(err) }, { status: 500 })
  }
}
