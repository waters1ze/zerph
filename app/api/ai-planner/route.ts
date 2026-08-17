/**
 * POST /api/ai-planner
 * Accepts today's tasks (without dueTime) and returns AI-generated time slots.
 * Requires authenticated session (sessionToken header).
 * Applies distributed slots back to tasks via DB update.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { generateDayPlan, TaskForPlanning } from '@/lib/backend/ai-planner'
import { planAtLeast } from '@/lib/backend/plans'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const chatId = authUser.chatId
    const user = await prisma.telegramChat.findUnique({
      where: { chatId: BigInt(chatId) },
      select: { plan: true, isAdmin: true }
    })
    const isPro = user?.isAdmin || planAtLeast(user?.plan, 'pro')
    if (!isPro) {
      return NextResponse.json({
        error: 'Функция Smart Reschedule и AI-автопланирования дня доступна на тарифах Zerf Pro и Corp. Оформите Pro в Настройках!',
        requiresPro: true,
      }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const todayStr: string = body.date || new Date().toISOString().slice(0, 10)
    const workdayStart: string = body.workdayStart || '09:00'
    const workdayEnd: string   = body.workdayEnd   || '19:00'

    // Fetch today's tasks for this user (not completed, not draft)
    const tasks = await prisma.task.findMany({
      where: {
        ownerChatId: BigInt(chatId),
        dueDate: todayStr,
        status: { notIn: ['done', 'completed', 'draft'] },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (tasks.length === 0) {
      return NextResponse.json({ success: true, message: 'Нет задач на сегодня для планирования', slots: [] })
    }

    const taskInputs: TaskForPlanning[] = tasks.map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority || 'medium',
      dueTime: t.dueTime || null,
      tags: t.tags || [],
    }))

    const slots = await generateDayPlan(taskInputs, todayStr, workdayStart, workdayEnd)

    // Apply the generated time slots to tasks in DB
    const updates = await Promise.allSettled(
      slots.map(slot =>
        prisma.task.update({
          where: {
            id: slot.taskId,
            ownerChatId: BigInt(chatId), // security: only own tasks
          },
          data: { dueTime: slot.dueTime },
        })
      )
    )

    const updatedCount = updates.filter(r => r.status === 'fulfilled').length

    return NextResponse.json({
      success: true,
      slots,
      updatedCount,
      message: `ИИ распланировал ${updatedCount} задач${updatedCount === 1 ? 'у' : updatedCount < 5 ? 'и' : ''} по временным слотам`,
    })
  } catch (err) {
    console.error('[AI Planner API] Error:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
