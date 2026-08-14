/**
 * Next.js API Route — Voice Processing
 * POST /api/voice — multipart/form-data with 'file' audio
 */

import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudioWithGroq, parseIntentWithGroq } from '@/lib/backend/groq'
import { saveParsedItemToDb, getUserUsageAndLimits, incrementUserUsage } from '@/lib/backend/db'
import { GROQ_API_KEY } from '@/lib/config'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    const ownerChatId = authUser.chatId
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

    // Parse intent — detects task/goal/note/completion/reminder (can extract multiple items)
    const parsedItems = await parseIntentWithGroq(transcript, apiKey)
    const results = []

    for (const item of parsedItems) {
      const savedResult = await saveParsedItemToDb(item, ownerChatId)
      results.push(savedResult)
    }

    const clientDuration = Number(formData.get('duration')) || 15
    const maxDuration = file ? Math.ceil(file.size / 4000) : 15 // Roughly 4KB/s WebM
    const actualDuration = file ? Math.min(clientDuration, maxDuration) : 0

    if (ownerChatId && file) {
      await incrementUserUsage(ownerChatId, 'voice', actualDuration)
    }

    return NextResponse.json({
      success: true,
      transcript,
      items: results.map(r => r.item),
      completedTask: results.find(r => r.completedTask)?.completedTask || null,
      isCompletion: results.some(r => r.item.type === 'completion'),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
