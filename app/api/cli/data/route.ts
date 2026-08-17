import { NextRequest } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import {
  getAllTasks,
  getAllNotes,
  getAllGoals,
  getFriends,
  saveParsedItemToDb,
} from '@/lib/backend/db'
import { PLANS, PlanId } from '@/lib/plans'
import { getDailyCount, incrementDailyCount } from '@/lib/backend/plans'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

function safeJsonResponse(payload: any, status = 200) {
  const json = JSON.stringify(payload, (_key, value) => {
    if (typeof value === 'bigint') return Number(value)
    if (value instanceof Date) return value.toISOString()
    return value
  })
  return new Response(json, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

async function getChatIdAndPlan(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) return null

  const cid = BigInt(authUser.chatId)
  const { getUserUsageAndLimits } = await import('@/lib/backend/db')
  const limits = await getUserUsageAndLimits(authUser.chatId)
  const plan = (limits.plan || 'free') as PlanId

  const chat = await prisma.telegramChat.findUnique({
    where: { chatId: cid },
    select: {
      chatId: true,
      firstName: true,
      lastName: true,
      username: true,
    }
  })

  const isPlusOrHigher = plan === 'plus' || plan === 'pro' || plan === 'corp'
  return {
    chatId: cid,
    chatIdNum: Number(authUser.chatId),
    name: [chat?.firstName, chat?.lastName].filter(Boolean).join(' ') || chat?.username || `User #${authUser.chatId}`,
    username: chat?.username || null,
    plan,
    isPlusOrHigher,
    planLimits: PLANS[plan] || PLANS.free,
  }
}

// GET /api/cli/data — Fetch full snapshot for CLI dashboard
export async function GET(req: NextRequest) {
  try {
    const user = await getChatIdAndPlan(req)
    if (!user) {
      return safeJsonResponse({ error: 'Unauthorized', requiresAuth: true }, 401)
    }

    // Check Plus+ Tier requirement
    if (!user.isPlusOrHigher) {
      return safeJsonResponse({
        allowed: false,
        plan: user.plan,
        name: user.name,
        chatId: String(user.chatId),
        upgradeUrl: 'https://t.me/Zerph_bot?start=buy',
        message: 'Zerf CLI доступен для подписчиков тарифов Plus, Pro и Corp. Оформите подписку в боте или на сайте, чтобы разблокировать терминальный клиент!',
      }, 403)
    }

    // Fetch daily counters & user assets in parallel
    const [tasks, notes, goals, habits, friends, cliUsed, voiceUsed, chatUsed] = await Promise.all([
      getAllTasks(user.chatId),
      getAllNotes(user.chatId),
      getAllGoals(user.chatId),
      prisma.habit.findMany({ where: { ownerChatId: user.chatId } }).catch(() => []),
      getFriends(user.chatIdNum),
      getDailyCount('cli', user.chatId),
      getDailyCount('voice', user.chatId),
      getDailyCount('chat', user.chatId),
    ])

    const maxCli = user.planLimits.cliRequestsPerDay
    const maxVoice = user.planLimits.voiceSecondsPerDay
    const maxChat = user.planLimits.chatMessagesPerDay

    const payload = {
      allowed: true,
      user: {
        chatId: String(user.chatId),
        name: user.name,
        username: user.username,
        plan: user.plan,
      },
      limits: {
        plan: user.plan,
        cliUsed,
        maxCli: isFinite(maxCli) ? maxCli : '∞',
        voiceUsedSeconds: voiceUsed,
        maxVoiceSeconds: isFinite(maxVoice) ? maxVoice : '∞',
        chatUsed,
        maxChat: isFinite(maxChat) ? maxChat : '∞',
        notesCount: notes.length,
        maxNotes: isFinite(user.planLimits.maxStoredNotes) ? user.planLimits.maxStoredNotes : '∞',
      },
      stats: {
        totalTasks: tasks.length,
        doneTasks: tasks.filter((t: any) => t.status === 'done').length,
        totalNotes: notes.length,
        totalGoals: goals.length,
        totalHabits: habits.length,
      },
      tasks,
      notes,
      goals,
      habits,
      friends,
    }

    return safeJsonResponse(payload, 200)
  } catch (err: unknown) {
    console.error('CLI data fetch error:', err)
    return safeJsonResponse({ error: String(err) }, 500)
  }
}

// POST /api/cli/data — Mutate items from CLI
export async function POST(req: NextRequest) {
  try {
    const user = await getChatIdAndPlan(req)
    if (!user) {
      return safeJsonResponse({ error: 'Unauthorized', requiresAuth: true }, 401)
    }

    if (!user.isPlusOrHigher) {
      return safeJsonResponse({
        error: 'Forbidden: Plus, Pro or Corp tier required for CLI operations.',
        upgradeUrl: 'https://t.me/Zerph_bot?start=buy',
      }, 403)
    }

    // Check daily CLI limit if finite
    const maxCli = user.planLimits.cliRequestsPerDay
    if (isFinite(maxCli)) {
      const currentCliUsed = await getDailyCount('cli', user.chatId)
      if (currentCliUsed >= maxCli) {
        return safeJsonResponse({
          error: `Достигнут дневной лимит запросов для тарифа ${user.plan.toUpperCase()} (${maxCli} в день). Лимиты сбросятся в 00:00 МСК.`,
          upgradeUrl: 'https://t.me/Zerph_bot?start=buy',
        }, 429)
      }
    }

    // Increment CLI daily counter
    await incrementDailyCount('cli', user.chatId, 1)

    const body = await req.json()
    const { action, itemType, item, id } = body

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
        return safeJsonResponse({ success: true, task: updated })
      }
      return safeJsonResponse({ error: 'Task not found' }, 404)
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
      return safeJsonResponse({ success: true, deletedId: id })
    }

    // 3. Create parsed item
    if (action === 'create' && item) {
      const saved = await saveParsedItemToDb(item, user.chatIdNum)
      return safeJsonResponse({ success: true, saved })
    }

    return safeJsonResponse({ error: 'Unsupported action' }, 400)
  } catch (err: unknown) {
    console.error('CLI mutate error:', err)
    return safeJsonResponse({ error: String(err) }, 500)
  }
}
