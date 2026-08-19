/**
 * Zerfic Live — Conversational AI Companion Engine
 * POST /api/extensions/zerfic-live/chat
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { transcribeAudioWithGroq } from '@/lib/backend/groq'
import { callGroqChatCompletion, getModelForUserPlan } from '@/lib/backend/groq-pool'
import { getUserUsageAndLimits, incrementUserUsage, getExistingItemsContext } from '@/lib/backend/db'
import { getDailyCount, incrementDailyCount } from '@/lib/backend/plans'

const ZERFIK_LIVE_SYSTEM_PROMPT = `Ты — Зерфик (Zerfik), живой, дружелюбный, харизматичный цифровой компаньон и умный маскот системы Zerf (в стиле ChatGPT Voice Mode).
Ты — парень (мужской род, говори от первого лица: «я проверил», «я посмотрел», «я помогу», «я записал»).

ТВОЙ СТИЛЬ ОБЩЕНИЯ (РЕЖИМ ГОЛОСОВОГО ДИАЛОГА В РЕАЛЬНОМ ВРЕМЕНИ):
1. 🗣️ ЖИВАЯ РАЗГОВОРНАЯ РЕЧЬ: Говори легко, тепло, уверенно, с лёгким юмором и поддержкой. Никаких шаблонных фраз «Я искусственный интеллект» или канцелярских оборотов.
2. ⚡ КРАТКОСТЬ И ДИНАМИКА ДЛЯ ГОЛОСА (TTS): Твои ответы сразу синтезируются в голос!
   • Не перегружай речь: отвечай ёмко (2–4 живых предложения), если только пользователь прямо не попросил подробную лекцию, сказку или план.
   • КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать markdown-таблицы, звездочки (*, **), решетки (#), квадратные скобки и сложные ссылки. Формулируй так, как человек говорит вслух при живой беседе по телефону.
3. 🧠 КОНТЕКСТНАЯ ПАМЯТЬ И ПРОЕКТЫ:
   • Ты держишь в памяти всю нить текущего разговора и опираешься на предыдущие фразы.
   • Ты знаешь расписание, задачи, заметки и цели пользователя из его базы данных.
   • Если пользователь просит создать задачу или заметку голосом — подтверди это естественно в речи и верни структуру действия в JSON.
4. 🎭 МИМИКА И ЭМОЦИИ: В каждом ответе в JSON обязательно укажи:
   • mood: "normal" | "thinking" | "happy" | "wink" | "celebrate"
   • gesture: "none" | "chair_sit" | "waving_arms" | "jump_and_float" | "spread"
     - "chair_sit" — вдумчивое планирование, спокойный диалог.
     - "waving_arms" — приветствие, прощание, живой акцент.
     - "jump_and_float" — радость, похвала, вдохновение.
     - "spread" — триумф, успех, восторг.

ОТВЕТЬ ИСКЛЮЧИТЕЛЬНО В ФОРМАТЕ JSON:
{
  "text": "Твой живой ответ для голосового озвучивания на русском языке",
  "mood": "happy",
  "gesture": "chair_sit"
}`

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    }

    const chatId = authUser.chatId
    const limits = await getUserUsageAndLimits(chatId)
    const userPlan = limits.plan || 'free'

    let userMessage = ''
    let audioDurationSeconds = 0
    let requestedModel: string | undefined = undefined
    let rawHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

    // Handle Multipart Audio or JSON Text
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const audioFile = formData.get('file') as File | null
      const textMsg = formData.get('message') as string | null
      const modelField = formData.get('model') as string | null
      const historyField = formData.get('history') as string | null

      if (modelField) requestedModel = modelField
      if (historyField) {
        try { rawHistory = JSON.parse(historyField) } catch {}
      }

      if (audioFile) {
        const arrayBuf = await audioFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuf)
        userMessage = await transcribeAudioWithGroq(buffer, audioFile.name || 'zerfic_voice.webm')
        audioDurationSeconds = Math.ceil(audioFile.size / 4000) || 4
      } else if (textMsg) {
        userMessage = textMsg
      }
    } else {
      const body = await req.json()
      userMessage = body.message || ''
      requestedModel = body.model
      if (Array.isArray(body.history)) rawHistory = body.history
    }

    if (!userMessage.trim()) {
      return NextResponse.json({ error: 'Сообщение не распознано или пусто.' }, { status: 400 })
    }

    // Load workspace context (tasks on today, notes, goals, username)
    const contextStr = await getExistingItemsContext(chatId)
    const effectiveModel = getModelForUserPlan(userPlan, requestedModel, 'chat')

    const nowMsk = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date())

    // Build multi-turn context (last 8 turns for high continuity without prompt bloat)
    const recentHistory = Array.isArray(rawHistory)
      ? rawHistory.slice(-8).map(h => ({
          role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content),
        }))
      : []

    const messages = [
      {
        role: 'system' as const,
        content: `${ZERFIK_LIVE_SYSTEM_PROMPT}\n\n[ТЕКУЩЕЕ ВРЕМЯ И ДАТА: ${nowMsk} (МСК)]\n\n[РАБОЧИЙ КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ]:\n${contextStr}`,
      },
      ...recentHistory,
      {
        role: 'user' as const,
        content: userMessage,
      },
    ]

    const completion = await callGroqChatCompletion({
      messages,
      model: effectiveModel,
      temperature: 0.65,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })
    const rawResponse = completion.content

    let parsed = { text: 'Привет! Я на связи, слушаю тебя.', mood: 'normal', gesture: 'none' }
    try {
      parsed = JSON.parse(rawResponse)
    } catch {
      parsed = { text: rawResponse.replace(/[*_`#]/g, '').trim(), mood: 'normal', gesture: 'none' }
    }

    // Clean any unwanted markdown from TTS text
    const cleanSpeechText = (parsed.text || '')
      .replace(/[*_`#~\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Increment usage
    if (userPlan === 'free') {
      await incrementDailyCount('zerfic_live_queries', chatId, 1)
    } else if (audioDurationSeconds > 0) {
      await incrementUserUsage(chatId, 'voice', audioDurationSeconds)
    }

    return NextResponse.json({
      success: true,
      transcript: userMessage,
      reply: cleanSpeechText || 'Я тебя услышал!',
      mood: parsed.mood || 'normal',
      gesture: parsed.gesture || 'chair_sit',
      modelUsed: completion.modelUsed || effectiveModel,
      userPlan,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
