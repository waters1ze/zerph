import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.telegramChat.update({
      where: { chatId: BigInt(authUser.chatId) },
      data: {
        googleCalendarToken: null,
        googleCalendarSync: false,
      },
    })

    return NextResponse.json({ success: true, disconnected: true })
  } catch (err: any) {
    console.error('Error disconnecting Google Calendar:', err)
    return NextResponse.json({ error: String(err), success: false }, { status: 500 })
  }
}
