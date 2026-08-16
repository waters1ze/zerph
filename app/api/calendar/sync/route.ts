import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const numericChatId = BigInt(authUser.chatId)
    const user = await prisma.telegramChat.findUnique({
      where: { chatId: numericChatId },
      select: {
        googleCalendarSync: true,
        googleEmail: true,
        timezone: true,
      },
    })

    const tokenConfig = await prisma.config.findUnique({
      where: { key: `cal_feed_token_${authUser.chatId}` },
    })

    const origin = req.nextUrl.origin || 'https://zerph.ru'
    const token = tokenConfig?.value || ''
    const webcalUrl = token ? `${origin}/api/calendar/feed/${token}.ics`.replace(/^https?:\/\//, 'webcal://') : ''

    return NextResponse.json({
      success: true,
      googleCalendarSync: user?.googleCalendarSync || false,
      googleEmail: user?.googleEmail || null,
      timezone: user?.timezone || 'Europe/Moscow',
      hasFeedToken: Boolean(token),
      webcalUrl,
    })
  } catch (error: any) {
    console.error('[Calendar Sync GET] Error:', error)
    return NextResponse.json({ error: 'Ошибка получения статуса синхронизации' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const numericChatId = BigInt(authUser.chatId)
    const body = await req.json().catch(() => ({}))
    const enable = Boolean(body.enabled)

    await prisma.telegramChat.update({
      where: { chatId: numericChatId },
      data: {
        googleCalendarSync: enable,
      },
    })

    return NextResponse.json({
      success: true,
      googleCalendarSync: enable,
      message: enable ? 'Синхронизация с календарем включена' : 'Синхронизация отключена',
    })
  } catch (error: any) {
    console.error('[Calendar Sync POST] Error:', error)
    return NextResponse.json({ error: 'Ошибка обновления статуса' }, { status: 500 })
  }
}
