import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { parseTimezoneInput } from '@/lib/backend/timezone'

export async function POST(req: NextRequest) {
  try {
    const { chatId, timezone } = await req.json()

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID required' }, { status: 400 })
    }

    if (!timezone || !timezone.trim()) {
      return NextResponse.json({ error: 'Timezone required' }, { status: 400 })
    }

    const numericChatId = BigInt(String(chatId).replace(/\D/g, '') || '0')
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
