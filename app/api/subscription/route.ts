/**
 * GET  /api/subscription — Get current user usage limits & subscription status
 * POST /api/subscription — Create ЮMoney payment link (99 RUB)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserUsageAndLimits } from '@/lib/backend/db'

import { verifyUserAuth } from '@/lib/backend/auth'

function getOwnerChatId(req: NextRequest): string | null {
  const { searchParams } = new URL(req.url)
  const chatId = req.headers.get('x-chat-id') || searchParams.get('chatId') || null
  const token = req.headers.get('x-auth-token') || searchParams.get('token') || null
  const initData = req.headers.get('x-tg-init-data') || null
  
  if (!chatId) return null
  if (!verifyUserAuth(chatId, token, initData)) return null
  return chatId
}

export async function GET(req: NextRequest) {
  try {
    const ownerChatId = getOwnerChatId(req)
    if (!ownerChatId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const usage = await getUserUsageAndLimits(ownerChatId)
    return NextResponse.json(usage)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ownerChatId = getOwnerChatId(req)
    if (!ownerChatId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await req.json().catch(() => ({}))

    if (!ownerChatId) {
      return NextResponse.json({ error: 'ownerChatId is required' }, { status: 400 })
    }

    const receiver = process.env.YOOMONEY_RECEIVER || '4100119573095433'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
    const successUrl = `${appUrl}/?payment=success`

    // ЮMoney QuickPay form parameters
    const params = new URLSearchParams({
      receiver: receiver,
      'quickpay-form': 'shop',
      targets: 'Подписка Zerf Premium (30 дней)',
      paymentType: 'AC', // Allows Bank card or ЮMoney
      sum: '99',
      label: String(ownerChatId),
      successURL: successUrl,
    })

    const paymentUrl = `https://yoomoney.ru/quickpay/confirm?${params.toString()}`

    return NextResponse.json({
      success: true,
      paymentUrl,
      amount: 99,
      currency: 'RUB',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
