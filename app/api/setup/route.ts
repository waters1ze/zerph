/**
 * GET /api/setup — One-click setup endpoint (admin only)
 * 1. Sets Telegram Webhook (with secret token) to the app URL
 * 2. Registers Telegram Bot Command Menu
 *
 * Requires: Authorization: Bearer <ADMIN_SECRET> or ?secret=<ADMIN_SECRET>
 * After deploying with a fresh bot, call this ONCE to finish configuration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSecret, getTelegramWebhookSecret, secretsMatch } from '@/lib/backend/auth'

export async function GET(req: NextRequest) {
  const adminSecret = getAdminSecret()
  const authHeader = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const querySecret = new URL(req.url).searchParams.get('secret') || ''
  if (!adminSecret || !(secretsMatch(authHeader, adminSecret) || secretsMatch(querySecret, adminSecret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN is missing in environment variables.' },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`
  const webhookUrl = `${appUrl}/api/telegram`
  const webhookSecret = getTelegramWebhookSecret()

  try {
    // 1. Set Webhook (with secret token so forged updates are rejected)
    const webhookBody: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query', 'channel_post', 'chat_member'],
    }
    if (webhookSecret) webhookBody.secret_token = webhookSecret

    const webhookRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookBody),
    })
    const webhookData = await webhookRes.json()

    // 2. Set Private Commands Menu (ONLY for 1-on-1 private bot chats)
    const privateCommandsRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'today',      description: '▫ Задачи, фокус и цели на сегодня' },
          { command: 'schedule',   description: '▫ График и доступные временные слоты' },
          { command: 'shared',     description: '▫ Совместные и делегированные задачи' },
          { command: 'matrix',     description: '▫ Матрица приоритетов Эйзенхауэра' },
          { command: 'focus',      description: '▫ Таймер фокуса (/focus 25)' },
          { command: 'siri',       description: '▫ Голосовой ввод Apple Shortcuts' },
          { command: 'report',     description: '▫ Недельный AI-отчет продуктивности' },
          { command: 'inbox',      description: '▫ Входящие задачи' },
          { command: 'stats',      description: '▫ Аналитика и статистика' },
          { command: 'invite',     description: '▫ Пригласить в команду' },
          { command: 'login',      description: '▫ Вход в веб-версию (ПК/браузер)' },
          { command: 'settings',   description: '▫ Параметры и таймзона' },
          { command: 'help',       description: '▫ Спецификация и руководство' },
        ],
        scope: { type: 'all_private_chats' },
      }),
    })
    const privateCommandsData = await privateCommandsRes.json()

    // 3. Set Group Commands Menu (ONLY /add for all groups)
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
      secretTokenConfigured: Boolean(webhookSecret),
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