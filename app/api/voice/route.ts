/**
 * Next.js API Route — Voice Processing
 * POST /api/voice — multipart/form-data with 'file' audio
 */

import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudioWithGroq, parseIntentWithGroq } from '@/lib/backend/groq'
import { saveParsedItemToDb, getUserUsageAndLimits, incrementUserUsage } from '@/lib/backend/db'
import { GROQ_API_KEY } from '@/lib/config'

export async function POST(req: NextRequest) {
  try {
    const ownerChatId = req.headers.get('x-chat-id')
    if (ownerChatId) {
      const limits = await getUserUsageAndLimits(ownerChatId)
      if (!limits.canSendVoice) {
        return NextResponse.json({
          error: limits.plan === 'premium'
            ? '❌ Достигнут лимит голосового ввода на сегодня (10 минут). Наступит сброс завтра!'
            : '❌ Достигнут дневной лимит (2 голосовых сообщения в день). Оформите подписку Zerf Premium за 99 ₽ в Настройках!',
          limitReached: true,
        }, { status: 403 })
      }
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const textInput = formData.get('text') as string | null  // allow text-only mode
    const apiKey =
      (formData.get('apiKey') as string) ||
      req.headers.get('x-groq-api-key') ||
      process.env.GROQ_API_KEY ||
      GROQ_API_KEY

    let transcript = ''

    if (file) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      transcript = await transcribeAudioWithGroq(buffer, file.name || 'voice.webm', apiKey)
      if (!transcript.trim()) {
        return NextResponse.json({ error: 'No speech detected.' }, { status: 400 })
      }
    } else if (textInput) {
      transcript = textInput
    } else {
      return NextResponse.json({ error: 'Provide audio file or text input.' }, { status: 400 })
    }

    // Parse intent — detects task/goal/note/completion/reminder
    const parsedItem = await parseIntentWithGroq(transcript, apiKey)

    // Save to DB (handles completion internally)
    const { item, completedTask } = await saveParsedItemToDb(parsedItem, ownerChatId)

    if (ownerChatId && file) {
      await incrementUserUsage(ownerChatId, 'voice', 15) // estimate ~15s per voice clip
    }

    return NextResponse.json({
      success: true,
      transcript,
      item,
      completedTask: completedTask || null,
      isCompletion: item.type === 'completion',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
