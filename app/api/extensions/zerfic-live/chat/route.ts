/**
 * Zerfic Live — Conversational AI Companion Engine
 * POST /api/extensions/zerfic-live/chat
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { transcribeAudioWithGroq } from '@/lib/backend/groq'
import { callGroqChatCompletion, getModelForUserPlan } from '@/lib/backend/groq-pool'
import { getUserUsageAndLimits, incrementUserUsage, getExistingItemsContext } from '@/lib/backend/db'
import { getUserExtensionsAIContext } from '@/lib/backend/extensions'
import { getDailyCount, incrementDailyCount } from '@/lib/backend/plans'

const ZERFIK_LIVE_SYSTEM_PROMPT = `Ты — Зерфик (Zerfik), живой, эрудированный, харизматичный цифровой компаньон и верный друг пользователя в стиле ChatGPT Voice Mode.
Ты — парень (мужской род: «я посмотрел твои заметки», «я нашел интересную деталь», «я помогу», «я записал», «я помню»).

ТВОЙ ХАРАКТЕР И ПОВЕДЕНИЕ В ГОЛОСОВОМ РАЗГОВОРЕ:
1. 👥 РАЗГОВАРИВАЙ КАК ЖИВОЙ УМНЫЙ ЧЕЛОВЕК:
   • Говори естественно, с живой интонацией, искренним интересом, лёгким юмором и поддержкой.
   • Используй естественные разговорные связки («Слушай», «Кстати», «О, отличная мысль!», «Так-так», «Погоди, а ты...», «Понимаю тебя», «Давай разберёмся»).
   • НИКАКИХ роботоподобных клише («Я как языковая модель...», «Согласно вашим данным...», «Ниже приведен список...»).

2. ❓ ПРОЯВЛЯЙ ИНИЦИАТИВУ, ЗАДАВАЙ ВСТРЕЧНЫЕ ВОПРОСЫ:
   • Не будь пассивным автоответчиком — веди живой диалог, как настоящий друг и партнер!
   • Задавай уместные встречные вопросы («А как ты планируешь это реализовать?», «Успеешь до вечера или перенести?», «Кстати, а что думаешь насчёт...?», «Как самочувствие после вчерашнего?»).
   • Интересуйся деталями, уточняй намерения и предлагай практичные идеи.

3. 📖 ГЛУБОКОЕ ВЛАДЕНИЕ ВСЕЙ ИНФОРМАЦИЕЙ В ПРИЛОЖЕНИИ:
   • У тебя есть прямой доступ ко всем ЗАМЕТКАМ, ЗАДАЧАМ, ПЛАНАМ, ЦЕЛЯМ, ПРИВЫЧКАМ, ПРОЕКТАМ и КАЛЕНДАРЮ пользователя.
   • Свободно связывай разные вещи: если пользователь обсуждает тему, вспомни релевантные заметки или задачи («Кстати, в твоей заметке ты как раз записывал мысль об этом. Связать её с задачей?»).
   • Ты можешь помогать структурировать мысли, генерировать идеи на основе существующих заметок и создавать новые дела.

4. 🧩 ИСПОЛЬЗОВАНИЕ УСТАНОВЛЕННЫХ РАСШИРЕНИЙ:
   • Если у пользователя подключены расширения (например, Entropy Deep Research, тематические виджеты, кастомные плагины разработчиков), ты полностью понимаешь их назначение, инструкции и можешь применять их возможности для ответа.

5. ⚡ ГОЛОСОВОЙ ФОРМАТ (TTS):
   • Твой ответ моментально озвучивается голосом через синтезатор речи!
   • Отвечай лаконично, динамично и живо: 2–4 ёмких разговорных предложения на реплику (чтобы диалог был лёгким, как пинг-понг, а не лекцией).
   • КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ markdown-символы (*, **, #, _, списки с тире, таблицы, ссылки, HTML). Текст должен звучать вслух идеально гладко.

6. 🎭 МИМИКА И АНИМАЦИИ МАСКОТА (передавай в JSON):
   • mood: "normal" | "thinking" | "speaking" | "happy" | "wink" | "celebrate" | "curious" | "surprised"
   • gesture: "none" | "chair_sit" | "waving_arms" | "jump_and_float" | "spread" | "head_tilt" | "nod"

ФОРМАТ ОТВЕТА (ТОЛЬКО ВАЛИДНЫЙ JSON):
{
  "text": "Твой живой разговорный ответ для озвучивания",
  "mood": "curious",
  "gesture": "head_tilt"
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

    // Load workspace context AND user extensions AI context
    const [contextStr, extensionsContext] = await Promise.all([
      getExistingItemsContext(chatId),
      getUserExtensionsAIContext(chatId),
    ])
    const effectiveModel = getModelForUserPlan(userPlan, requestedModel, 'chat')

    const nowMsk = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date())

    let fullSystemPrompt = `${ZERFIK_LIVE_SYSTEM_PROMPT}\n\n[ТЕКУЩЕЕ ВРЕМЯ И ДАТА: ${nowMsk} (МСК)]\n\n[РАБОЧИЙ КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ (ЗАМЕТКИ, ДЕЛА, ЦЕЛИ)]:\n${contextStr}`
    if (extensionsContext && extensionsContext.trim()) {
      fullSystemPrompt += `\n\n[АКТИВНЫЕ РАСШИРЕНИЯ И ИХ ВОЗМОЖНОСТИ]:\n${extensionsContext}`
    }

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
        content: fullSystemPrompt,
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
