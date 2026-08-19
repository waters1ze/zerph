/**
 * GET  /api/subscription — Get current user usage limits & subscription status
 * POST /api/subscription — Create ЮMoney payment link (99 RUB)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserUsageAndLimits } from '@/lib/backend/db'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { PAYMENT_PRODUCTS, PLAN_CATALOG } from '@/lib/backend/plans'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    const ownerChatId = authUser.chatId
    
    const usage = await getUserUsageAndLimits(ownerChatId)
    const chat = await prisma.telegramChat.findUnique({
      where: { chatId: BigInt(ownerChatId) },
      select: { firstName: true, lastName: true, username: true, email: true }
    })
    const displayName = [chat?.firstName, chat?.lastName].filter(Boolean).join(' ') || chat?.username || chat?.email?.split('@')[0] || `Пользователь #${ownerChatId}`

    return NextResponse.json({
      ...usage,
      chatId: String(ownerChatId),
      name: displayName,
      username: chat?.username || null,
    })
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

    // Plan products: plus (99 ₽/мес, 1009 ₽/год) | pro (299 ₽/мес, 3049 ₽/год)
    const plan = body.plan === 'pro' ? 'pro' : 'plus'
    const isYear = body.period === 'year' || body.period === 'annual' || body.duration === 'year'
    const product = PAYMENT_PRODUCTS.find(p => p.plan === plan && p.days === (isYear ? 365 : 30))
    if (!product) {
      return NextResponse.json({ error: 'Unknown plan or period' }, { status: 400 })
    }

    // Check if user has an active applied promo discount
    let discountPercent = 0
    let promoCodeUsed: string | null = null
    const discountKey = `user_promo_discount_${ownerChatId}`
    const activeDiscountRow = await prisma.config.findUnique({ where: { key: discountKey } })
    if (activeDiscountRow?.value) {
      try {
        const dInfo = JSON.parse(activeDiscountRow.value)
        if (dInfo.discountPercent && (dInfo.targetPlan === 'all' || dInfo.targetPlan === plan)) {
          discountPercent = Number(dInfo.discountPercent) || 0
          promoCodeUsed = dInfo.code || null
        }
      } catch {}
    }

    const catalogEntry = PLAN_CATALOG.find(c => c.id === plan)
    if (!catalogEntry) {
      return NextResponse.json({ error: 'Тарифный план не найден' }, { status: 400 })
    }

    const basePrice = (isYear ? catalogEntry.priceYearly : catalogEntry.priceMonthly) ?? 0
    const finalPrice = discountPercent > 0
      ? Math.max(1, Math.round(basePrice * (1 - discountPercent / 100)))
      : basePrice

    const sum = String(finalPrice)
    const targets = discountPercent > 0
      ? `Подписка Zerf ${catalogEntry.name} (${isYear ? '1 год' : '30 дней'}, промокод: -${discountPercent}%)`
      : isYear
        ? `Подписка Zerf ${catalogEntry.name} на 1 год (со скидкой 15%)`
        : `Подписка Zerf ${catalogEntry.name} (30 дней)`
    const label = `${ownerChatId}_${product.labelSuffix}`

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
      basePrice,
      discountPercent,
      plan,
      period: isYear ? 'year' : 'month',
      days: isYear ? 365 : 30,
      currency: 'RUB',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
