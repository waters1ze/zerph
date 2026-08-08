import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const time = searchParams.get('time') || '12:00'
  const title = searchParams.get('title') || 'Напоминание Zerf AI'
  const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  const parts = time.split(':')
  const h = (parts[0] || '12').padStart(2, '0')
  const m = (parts[1] || '00').padStart(2, '0')
  const cleanDate = dateStr.replace(/-/g, '')
  const dtStart = `${cleanDate}T${h}${m}00`

  const endMinNum = (parseInt(m, 10) + 15) % 60
  const endHourNum = parseInt(m, 10) + 15 >= 60 ? (parseInt(h, 10) + 1) % 24 : parseInt(h, 10)
  const endMin = String(endMinNum).padStart(2, '0')
  const endHour = String(endHourNum).padStart(2, '0')
  const dtEnd = `${cleanDate}T${endHour}${endMin}00`

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zerf AI//Alarm Event//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `SUMMARY:⏰ ${title}`,
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
