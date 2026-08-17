import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { normalizePlan } from '@/lib/plans'
import {
  getAllTasks,
  getAllNotes,
  getAllGoals,
  getFriends,
  saveParsedItemToDb,
} from '@/lib/backend/db'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

async function getChatIdAndPlan(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) return null

  const cid = BigInt(authUser.chatId)
  const { getUserUsageAndLimits } = await import('@/lib/backend/db')
  const limits = await getUserUsageAndLimits(authUser.chatId)
  const plan = limits.plan

  const chat = await prisma.telegramChat.findUnique({
    where: { chatId: cid },
    select: {
      chatId: true,
      firstName: true,
      lastName: true,
      username: true,
    }
  })

  return {
    chatId: cid,
    chatIdNum: Number(authUser.chatId),
    name: [chat?.firstName, chat?.lastName].filter(Boolean).join(' ') || chat?.username || `User #${authUser.chatId}`,
    username: chat?.username || null,
    plan,
    isProOrCorp: plan === 'pro' || plan === 'corp',
  }
}

// GET /api/cli/data — Fetch full snapshot for CLI dashboard
export async function GET(req: NextRequest) {
  try {
    const user = await getChatIdAndPlan(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    }

    // Check Pro / Corp Tier requirement
    if (!user.isProOrCorp) {
      return NextResponse.json({
        allowed: false,
        plan: user.plan,
        name: user.name,
        chatId: String(user.chatId),
        upgradeUrl: 'https://t.me/Zerph_bot?start=buy',
        message: 'Zerf CLI доступен для подписчиков тарифов Pro и Corp. Оформите подписку в боте или на сайте, чтобы разблокировать терминальный клиент!',
      }, { status: 403 })
    }

    // Fetch all user assets in parallel
    const [tasks, notes, goals, habits, friends] = await Promise.all([
      getAllTasks(user.chatId),
      getAllNotes(user.chatId),
      getAllGoals(user.chatId),
      prisma.habit.findMany({ where: { ownerChatId: user.chatId } }).catch(() => []),
      getFriends(user.chatIdNum),
    ])

    return NextResponse.json({
      allowed: true,
      user: {
        chatId: String(user.chatId),
        name: user.name,
        username: user.username,
        plan: user.plan,
      },
      stats: {
        totalTasks: tasks.length,
        doneTasks: tasks.filter(t => t.status === 'done').length,
        totalNotes: notes.length,
        totalGoals: goals.length,
        totalHabits: habits.length,
      },
      tasks,
      notes,
      goals,
      habits,
      friends,
    })
  } catch (err: unknown) {
    console.error('CLI data fetch error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/cli/data — Mutate items from CLI
export async function POST(req: NextRequest) {
  try {
    const user = await getChatIdAndPlan(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    }

    if (!user.isProOrCorp) {
      return NextResponse.json({
        error: 'Forbidden: Pro or Corp tier required for CLI operations.',
        upgradeUrl: 'https://t.me/Zerph_bot?start=buy',
      }, { status: 403 })
    }

    const body = await req.json()
    const { action, itemType, item, id, query } = body

    // 1. Toggle Task Done / Undone
    if (action === 'toggle_task' && id) {
      const existing = await prisma.task.findUnique({ where: { id } })
      if (existing && existing.ownerChatId === user.chatId) {
        const nextStatus = existing.status === 'done' ? 'todo' : 'done'
        const updated = await prisma.task.update({
          where: { id },
          data: {
            status: nextStatus,
            completedAt: nextStatus === 'done' ? new Date() : null,
          }
        })
        return NextResponse.json({ success: true, task: updated })
      }
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // 2. Delete Task / Note / Goal
    if (action === 'delete' && id && itemType) {
      if (itemType === 'task') {
        await prisma.task.deleteMany({ where: { id, ownerChatId: user.chatId } })
      } else if (itemType === 'note') {
        await prisma.note.deleteMany({ where: { id, ownerChatId: user.chatId } })
      } else if (itemType === 'goal') {
        await prisma.goal.deleteMany({ where: { id, ownerChatId: user.chatId } })
      }
      return NextResponse.json({ success: true, deletedId: id })
    }

    // 3. Create parsed item
    if (action === 'create' && item) {
      const saved = await saveParsedItemToDb(item, user.chatIdNum)
      return NextResponse.json({ success: true, saved })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('CLI mutate error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
