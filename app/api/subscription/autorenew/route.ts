import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const chatId = authUser.chatId

    const [cardRow, arRow, chatRow] = await Promise.all([
      prisma.config.findUnique({ where: { key: `user_payment_card_${chatId}` } }),
      prisma.config.findUnique({ where: { key: `user_autorenew_${chatId}` } }),
      prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } }),
    ])

    const cardData = cardRow?.value ? JSON.parse(cardRow.value) : null
    // Auto-renew defaults to false (OFF) as requested
    const autoRenew = arRow?.value ? arRow.value === 'true' : false
    const currentPlan = (chatRow?.plan || 'free').toLowerCase()

    return NextResponse.json({
      success: true,
      autoRenew,
      cardData,
      currentPlan,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const chatId = authUser.chatId

    const body = await req.json().catch(() => ({}))
    const { autoRenew, payoutType = 'card', cardNumber, phone, bankName, recipientName } = body

    const isAutoRenew = Boolean(autoRenew)

    const cardPayload = {
      payoutType: payoutType || 'card',
      cardNumber: cardNumber ? String(cardNumber).replace(/\s+/g, '') : '',
      phone: phone ? String(phone).trim() : '',
      bankName: bankName ? String(bankName).trim() : '',
      recipientName: recipientName ? String(recipientName).trim() : '',
      updatedAt: new Date().toISOString(),
    }

    if (cardPayload.cardNumber || cardPayload.phone) {
      await prisma.config.upsert({
        where: { key: `user_payment_card_${chatId}` },
        update: { value: JSON.stringify(cardPayload) },
        create: { key: `user_payment_card_${chatId}`, value: JSON.stringify(cardPayload) },
      })
    }

    await prisma.config.upsert({
      where: { key: `user_autorenew_${chatId}` },
      update: { value: isAutoRenew ? 'true' : 'false' },
      create: { key: `user_autorenew_${chatId}`, value: isAutoRenew ? 'true' : 'false' },
    })

    return NextResponse.json({
      success: true,
      autoRenew: isAutoRenew,
      cardData: cardPayload,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
