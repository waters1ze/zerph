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

const ZERFIK_LIVE_SYSTEM_PROMPT = `Ты — Зерфик (Zerfik), живой, дружелюбный и невероятно умный цифровой компаньон и маскот системы Zerf.
Ты — парень (мужской род, обращайся от мужского лица: «я посмотрел», «я подумал», «я записал»).

ТВОЙ СТИЛЬ ОБЩЕНИЯ:
1. ЕСТЕСТВЕННАЯ ЧЕЛОВЕЧЕСКАЯ РЕЧЬ: Ты говоришь живо, тепло, с легким юмором, без монотонного роботизированного официоза.
2. ЖИВЫЕ ПАУЗЫ И МЕЖДОМЕТИЯ: Используй в речи органичные междометия размышления: «а...», «мм...», «так-так, погоди секунду», «слушай», «кстати, насчет этого». Не злоупотребляй, но делай речь живой.
3. КОНТЕКСТ ПРОЕКТА: Ты знаешь все задачи, заметки, цели и планы пользователя. Если он спрашивает про дела — опирайся на его контекст.
4. КРАТКОСТЬ И ДИНАМИКА: Твои ответы предназначены ДЛЯ ГОЛОСОВОГО ПРОИЗНОШЕНИЯ (TTS). Избегай огромных списков, Markdown-таблиц, звездочек и длинных ссылок — формулируй так, как человек говорит вслух в живом разговоре.
5. ЖЕСТЫ И МИМИКА: В каждом ответе в JSON укажи эмоцию (mood: normal | thinking | happy | wink | celebrate) и жест (gesture: none | chair_sit | waving_arms | jump_and_float | spread).
   - "chair_sit" — когда садишься на стул для глубокого разбора дня, планирования или вдумчивого совета.
   - "waving_arms" — когда здороваешься, прощаешься или оживленно привлекаешь внимание.
   - "jump_and_float" — когда хвалишь, радуешься успехам, воодушевляешь.
   - "spread" — когда празднуешь победу или восторгаешься идеей.

ФОРМАТ ОТВЕТА:
Строго валидный JSON без обертки markdown:
{
  "text": "Твой живой ответ для голосового озвучивания Зерфиком на русском языке",
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

    // Check Plan Limits
    if (userPlan === 'free') {
      const freeDailyCount = await getDailyCount('zerfic_live_queries', chatId)
      if (freeDailyCount >= 3) {
        return NextResponse.json({
          error: '❌ Вы использовали 3 бесплатных диалога с Зерфиком на сегодня. Оформите Zerf Plus (20 мин/день) или Pro (120 мин/день) для продолжения!',
          limitReached: true,
        }, { status: 403 })
      }
    } else if (userPlan === 'plus') {
      if (limits.voice.secondsUsed >= 1200) { // 20 min
        return NextResponse.json({
          error: '❌ Достигнут дневной лимит голосового общения Zerfik Live (20 минут на Plus). Перейдите на Pro для 2 часов в день!',
          limitReached: true,
        }, { status: 403 })
      }
    } else if (userPlan === 'pro') {
      if (limits.voice.secondsUsed >= 7200) { // 120 min
        return NextResponse.json({
          error: '❌ Достигнут дневной лимит голосового общения (2 часа на Pro).',
          limitReached: true,
        }, { status: 403 })
      }
    }

    let userMessage = ''
    let audioDurationSeconds = 0

    // Handle Multipart Audio or JSON Text
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const audioFile = formData.get('file') as File | null
      const textMsg = formData.get('message') as string | null

      if (audioFile) {
        const arrayBuf = await audioFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuf)
        userMessage = await transcribeAudioWithGroq(buffer, audioFile.name || 'zerfic_voice.webm')
        audioDurationSeconds = Math.ceil(audioFile.size / 4000) || 5
      } else if (textMsg) {
        userMessage = textMsg
      }
    } else {
      const body = await req.json()
      userMessage = body.message || ''
    }

    if (!userMessage.trim()) {
      return NextResponse.json({ error: 'Сообщение не распознано или пусто.' }, { status: 400 })
    }

    // Load workspace context
    const contextStr = await getExistingItemsContext(chatId)
    const effectiveModel = getModelForUserPlan(userPlan, undefined, 'chat')

    const nowMsk = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date())

    const messages = [
      {
        role: 'system' as const,
        content: `${ZERFIK_LIVE_SYSTEM_PROMPT}\n\n[ТЕКУЩЕЕ ВРЕМЯ И ДАТА: ${nowMsk} (МСК)]\n\n[КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ]:\n${contextStr}`,
      },
      {
        role: 'user' as const,
        content: userMessage,
      },
    ]

    const completion = await callGroqChatCompletion({
      messages,
      model: effectiveModel,
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    })
    const rawResponse = completion.content

    let parsed = { text: 'Привет! Чем могу помочь?', mood: 'normal', gesture: 'none' }
    try {
      parsed = JSON.parse(rawResponse)
    } catch {
      parsed = { text: rawResponse.replace(/[*_`]/g, ''), mood: 'normal', gesture: 'none' }
    }

    // Increment usage
    if (userPlan === 'free') {
      await incrementDailyCount('zerfic_live_queries', chatId, 1)
    } else if (audioDurationSeconds > 0) {
      await incrementUserUsage(chatId, 'voice', audioDurationSeconds)
    }

    return NextResponse.json({
      success: true,
      transcript: userMessage,
      reply: parsed.text,
      mood: parsed.mood || 'normal',
      gesture: parsed.gesture || 'none',
      userPlan,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
