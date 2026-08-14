/**
 * POST /api/payment/yoomoney — ЮMoney Webhook Notification Endpoint
 * Receives payment confirmations from ЮMoney and activates user Premium subscription
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { activateUserSubscription } from '@/lib/backend/db'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const YOOMONEY_SECRET = process.env.YOOMONEY_NOTIFICATION_SECRET || process.env.YOOMONEY_CLIENT_SECRET || 'FBA7EDCDB4EE172D4633DC95EC2E8B34B4FA0C9CECBE35C5CD2B7B1D3AD87F6D65B768B27F4044FD7655887D6C1D20D929C3126C72D84EE1402D1E7B1FD8A47B'

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

    if (!label) {
      return new Response('Missing label', { status: 400 })
    }

    // Verify SHA-1 hash if secret is present
    if (YOOMONEY_SECRET) {
      const checkString = `${notification_type}&${operation_id}&${amount}&${currency}&${datetime}&${sender}&${codepro}&${YOOMONEY_SECRET}&${label}`
      const calculatedHash = crypto.createHash('sha1').update(checkString).digest('hex')

      if (sha1_hash && calculatedHash !== sha1_hash) {
        console.warn('ЮMoney signature hash mismatch:', { calculatedHash, sha1_hash })
      }
    }

    // Determine subscription duration: 365 days for annual, 30 days for monthly
    let actualChatId = label
    let days = 30
    const amtNum = parseFloat(amount || '0')

    if (label.includes('_365') || label.includes('_year') || amtNum >= 900) {
      days = 365
      actualChatId = label.replace('_365', '').replace('_year', '')
    } else if (label.includes('_30') || label.includes('_month')) {
      days = 30
      actualChatId = label.replace('_30', '').replace('_month', '')
    }

    // Activate subscription in database
    const success = await activateUserSubscription(actualChatId, days)

    if (success) {
      const periodName = days === 365 ? '1 год (365 дней)' : '30 дней'
      await sendTgNotification(
        actualChatId,
        `🎉 *Подписка Zerf Premium успешно активирована на ${periodName}!* ⭐\n\n` +
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
