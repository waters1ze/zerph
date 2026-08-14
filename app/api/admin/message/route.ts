import { NextRequest, NextResponse } from 'next/server'
import { isCallerAdmin } from '@/lib/backend/admin'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await isCallerAdmin(req)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access Denied: Admin role required' }, { status: 403 })
    }

    if (!BOT_TOKEN) {
      return NextResponse.json({ error: 'Telegram Bot Token not configured' }, { status: 500 })
    }

    const body = await req.json()
    const { targetChatId, text } = body

    if (!targetChatId || !text) {
      return NextResponse.json({ error: 'targetChatId and text are required' }, { status: 400 })
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        parse_mode: 'Markdown',
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      return NextResponse.json({ error: data.description || 'Failed to send message' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Сообщение успешно отправлено' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
