import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

import { getVapidPublicKey } from '@/lib/backend/web-push'

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
    const { subscription, chatId: bodyChatId } = body

    const targetChatId = authUser?.chatId || bodyChatId
    if (!targetChatId) {
      return NextResponse.json({ error: 'Chat ID required' }, { status: 400 })
    }

    const cid = BigInt(targetChatId)

    if (subscription) {
      const key = `user_push_subscription_${cid}`
      await prisma.config.upsert({
        where: { key },
        update: { value: JSON.stringify(subscription) },
        create: { key, value: JSON.stringify(subscription) },
      })
    }

    return NextResponse.json({ success: true, message: 'Push subscription saved' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
