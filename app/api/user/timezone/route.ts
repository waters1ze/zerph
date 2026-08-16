import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { parseTimezoneInput } from '@/lib/backend/timezone'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { timezone } = await req.json()

    if (!timezone || !timezone.trim()) {
      return NextResponse.json({ error: 'Timezone required' }, { status: 400 })
    }

    const numericChatId = BigInt(authUser.chatId)
    if (!numericChatId) {
      return NextResponse.json({ error: 'Invalid Chat ID' }, { status: 400 })
    }

    const cleanTz = parseTimezoneInput(timezone) || timezone.trim()

    // Validate IANA timezone compatibility
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: cleanTz })
    } catch {
      return NextResponse.json({ error: 'Неверный формат часового пояса' }, { status: 400 })
    }

    await prisma.telegramChat.upsert({
      where: { chatId: numericChatId },
      update: { timezone: cleanTz },
      create: { chatId: numericChatId, timezone: cleanTz },
    })

    return NextResponse.json({ success: true, timezone: cleanTz })
  } catch (error: any) {
    console.error('Timezone update error:', error)
    return NextResponse.json({ error: error.message || 'Error updating timezone' }, { status: 500 })
  }
}
