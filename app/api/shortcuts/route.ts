/**
 * POST /api/shortcuts & GET /api/shortcuts — Apple Shortcuts & Android Siri/Assistant Integration Endpoint
 * Allows 1-tap voice/text input from iOS Action Button, Siri, Back Tap, and Android widgets.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { parseIntentWithGroq, transcribeAudioWithGroq } from '@/lib/backend/groq'
import { saveParsedItemToDb, getExistingItemsContext, registerChatId, getAllTasks, extractNaturalTime } from '@/lib/backend/db'
import { sendVoiceResponse, createSpokenSummary } from '@/lib/backend/tts'
import { GROQ_API_KEY } from '@/lib/config'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export function getSiriUserKey(chatId: number | string | bigint): string {
  const secret = process.env.TELEGRAM_BOT_TOKEN || 'zerf-siri-secret-key-2026'
  return crypto.createHmac('sha256', secret).update(String(chatId)).digest('hex').slice(0, 10)
}

async function sendTgNotification(chatId: number, text: string) {
  if (!BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch {}
}

function isTodayQuery(text: string): boolean {
  const t = text.toLowerCase().trim()
  return (
    t.includes('что на сегодня') ||
    t.includes('задачи на сегодня') ||
    t.includes('планы на сегодня') ||
    t.includes('какие задачи') ||
    t.includes('список на сегодня') ||
    t.includes('что сегодня') ||
    t === 'сегодня' ||
    t === 'today'
  )
}

async function handleTodaySpeech(chatId: number): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const allTasks = await getAllTasks(chatId)
  const pending = allTasks.filter(t => t.status !== 'done' && (t.dueDate === today || !t.dueDate))

  if (pending.length === 0) {
    return 'У вас на сегодня нет невыполненных задач. Всё чисто!'
  }

  const countWord = pending.length === 1 ? 'задача' : pending.length < 5 ? 'задачи' : 'задач'
  const itemsList = pending
    .slice(0, 5)
    .map((t, idx) => `${idx + 1}. ${t.title}${t.dueTime ? ' в ' + t.dueTime : ''}`)
    .join('. ')

  return `На сегодня ${pending.length} ${countWord}: ${itemsList}.`
}

export async function POST(req: NextRequest) {
  try {
    const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
    if (!key) {
      return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    let chatId: number | null = null
    let inputText = ''
    let bodyObj: Record<string, any> = {}

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      bodyObj = await req.json().catch(() => ({}))
      const rawCid = bodyObj.chatId || bodyObj.chat_id || bodyObj.userId || bodyObj.user_id || req.headers.get('x-chat-id') || searchParams.get('chatId')
      if (rawCid) chatId = Number(rawCid)
      inputText = bodyObj.text || bodyObj.query || bodyObj.task || bodyObj.q || bodyObj.prompt || bodyObj.message || ''
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData().catch(() => null)
      if (formData) {
        const rawCid = formData.get('chatId') || formData.get('chat_id') || req.headers.get('x-chat-id') || searchParams.get('chatId')
        if (rawCid) chatId = Number(rawCid)
        inputText = (formData.get('text') as string) || (formData.get('query') as string) || ''
        const file = (formData.get('audio') || formData.get('file')) as File | null

        if (file && !inputText) {
          const arrayBuf = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuf)
          inputText = await transcribeAudioWithGroq(buffer, file.name || 'voice.m4a', key)
        }
      }
    } else {
      // Plain text or urlencoded
      const rawText = await req.text().catch(() => '')
      const rawCid = req.headers.get('x-chat-id') || searchParams.get('chatId')
      if (rawCid) chatId = Number(rawCid)
      inputText = rawText || searchParams.get('text') || searchParams.get('q') || ''
    }

    if (!chatId || isNaN(chatId)) {
      return NextResponse.json({
        error: 'chatId is required. Find your Chat ID via /start in @Zerph_bot',
        example: 'POST /api/shortcuts with {"chatId": 123456789, "text": "Купить молоко в 19:00"}'
      }, { status: 400 })
    }

    // Optional Key Verification
    const providedKey = searchParams.get('key') || bodyObj.key
    if (providedKey) {
      const expectedKey = getSiriUserKey(chatId)
      if (providedKey !== expectedKey) {
        return NextResponse.json({ error: 'Invalid security key for this chatId' }, { status: 403 })
      }
    }

    if (!inputText || !inputText.trim()) {
      return NextResponse.json({
        error: 'No text or audio provided',
        spokenResponse: 'Текст задачи не был получен. Попробуйте еще раз.'
      }, { status: 400 })
    }

    await registerChatId(chatId)

    // 1. Check if user asked Siri "What's on today?"
    if (isTodayQuery(inputText)) {
      const spokenResponse = await handleTodaySpeech(chatId)
      return NextResponse.json({
        success: true,
        type: 'query',
        rawInput: inputText,
        spokenResponse,
        result: spokenResponse,
        text: spokenResponse,
      })
    }

    // 2. Parse and save task/goal/note
    const context = await getExistingItemsContext(chatId)
    const items = await parseIntentWithGroq(inputText, key, undefined, context)

    if (!items || items.length === 0) {
      const failText = 'Не удалось распознать задачу. Попробуйте сказать иначе.'
      return NextResponse.json({
        success: false,
        spokenResponse: failText,
        result: failText,
        text: failText,
      })
    }

    for (const item of items) {
      await saveParsedItemToDb(item, chatId)
    }

    const spokenText = createSpokenSummary(items)

    // Send confirmation in Telegram
    let tgMsg = `🍏 *Голосовой ввод через Siri / Быстрые команды*\n\n`
    items.forEach((item, idx) => {
      const due = item.dueTime ? ` _(до ${item.dueTime})_` : ''
      tgMsg += `${idx + 1}. 📌 *${item.title}*${due}\n`
    })
    sendTgNotification(chatId, tgMsg).catch(() => {})
    sendVoiceResponse(chatId, spokenText).catch(() => {})

    return NextResponse.json({
      success: true,
      rawInput: inputText,
      itemsCount: items.length,
      spokenResponse: spokenText,
      result: spokenText,
      text: spokenText,
      items: items.map(i => ({ title: i.title, dueTime: i.dueTime, priority: i.priority }))
    })
  } catch (err: unknown) {
    console.error('Shortcuts API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawCid = searchParams.get('chatId') || searchParams.get('chat_id')
  const text = searchParams.get('text') || searchParams.get('q') || searchParams.get('query')
  const format = searchParams.get('format')
  const providedKey = searchParams.get('key')

  if (!rawCid || !text) {
    return NextResponse.json({
      status: 'active',
      name: 'Zerf AI Siri & Shortcuts Gateway',
      usage: 'GET /api/shortcuts?chatId=123456789&text=Напомни+позвонить+маме+в+19:00',
      iosShortcutGuide: 'Apple Shortcuts: Use "Get Contents of URL" with POST or GET to this endpoint.'
    })
  }

  const chatId = Number(rawCid)
  if (isNaN(chatId)) {
    return NextResponse.json({ error: 'Invalid chatId' }, { status: 400 })
  }

  // Optional Key Verification
  if (providedKey) {
    const expectedKey = getSiriUserKey(chatId)
    if (providedKey !== expectedKey) {
      return NextResponse.json({ error: 'Invalid security key for this chatId' }, { status: 403 })
    }
  }

  const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
  await registerChatId(chatId)

  // Check today query
  if (isTodayQuery(text)) {
    const spokenResponse = await handleTodaySpeech(chatId)
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        spokenResponse,
        result: spokenResponse,
        text: spokenResponse,
      })
    }
    return new NextResponse(spokenResponse, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  const items = await parseIntentWithGroq(text, key)

  for (const item of items) {
    await saveParsedItemToDb(item, chatId)
  }

  const spokenText = createSpokenSummary(items)
  sendVoiceResponse(chatId, spokenText).catch(() => {})

  // Send confirmation in Telegram
  let tgMsg = `🍏 *Голосовой ввод через Siri / Быстрые команды*\n\n`
  items.forEach((item, idx) => {
    const due = item.dueTime ? ` _(до ${item.dueTime})_` : ''
    tgMsg += `${idx + 1}. 📌 *${item.title}*${due}\n`
  })
  sendTgNotification(chatId, tgMsg).catch(() => {})

  if (format === 'json') {
    return NextResponse.json({
      success: true,
      spokenResponse: spokenText,
      result: spokenText,
      text: spokenText,
      items
    })
  }

  // Default for Apple Shortcuts is plain text — speak directly without dictionary parsing!
  return new NextResponse(spokenText, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
