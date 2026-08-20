import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { getVapidPublicKey, saveUserPushSubscription, removeUserPushSubscription } from '@/lib/backend/web-push'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const publicKey = await getVapidPublicKey()
    return NextResponse.json({ success: true, publicKey })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const body = await req.json()
    const { subscription, endpoint, action, chatId: bodyChatId } = body

    const targetChatId = authUser?.chatId || bodyChatId
    if (!targetChatId) {
      return NextResponse.json({ error: 'Chat ID required' }, { status: 400 })
    }

    if (action === 'unsubscribe' && (endpoint || subscription?.endpoint)) {
      const ep = endpoint || subscription.endpoint
      await removeUserPushSubscription(targetChatId, ep)
      return NextResponse.json({ success: true, message: 'Push subscription removed' })
    }

    if (subscription) {
      await saveUserPushSubscription(targetChatId, subscription)
    }

    return NextResponse.json({ success: true, message: 'Push subscription saved for device' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
