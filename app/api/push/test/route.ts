import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { sendWebPushNotification } from '@/lib/backend/web-push'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const title = body.title || '🔔 Zerf Note — Тестовое уведомление'
    const message = body.message || 'Пуш-уведомления успешно работают на вашем устройстве! 🎉'
    const targetChatId = authUser?.chatId || body.chatId

    let webPushResult = null
    if (targetChatId) {
      webPushResult = await sendWebPushNotification(targetChatId, {
        title,
        body: message,
        icon: '/icon-192.png',
        url: '/',
        tag: 'zerf-test-push',
      })
    }

    return NextResponse.json({
      success: true,
      title,
      message,
      webPushResult,
      timestamp: new Date().toISOString(),
      user: targetChatId ? String(targetChatId) : 'guest',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
