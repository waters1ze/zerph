/**
 * GET  /api/subscription — Get current user usage limits & subscription status
 * POST /api/subscription — Create ЮMoney payment link (99 RUB)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserUsageAndLimits } from '@/lib/backend/db'

import { getAuthenticatedUser } from '@/lib/backend/auth'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    const ownerChatId = authUser.chatId
    
    const usage = await getUserUsageAndLimits(ownerChatId)
    return NextResponse.json(usage)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    const ownerChatId = authUser.chatId
    
    const body = await req.json().catch(() => ({}))

    if (!ownerChatId) {
      return NextResponse.json({ error: 'ownerChatId is required' }, { status: 400 })
    }

    const isYear = body.period === 'year' || body.period === 'annual' || body.duration === 'year'
    const sum = isYear ? '1009' : '99'
    const targets = isYear
      ? 'Подписка Zerf Premium на 1 год (со скидкой 15%)'
      : 'Подписка Zerf Premium (30 дней)'
    const label = isYear ? `${ownerChatId}_365` : `${ownerChatId}_30`

    const receiver = process.env.YOOMONEY_RECEIVER || '4100119573095433'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
    const successUrl = `${appUrl}/?payment=success`

    // ЮMoney QuickPay form parameters
    const params = new URLSearchParams({
      receiver: receiver,
      'quickpay-form': 'shop',
      targets,
      paymentType: 'AC', // Allows Bank card or ЮMoney
      sum,
      label,
      successURL: successUrl,
    })

    const paymentUrl = `https://yoomoney.ru/quickpay/confirm?${params.toString()}`

    return NextResponse.json({
      success: true,
      paymentUrl,
      amount: Number(sum),
      period: isYear ? 'year' : 'month',
      days: isYear ? 365 : 30,
      currency: 'RUB',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
