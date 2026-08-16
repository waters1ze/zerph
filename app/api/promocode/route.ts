import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

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

    // Determine target plan without downgrading unlimited users
    let targetPlan = promo.targetPlan === 'unlimited' ? 'unlimited' : 'premium'
    if (user?.plan === 'unlimited' && targetPlan === 'premium') {
      targetPlan = 'unlimited'
    }

    const daysToAdd = promo.durationDays || 30

    let newExpiry = new Date()
    if (user?.subscriptionExpiry && user.subscriptionExpiry > new Date()) {
      newExpiry = new Date(user.subscriptionExpiry.getTime() + daysToAdd * 86400000)
    } else {
      newExpiry = new Date(Date.now() + daysToAdd * 86400000)
    }

    // Update user subscription & plan
    await prisma.telegramChat.upsert({
      where: { chatId: numericChatId },
      update: {
        plan: targetPlan,
        subscriptionExpiry: newExpiry,
      },
      create: {
        chatId: numericChatId,
        plan: targetPlan,
        subscriptionExpiry: newExpiry,
      },
    })

    // Record promo code activation
    await prisma.promoCode.update({
      where: { id: promo.id },
      data: {
        usedCount: { increment: 1 },
        usedByChatIds: { push: strChatId },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Промокод успешно активирован! Тариф «${targetPlan === 'unlimited' ? 'Безлимит' : 'Premium'}» продлен на ${daysToAdd} дн.`,
      plan: targetPlan,
      expiresAt: newExpiry.toISOString(),
      discountPercent: promo.discountPercent,
    })
  } catch (error: any) {
    console.error('Promo activation error:', error)
    return NextResponse.json({ error: error.message || 'Ошибка активации' }, { status: 500 })
  }
}
