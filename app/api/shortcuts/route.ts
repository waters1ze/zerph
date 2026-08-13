/**
 * POST /api/shortcuts — Apple Shortcuts & Android Siri/Assistant Integration Endpoint
 * Allows 1-tap voice/text input from iOS Action Button, Siri, Back Tap, and Android widgets.
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseIntentWithGroq, transcribeAudioWithGroq } from '@/lib/backend/groq'
import { saveParsedItemToDb, getExistingItemsContext, registerChatId } from '@/lib/backend/db'
import { sendVoiceResponse, createSpokenSummary } from '@/lib/backend/tts'
import { GROQ_API_KEY } from '@/lib/config'
import { prisma } from '@/lib/backend/prisma'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8649326236:AAH0dqSDP4akzWrM-5ncS68wZhlrwZISbxw'

async function sendTg(chatId: number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
    if (!key) {
      return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 })
    }

    let chatId: number | null = null
    let inputText = ''

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await req.json()
      chatId = Number(body.chatId)
      inputText = body.text || ''
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      chatId = Number(formData.get('chatId'))
      inputText = (formData.get('text') as string) || ''
      const file = formData.get('audio') as File | null

      if (file && !inputText) {
        const arrayBuf = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuf)
        inputText = await transcribeAudioWithGroq(buffer, file.name || 'voice.m4a', key)
      }
    }

    if (!chatId || isNaN(chatId)) {
      return NextResponse.json({
        error: 'chatId is required. Find your Chat ID via /start in @ZerfBot'
      }, { status: 400 })
    }

    if (!inputText || !inputText.trim()) {
      return NextResponse.json({
        error: 'No text or audio provided'
      }, { status: 400 })
    }

    await registerChatId(chatId)
    const context = await getExistingItemsContext(chatId)
    const items = await parseIntentWithGroq(inputText, key, undefined, context)

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: false,
        spokenResponse: 'Не удалось распознать задачу. Попробуйте сформулировать иначе.'
      })
    }

    for (const item of items) {
      await saveParsedItemToDb(item, chatId)
    }

    const spokenText = createSpokenSummary(items)

    // Notify user in Telegram as well
    let tgMsg = `📱 *Голосовой ввод через Быстрые команды (Siri / Телефон)*\n\n`
    items.forEach((item, idx) => {
      const due = item.dueTime ? ` _(до ${item.dueTime})_` : ''
      tgMsg += `${idx + 1}. 📌 *${item.title}*${due}\n`
    })
    sendTg(chatId, tgMsg).catch(() => {})
    sendVoiceResponse(chatId, spokenText).catch(() => {})

    return NextResponse.json({
      success: true,
      rawInput: inputText,
      itemsCount: items.length,
      spokenResponse: spokenText,
      items: items.map(i => ({ title: i.title, dueTime: i.dueTime, priority: i.priority }))
    })
  } catch (err: unknown) {
    console.error('Shortcuts API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const chatId = searchParams.get('chatId')
  const text = searchParams.get('text')

  if (!chatId || !text) {
    return NextResponse.json({
      status: 'active',
      usage: 'GET /api/shortcuts?chatId=123456789&text=Напомни+позвонить+маме+в+19:00',
      iosShortcutGuide: 'Import this URL in Apple Shortcuts "Get Contents of URL" action.'
    })
  }

  // Handle GET quick ping
  const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
  const items = await parseIntentWithGroq(text, key)
  const cIdNum = Number(chatId)

  for (const item of items) {
    await saveParsedItemToDb(item, cIdNum)
  }

  const spokenText = createSpokenSummary(items)
  sendVoiceResponse(cIdNum, spokenText).catch(() => {})

  return NextResponse.json({
    success: true,
    spokenResponse: spokenText,
    items
  })
}
