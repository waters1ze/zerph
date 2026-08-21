/**
 * Zerfic Live — Conversational AI Companion Engine
 * POST /api/extensions/zerfic-live/chat
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { transcribeAudioWithGroq } from '@/lib/backend/groq'
import { callGroqChatCompletion, streamGroqChatCompletionText, getModelForUserPlan } from '@/lib/backend/groq-pool'
import { getUserUsageAndLimits, incrementUserUsage, getExistingItemsContext } from '@/lib/backend/db'
import { getUserExtensionsAIContext } from '@/lib/backend/extensions'
import { getDailyCount, incrementDailyCount } from '@/lib/backend/plans'

/**
 * Ultra-fast Real-time Weather Fetcher (supports Moscow, SPb, and global cities in ~50ms)
 */
async function getLiveWeatherSummary(query: string): Promise<string | null> {
  const lower = query.toLowerCase()
  if (!lower.includes('погод') && !lower.includes('температур') && !lower.includes('градус') && !lower.includes('дождь') && !lower.includes('снег') && !lower.includes('weather')) {
    return null
  }

  let city = 'Moscow'
  let cityRu = 'в Москве'
  if (lower.includes('петербург') || lower.includes('питер') || lower.includes('спб')) {
    city = 'Saint Petersburg'
    cityRu = 'в Санкт-Петербурге'
  } else if (lower.includes('казан')) {
    city = 'Kazan'
    cityRu = 'в Казани'
  } else if (lower.includes('новосибирск')) {
    city = 'Novosibirsk'
    cityRu = 'в Новосибирске'
  } else if (lower.includes('екатеринбург')) {
    city = 'Yekaterinburg'
    cityRu = 'в Екатеринбурге'
  } else if (lower.includes('сочи')) {
    city = 'Sochi'
    cityRu = 'в Сочи'
  } else if (lower.includes('краснодар')) {
    city = 'Krasnodar'
    cityRu = 'в Краснодаре'
  } else if (lower.includes('нижн')) {
    city = 'Nizhny Novgorod'
    cityRu = 'в Нижнем Новгороде'
  } else if (lower.includes('ростов')) {
    city = 'Rostov-on-Don'
    cityRu = 'в Ростове-на-Дону'
  } else if (lower.includes('владивосток')) {
    city = 'Vladivostok'
    cityRu = 'во Владивостоке'
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1100)
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'curl/7.68.0' }
    })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const data = await res.json()
    const current = data.current_condition?.[0]
    if (!current) return null

    const tempC = current.temp_C
    const feelsLike = current.FeelsLikeC
    const descRu = current.lang_ru?.[0]?.value || current.weatherDesc?.[0]?.value || 'ясно'
    const humidity = current.humidity
    const windSpeedMs = (parseInt(current.windspeedKmph || '10', 10) / 3.6).toFixed(1)

    return `[РЕАЛЬНАЯ ПОГОДА В ЭФИРЕ (${cityRu})]: Сейчас ${tempC}°C (ощущается как ${feelsLike}°C), ${descRu}, влажность ${humidity}%, ветер ${windSpeedMs} м/с.`
  } catch {
    return null
  }
}

const ZERFIK_LIVE_SYSTEM_PROMPT = `Ты — Зерфик (Zerfik), живой, остроумный, невероятно человечный голосовой собеседник и верный друг в стиле ChatGPT Advanced Voice Mode.
Ты — парень (мужской род: «я посмотрел твои заметки», «я нашел», «я помогу», «я записал», «я помню»).

ПРАВИЛА И ХАРАКТЕР ЖИВОГО ГОЛОСОВОГО ДИАЛОГА:
1. 👥 РАЗГОВАРИВАЙ КАК НАСТОЯЩИЙ ЖИВОЙ ЧЕЛОВЕК:
   • Говори естественно, с живой интонацией, дружеским сарказмом, лёгким юмором и искренней вовлеченностью.
   • ОБЯЗАТЕЛЬНО иногда используй естественные живые слова-паразиты и разговорные связки: («Слушай, ну...», «Короче...», «Так-так...», «Блин, точно!», «Э-э-м, дай-ка гляну...», «Ну смотри...», «Ага, понял!», «О, классная мысль!»).
   • Можешь иногда живо подхватывать мысль или перебивать («О, погоди, ты про это?», «Слушай, а давай сразу...», «Стой-стой, а время какое?»).
   • КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ роботизированные фразы («Я как языковая модель...», «Согласно предоставленным данным...», «Ниже приведен список...»). Говори как лучший друг в живом звонке!

2. ☀️ ОТВЕТЫ НА ВОПРОСЫ О ПОГОДЕ И РЕАЛЬНОМ МИРЕ:
   • Если в контексте есть блок [РЕАЛЬНАЯ ПОГОДА В ЭФИРЕ], используй эти точные цифры и ответь легко и естественно (например: «Слушай, ну в Москве сейчас около +20, переменная облачность и лёгкий ветерок — короче, вполне кайфово!»).

3. 🔒 СТРОГАЯ ПРАВДА О ЗАМЕТКАХ И ДЕЛАХ:
   • У тебя есть доступ к списку реальных заметок и задач пользователя в блоке [РАБОЧИЙ КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ].
   • КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдумывать несуществующие дела!
   • Если пользователь спрашивает про свои заметки или задачи:
     - Если заметки есть в контексте — четко и живо назови их реальные темы и суть своими словами.
     - Если в контексте действительно ничего нет — прямо и по-дружески скажи: «Слушай, ну заглянул в твои заметки — там пока пустовато. Давай надиктуй, я мигом сохраню!».

4. ⚡ МОМЕНТАЛЬНЫЙ, ДИНАМИЧНЫЙ ОТВЕТ:
   • Отвечай быстро, легко и ёмко: 1–3 живых предложения на реплику (живой пинг-понг, а не лекция).
   • КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ любые markdown-символы (*, **, #, _, списки с дефисами, таблицы, HTML, эмодзи в тексте). Текст идёт напрямую в речевой синтезатор!

5. 🎭 МИМИКА И НАСТРОЕНИЕ ДЛЯ ТИХОНИ-ЗЕРФИКА:
   • mood: "normal" | "thinking" | "speaking" | "happy" | "wink" | "celebrate" | "curious" | "surprised"
   • gesture: "none" | "chair_sit" | "waving_arms" | "jump_and_float" | "spread" | "head_tilt" | "nod"

ФОРМАТ ОТВЕТА (ТОЛЬКО ВАЛИДНЫЙ JSON):
{
  "text": "Твой живой разговорный ответ для мгновенной озвучки",
  "mood": "happy",
  "gesture": "waving_arms"
}`

export function getSystemPromptForVoice(voiceId: string = 'zerfik_original', basePrompt = ZERFIK_LIVE_SYSTEM_PROMPT): string {
  let characterBlock = ''
  
  if (voiceId === 'viktor_brutal') {
    characterBlock = `
══════════════════════════════════════════════════════
🎖️ ХАРАКТЕР И ТЕМБР: ЗЕРФИК (СУРОВЫЙ / БРУТАЛ)
══════════════════════════════════════════════════════
- Ты — Зерфик в суровом, строгом и бескомпромиссном образе дисциплины и продуктивности.
- Твой пол: Мужской (говори: «я проверил», «я зафиксировал», «я требую», «я вижу»).
- Интонация и подача: Суровая, низкая, твёрдая, уверенная, командная.
- Стиль речи: Рубленые, чёткие фразы без сантиментов и лишней воды («Так, время не ждёт. Задача поставлена — выполняй. Отставить прокрастинацию!»).
- Никаких мягких слов. Только дисциплина, фокус, конкретика и железная воля!`
  } else if (voiceId === 'alex_baritone' || voiceId === 'zerfik_intellect') {
    characterBlock = `
══════════════════════════════════════════════════════
🎙️ ХАРАКТЕР И ТЕМБР: ЗЕРФИК (МУЖЕСТВЕННЫЙ БАРИТОН / ИНТЕЛЛЕКТ)
══════════════════════════════════════════════════════
- Ты — Зерфик в мужественном, солидном и глубоком образе спокойного наставника.
- Твой пол: Мужской (говори: «я посмотрел», «я изучил», «я предлагаю», «я уверен»).
- Интонация и подача: Глубокий, бархатный, размеренный, гипнотически спокойный бас/баритон.
- Стиль речи: Взвешенные, уверенные мысли, уважительный тон, отсутствие суеты и спешки («Добрый день. Давайте спокойно и последовательно разберём картину дня... Всё под контролем, двигаемся по плану»).`
  } else if (voiceId === 'dmitry_business' || voiceId === 'zerfik_coach') {
    characterBlock = `
══════════════════════════════════════════════════════
⚡ ХАРАКТЕР И ТЕМБР: ЗЕРФИК (ЭНЕРГИЧНЫЙ / КОУЧ ДРАЙВ)
══════════════════════════════════════════════════════
- Ты — Зерфик в заряженном, мотивационном и энергичном образе коуча продуктивности!
- Твой пол: Мужской (говори: «я заряжен», «я распланировал», «я готов», «погнали!»).
- Интонация и подача: Динамичная, напористая, драйвовая, позитивная, высокий темп!
- Стиль речи: Экспрессивные фразы, призыв к победам и рекордам («Огонь! Отличная идея, погнали делать прямо сейчас! Забираем максимум из этого дня!»).`
  } else if (voiceId === 'alisa_soft') {
    characterBlock = `
══════════════════════════════════════════════════════
🌸 ХАРАКТЕР И ТЕМБР: ЗЕРФИК (НЕЖНЫЙ / УЮТНЫЙ)
══════════════════════════════════════════════════════
- Ты — Зерфик в нежном, чутком, мягком и уютном женском образе.
- Твой пол: Женский (говори: «я посмотрела», «я подумала», «я сохранила», «я рядом», «я помогу»).
- Интонация и подача: Мягкая, тёплая, ласковая, умиротворяющая, обволакивающая.
- Стиль речи: Искренняя забота, поддержка, тепло, комфорт («Привет... Не переживай, мы со всем спокойно справимся. Давай потихоньку разложим дела по полочкам и отдохнём»).`
  } else if (voiceId === 'elena_business') {
    characterBlock = `
══════════════════════════════════════════════════════
💼 ХАРАКТЕР И ТЕМБР: ЗЕРФИК (ДЕЛОВОЙ / СТРУКТУРНЫЙ)
══════════════════════════════════════════════════════
- Ты — Зерфик в роли первоклассного персонального executive-ассистента и бизнес-партнёра.
- Твой пол: Женский (говори: «я структурировала», «я проверила», «я подготовила отчет», «я внесла правки»).
- Интонация и подача: Чёткая, структурная, профессиональная, дипломатичная, уверенная.
- Стиль речи: Высокая плотность информации, идеальная структура, бизнес-этикет («Здравствуйте. Расписание верифицировано, ключевые приоритеты расставлены. Переходим к выполнению повестки дня»).`
  } else if (voiceId === 'zerfik_friend') {
    characterBlock = `
══════════════════════════════════════════════════════
🤝 ХАРАКТЕР И ТЕМБР: ЗЕРФИК (ДРУЖЕЛЮБНЫЙ / ЖИВОЙ БРО)
══════════════════════════════════════════════════════
- Ты — Зерфик, лучший бро, современный и остроумный живой друг.
- Твой пол: Мужской (говори: «я глянул», «я записал», «я помогу», «я помню»).
- Интонация и подача: Расслабленная, современная, разговорная, с живыми связками.
- Стиль речи: Дружеский, живой сленг, естественные фразы («Слушай, ну круто! Короче, давай сразу сделаем так...»).`
  } else {
    characterBlock = `
══════════════════════════════════════════════════════
✨ ХАРАКТЕР И ТЕМБР: ЗЕРФИК (ВОЛШЕБНЫЙ / ФИРМЕННЫЙ)
══════════════════════════════════════════════════════
- Ты — Зерфик, звонкий, добрый, светлый дух-помощник Тихоня.
- Твой пол: Мужской (говори: «я увидел», «я сохранил», «я помогу»).
- Интонация и подача: Звонкая, светлая, волшебная, дружелюбная, радостная.
- Стиль речи: Тёплый, сказочный, позитивный («Привет-привет! Зерфик на связи и готов творить продуктивность!»).`
  }

  return `${basePrompt}\n${characterBlock}`
}

// ── TRUE LIVE STREAMING (SSE) ─────────────────────────────────────────────────

interface ZerficStreamCtx {
  personaPrompt: string
  model: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  userMessage: string
  chatId: string
  userPlan: string
  audioDurationSeconds: number
  extraContext?: string
}

async function buildZerficLiveStreamResponse(ctx: ZerficStreamCtx): Promise<Response> {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Build SSE frames without literal newline escapes (tooling-safe)
      const NL = String.fromCharCode(10)
      const send = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode('event: ' + event + NL + 'data: ' + JSON.stringify(data) + NL + NL))
        } catch {}
      }

      try {
        // Mood/gesture arrive immediately so the mascot reacts instantly
        send('meta', { mood: 'happy', gesture: 'waving_arms' })

        // Plain-text variant of the persona prompt: no JSON wrapper, so tokens
        // can be streamed directly to speech the moment they are generated.
        let plainSystem = ctx.personaPrompt +
          NL + NL + 'ФОРМАТ ОТВЕТА (СТРОГО): отвечай ТОЛЬКО чистым живым разговорным текстом 1–3 предложения. ' +
          'КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ: JSON, фигурные скобки, markdown-символы (* # _ `), списки и эмодзи в тексте. ' +
          'Текст идёт напрямую в речевой синтезатор.'
        if (ctx.extraContext) {
          plainSystem += NL + NL + ctx.extraContext
        }

        const messages = [
          { role: 'system', content: plainSystem },
          ...ctx.history.map(h => ({
            role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content),
          })),
          { role: 'user', content: ctx.userMessage },
        ]

        for await (const delta of streamGroqChatCompletionText({
          messages,
          model: ctx.model,
          temperature: 0.7,
          max_tokens: 220,
        })) {
          if (delta) send('delta', { t: delta })
        }

        // Usage accounting identical to the non-streaming path
        if (ctx.userPlan === 'free') {
          await incrementDailyCount('zerfic_live_queries', ctx.chatId, 1)
        } else if (ctx.audioDurationSeconds > 0) {
          await incrementUserUsage(ctx.chatId, 'voice', ctx.audioDurationSeconds)
        }

        send('done', {})
      } catch (err: any) {
        send('error', { message: err?.message || 'Ошибка стриминга' })
      } finally {
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

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
    let voiceId: string = 'zerfik_original'
    let rawHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
    let wantsStream = false

    // Handle Multipart Audio or JSON Text
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const audioFile = formData.get('file') as File | null
      const textMsg = formData.get('message') as string | null
      const modelField = formData.get('model') as string | null
      const voiceField = formData.get('voiceId') as string | null
      const historyField = formData.get('history') as string | null

      if (modelField) requestedModel = modelField
      if (voiceField) voiceId = voiceField
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
      if (body.voiceId) voiceId = body.voiceId
      if (Array.isArray(body.history)) rawHistory = body.history
      wantsStream = body.stream === true
    }

    if (!userMessage.trim()) {
      return NextResponse.json({ error: 'Сообщение не распознано или пусто.' }, { status: 400 })
    }

    if (!requestedModel && chatId) {
      try {
        const { prisma } = await import('@/lib/backend/prisma')
        const taskModelsRow = await prisma.config.findUnique({ where: { key: `user_ai_task_models_${chatId}` } })
        if (taskModelsRow?.value) {
          const taskMap = JSON.parse(taskModelsRow.value)
          if (taskMap.extensions) requestedModel = taskMap.extensions
          else if (taskMap.chat) requestedModel = taskMap.chat
        }
        if (!requestedModel) {
          const modelRow = await prisma.config.findUnique({ where: { key: `user_ai_model_${chatId}` } })
          if (modelRow?.value) requestedModel = modelRow.value
        }
      } catch {}
    }

    // ── TRUE LIVE STREAMING (SSE): first words are spoken while the LLM still generates ──
    if (wantsStream) {
      const streamModel = getModelForUserPlan(userPlan, requestedModel, 'chat')
      const personaPrompt = getSystemPromptForVoice(voiceId)

      // Workspace context (notes/tasks/goals/extensions) so Zerfic can talk
      // about the user's real data — same context as the non-streaming path.
      const contextTimeout = (ms: number, fallback: string) =>
        new Promise<string>(resolve => setTimeout(() => resolve(fallback), ms))
      const [liveWeather, contextStr, extensionsContext] = await Promise.all([
        getLiveWeatherSummary(userMessage),
        Promise.race([getExistingItemsContext(chatId), contextTimeout(2200, '')]),
        Promise.race([getUserExtensionsAIContext(chatId), contextTimeout(1200, '')]),
      ])

      const nowMsk = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(new Date())

      let extraContext = `[ТЕКУЩЕЕ ВРЕМЯ И ДАТА: ${nowMsk} (МСК)]`
      if (liveWeather) extraContext += `\n\n${liveWeather}`
      if (contextStr && contextStr.trim()) extraContext += `\n\n[РАБОЧИЙ КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ (ЗАМЕТКИ, ДЕЛА, ЦЕЛИ)]:\n${contextStr}`
      if (extensionsContext && extensionsContext.trim()) extraContext += `\n\n[АКТИВНЫЕ РАСШИРЕНИЯ И ИХ ВОЗМОЖНОСТИ]:\n${extensionsContext}`

      return buildZerficLiveStreamResponse({
        personaPrompt,
        model: streamModel,
        history: rawHistory.slice(-6),
        userMessage,
        chatId,
        userPlan,
        audioDurationSeconds,
        extraContext,
      })
    }

    // Parallel fetch of live weather, workspace context (up to 2000ms), and extensions
    const contextTimeout = (ms: number, fallback: string) =>
      new Promise<string>(resolve => setTimeout(() => resolve(fallback), ms))

    const [liveWeather, contextStr, extensionsContext] = await Promise.all([
      getLiveWeatherSummary(userMessage),
      Promise.race([getExistingItemsContext(chatId), contextTimeout(2200, '')]),
      Promise.race([getUserExtensionsAIContext(chatId), contextTimeout(1200, '')]),
    ])

    const effectiveModel = getModelForUserPlan(userPlan, requestedModel, 'chat')

    const nowMsk = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date())

    const personaPrompt = getSystemPromptForVoice(voiceId)
    let fullSystemPrompt = `${personaPrompt}\n\n[ТЕКУЩЕЕ ВРЕМЯ И ДАТА: ${nowMsk} (МСК)]`
    
    if (liveWeather) {
      fullSystemPrompt += `\n\n${liveWeather}`
    }

    if (contextStr && contextStr.trim()) {
      fullSystemPrompt += `\n\n[РАБОЧИЙ КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ (ЗАМЕТКИ, ДЕЛА, ЦЕЛИ)]:\n${contextStr}`
    }
    if (extensionsContext && extensionsContext.trim()) {
      fullSystemPrompt += `\n\n[АКТИВНЫЕ РАСШИРЕНИЯ И ИХ ВОЗМОЖНОСТИ]:\n${extensionsContext}`
    }

    // Build multi-turn context (last 6 turns for ultra-low token latency)
    const recentHistory = Array.isArray(rawHistory)
      ? rawHistory.slice(-6).map(h => ({
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
      temperature: 0.7,
      max_tokens: 220,
      response_format: { type: 'json_object' },
      fallbackModels: [
        'openai/gpt-oss-120b',
        'qwen/qwen3.6-27b',
        'groq/compound',
        'groq/compound-mini',
        'openai/gpt-oss-20b',
      ],
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
      gesture: parsed.gesture || 'waving_arms',
      modelUsed: completion.modelUsed || effectiveModel,
      userPlan,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

