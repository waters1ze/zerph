import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await params
    const token = rawToken.replace(/\.ics$/i, '')

    if (!token || token.length < 8) {
      return new NextResponse('Invalid calendar token', { status: 400 })
    }

    // Find the config key matching cal_feed_token_* where value = token
    const feedConfig = await prisma.config.findFirst({
      where: {
        key: { startsWith: 'cal_feed_token_' },
        value: token,
      },
    })

    if (!feedConfig) {
      return new NextResponse('Calendar feed not found or expired', { status: 404 })
    }

    const chatIdStr = feedConfig.key.replace('cal_feed_token_', '')
    const numericChatId = BigInt(chatIdStr)

    // Fetch user's tasks with due dates that are not deleted/completed older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    const tasks = await prisma.task.findMany({
      where: {
        ownerChatId: numericChatId,
        dueDate: { not: null },
        OR: [
          { status: { notIn: ['done', 'completed'] } },
          { dueDate: { gte: thirtyDaysAgo } },
        ],
      },
      orderBy: { dueDate: 'asc' },
    })

    // Fetch user's active goals with deadlines
    const goals = await prisma.goal.findMany({
      where: {
        ownerChatId: numericChatId,
        deadline: { not: null },
      },
    })

    const nowStr = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'

    const events: string[] = []

    // 1. Task events
    for (const t of tasks) {
      if (!t.dueDate) continue
      const dateParts = t.dueDate.split('-')
      if (dateParts.length !== 3) continue

      const dateCompact = t.dueDate.replace(/-/g, '')
      let dtStart = ''
      let dtEnd = ''

      if (t.dueTime && /^\d{2}:\d{2}$/.test(t.dueTime)) {
        const timeCompact = t.dueTime.replace(/:/g, '') + '00'
        dtStart = `DTSTART:${dateCompact}T${timeCompact}`

        // Calculate end time (+45 minutes default)
        const [h, m] = t.dueTime.split(':').map(Number)
        const endMinutes = h * 60 + m + 45
        const endH = Math.floor(endMinutes / 60) % 24
        const endM = endMinutes % 60
        const endHStr = String(endH).padStart(2, '0')
        const endMStr = String(endM).padStart(2, '0')
        dtEnd = `DTEND:${dateCompact}T${endHStr}${endMStr}00`
      } else {
        // All-day event
        dtStart = `DTSTART;VALUE=DATE:${dateCompact}`
        // Next day for end of all-day
        const nextDay = new Date(t.dueDate)
        nextDay.setDate(nextDay.getDate() + 1)
        const nextDayCompact = nextDay.toISOString().slice(0, 10).replace(/-/g, '')
        dtEnd = `DTEND;VALUE=DATE:${nextDayCompact}`
      }

      const isDone = t.status === 'done' || t.status === 'completed'
      const statusPrefix = isDone ? '✅ ' : ''
      const title = escapeIcsText(`${statusPrefix}${t.title}`)
      const desc = escapeIcsText(t.description || '')
      const priorityVal = t.priority === 'urgent' || t.priority === 'high' ? 1 : t.priority === 'medium' ? 5 : 9
      const categories = (t.tags && t.tags.length > 0) ? `CATEGORIES:${t.tags.join(',')}\r\n` : ''

      events.push([
        'BEGIN:VEVENT',
        `UID:task-${t.id}@zerph.app`,
        `DTSTAMP:${nowStr}`,
        dtStart,
        dtEnd,
        `SUMMARY:${title}`,
        `DESCRIPTION:${desc}`,
        `PRIORITY:${priorityVal}`,
        `STATUS:${isDone ? 'COMPLETED' : 'CONFIRMED'}`,
        categories +
        'END:VEVENT',
      ].filter(Boolean).join('\r\n'))
    }

    // 2. Goal events
    for (const g of goals) {
      if (!g.deadline) continue
      const dateCompact = g.deadline.replace(/-/g, '')
      if (dateCompact.length !== 8) continue

      events.push([
        'BEGIN:VEVENT',
        `UID:goal-${g.id}@zerph.app`,
        `DTSTAMP:${nowStr}`,
        `DTSTART;VALUE=DATE:${dateCompact}`,
        `SUMMARY:🎯 Цель: ${escapeIcsText(g.title)} (${g.progress}%)`,
        `DESCRIPTION:${escapeIcsText(g.description || '')}`,
        'STATUS:CONFIRMED',
        'CATEGORIES:Цели',
        'END:VEVENT',
      ].join('\r\n'))
    }

    const icsCalendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zerf AI//Calendar Feed 2.0//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Zerf AI',
      'X-WR-TIMEZONE:Europe/Moscow',
      'X-WR-CALDESC:Ваши задачи и цели из Zerf AI',
      'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
      'X-PUBLISHED-TTL:PT15M',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n')

    return new NextResponse(icsCalendar, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="zerf_calendar.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('[Calendar Feed GET] Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

function escapeIcsText(str: string): string {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}
