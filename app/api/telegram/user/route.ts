/**
 * GET /api/telegram/user — Returns the connected Telegram user profile from Neon DB
 */

import { NextResponse } from 'next/server'
import { getAllChatIds } from '@/lib/backend/db'

export async function GET() {
  try {
    const chats = await getAllChatIds()
    if (chats.length === 0) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      chatId: chats[0],
      name: 'w-size',
    })
  } catch {
    return NextResponse.json({ connected: false }, { status: 500 })
  }
}
