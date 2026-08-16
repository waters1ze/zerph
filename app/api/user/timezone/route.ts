import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'

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

    await prisma.telegramChat.upsert({
      where: { chatId: numericChatId },
      update: { timezone: timezone.trim() },
      create: { chatId: numericChatId, timezone: timezone.trim() },
    })

    return NextResponse.json({ success: true, timezone: timezone.trim() })
  } catch (error: any) {
    console.error('Timezone update error:', error)
    return NextResponse.json({ error: error.message || 'Error updating timezone' }, { status: 500 })
  }
}
