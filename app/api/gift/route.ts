import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { PAYMENT_PRODUCTS, PLAN_CATALOG, PlanId } from '@/lib/plans'

// Same wallet default as /api/subscription — a divergent fallback wallet
// would silently send gift payments to an account whose webhook never fires
// (paid gifts would be lost).
const YOOMONEY_RECEIVER = process.env.YOOMONEY_RECEIVER || process.env.NEXT_PUBLIC_YOOMONEY_WALLET || '4100119573095433'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const chatIdStr = authUser.chatId

    // Find gifts where buyer is this user (stored in Config as gift_buyer_*)
    const giftConfigs = await prisma.config.findMany({
      where: {
        key: { startsWith: 'gift_buyer_' },
      },
    })

    const myGiftCodes: string[] = []
    for (const conf of giftConfigs) {
      try {
        const data = JSON.parse(conf.value)
        if (data.buyerChatId === chatIdStr) {
          myGiftCodes.push(conf.key.replace('gift_buyer_', ''))
        }
      } catch {}
    }

    const promos = await prisma.promoCode.findMany({
      where: {
        code: { in: myGiftCodes },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formattedGifts = promos.map(p => ({
      id: p.id,
      code: p.code,
      targetPlan: p.targetPlan,
      durationDays: p.durationDays,
      isUsed: p.usedCount >= p.maxActivations,
      usedCount: p.usedCount,
      createdAt: p.createdAt.toISOString(),
      activationUrl: `https://t.me/zerph_bot?start=promo_${p.code}`,
    }))

    return NextResponse.json({
      success: true,
      gifts: formattedGifts,
    })
  } catch (error: any) {
    console.error('[Gift API GET] Error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки подарков' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const plan: PlanId = body.plan || 'plus'
    const days: number = Number(body.days) || 30

    const product = PAYMENT_PRODUCTS.find(p => p.plan === plan && p.days === days)
    if (!product) {
      return NextResponse.json({ error: 'Неверный тариф или период' }, { status: 400 })
    }

    // Charge the full catalog price: gifts must never be cheaper than buying
    // for yourself (minAmount previously undercut the catalog by ~5%).
    const catalogEntry = PLAN_CATALOG.find(c => c.id === plan)
    const amount = (days === 365 ? catalogEntry?.priceYearly : catalogEntry?.priceMonthly) ?? product.minAmount

    const label = `gift_${authUser.chatId}_${product.labelSuffix}`

    // Form direct YooMoney payment URL
    const params = new URLSearchParams({
      receiver: YOOMONEY_RECEIVER,
      'quickpay-form': 'shop',
      targets: `Подарочная подписка Zerf ${plan.toUpperCase()} (${days} дн.)`,
      paymentType: 'AC',
      sum: String(amount),
      label: label,
      successURL: 'https://t.me/zerph_bot',
    })

    const checkoutUrl = `https://yoomoney.ru/quickpay/confirm.xml?${params.toString()}`

    return NextResponse.json({
      success: true,
      checkoutUrl,
      amount,
      plan,
      days,
    })
  } catch (error: any) {
    console.error('[Gift API POST] Error:', error)
    return NextResponse.json({ error: 'Ошибка создания ссылки оплаты подарка' }, { status: 500 })
  }
}
