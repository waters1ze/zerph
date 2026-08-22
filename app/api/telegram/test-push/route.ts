import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ ok: false, error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    // Test pushes go only to the authenticated caller — a client-supplied
    // chatId would allow sending arbitrary Telegram messages to any user.
    const chatId = authUser.chatId

    if (!chatId || String(chatId).startsWith('guest_') || !/^\d+$/.test(String(chatId))) {
      return NextResponse.json({
        ok: false,
        error: 'Telegram не подключен. Откройте бота @Zerph_bot и нажмите /start для привязки.',
      }, { status: 400 })
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({
        ok: false,
        error: 'Серверный токен Telegram-бота не настроен.',
      }, { status: 500 })
    }

    const text = body?.message || `🔔 *Тестовое уведомление Zerf Note*\n\n✅ Связь с сервером успешно установлена!\nВсе напоминания, дедлайны и голосовые отчеты будут приходить сюда вовремя.`

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text,
        parse_mode: 'Markdown',
      }),
    })

    const data = await res.json()
    if (data.ok) {
      return NextResponse.json({
        ok: true,
        message: 'Тестовое уведомление успешно отправлено в ваш Telegram!',
      })
    } else {
      return NextResponse.json({
        ok: false,
        error: data.description || 'Не удалось отправить сообщение в Telegram.',
      }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e?.message || 'Ошибка сети при отправке уведомления.',
    }, { status: 500 })
  }
}
