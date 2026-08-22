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
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    }
    const body = await req.json()
    const { subscription, endpoint, action } = body

    // Identity comes strictly from the verified session: accepting a
    // client-supplied chatId here would let anyone overwrite another
    // user's push subscription or hijack their notification stream.
    const targetChatId = authUser.chatId

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
