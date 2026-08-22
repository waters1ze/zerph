/**
 * POST /api/payment/yoomoney — ЮMoney Webhook Notification Endpoint
 * Receives payment confirmations from ЮMoney and activates user Premium subscription.
 *
 * Security:
 * - SHA-1 notification signature is REQUIRED (env YOOMONEY_NOTIFICATION_SECRET).
 * - Only `payment-confirm` notifications are processed.
 * - `codepro=true` (protected payments) are rejected.
 * - label must match `<chatId>_30` or `<chatId>_365`.
 * - amount must match the expected plan price.
 * - operation_id is deduplicated to prevent replay.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/backend/prisma'
import { activateUserSubscription } from '@/lib/backend/db'
import { secretsMatch } from '@/lib/backend/auth'
import { findPaymentProduct, PLAN_NAMES_RU, PLAN_CATALOG, PlanId } from '@/lib/backend/plans'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const YOOMONEY_SECRET = process.env.YOOMONEY_NOTIFICATION_SECRET || process.env.YOOMONEY_CLIENT_SECRET || ''

async function sendTgNotification(chatId: string | number, text: string) {
  if (!BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    })
  } catch {}
}

/** Mark an operation as processed; returns false if it was already handled (replay). */
async function consumeOperation(operationId: string): Promise<boolean> {
  if (!operationId) return false
  try {
    await prisma.config.create({
      data: { key: `yoomoney_op_${operationId}`, value: new Date().toISOString() },
    })
    return true
  } catch (err: any) {
    // Only a unique-key violation means "already processed"; any other DB
    // error must NOT swallow the payment (previously it silently did).
    if (err?.code === 'P2002') return false
    console.error('[YooMoney] consumeOperation DB error (allowing retry):', err)
    return true
  }
}

/**
 * Release a consumed replay-guard key so the provider's retry can reprocess
 * the payment after a transient activation failure (money taken, plan not
 * granted). Best-effort: if release fails we still return 500 to trigger retry.
 */
async function releaseOperation(operationId: string): Promise<void> {
  if (!operationId) return
  try {
    await prisma.config.delete({ where: { key: `yoomoney_op_${operationId}` } })
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text()
    const params = new URLSearchParams(text)

    const notification_type = params.get('notification_type') || ''
    const operation_id = params.get('operation_id') || ''
    const amount = params.get('amount') || ''
    const currency = params.get('currency') || ''
    const datetime = params.get('datetime') || ''
    const sender = params.get('sender') || ''
    const codepro = params.get('codepro') || 'false'
    const label = params.get('label') || ''
    const sha1_hash = params.get('sha1_hash') || ''

    if (!YOOMONEY_SECRET) {
      console.error('[YooMoney] YOOMONEY_NOTIFICATION_SECRET is not configured — rejecting notification')
      return new Response('Not configured', { status: 503 })
    }

    // Only successful payment confirmations activate subscriptions
    if (notification_type !== 'payment-confirm') {
      return new Response('Ignored', { status: 200 })
    }

    // Protected (codepro) payments can later be cancelled by the sender — reject
    if (codepro === 'true') {
      console.warn('[YooMoney] Rejected codepro payment', { operation_id })
      return new Response('Ignored', { status: 200 })
    }

    if (!sha1_hash) {
      return new Response('Forbidden', { status: 403 })
    }

    // MANDATORY signature verification.
    // YOOMONEY_NOTIFICATION_SECRET_OLD is accepted temporarily during
    // secret rotation (set it to the previous value while switching to a
    // new one, then remove it after a day or two).
    const candidateSecrets = [YOOMONEY_SECRET, process.env.YOOMONEY_NOTIFICATION_SECRET_OLD]
      .filter((s): s is string => Boolean(s))
    const signatureValid = candidateSecrets.some(secret => {
      const checkString = `${notification_type}&${operation_id}&${amount}&${currency}&${datetime}&${sender}&${codepro}&${secret}&${label}`
      const calculatedHash = crypto.createHash('sha1').update(checkString).digest('hex')
      return secretsMatch(calculatedHash, sha1_hash)
    })
    if (!signatureValid) {
      console.warn('[YooMoney] Signature mismatch for operation', operation_id || '(no id)')
      return new Response('Forbidden', { status: 403 })
    }

    if (!label) {
      return new Response('Missing label', { status: 400 })
    }

    // Replay protection
    if (!(await consumeOperation(operation_id))) {
      console.warn('[YooMoney] Duplicate operation ignored', operation_id)
      return new Response('OK', { status: 200 })
    }

    // ── Extension purchase handling: label starts with ext_ ──
    if (label.startsWith('ext_')) {
      const pendingRec = await prisma.config.findUnique({
        where: { key: `ext_pending_${label}` },
      })

      if (!pendingRec) {
        console.warn('[YooMoney] Pending extension order not found for label:', label)
        return new Response('OK', { status: 200 })
      }

      try {
        const order = JSON.parse(pendingRec.value)
        const { extensionId, buyerChatId, authorChatId, price } = order
        const amtNum = parseFloat(amount)

        if (isNaN(amtNum) || amtNum < price) {
          console.warn('[YooMoney] Extension payment amount below required price', { label, amount, price })
          return new Response('OK', { status: 200 })
        }

        // 1. Grant extension to buyer (installed + enabled)
        let installed: string[] = []
        try {
          const instRow = await prisma.config.findUnique({ where: { key: `user_extensions_${buyerChatId}` } })
          installed = instRow?.value ? JSON.parse(instRow.value) : []
        } catch {}
        if (!installed.includes(extensionId)) {
          installed.push(extensionId)
          await prisma.config.upsert({
            where: { key: `user_extensions_${buyerChatId}` },
            update: { value: JSON.stringify(installed) },
            create: { key: `user_extensions_${buyerChatId}`, value: JSON.stringify(installed) },
          })
        }

        let enabled: string[] = []
        try {
          const enRow = await prisma.config.findUnique({ where: { key: `user_enabled_extensions_${buyerChatId}` } })
          enabled = enRow?.value ? JSON.parse(enRow.value) : []
        } catch {}
        if (!enabled.includes(extensionId)) {
          enabled.push(extensionId)
          await prisma.config.upsert({
            where: { key: `user_enabled_extensions_${buyerChatId}` },
            update: { value: JSON.stringify(enabled) },
            create: { key: `user_enabled_extensions_${buyerChatId}`, value: JSON.stringify(enabled) },
          })
        }

        // Increment extension install count in catalog
        try {
          const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
          if (extRec?.value) {
            const parsed = JSON.parse(extRec.value)
            parsed.installCount = (parsed.installCount || 0) + 1
            await prisma.config.update({
              where: { key: `zerf_ext_${extensionId}` },
              data: { value: JSON.stringify(parsed) },
            })
          }
        } catch {}

        const finalAuthorShare = order.authorShare ?? Math.round(price * 0.80)
        const finalPlatformShare = order.platformShare ?? (price - finalAuthorShare)

        // 2. Record permanent purchase
        await prisma.config.create({
          data: {
            key: `ext_purchase_${extensionId}_${buyerChatId}`,
            value: JSON.stringify({
              extensionId,
              buyerChatId,
              authorChatId,
              price,
              authorShare: finalAuthorShare,
              platformShare: finalPlatformShare,
              operationId: operation_id,
              purchasedAt: datetime || new Date().toISOString(),
            }),
          },
        }).catch(() => {})

        // 3. Credit author share (80% to author)
        if (authorChatId && authorChatId !== 'system') {
          let authorStats = { balance: 0, totalEarned: 0, salesCount: 0 }
          try {
            const aRow = await prisma.config.findUnique({ where: { key: `author_balance_${authorChatId}` } })
            if (aRow?.value) authorStats = JSON.parse(aRow.value)
          } catch {}

          authorStats.balance += finalAuthorShare
          authorStats.totalEarned += finalAuthorShare
          authorStats.salesCount += 1

          await prisma.config.upsert({
            where: { key: `author_balance_${authorChatId}` },
            update: { value: JSON.stringify(authorStats) },
            create: { key: `author_balance_${authorChatId}`, value: JSON.stringify(authorStats) },
          })

          // Check author's payout wallet / card
          let cardInfoText = ''
          try {
            const cardRow = (await prisma.config.findUnique({ where: { key: `author_payout_card_${authorChatId}` } }))
              || (await prisma.config.findUnique({ where: { key: `user_payment_card_${authorChatId}` } }))
            if (cardRow?.value) {
              const card = JSON.parse(cardRow.value)
              const mask = card.payoutType === 'yoomoney'
                ? `🟣 ЮMoney (${card.cardNumber ? '•••• ' + card.cardNumber.slice(-4) : 'Кошелёк'})`
                : `💳 Карту (•••• ${card.cardNumber ? card.cardNumber.slice(-4) : '••••'})`
              cardInfoText = `\n💳 *Авто-выплата*: направлена на ваш ${mask}`
            }
          } catch {}

          await sendTgNotification(
            authorChatId,
            `🎉 *Покупка вашего расширения!*\n\n` +
            `Пользователь приобрёл ваше расширение за *${price} ₽* в Zerf Note.\n` +
            `💰 *Ваш доход (80%): +${finalAuthorShare} ₽*${cardInfoText}\n` +
            `• Проверить баланс и историю: https://zeprh.vercel.app/developer?tab=earnings`
          )

          // Notify platform owner (20% platform share)
          const adminChatId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || '1177651034'
          if (adminChatId && String(adminChatId) !== String(authorChatId)) {
            await sendTgNotification(
              adminChatId,
              `💎 *Доход платформы с продажи расширения (20%)*\n\n` +
              `• Расширение: \`${extensionId}\`\n` +
              `• Сумма покупки: *${price} ₽*\n` +
              `• Выплата автору (80%): +${finalAuthorShare} ₽\n` +
              `💰 *Комиссия платформы (20%): +${finalPlatformShare} ₽*`
            )
          }
        }

        // 4. Notify buyer
        await sendTgNotification(
          buyerChatId,
          `🎉 *Расширение успешно оплачено и добавлено!* ✨\n\n` +
          `Расширение активировано в вашем аккаунте Zerf Note.\n` +
          `• Открыть: https://zeprh.vercel.app/?view=extensions`
        )

        // 5. Delete pending record
        await prisma.config.delete({ where: { key: `ext_pending_${label}` } }).catch(() => {})

        return new Response('OK', { status: 200 })
      } catch (extErr) {
        console.error('[YooMoney] Error processing extension purchase:', extErr)
        return new Response('OK', { status: 200 })
      }
    }

    // Strict label format: <chatId>_<product suffix> (plus30/pro365/…, legacy 30/365)
    const product = findPaymentProduct(label)
    if (!product) {
      console.warn('[YooMoney] Unexpected label format', label)
      return new Response('OK', { status: 200 })
    }

    const buyerChatId = product.buyerChatId || label.split('_')[0]
    const amtNum = parseFloat(amount)

    // Promo-discounted checkouts legitimately pay below the catalog price.
    // Recompute the expected minimum from the buyer's ACTIVATED discount
    // (re-validating that the promo is still active) instead of rejecting.
    let expectedMin = product.minAmount
    let appliedDiscountKey: string | null = null
    const discountKey = `user_promo_discount_${buyerChatId}`
    const discountRow = await prisma.config.findUnique({ where: { key: discountKey } }).catch(() => null)
    if (!product.isGift && discountRow?.value) {
      try {
        const dInfo = JSON.parse(discountRow.value)
        const promoRow = dInfo.code
          ? await prisma.promoCode.findUnique({ where: { code: String(dInfo.code).toUpperCase() } })
          : null
        const promoStillValid = promoRow?.isActive && (!promoRow.expiresAt || new Date(promoRow.expiresAt) > new Date())
        if (dInfo.discountPercent && promoStillValid && (dInfo.targetPlan === 'all' || dInfo.targetPlan === product.plan)) {
          const catalogEntry = PLAN_CATALOG.find(c => c.id === product.plan)
          const basePrice = (product.days === 365 ? catalogEntry?.priceYearly : catalogEntry?.priceMonthly)
          if (basePrice) {
            expectedMin = Math.max(1, Math.round(basePrice * (1 - Number(dInfo.discountPercent) / 100)))
            appliedDiscountKey = discountKey
          }
        }
      } catch {}
    }

    if (isNaN(amtNum) || amtNum < expectedMin) {
      console.warn('[YooMoney] Amount below plan price', { label, amount, product: product.labelSuffix, expectedMin })
      return new Response('OK', { status: 200 })
    }

    const planName = PLAN_NAMES_RU[product.plan as PlanId] || 'Plus'
    const periodName = product.days === 365 ? '1 год (365 дней)' : '30 дней'

    if (product.isGift) {
      // ── Gift purchase: generate a unique promo code and send to buyer ──
      const giftCode = `GIFT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`
      await prisma.promoCode.create({
        data: {
          code: giftCode,
          discountPercent: 100,
          targetPlan: product.plan,
          durationDays: product.days,
          maxActivations: 1,
          usedCount: 0,
          usedByChatIds: [],
          isActive: true,
        },
      })

      // Store buyer association in Config
      await prisma.config.create({
        data: {
          key: `gift_buyer_${giftCode}`,
          value: JSON.stringify({ buyerChatId, plan: product.plan, days: product.days, createdAt: new Date().toISOString() }),
        },
      }).catch(() => {})

      // Store payment record for analytics
      await prisma.config.create({
        data: {
          key: `payment_record_${operation_id}`,
          value: JSON.stringify({
            operationId: operation_id,
            amount: amtNum,
            plan: product.plan,
            days: product.days,
            chatId: buyerChatId,
            isGift: true,
            createdAt: datetime || new Date().toISOString(),
          }),
        },
      }).catch(() => {})

      await sendTgNotification(
        buyerChatId,
        `🎁 *Подарочная подписка Zerf ${planName} (${periodName}) оформлена!*\n\n` +
        `🎟 Код подарка: \`${giftCode}\`\n\n` +
        `🔗 Быстрая ссылка для активации в боте:\n` +
        `https://t.me/zerph_bot?start=promo_${giftCode}\n\n` +
        `Отправьте этот код или ссылку другу — он сможет активировать подписку в один клик! ✨`
      )

      return new Response('OK', { status: 200 })
    }

    // ── Regular personal subscription ──
    const actualChatId = buyerChatId
    const success = await activateUserSubscription(actualChatId, product.days, product.plan as 'plus' | 'pro' | 'corp')

    if (!success) {
      // Activation failed (DB error etc.): release the replay-guard so the
      // provider's retry reprocesses this payment, and answer 500 (not 200)
      // — otherwise the user pays and silently gets nothing.
      console.error('[YooMoney] Subscription activation failed, releasing operation for retry', operation_id)
      await releaseOperation(operation_id)
      return new Response('Activation Failed', { status: 500 })
    }

    if (success) {
      // A discount is single-use: burn it once the paid subscription is live
      if (appliedDiscountKey) {
        await prisma.config.delete({ where: { key: appliedDiscountKey } }).catch(() => {})
      }

      // Store payment record for analytics
      await prisma.config.create({
        data: {
          key: `payment_record_${operation_id}`,
          value: JSON.stringify({
            operationId: operation_id,
            amount: amtNum,
            plan: product.plan,
            days: product.days,
            chatId: actualChatId,
            isGift: false,
            createdAt: datetime || new Date().toISOString(),
          }),
        },
      }).catch(() => {})

      await sendTgNotification(
        actualChatId,
        `🎉 *Подписка Zerf ${planName} успешно активирована на ${periodName}!* ⭐\n\n` +
        `✨ Спасибо за поддержку Zerf AI — ваш тариф обновлён!\n` +
        `• 📋 Управлять подпиской: /settings`
      )

      // ── Referral bonus: if the paying user was referred, reward the referrer once ──
      try {
        const paidUserRecord = await prisma.telegramChat.findUnique({
          where: { chatId: BigInt(actualChatId) },
          select: { referredBy: true, referralRewarded: true },
        })
        if (paidUserRecord?.referredBy && !paidUserRecord.referralRewarded) {
          // Atomic claim first (prevents double +7 days when two webhook
          // deliveries race); only the winner grants the bonus.
          const claim = await prisma.telegramChat.updateMany({
            where: { chatId: BigInt(actualChatId), referralRewarded: false },
            data: { referralRewarded: true },
          })
          if (claim.count === 1) {
            const referrerId = paidUserRecord.referredBy
            // Grant +7 days Plus to the referrer
            await activateUserSubscription(String(referrerId), 7, 'plus')
            await sendTgNotification(
              String(referrerId),
              `🎁 *Ваш друг оформил Zerf Plus!*\n\nВам начислено *+7 дней Zerf Plus* в подарок за приглашение 🎉\n` +
              `Продолжайте приглашать друзей — за каждого получайте бонусные дни!`
            )
          }
        }
      } catch (refErr) {
        console.error('[YooMoney] Referral bonus error:', refErr)
      }
    }

    return new Response('OK', { status: 200 })
  } catch (err: unknown) {
    console.error('ЮMoney Webhook error:', err)
    return new Response('Internal Error', { status: 500 })
  }
}

export async function GET() {
  return new Response('ЮMoney Webhook Endpoint Active', { status: 200 })
}
