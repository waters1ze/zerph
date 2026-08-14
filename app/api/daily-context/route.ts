/**
 * GET /api/daily-context — Returns today's date context, real Celsius weather, and personalized AI tip
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

const RU_MONTHS = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря'
]
const RU_DAYS = [
  'Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'
]

const DAILY_TIPS = [
  'Начни с самой важной задачи — и весь день пройдет на подъеме.',
  'Сфокусируйся на одном деле: глубокий фокус экономит часы работы.',
  'Делай короткий перерыв каждые 90 минут — это лучшая инвестиция в энергию.',
  'Выдели 3 главные задачи на сегодня и доведи их до результата.',
  'Отключи лишние уведомления и погрузись в состояние потока.',
  'Даже маленький шаг вперед к большой цели — это победа.',
  'Твои задачи уже структурированы. Двигайся по плану шаг за шагом.',
]

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: 'Ясно',
  1: 'Преимущественно ясно',
  2: 'Переменная облачность',
  3: 'Пасмурно',
  45: 'Туман',
  48: 'Иней',
  51: 'Небольшая морось',
  53: 'Морось',
  55: 'Плотная морось',
  61: 'Небольшой дождь',
  63: 'Умеренный дождь',
  65: 'Сильный дождь',
  71: 'Небольшой снег',
  73: 'Снегопад',
  75: 'Сильный снегопад',
  80: 'Ливень',
  81: 'Сильный ливень',
  82: 'Шквальный ливень',
  95: 'Гроза',
}

// In-memory cache for personalized daily tips to minimize LLM token usage (1 call per user per day)
const userTipCache = new Map<string, { date: string; tip: string }>()

async function getRealWeather(): Promise<string> {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=55.7558&longitude=37.6173&current=temperature_2m,weather_code&timezone=Europe/Moscow',
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(3000) }
    )
    if (res.ok) {
      const data = await res.json()
      const temp = Math.round(data.current?.temperature_2m ?? 15)
      const code = data.current?.weather_code ?? 0
      const desc = WEATHER_DESCRIPTIONS[code] || 'Облачно'
      const tempSign = temp > 0 ? '+' : ''
      return `Москва: ${desc} ${tempSign}${temp}°C`
    }
  } catch {}

  // Fallback to wttr.in with metric Celsius flag
  try {
    const fallbackRes = await fetch(
      'https://wttr.in/Moscow?format=%C+%t&m&lang=ru',
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(3000) }
    )
    if (fallbackRes.ok) {
      const text = await fallbackRes.text()
      return `Москва: ${text.trim()}`
    }
  } catch {}

  return 'Москва: Переменная облачность +15°C'
}

async function getPersonalizedDailyTip(chatId: string | null, todayISO: string): Promise<string> {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const defaultTip = DAILY_TIPS[dayOfYear % DAILY_TIPS.length]

  if (!chatId) return defaultTip

  // Check cache first (0 tokens)
  const cached = userTipCache.get(chatId)
  if (cached && cached.date === todayISO && cached.tip) {
    return cached.tip
  }

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return defaultTip

  try {
    const cid = BigInt(chatId)
    const [user, tasks, notes] = await Promise.all([
      prisma.telegramChat.findUnique({ where: { chatId: cid }, select: { firstName: true } }),
      prisma.task.findMany({
        where: { ownerChatId: cid, status: { not: 'done' } },
        take: 3,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        select: { title: true, priority: true }
      }),
      prisma.note.findMany({
        where: { ownerChatId: cid },
        take: 2,
        orderBy: { updatedAt: 'desc' },
        select: { title: true }
      })
    ])

    const userName = user?.firstName || 'друг'
    const taskList = tasks.map(t => t.title).filter(Boolean)
    const noteList = notes.map(n => n.title).filter(Boolean)

    if (taskList.length === 0 && noteList.length === 0) {
      userTipCache.set(chatId, { date: todayISO, tip: defaultTip })
      return defaultTip
    }

    const contextText = [
      taskList.length ? `Задачи: ${taskList.join(', ')}` : '',
      noteList.length ? `Заметки: ${noteList.join(', ')}` : '',
    ].filter(Boolean).join(' | ')

    const prompt = `Ты — умный персональный ИИ-наставник по продуктивности Zerf AI. Имя пользователя: ${userName}. Его фокус на сегодня: ${contextText}. Сформулируй ОДИН ультра-точный, вдохновляющий и практичный совет на сегодня под эти дела. Правила: ровно 1 предложение, максимум 12-16 слов, только на русском языке, без кавычек и вводных фраз.`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(3000)
    })

    if (groqRes.ok) {
      const data = await groqRes.json()
      const generated = data.choices?.[0]?.message?.content?.trim()?.replace(/^["«]|["»]$/g, '')
      if (generated && generated.length > 10) {
        userTipCache.set(chatId, { date: todayISO, tip: generated })
        return generated
      }
    }
  } catch (e) {
    console.error('Personalized tip error:', e)
  }

  userTipCache.set(chatId, { date: todayISO, tip: defaultTip })
  return defaultTip
}

export async function GET(req: NextRequest) {
  try {
    const now = new Date()

    // Moscow time via Intl
    const mskFormatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const mskDateStr = mskFormatter.format(now)

    const dayFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const parts = dayFormatter.formatToParts(now)
    const getPart = (t: string) => parts.find(p => p.type === t)?.value || ''
    const todayISO = `${getPart('year')}-${getPart('month')}-${getPart('day')}`

    const dayOfWeekIdx = new Date(todayISO + 'T12:00:00').getDay()
    const dayName = RU_DAYS[dayOfWeekIdx]

    const day = parseInt(getPart('day'))
    const monthIdx = parseInt(getPart('month')) - 1
    const year = parseInt(getPart('year'))

    const authUser = await getAuthenticatedUser(req)
    const chatId = authUser?.chatId || null

    const [weather, tip] = await Promise.all([
      getRealWeather(),
      getPersonalizedDailyTip(chatId, todayISO)
    ])

    return NextResponse.json({
      success: true,
      todayISO,
      dayName,
      formattedDate: `${dayName}, ${day} ${RU_MONTHS[monthIdx]} ${year}`,
      mskTime: mskDateStr,
      weather,
      tip,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
