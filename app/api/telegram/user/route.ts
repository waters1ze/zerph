/**
 * GET /api/telegram/user — Returns the connected Telegram user profile from Neon DB
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

    return NextResponse.json({ connected: false })
  } catch (err: unknown) {
    return NextResponse.json({ connected: false, error: String(err) }, { status: 500 })
  }
}
