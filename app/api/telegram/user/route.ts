/**
 * GET /api/telegram/user — Returns Telegram user profile by chatId
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/backend/db'

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get('chatId')
    || req.nextUrl.searchParams.get('chat_id')
    || req.headers.get('x-chat-id')

  if (!chatId) {
    return NextResponse.json({ connected: false })
  }

  const user = getUserProfile(Number(chatId))
  if (!user) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    chatId: user.chatId,
    name: user.name,
    username: user.username,
  })
}
