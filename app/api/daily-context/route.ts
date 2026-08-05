/**
 * GET /api/daily-context — Returns today's date context, weather, and a motivational fact
 * Uses wttr.in for weather (no API key needed) and JS Date for date info
 */

import { NextResponse } from 'next/server'

const RU_MONTHS = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря'
]
const RU_DAYS = [
  'Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'
]

const DAILY_TIPS = [
  'Начни с самой сложной задачи — потом всё пойдёт легче.',
  'Сфокусируйся на одном важном деле. Многозадачность снижает продуктивность на 40%.',
  'Сделай небольшой перерыв каждые 90 минут — это лучшая инвестиция в энергию.',
  'Запиши 3 главные задачи на сегодня и держи их в фокусе.',
  'Отключи уведомления на 2 часа и войди в состояние потока.',
  'Вода, движение и свет — три ресурса продуктивного дня.',
  'Даже маленький шаг вперёд — это прогресс.',
  'Доверяй системе: твои задачи уже расставлены по приоритетам.',
]

function getDailyTip(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return DAILY_TIPS[dayOfYear % DAILY_TIPS.length]
}

export async function GET() {
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

    // Fetch weather from wttr.in (free, no API key)
    let weather = '🌤 Данные недоступны'
    try {
      const weatherRes = await fetch(
        'https://wttr.in/Moscow?format=%C+%t',
        { next: { revalidate: 1800 }, signal: AbortSignal.timeout(3000) }
      )
      if (weatherRes.ok) {
        const text = await weatherRes.text()
        weather = `🌍 Москва: ${text.trim()}`
      }
    } catch { /* weather unavailable, use default */ }

    const tip = getDailyTip()

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
