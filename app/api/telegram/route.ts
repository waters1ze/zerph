/**
 * Next.js API Route — Telegram Webhook Handler
 * POST /api/telegram
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleTelegramUpdate } from '@/lib/backend/telegram'

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()

    // Get tokens from headers or environment variables
    const botToken = req.headers.get('x-telegram-bot-token') || process.env.TELEGRAM_BOT_TOKEN
    const groqApiKey = req.headers.get('x-groq-api-key') || process.env.GROQ_API_KEY

    if (!botToken || !groqApiKey) {
      return NextResponse.json(
        { error: 'Missing TELEGRAM_BOT_TOKEN or GROQ_API_KEY env variables / headers' },
        { status: 400 }
      )
    }

    const result = await handleTelegramUpdate(update, botToken, groqApiKey)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'Zerf Telegram Webhook Engine' })
}
