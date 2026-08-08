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

    // 2. Set Private Commands Menu
    const privateCommandsRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start',    description: '🚀 Открыть приложение Zerf AI' },
          { command: 'today',    description: '📅 Задачи на сегодня' },
          { command: 'invite',   description: '🤝 Пригласить друга в команду' },
          { command: 'report',   description: '📊 Недельный AI-отчёт' },
          { command: 'goals',    description: '🎯 Активные цели' },
          { command: 'notes',    description: '📌 Заметки' },
          { command: 'buy',      description: '⭐ Оформить Zerf Premium (99 ₽)' },
          { command: 'settings', description: '⚙️ Настройки' },
          { command: 'help',     description: '❓ Команды и инструкции' },
        ],
        scope: { type: 'all_private_chats' },
      }),
    })
    const privateCommandsData = await privateCommandsRes.json()

    // 3. Set Group Commands Menu (ONLY /add)
    const groupCommandsRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'add', description: '📌 Добавить задачу из этого сообщения в Zerf AI' },
        ],
        scope: { type: 'all_group_chats' },
      }),
    })
    const groupCommandsData = await groupCommandsRes.json()

    return NextResponse.json({
      success: webhookData.ok && privateCommandsData.ok && groupCommandsData.ok,
      webhookUrl,
      webhookResult: webhookData,
      privateCommandsResult: privateCommandsData,
      groupCommandsResult: groupCommandsData,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
