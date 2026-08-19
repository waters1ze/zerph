/**
 * POST /api/tasks/smart-reschedule
 * AI Smart Overdue Task Rescheduler
 * Distributes overdue tasks across upcoming days with balanced time slots.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { callGroqChatCompletion } from '@/lib/backend/groq-pool'
import { prisma } from '@/lib/backend/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const tasks = Array.isArray(body?.tasks) ? body.tasks : []

    if (tasks.length === 0) {
      return NextResponse.json({ ok: false, error: 'Нет задач для перепланирования' }, { status: 400 })
    }

    const now = new Date()
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    const nowStr = formatter.format(now)
    const todayIso = now.toISOString().split('T')[0]

    const prompt = `Ты — экспертный персональный тайм-менеджер Zerf Note.
Текущее время: ${nowStr} (МСК). Сегодняшняя дата: ${todayIso}.

Пользователь накопил список просроченных дел. 
Твоя задача — умно распределить эти дела на ближайшие 1–3 дня (начиная с сегодняшнего вечера или завтрашнего дня), чтобы пользователь не перегружался:
- Назначь для каждой задачи дату "dueDate" (формат YYYY-MM-DD, строго начиная с ${todayIso})
- Назначь удобное время напоминания "dueTime" (формат HH:MM, например "10:00", "14:30", "18:00")
- Не ставь все дела на одно и то же время! Разнеси их по разным часам и дням с учетом приоритета.

Входные задачи:
${JSON.stringify(tasks.map((t: any) => ({ id: t.id, title: t.title, priority: t.priority })), null, 2)}

Отвечай СТРОГО валидным JSON формата:
{
  "rescheduled": [
    {
      "id": "id задачи",
      "dueDate": "YYYY-MM-DD",
      "dueTime": "HH:MM",
      "reason": "краткое пояснение на русском, например: 'Перенесено на завтра в 11:00'"
    }
  ]
}`

    const completion = await callGroqChatCompletion({
      messages: [{ role: 'system', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      fallbackModels: ['llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b'],
    })

    const parsed = JSON.parse(completion.content || '{}')
    const rescheduledList: Array<{ id: string; dueDate: string; dueTime: string; reason?: string }> =
      Array.isArray(parsed.rescheduled) ? parsed.rescheduled : []

    // If authenticated, persist updates to DB
    if (authUser?.chatId && rescheduledList.length > 0) {
      const ownerChatId = BigInt(authUser.chatId)
      for (const item of rescheduledList) {
        if (!item.id || !item.dueDate) continue
        await prisma.task.updateMany({
          where: {
            id: item.id,
            ownerChatId,
          },
          data: {
            dueDate: item.dueDate,
            dueTime: item.dueTime || null,
            status: 'todo',
            reminderSent: false,
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      ok: true,
      rescheduled: rescheduledList,
      count: rescheduledList.length,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Ошибка перепланирования' }, { status: 500 })
  }
}
