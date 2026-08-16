import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'

export async function POST(req: NextRequest) {
  try {
    const { code, chatId } = await req.json()

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Введите промокод' }, { status: 400 })
    }

    if (!chatId) {
      return NextResponse.json({ error: 'Не удалось определить пользователя' }, { status: 400 })
    }

    const cleanCode = code.trim().toUpperCase()
    const numericChatId = BigInt(String(chatId).replace(/\D/g, '') || '0')
    const strChatId = String(chatId)

    if (!numericChatId) {
      return NextResponse.json({ error: 'Неверный ID пользователя' }, { status: 400 })
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

    if (promo.usedByChatIds.includes(strChatId)) {
      return NextResponse.json({ error: 'Вы уже активировали этот промокод' }, { status: 400 })
    }

    // Determine target plan
    const targetPlan = promo.targetPlan === 'unlimited' ? 'unlimited' : 'premium'
    const daysToAdd = promo.durationDays || 30

    const user = await prisma.telegramChat.findUnique({
      where: { chatId: numericChatId },
    })

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
