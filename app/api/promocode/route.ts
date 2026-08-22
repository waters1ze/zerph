import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { PLAN_RANK, PLAN_NAMES_RU, normalizePlan } from '@/lib/backend/plans'

export async function POST(req: NextRequest) {
  try {
    // Identity comes strictly from the authenticated session — never from the body
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Требуется вход в аккаунт' }, { status: 401 })
    }

    const { code } = await req.json()

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Введите промокод' }, { status: 400 })
    }

    const strChatId = authUser.chatId
    const numericChatId = BigInt(strChatId)

    const cleanCode = code.trim().toUpperCase()

    // Basic rate limiting: max 10 activation attempts per 5 minutes per user
    const recentKey = `promo_attempts_${strChatId}`
    const recent = await prisma.config.findUnique({ where: { key: recentKey } })
    const now = Date.now()
    if (recent) {
      const attempts: number[] = JSON.parse(recent.value || '[]').filter((t: number) => now - t < 5 * 60 * 1000)
      if (attempts.length >= 10) {
        return NextResponse.json({ error: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 })
      }
      attempts.push(now)
      await prisma.config.update({ where: { key: recentKey }, data: { value: JSON.stringify(attempts) } })
    } else {
      await prisma.config.create({ data: { key: recentKey, value: JSON.stringify([now]) } }).catch(() => {})
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: cleanCode },
    })

    if (!promo || !promo.isActive) {
      return NextResponse.json({ error: 'Промокод не найден или недействителен' }, { status: 404 })
    }

    if (promo.expiresAt && new Date() > promo.expiresAt) {
      return NextResponse.json({ error: 'Срок действия промокода истёк' }, { status: 400 })
    }

    if (promo.usedCount >= promo.maxActivations) {
      return NextResponse.json({ error: 'Лимит активаций этого промокода исчерпан' }, { status: 400 })
    }

    const usedList = promo.usedByChatIds || []
    if (usedList.includes(strChatId)) {
      return NextResponse.json({ error: 'Вы уже активировали этот промокод' }, { status: 400 })
    }

    const user = await prisma.telegramChat.findUnique({
      where: { chatId: numericChatId },
    })

    const userCurrentPlan = normalizePlan(user?.plan)
    const isUserSubActive = Boolean(user?.subscriptionExpiry && user.subscriptionExpiry > new Date())
    const userPlanRank = isUserSubActive ? (PLAN_RANK[userCurrentPlan] || 0) : 0

    // Determine target plan for this promo code
    const promoPlanRaw = (promo.targetPlan || 'all').toLowerCase()
    let promoTargetPlan: 'plus' | 'pro' | 'corp' | 'all'
    if (promoPlanRaw === 'corp' || promoPlanRaw === 'unlimited') promoTargetPlan = 'corp'
    else if (promoPlanRaw === 'plus' || promoPlanRaw === 'premium') promoTargetPlan = 'plus'
    else if (promoPlanRaw === 'pro') promoTargetPlan = 'pro'
    else promoTargetPlan = 'all'

    // Strict validation: If user has an active higher-tier plan, REJECT the lower promo code!
    if (isUserSubActive && promoTargetPlan !== 'all') {
      const promoRank = PLAN_RANK[promoTargetPlan] || 0
      if (userPlanRank > promoRank) {
        const userPlanName = PLAN_NAMES_RU[userCurrentPlan] || userCurrentPlan.toUpperCase()
        const promoPlanName = PLAN_NAMES_RU[promoTargetPlan] || promoTargetPlan.toUpperCase()
        return NextResponse.json({
          error: `Данный промокод предназначен для тарифа «${promoPlanName}». У вас уже активен более высокий тариф «${userPlanName}» — промокод не подходит для продления вашей текущей подписки.`,
        }, { status: 400 })
      }
    }

    let targetPlan: 'plus' | 'pro' | 'corp'
    if (promoTargetPlan === 'all') {
      targetPlan = isUserSubActive && userCurrentPlan !== 'free' ? (userCurrentPlan as 'plus' | 'pro' | 'corp') : 'pro'
    } else {
      targetPlan = promoTargetPlan
    }

    const daysToAdd = promo.durationDays || 30
    const isFullFree = !promo.discountPercent || promo.discountPercent === 100

    if (isFullFree) {
      // ── 100% FREE ACTIVATION: Instantly grant/extend subscription ──

      // Atomically consume one activation slot BEFORE granting anything.
      // updateMany enforces maxActivations and per-user reuse in a single
      // conditional write, closing the check-then-act race that previously
      // let two parallel requests exceed maxActivations.
      const consumed = await prisma.promoCode.updateMany({
        where: {
          id: promo.id,
          isActive: true,
          usedCount: { lt: promo.maxActivations },
          NOT: { usedByChatIds: { has: strChatId } },
        },
        data: {
          usedCount: { increment: 1 },
          usedByChatIds: { push: strChatId },
        },
      })
      if (consumed.count === 0) {
        return NextResponse.json({ error: 'Лимит активаций этого промокода исчерпан' }, { status: 400 })
      }

      let newExpiry = new Date()
      if (user?.subscriptionExpiry && user.subscriptionExpiry > new Date()) {
        newExpiry = new Date(user.subscriptionExpiry.getTime() + daysToAdd * 86400000)
      } else {
        newExpiry = new Date(Date.now() + daysToAdd * 86400000)
      }

      // Update user subscription & plan (activateUserSubscription-grade
      // anti-downgrade: keep a higher active tier, only extend the expiry)
      await prisma.telegramChat.upsert({
        where: { chatId: numericChatId },
        update: {
          plan: userPlanRank > (PLAN_RANK[targetPlan] || 0) && isUserSubActive ? userCurrentPlan : targetPlan,
          subscriptionExpiry: newExpiry,
        },
        create: {
          chatId: numericChatId,
          plan: targetPlan,
          subscriptionExpiry: newExpiry,
        },
      })

      return NextResponse.json({
        success: true,
        message: `🎉 Промокод активирован! Тариф «${PLAN_NAMES_RU[targetPlan]}» предоставлен бесплатно на ${daysToAdd} дн.`,
        plan: targetPlan,
        expiresAt: newExpiry.toISOString(),
        discountPercent: 100,
        isFree: true,
      })
    } else {
      // ── PARTIAL DISCOUNT (e.g. 30%, 50% off): Save discount for checkout ──

      // Discount codes must be consumed exactly like free codes — otherwise
      // maxActivations is never reached and the same code can arm a discount
      // for an unlimited number of accounts.
      const consumedDiscount = await prisma.promoCode.updateMany({
        where: {
          id: promo.id,
          isActive: true,
          usedCount: { lt: promo.maxActivations },
          NOT: { usedByChatIds: { has: strChatId } },
        },
        data: {
          usedCount: { increment: 1 },
          usedByChatIds: { push: strChatId },
        },
      })
      if (consumedDiscount.count === 0) {
        return NextResponse.json({ error: 'Лимит активаций этого промокода исчерпан' }, { status: 400 })
      }

      const discountKey = `user_promo_discount_${strChatId}`
      const discountPayload = {
        code: cleanCode,
        discountPercent: promo.discountPercent,
        targetPlan: promo.targetPlan,
        durationDays: promo.durationDays,
        activatedAt: new Date().toISOString(),
      }
      await prisma.config.upsert({
        where: { key: discountKey },
        update: { value: JSON.stringify(discountPayload) },
        create: { key: discountKey, value: JSON.stringify(discountPayload) },
      })

      return NextResponse.json({
        success: true,
        message: `🎉 Промокод применён! Вы получили скидку ${promo.discountPercent}% на тариф «${promo.targetPlan === 'all' ? 'Любой' : promo.targetPlan.toUpperCase()}». Скидка будет учтена при оформлении подписки.`,
        discountPercent: promo.discountPercent,
        targetPlan: promo.targetPlan,
        isFree: false,
      })
    }
  } catch (error: any) {
    console.error('Promo activation error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка активации' }, { status: 500 })
  }
}
