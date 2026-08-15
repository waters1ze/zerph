/**
 * POST /api/shortcuts & GET /api/shortcuts — Apple Shortcuts & Android Siri/Assistant Integration Endpoint
 * Allows 1-tap voice/text input from iOS Action Button, Siri, Back Tap, and Android widgets.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { parseIntentWithGroq, transcribeAudioWithGroq } from '@/lib/backend/groq'
import { saveParsedItemToDb, getExistingItemsContext, registerChatId, getAllTasks, extractNaturalTime, getUserUsageAndLimits, incrementUserUsage } from '@/lib/backend/db'
import { sendVoiceResponse, createSpokenSummary } from '@/lib/backend/tts'
import { GROQ_API_KEY } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const NO_CACHE_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

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
  
  // If it has action verbs, colons, time or task creation markers, it is NEVER a query for reading tasks!
  const hasActionVerb = /\b(добавь|создай|напомни|запиши|поставь|купи|купить|сделай|сделать|позвони|позвонить|встреча|тренировка|занятие|урок|сдать|отправить|задача|задачу|план|планы)\b/i.test(t)
  if (hasActionVerb || t.includes(':') || /\b\d{1,2}:\d{2}\b/.test(t) || t.length > 35) {
    return false
  }

  return (
    t === 'что на сегодня' ||
    t === 'какие задачи на сегодня' ||
    t === 'какие планы на сегодня' ||
    t === 'прочитай задачи' ||
    t === 'список на сегодня' ||
    t === 'что у меня на сегодня' ||
    t === 'какие задачи' ||
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

    const format = searchParams.get('format') || bodyObj.format

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
        return NextResponse.json({ error: 'Invalid security key for this chatId' }, { status: 403, headers: NO_CACHE_HEADERS })
      }
    }

    if (!inputText || !inputText.trim()) {
      return NextResponse.json({
        error: 'No text or audio provided',
        spokenResponse: 'Текст задачи не был получен. Попробуйте еще раз.'
      }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    await registerChatId(chatId)

    // Limits check
    const limits = await getUserUsageAndLimits(chatId)
    if (!limits.canSendVoice) {
      const limitMsg = limits.plan === 'premium'
        ? '❌ Дневной лимит голосового ввода Premium исчерпан (20 минут в день).'
        : '❌ Дневной лимит голосовых запросов исчерпан (5 в день). Оформите Zerf Premium в боте (20 минут в день)!'
      if (format === 'json') {
        return NextResponse.json({ error: limitMsg, spokenResponse: limitMsg, text: limitMsg }, { status: 403, headers: NO_CACHE_HEADERS })
      }
      return new NextResponse(limitMsg, { headers: NO_CACHE_HEADERS, status: 200 })
    }

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
      }, { headers: NO_CACHE_HEADERS })
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
      }, { headers: NO_CACHE_HEADERS })
    }

    for (const item of items) {
      await saveParsedItemToDb(item, chatId)
    }

    // Track usage
    const estimatedSec = Math.max(5, Math.round(inputText.length / 15))
    await incrementUserUsage(chatId, 'voice', estimatedSec).catch(() => {})

    const spokenText = createSpokenSummary(items)

    // Send confirmation in Telegram
    let tgMsg = `✦ *Голосовой ввод через Siri / Быстрые команды*\n\n`
    items.forEach((item, idx) => {
      if (item.action === 'delete') {
        tgMsg += `${idx + 1}. ▪ *Удалено:* ${item.targetTitle || item.title}\n`
      } else if (item.action === 'delete_all') {
        tgMsg += `▪ *Все задачи очищены*\n`
      } else if (item.action === 'completion' || item.type === 'completion') {
        tgMsg += `${idx + 1}. ▪ *Выполнено:* ${item.targetTitle || item.title}\n`
      } else {
        const due = item.dueTime ? ` _(до ${item.dueTime})_` : ''
        tgMsg += `${idx + 1}. ▪ *${item.title}*${due}\n`
      }
    })

    // Send confirmation in Telegram or VK if applicable
    try {
      const userRec = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
      if (userRec?.authProvider === 'vk') {
        const { sendVkMessage } = await import('@/lib/backend/vk')
        await sendVkMessage(String(chatId), tgMsg.replace(/[*_`]/g, ''))
      } else if (!userRec || userRec.authProvider === 'telegram') {
        sendTgNotification(chatId, tgMsg).catch(() => {})
      }
    } catch {}

    if (format === 'json' || req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({
        success: true,
        rawInput: inputText,
        itemsCount: items.length,
        spokenResponse: spokenText,
        result: spokenText,
        text: spokenText,
        items: items.map(i => ({ title: i.title, dueTime: i.dueTime, priority: i.priority }))
      }, { headers: NO_CACHE_HEADERS })
    }

    return new NextResponse(spokenText, {
      headers: NO_CACHE_HEADERS,
    })
  } catch (err: unknown) {
    console.error('Shortcuts API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawCid = searchParams.get('chatId') || searchParams.get('chat_id')
  let text = searchParams.get('text') || searchParams.get('q') || searchParams.get('query') || ''
  if (!text) {
    const rawQuery = req.url.split('?')[1] || ''
    const match = rawQuery.match(/(?:text|q|query)=([^&]+)/i)
    if (match) {
      try {
        text = decodeURIComponent(match[1])
      } catch {
        text = match[1]
      }
    }
  }
  const format = searchParams.get('format')
  const providedKey = searchParams.get('key')

  if (!rawCid) {
    return NextResponse.json({
      status: 'active',
      name: 'Zerf AI Siri & Shortcuts Gateway',
      usage: 'GET /api/shortcuts?chatId=123456789&text=Напомни+позвонить+маме+в+19:00',
      iosShortcutGuide: 'Apple Shortcuts: Use "Get Contents of URL" with POST or GET to this endpoint.'
    }, { headers: NO_CACHE_HEADERS })
  }

  if (!text || !text.trim()) {
    const hintMsg = 'Текст задачи не был получен. Проверьте, что в Командах Apple в самый конец ссылки после text= добавлена переменная [Кодированный в URL текст].'
    if (format === 'json') {
      return NextResponse.json({
        error: 'No text provided',
        spokenResponse: hintMsg,
        result: hintMsg,
        text: hintMsg,
      }, { status: 400, headers: NO_CACHE_HEADERS })
    }
    return new NextResponse(hintMsg, {
      status: 200,
      headers: NO_CACHE_HEADERS,
    })
  }

  const chatId = Number(rawCid)
  if (isNaN(chatId)) {
    return NextResponse.json({ error: 'Invalid chatId' }, { status: 400, headers: NO_CACHE_HEADERS })
  }

  // Optional Key Verification
  if (providedKey) {
    const expectedKey = getSiriUserKey(chatId)
    if (providedKey !== expectedKey) {
      return NextResponse.json({ error: 'Invalid security key for this chatId' }, { status: 403, headers: NO_CACHE_HEADERS })
    }
  }

  const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
  await registerChatId(chatId)

  // Limits check
  const limits = await getUserUsageAndLimits(chatId)
  if (!limits.canSendVoice) {
    const limitMsg = limits.plan === 'premium'
      ? '❌ Дневной лимит голосового ввода Premium исчерпан (20 минут в день).'
      : '❌ Дневной лимит голосовых запросов исчерпан (5 в день). Оформите Zerf Premium в боте (20 минут в день)!'
    if (format === 'json') {
      return NextResponse.json({ error: limitMsg, spokenResponse: limitMsg, text: limitMsg }, { status: 403, headers: NO_CACHE_HEADERS })
    }
    return new NextResponse(limitMsg, { headers: NO_CACHE_HEADERS, status: 200 })
  }

  // Check today query
  if (isTodayQuery(text)) {
    const spokenResponse = await handleTodaySpeech(chatId)
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        spokenResponse,
        result: spokenResponse,
        text: spokenResponse,
      }, { headers: NO_CACHE_HEADERS })
    }
    return new NextResponse(spokenResponse, { headers: NO_CACHE_HEADERS })
  }

  const context = await getExistingItemsContext(chatId)
  const items = await parseIntentWithGroq(text, key, undefined, context)

  for (const item of items) {
    await saveParsedItemToDb(item, chatId)
  }

  // Track usage
  const estimatedSec = Math.max(5, Math.round(text.length / 15))
  await incrementUserUsage(chatId, 'voice', estimatedSec).catch(() => {})

  const spokenText = createSpokenSummary(items)

  // Send confirmation in Telegram
  let tgMsg = `✦ *Голосовой ввод через Siri / Быстрые команды*\n\n`
  items.forEach((item, idx) => {
    if (item.action === 'delete') {
      tgMsg += `${idx + 1}. ▪ *Удалено:* ${item.targetTitle || item.title}\n`
    } else if (item.action === 'delete_all') {
      tgMsg += `▪ *Все задачи очищены*\n`
    } else if (item.action === 'completion' || item.type === 'completion') {
      tgMsg += `${idx + 1}. ▪ *Выполнено:* ${item.targetTitle || item.title}\n`
    } else {
      const due = item.dueTime ? ` _(до ${item.dueTime})_` : ''
      tgMsg += `${idx + 1}. ▪ *${item.title}*${due}\n`
    }
  })
  // Send confirmation in Telegram or VK if applicable
  try {
    const userRec = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
    if (userRec?.authProvider === 'vk') {
      const { sendVkMessage } = await import('@/lib/backend/vk')
      await sendVkMessage(String(chatId), tgMsg.replace(/[*_`]/g, ''))
    } else if (!userRec || userRec.authProvider === 'telegram') {
      sendTgNotification(chatId, tgMsg).catch(() => {})
    }
  } catch {}

  if (format === 'json') {
    return NextResponse.json({
      success: true,
      spokenResponse: spokenText,
      result: spokenText,
      text: spokenText,
      items
    }, { headers: NO_CACHE_HEADERS })
  }

  // Default for Apple Shortcuts is plain text — speak directly without dictionary parsing!
  return new NextResponse(spokenText, {
    headers: NO_CACHE_HEADERS,
  })
}
