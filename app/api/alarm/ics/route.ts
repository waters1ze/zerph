import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getFeedSignature, secretsMatch } from '@/lib/backend/auth'

/** Escape user-controlled text for safe embedding into ICS fields. */
function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const chatId = searchParams.get('chatId') || searchParams.get('chat_id')

  if (chatId) {
    // Capability URL: the feed requires a valid per-user HMAC signature
    // (calendar clients cannot send Authorization headers).
    const sig = searchParams.get('sig') || ''
    if (!secretsMatch(sig, getFeedSignature(chatId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate Full Live Calendar Feed for Apple Calendar & Google Calendar (.ics subscription)
    try {
      const cid = BigInt(chatId)
      const tasks = await prisma.task.findMany({
        where: {
          ownerChatId: cid,
          status: { not: 'done' },
          dueDate: { not: null },
        },
        orderBy: { dueDate: 'asc' },
        take: 150,
      })

      const events = tasks.map(t => {
        const dStr = t.dueDate || new Date().toISOString().slice(0, 10)
        const cleanDate = dStr.replace(/-/g, '')
        const tStr = t.dueTime || '09:00'
        const parts = tStr.split(':')
        const h = (parts[0] || '09').padStart(2, '0')
        const m = (parts[1] || '00').padStart(2, '0')
        const dtStart = `${cleanDate}T${h}${m}00`

        const endMinNum = (parseInt(m, 10) + 30) % 60
        const endHourNum = parseInt(m, 10) + 30 >= 60 ? (parseInt(h, 10) + 1) % 24 : parseInt(h, 10)
        const dtEnd = `${cleanDate}T${String(endHourNum).padStart(2, '0')}${String(endMinNum).padStart(2, '0')}00`

        const priorityEmoji = t.priority === 'urgent' ? '🔴 ' : t.priority === 'high' ? '🟠 ' : ''
        const desc = [
          t.description || '',
          t.tags?.length ? `Теги: ${t.tags.join(', ')}` : '',
          'Создано в Zerf AI — https://zerph.vercel.app'
        ].filter(Boolean).join('\n')

        return [
          'BEGIN:VEVENT',
          `UID:zerf-${t.id}@zerph.vercel.app`,
          `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
          `SUMMARY:${icsEscape(priorityEmoji + t.title)}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `DESCRIPTION:${icsEscape(desc.replace(/\n/g, '\\n'))}`,
          'STATUS:CONFIRMED',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:Напоминание: ${icsEscape(t.title)}`,
          'TRIGGER:-PT15M',
          'END:VALARM',
          'END:VEVENT',
        ].join('\r\n')
      }).join('\r\n')

      const feedContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Zerf AI//Task Calendar Feed//RU',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Задачи Zerf AI',
        'X-WR-TIMEZONE:Europe/Moscow',
        'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
        'X-PUBLISHED-TTL:PT15M',
        events,
        'END:VCALENDAR',
      ].join('\r\n')

      return new NextResponse(feedContent, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Disposition': `inline; filename="zerf-calendar.ics"`,
        },
      })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  // Single Alarm Event fallback (no user data — only query params)
  const time = searchParams.get('time') || '12:00'
  const title = searchParams.get('title') || 'Напоминание Zerf AI'
  const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  if (!/^\d{1,2}:\d{2}$/.test(time) || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }
  const safeTitle = title.replace(/[\r\n]/g, ' ').slice(0, 120)

  const parts = time.split(':')
  const h = (parts[0] || '12').padStart(2, '0')
  const m = (parts[1] || '00').padStart(2, '0')
  const cleanDate = dateStr.replace(/-/g, '')
  const dtStart = `${cleanDate}T${h}${m}00`

  const endMinNum = (parseInt(m, 10) + 15) % 60
  const endHourNum = parseInt(m, 10) + 15 >= 60 ? (parseInt(h, 10) + 1) % 24 : parseInt(h, 10)
  const dtEnd = `${cleanDate}T${String(endHourNum).padStart(2, '0')}${String(endMinNum).padStart(2, '0')}00`

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zerf AI//Alarm Event//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `SUMMARY:⏰ ${safeTitle}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    'DESCRIPTION:Напоминание и звуковой сигнал Zerf AI',
    'BEGIN:VALARM',
    'ACTION:AUDIO',
    'TRIGGER:-PT0M',
    'ATTACH;VALUE=URI:Chord',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Напоминание Zerf AI',
    'TRIGGER:-PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="alarm-${time}.ics"`,
    },
  })
}
