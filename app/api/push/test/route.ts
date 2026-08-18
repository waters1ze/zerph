import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const title = body.title || '🔔 Zerf Note — Тестовое уведомление'
    const message = body.message || 'Пуш-уведомления успешно работают на вашем устройстве! 🎉'

    return NextResponse.json({
      success: true,
      title,
      message,
      timestamp: new Date().toISOString(),
      user: authUser?.chatId ? String(authUser.chatId) : 'guest',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
