/**
 * GET /api/setup — One-click setup endpoint
 * 1. Sets Telegram Webhook to Railway app URL
 * 2. Registers Telegram Bot Command Menu (/today, /goals, /notes, /help)
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const host = req.headers.get('host')
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`
  const webhookUrl = `${appUrl}/api/telegram`

  if (!BOT_TOKEN) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN is missing in environment variables.' },
      { status: 400 }
    )
  }

  try {
    // 1. Set Webhook
    const webhookRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message'],
      }),
    })
    const webhookData = await webhookRes.json()

    // 2. Set Bot Commands Menu
    const commandsRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'today',    description: '📅 Задачи на сегодня' },
          { command: 'goals',    description: '🎯 Активные цели' },
          { command: 'notes',    description: '📌 Последние заметки' },
          { command: 'buy',      description: '⭐ Оформить подписку Zerf Premium (99 ₽)' },
          { command: 'settings', description: '⚙️ Настройки интервалов и повторов' },
          { command: 'admin',    description: '👑 Панель администратора' },
          { command: 'language', description: '🌐 Выбрать язык интерфейса' },
          { command: 'help',     description: '❓ Инструкция и возможности' },
        ],
      }),
    })
    const commandsData = await commandsRes.json()

    return NextResponse.json({
      success: webhookData.ok && commandsData.ok,
      webhookUrl,
      webhookResult: webhookData,
      commandsResult: commandsData,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
