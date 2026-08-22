import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { parseStoredCard } from '@/lib/backend/crypto-box'

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

    // Supports legacy plaintext rows and new encrypted envelopes (audit M-5)
    let cardData = parseStoredCard<any>(cardRow?.value)
    // Never echo the full card/wallet number back to the client
    if (cardData?.cardNumber) {
      const n = String(cardData.cardNumber)
      cardData = { ...cardData, cardNumber: n.length <= 4 ? n : n.slice(-4) }
    }
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
      // SECURITY (audit M-5): payout details are encrypted at rest
      // (AES-256-GCM envelope) so a DB dump no longer exposes card numbers.
      const { encryptJson } = await import('@/lib/backend/crypto-box')
      const sealed = encryptJson(cardPayload)
      const storedValue = sealed || JSON.stringify(cardPayload) // fail-open only if keying is broken
      await prisma.config.upsert({
        where: { key: `user_payment_card_${chatId}` },
        update: { value: storedValue },
        create: { key: `user_payment_card_${chatId}`, value: storedValue },
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
      cardData: { ...cardPayload, cardNumber: cardPayload.cardNumber.length <= 4 ? cardPayload.cardNumber : cardPayload.cardNumber.slice(-4) },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
