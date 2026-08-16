import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'json'
    const chatId = BigInt(authUser.chatId)

    // Fetch user tasks, notes, goals, habits
    const [tasks, notes, goals, habits] = await Promise.all([
      prisma.task.findMany({
        where: { ownerChatId: chatId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.note.findMany({
        where: { ownerChatId: chatId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.goal.findMany({
        where: { ownerChatId: chatId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.habit.findMany({
        where: { ownerChatId: chatId },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const dateStr = new Date().toISOString().slice(0, 10)

    // ── 1. JSON Export ──
    if (format === 'json') {
      const exportData = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        tasks: tasks.map(t => ({
          ...t,
          ownerChatId: t.ownerChatId?.toString(),
          authorChatId: t.authorChatId?.toString(),
        })),
        notes: notes.map(n => ({
          ...n,
          ownerChatId: n.ownerChatId?.toString(),
        })),
        goals: goals.map(g => ({
          ...g,
          ownerChatId: g.ownerChatId?.toString(),
        })),
        habits: habits.map(h => ({
          ...h,
          ownerChatId: h.ownerChatId?.toString(),
        })),
      }

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="zerf_backup_${dateStr}.json"`,
        },
      })
    }

    // ── 2. CSV Export ──
    if (format === 'csv') {
      const headers = ['Название', 'Статус', 'Приоритет', 'Дата выполнения', 'Время', 'Теги', 'Описание', 'Создано']
      const rows = tasks.map(t => [
        escapeCsv(t.title),
        escapeCsv(t.status),
        escapeCsv(t.priority),
        escapeCsv(t.dueDate || ''),
        escapeCsv(t.dueTime || ''),
        escapeCsv((t.tags || []).join('; ')),
        escapeCsv(t.description || ''),
        escapeCsv(t.createdAt.toISOString().slice(0, 10)),
      ])

      // UTF-8 BOM (\uFEFF) ensures Excel properly renders Cyrillic
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="zerf_tasks_${dateStr}.csv"`,
        },
      })
    }

    // ── 3. iCal / ICS Export ──
    if (format === 'ics') {
      const icsEvents = tasks
        .filter(t => t.dueDate)
        .map(t => {
          const dateClean = (t.dueDate || '').replace(/-/g, '')
          const timeClean = (t.dueTime || '09:00').replace(/:/g, '') + '00'
          const dtStart = dateClean.length === 8 ? `${dateClean}T${timeClean}` : `${dateClean}`
          const title = (t.title || 'Задача').replace(/[\r\n]+/g, ' ')
          const desc = (t.description || '').replace(/[\r\n]+/g, '\\n')
          const priorityVal = t.priority === 'urgent' || t.priority === 'high' ? 1 : t.priority === 'medium' ? 5 : 9

          return [
            'BEGIN:VEVENT',
            `UID:task-${t.id}@zerph.app`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
            `DTSTART:${dtStart}`,
            `SUMMARY:${title}`,
            `DESCRIPTION:${desc}`,
            `PRIORITY:${priorityVal}`,
            `STATUS:${t.status === 'done' ? 'COMPLETED' : 'CONFIRMED'}`,
            'END:VEVENT',
          ].join('\r\n')
        })

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Zerf AI//Calendar Export 2.0//RU',
        'CALSCALE:GREGORIAN',
        'X-WR-CALNAME:Zerf AI Задачи',
        ...icsEvents,
        'END:VCALENDAR',
      ].join('\r\n')

      return new NextResponse(icsContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="zerf_calendar_${dateStr}.ics"`,
        },
      })
    }

    return NextResponse.json({ error: 'Неизвестный формат экспорта' }, { status: 400 })
  } catch (error: any) {
    console.error('[Export API] Error:', error)
    return NextResponse.json({ error: 'Ошибка экспорта данных' }, { status: 500 })
  }
}

function escapeCsv(val: string): string {
  if (!val) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}
