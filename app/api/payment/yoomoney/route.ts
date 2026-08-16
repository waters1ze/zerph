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

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const YOOMONEY_SECRET = process.env.YOOMONEY_NOTIFICATION_SECRET || process.env.YOOMONEY_CLIENT_SECRET || ''

const PLAN_PRICES: Record<string, { minAmount: number; days: number; name: string }> = {
  '30': { minAmount: 95, days: 30, name: '30 дней' },
  '365': { minAmount: 950, days: 365, name: '1 год (365 дней)' },
}

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

    // MANDATORY signature verification
    const checkString = `${notification_type}&${operation_id}&${amount}&${currency}&${datetime}&${sender}&${codepro}&${YOOMONEY_SECRET}&${label}`
    const calculatedHash = crypto.createHash('sha1').update(checkString).digest('hex')
    if (!secretsMatch(calculatedHash, sha1_hash)) {
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

    // Strict label format: <chatId>_<planDays>
    const labelMatch = label.match(/^(\d{3,20})_(30|365)$/)
    if (!labelMatch) {
      console.warn('[YooMoney] Unexpected label format', label)
      return new Response('OK', { status: 200 })
    }

    const actualChatId = labelMatch[1]
    const plan = PLAN_PRICES[labelMatch[2]]
    const amtNum = parseFloat(amount)

    if (!plan || isNaN(amtNum) || amtNum < plan.minAmount) {
      console.warn('[YooMoney] Amount below plan price', { label, amount, planDays: labelMatch[2] })
      return new Response('OK', { status: 200 })
    }

    // Activate subscription in database (extends any active subscription)
    const success = await activateUserSubscription(actualChatId, plan.days)

    if (success) {
      await sendTgNotification(
        actualChatId,
        `🎉 *Подписка Zerf Premium успешно активирована на ${plan.name}!* ⭐\n\n` +
        `✨ Вам открыт полный доступ ко всем возможностям Zerf AI:\n` +
        `• 🎙 Неограниченный голосовой ввод и интеграция с Siri (до 10 мин/день)\n` +
        `• 🧠 Безлимитное ИИ-перепланирование задач (/reschedule)\n` +
        `• 🔥 Безлимитный режим фокуса и таймеры отдыха (/focus)\n` +
        `• 📊 Полная аналитика продуктивности и недельные отчеты (/stats)\n` +
        `• 📌 Заметки и ИИ-чат без ограничений`
      )
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
