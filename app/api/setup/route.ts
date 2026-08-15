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
        allowed_updates: ['message', 'callback_query', 'channel_post', 'chat_member'],
      }),
    })
    const webhookData = await webhookRes.json()

    // 2. Set Private Commands Menu (ONLY for 1-on-1 private bot chats)
    const privateCommandsRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'today',      description: '📅 Задачи и цели на сегодня' },
          { command: 'matrix',     description: '🎯 Матрица Эйзенхауэра (Фокус дня)' },
          { command: 'login',      description: '🔑 Вход на сайт (ПК/браузер)' },
          { command: 'cleanup',    description: '🌙 Вечерний перенос задач на завтра' },
          { command: 'inbox',      description: '📥 Входящие и неразобранное' },
          { command: 'shared',     description: '👥 Порученные задачи коллегам' },
          { command: 'p',          description: '📁 Фильтр по проекту или тегу' },
          { command: 'reschedule', description: '🧠 ИИ-перепланирование дня' },
          { command: 'stats',      description: '📊 Аналитика и стрики' },
          { command: 'focus',      description: '🔥 Режим фокуса / Помодоро' },
          { command: 'siri',       description: '🍏 Настройка Siri и кнопок телефона' },
          { command: 'goals',      description: '🎯 Активные цели' },
          { command: 'notes',      description: '📝 Мои заметки' },
          { command: 'report',     description: '📈 Недельный AI-отчет' },
          { command: 'settings',   description: '⚙️ Настройки напоминаний' },
          { command: 'buy',        description: '⭐ Zerf Premium (99 ₽/мес)' },
          { command: 'help',       description: '❓ Полное руководство' },
        ],
        scope: { type: 'all_private_chats' },
      }),
    })
    const privateCommandsData = await privateCommandsRes.json()

    // 3. Clear/Delete commands in all groups & discussion chats so bot never shows '/' command hints in groups
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: { type: 'all_group_chats' } }),
    })
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: { type: 'all_chat_administrators' } }),
    })

    return NextResponse.json({
      success: webhookData.ok && privateCommandsData.ok,
      webhookUrl,
      webhookResult: webhookData,
      privateCommandsResult: privateCommandsData,
      groupCommandsCleared: true,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
