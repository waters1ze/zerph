/**
 * GET /api/daily-context — Returns today's date context, real Celsius weather, and personalized AI tip
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { GROQ_CHAT_MODEL } from '@/lib/config'
import { callGroqChatCompletion, stripThinkingTags } from '@/lib/backend/groq-pool'

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

const KNOWN_COORDINATES: Record<string, { lat: number; lon: number; name: string }> = {
  'москва': { lat: 55.7558, lon: 37.6173, name: 'Москва' },
  'санкт-петербург': { lat: 59.9343, lon: 30.3351, name: 'Санкт-Петербург' },
  'спб': { lat: 59.9343, lon: 30.3351, name: 'Санкт-Петербург' },
  'екатеринбург': { lat: 56.8389, lon: 60.6057, name: 'Екатеринбург' },
  'новосибирск': { lat: 55.0084, lon: 82.9357, name: 'Новосибирск' },
  'казань': { lat: 55.7887, lon: 49.1221, name: 'Казань' },
  'нижний новгород': { lat: 56.3269, lon: 44.0059, name: 'Нижний Новгород' },
  'сочи': { lat: 43.5855, lon: 39.7231, name: 'Сочи' },
  'краснодар': { lat: 45.0355, lon: 38.9754, name: 'Краснодар' },
  'самара': { lat: 53.1959, lon: 50.1002, name: 'Самара' },
  'уфа': { lat: 54.7388, lon: 55.9721, name: 'Уфа' },
  'челябинск': { lat: 55.1644, lon: 61.4368, name: 'Челябинск' },
  'ростов-на-дону': { lat: 47.2357, lon: 39.7015, name: 'Ростов-на-Дону' },
  'красноярск': { lat: 56.0153, lon: 92.8932, name: 'Красноярск' },
  'воронеж': { lat: 51.6608, lon: 39.2003, name: 'Воронеж' },
  'пермь': { lat: 58.0105, lon: 56.2502, name: 'Пермь' },
  'волгоград': { lat: 48.7080, lon: 44.5133, name: 'Волгоград' },
  'тюмень': { lat: 57.1522, lon: 65.5272, name: 'Тюмень' },
  'минск': { lat: 53.9006, lon: 27.5590, name: 'Минск' },
  'алматы': { lat: 43.2220, lon: 76.8512, name: 'Алматы' },
  'астана': { lat: 51.1694, lon: 71.4491, name: 'Астана' },
  'ереван': { lat: 40.1792, lon: 44.4991, name: 'Ереван' },
  'тбилиси': { lat: 41.7151, lon: 44.8271, name: 'Тбилиси' },
  'баку': { lat: 40.4093, lon: 49.8671, name: 'Баку' },
  'ташкент': { lat: 41.2995, lon: 69.2401, name: 'Ташкент' },
}

// In-memory cache for personalized daily tips to minimize LLM token usage (1 call per user per day)
const userTipCache = new Map<string, { date: string; tip: string }>()

async function getRealWeather(requestedCity: string = 'Москва'): Promise<string> {
  const cleanCity = (requestedCity || 'Москва').trim()
  const normKey = cleanCity.toLowerCase()
  const known = KNOWN_COORDINATES[normKey]

  let lat = known?.lat
  let lon = known?.lon
  let displayName = known?.name || cleanCity

  // If not in known list, use Open-Meteo geocoding to find lat/lon
  if (lat === undefined || lon === undefined) {
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=ru&format=json`,
        { signal: AbortSignal.timeout(2500) }
      )
      if (geoRes.ok) {
        const geoData = await geoRes.json()
        if (geoData.results && geoData.results.length > 0) {
          lat = geoData.results[0].latitude
          lon = geoData.results[0].longitude
          displayName = geoData.results[0].name || cleanCity
        }
      }
    } catch {}
  }

  // If coordinates found, fetch from Open-Meteo
  if (lat !== undefined && lon !== undefined) {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`,
        { next: { revalidate: 1800 }, signal: AbortSignal.timeout(3000) }
      )
      if (res.ok) {
        const data = await res.json()
        const temp = Math.round(data.current?.temperature_2m ?? 15)
        const code = data.current?.weather_code ?? 0
        const desc = WEATHER_DESCRIPTIONS[code] || 'Облачно'
        const tempSign = temp > 0 ? '+' : ''
        return `${displayName}: ${desc} ${tempSign}${temp}°C`
      }
    } catch {}
  }

  // Fallback to wttr.in
  try {
    const fallbackRes = await fetch(
      `https://wttr.in/${encodeURIComponent(cleanCity)}?format=%C+%t&m&lang=ru`,
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(3000) }
    )
    if (fallbackRes.ok) {
      const text = await fallbackRes.text()
      if (text && !text.includes('Unknown location')) {
        return `${displayName}: ${text.trim()}`
      }
    }
  } catch {}

  return `${displayName}: Переменная облачность +18°C`
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

    const prompt = `Ты — персональный ИИ-наставник по продуктивности Zerf Note. Имя пользователя: ${userName}. Его фокус на сегодня: ${contextText}.
Сформулируй ОДИН короткий, вдохновляющий и практичный совет на сегодня на русском языке (ровно 1 предложение, максимум 14 слов).
Запрещено выводить теги <think>, запрещено рассуждать или анализировать. Напиши сразу только текст совета.`

    const result = await callGroqChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_CHAT_MODEL,
      temperature: 0.3,
      max_tokens: 250,
    })

    const generated = stripThinkingTags(result.content || '')
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .replace(/<\/think>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/^["«]|["»]$/g, '')
      .replace(/^Совет:\s*/i, '')
      .replace(/^\s*[-*•]\s*/, '')
      .trim()

    const lower = generated.toLowerCase()
    const hasLeak = lower.includes('think') || lower.includes('process') || lower.includes('analyze') || lower.includes('user input') || lower.includes('role:') || lower.includes('focus:')

    if (generated && generated.length > 10 && !hasLeak) {
      userTipCache.set(chatId, { date: todayISO, tip: generated })
      return generated
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
    const { searchParams } = new URL(req.url)
    const cityParam = searchParams.get('city') || ''

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

    let userCity = cityParam
    if (!userCity && chatId) {
      try {
        const cityConfig = await prisma.config.findUnique({
          where: { key: `user_city_${chatId}` }
        })
        if (cityConfig?.value) {
          userCity = cityConfig.value
        }
      } catch {}
    }

    const [weather, tip] = await Promise.all([
      getRealWeather(userCity || 'Москва'),
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
