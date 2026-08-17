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
import { findPaymentProduct, PLAN_NAMES_RU, PlanId } from '@/lib/backend/plans'

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
  } catch {
    // Unique key violation -> already processed
    return false
  }
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
        const { extensionId, buyerChatId, authorChatId, price, authorShare, platformShare } = order
        const amtNum = parseFloat(amount)

        if (isNaN(amtNum) || amtNum < price) {
          console.warn('[YooMoney] Extension payment amount below required price', { label, amount, price })
          return new Response('OK', { status: 200 })
        }

        // 1. Grant extension to buyer
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

        // Enable extension
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

        // 2. Record permanent purchase
        await prisma.config.create({
          data: {
            key: `ext_purchase_${extensionId}_${buyerChatId}`,
            value: JSON.stringify({
              extensionId,
              buyerChatId,
              authorChatId,
              price,
              authorShare,
              platformShare,
              operationId: operation_id,
              purchasedAt: datetime || new Date().toISOString(),
            }),
          },
        }).catch(() => {})

        // 3. Credit author share (80%)
        if (authorChatId && authorChatId !== 'system') {
          let authorStats = { balance: 0, totalEarned: 0, salesCount: 0 }
          try {
            const aRow = await prisma.config.findUnique({ where: { key: `author_balance_${authorChatId}` } })
            if (aRow?.value) authorStats = JSON.parse(aRow.value)
          } catch {}

          authorStats.balance += authorShare
          authorStats.totalEarned += authorShare
          authorStats.salesCount += 1

          await prisma.config.upsert({
            where: { key: `author_balance_${authorChatId}` },
            update: { value: JSON.stringify(authorStats) },
            create: { key: `author_balance_${authorChatId}`, value: JSON.stringify(authorStats) },
          })

          await sendTgNotification(
            authorChatId,
            `🎉 *Покупка вашего расширения!*\n\n` +
            `Пользователь приобрёл ваше расширение за *${price} ₽* в Zerf Note.\n` +
            `Вам начислено *+${authorShare} ₽* (80%) на баланс автора! 💰\n` +
            `• Проверить баланс и запросить вывод: https://zeprh.vercel.app`
          )
        }

        // 4. Notify buyer
        await sendTgNotification(
          buyerChatId,
          `🎉 *Расширение успешно оплачено и добавлено!* ✨\n\n` +
          `Расширение активировано в вашем аккаунте Zerf Note.\n` +
          `• Открыть: https://zeprh.vercel.app`
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

    if (isNaN(amtNum) || amtNum < product.minAmount) {
      console.warn('[YooMoney] Amount below plan price', { label, amount, product: product.labelSuffix })
      return new Response('OK', { status: 200 })
    }

    const planName = PLAN_NAMES_RU[product.plan as PlanId] || 'Plus'
    const periodName = product.days === 365 ? '1 год (365 дней)' : '30 дней'

    if (product.isGift) {
      // ── Gift purchase: generate a unique promo code and send to buyer ──
      const giftCode = `GIFT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
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

    if (success) {
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
          const referrerId = paidUserRecord.referredBy
          // Grant +7 days Plus to the referrer
          await activateUserSubscription(String(referrerId), 7, 'plus')
          // Mark as rewarded to prevent double-rewarding
          await prisma.telegramChat.update({
            where: { chatId: BigInt(actualChatId) },
            data: { referralRewarded: true },
          })
          await sendTgNotification(
            String(referrerId),
            `🎁 *Ваш друг оформил Zerf Plus!*\n\nВам начислено *+7 дней Zerf Plus* в подарок за приглашение 🎉\n` +
            `Продолжайте приглашать друзей — за каждого получайте бонусные дни!`
          )
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
