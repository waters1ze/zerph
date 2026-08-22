import crypto from 'crypto'
import { getInternalPepper } from './auth'
import { prisma } from './prisma'

/**
 * Share-cards engine (feature: viral PNG cards).
 * All collectors are DETERMINISTIC (no LLM, no wall-clock randomness beyond
 * the requested window) so they are safely unit-testable and cheap to render.
 */

/** Capability signature allowing the Telegram bot to fetch cards without
 *  user session headers. MUST be the single source of truth — used by both
 *  the /api/cards/[kind] route and server/bot.ts. */
export function cardSignature(kind: string, chatId: string | number | bigint): string {
  return crypto
    .createHmac('sha256', getInternalPepper() || 'zerf-card-pepper')
    .update(`card:${kind}:${String(chatId)}`)
    .digest('hex')
    .slice(0, 32)
}

export interface WeeklyCardStats {
  tasksCreated: number
  tasksCompleted: number
  notesCreated: number
  bestDay: string
  bestDayCount: number
  streakDays: number
  weekLabel: string
}

const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

export async function collectWeeklyStats(chatId: bigint): Promise<WeeklyCardStats> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [tasksCreated, tasksCompleted, notesCreated, chat] = await Promise.all([
    prisma.task.count({ where: { ownerChatId: chatId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.task.count({ where: { ownerChatId: chatId, completedAt: { gte: sevenDaysAgo } } }),
    prisma.note.count({ where: { ownerChatId: chatId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.telegramChat.findUnique({
      where: { chatId },
      select: { streakDays: true },
    }),
  ])

  // Best weekday by completions within the window
  const completed = await prisma.task.findMany({
    where: { ownerChatId: chatId, completedAt: { gte: sevenDaysAgo } },
    select: { completedAt: true },
  })
  const perDay = new Map<number, number>()
  for (const t of completed) {
    if (!t.completedAt) continue
    // getDay(): 0=Sun..6=Sat -> our Monday-first index
    const idx = (t.completedAt.getDay() + 6) % 7
    perDay.set(idx, (perDay.get(idx) || 0) + 1)
  }
  let bestIdx = -1
  let bestDayCount = 0
  for (const [idx, count] of perDay.entries()) {
    if (count > bestDayCount) {
      bestDayCount = count
      bestIdx = idx
    }
  }

  const monday = new Date(now)
  monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7))
  const fmt = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('.')

  return {
    tasksCreated,
    tasksCompleted,
    notesCreated,
    bestDay: bestIdx >= 0 ? DAY_NAMES[bestIdx] : '—',
    bestDayCount,
    streakDays: chat?.streakDays || 0,
    weekLabel: `${fmt(monday)} — ${fmt(now)}`,
  }
}

export interface YearlyCardStats {
  totalCompleted: number
  topHabitName: string | null
  topHabitStreak: number
  bestMonth: string
  bestMonthCount: number
  activeDays: number
  year: number
}

export async function collectYearlyStats(chatId: bigint): Promise<YearlyCardStats> {
  const year = new Date().getFullYear()
  const start = new Date(year, 0, 1)

  const [totalCompleted, habits, yearlyTasks, chat] = await Promise.all([
    prisma.task.count({
      where: { ownerChatId: chatId, status: 'completed', completedAt: { gte: start } },
    }),
    prisma.habit.findMany({
      where: { ownerChatId: chatId },
      orderBy: { streak: 'desc' },
      take: 1,
      select: { title: true, streak: true },
    }).catch(() => [] as Array<{ title: string; streak: number }>),
    prisma.task.findMany({
      where: { ownerChatId: chatId, completedAt: { gte: start } },
      select: { completedAt: true },
    }),
    prisma.telegramChat.findUnique({ where: { chatId }, select: { streakDays: true } }),
  ])

  const perMonth = new Map<number, number>()
  const activeDays = new Set<string>()
  for (const t of yearlyTasks) {
    if (!t.completedAt) continue
    const m = t.completedAt.getMonth()
    perMonth.set(m, (perMonth.get(m) || 0) + 1)
    activeDays.add(t.completedAt.toISOString().slice(0, 10))
  }
  let bestMonth = 0
  let bestMonthCount = 0
  for (const [m, c] of perMonth.entries()) {
    if (c > bestMonthCount) {
      bestMonth = m
      bestMonthCount = c
    }
  }

  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

  return {
    totalCompleted,
    topHabitName: habits[0]?.title || null,
    topHabitStreak: habits[0]?.streak ?? chat?.streakDays ?? 0,
    bestMonth: perMonth.size > 0 ? MONTHS[bestMonth] : '—',
    bestMonthCount,
    activeDays: activeDays.size,
    year,
  }
}

// ─── Psychological portrait (deterministic classifier, no LLM) ─────────────

export interface PortraitAxes {
  focus: number        // deep work on few tasks vs scattered
  consistency: number  // daily activity regularity
  completion: number   // finisher rate
  planning: number     // notes/goals usage
  social: number       // delegations/friend interactions
}

export interface Portrait {
  title: string
  tagline: string
  emoji: string
  axes: PortraitAxes
}

export interface PortraitInput {
  tasksCompleted: number
  tasksCreated: number
  notesCreated: number
  goalsUpdated: number
  activeDaysLast30: number
  distinctProjects: number
  delegatedToFriends: number
}

/** Pure function — fully unit-testable. */
export function computePortrait(input: PortraitInput): Portrait {
  const pct = (n: number, max: number) => Math.max(5, Math.min(100, Math.round((n / max) * 100)))

  const completionRate = input.tasksCreated > 0 ? input.tasksCompleted / input.tasksCreated : 0.5
  const axes: PortraitAxes = {
    focus: pct(Math.max(0, input.tasksCreated - input.distinctProjects * 2), Math.max(1, input.tasksCreated)) *
           (input.distinctProjects <= 3 ? 1 : 0.7),
    consistency: pct(input.activeDaysLast30, 30),
    completion: pct(completionRate * 100, 100),
    planning: pct(input.notesCreated * 10 + input.goalsUpdated * 15, 100),
    social: pct(input.delegatedToFriends, 20),
  }

  // Dominant-axis classification (deterministic tie-break by declaration order)
  const entries: Array<[keyof PortraitAxes, Portrait]> = [
    ['consistency', {
      title: 'Марафонец',
      tagline: 'Ваше главное оружие — ежедневность. Вы строите результаты из маленьких побед.',
      emoji: '🏃',
      axes,
    }],
    ['completion', {
      title: 'Завершатель',
      tagline: 'Начатое — доведено. Незакрытых задач почти не остаётся в ваших руках.',
      emoji: '✅',
      axes,
    }],
    ['planning', {
      title: 'Архитектор порядка',
      tagline: 'Вы думаете прежде, чем делаете: заметки и цели ведут ваши задачи.',
      emoji: '🏛',
      axes,
    }],
    ['social', {
      title: 'Дирижёр команды',
      tagline: 'Вы достигаете большего через людей: доверяете, делегируете, объединяете.',
      emoji: '🎼',
      axes,
    }],
    ['focus', {
      title: 'Снайпер фокуса',
      tagline: 'Мало проектов — максимум глубины. Ваша сила в концентрации на главном.',
      emoji: '🎯',
      axes,
    }],
  ]

  let bestKey: keyof PortraitAxes = 'consistency'
  let bestVal = -1
  for (const [k] of entries) {
    if (axes[k] > bestVal) {
      bestVal = axes[k]
      bestKey = k
    }
  }
  return entries.find(([k]) => k === bestKey)![1]
}

export async function buildPortrait(chatId: bigint): Promise<Portrait & { stats: WeeklyCardStats }> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [tasksCreated, tasksCompleted, notesCreated, goals, recent, projects, chat] = await Promise.all([
    prisma.task.count({ where: { ownerChatId: chatId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.task.count({ where: { ownerChatId: chatId, completedAt: { gte: thirtyDaysAgo } } }),
    prisma.note.count({ where: { ownerChatId: chatId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.goal.count({ where: { ownerChatId: chatId, updatedAt: { gte: thirtyDaysAgo } } }).catch(() => 0),
    prisma.task.findMany({
      where: { ownerChatId: chatId, OR: [{ createdAt: { gte: thirtyDaysAgo } }, { completedAt: { gte: thirtyDaysAgo } }] },
      select: { createdAt: true, completedAt: true },
    }),
    prisma.task.findMany({
      where: { ownerChatId: chatId, projectDbId: { not: null }, createdAt: { gte: thirtyDaysAgo } },
      select: { projectDbId: true },
    }).catch(() => [] as Array<{ projectDbId: string | null }>),
    prisma.telegramChat.findUnique({ where: { chatId }, select: { streakDays: true } }),
  ])
  void chat

  const activeDays = new Set<string>()
  for (const t of recent) {
    if (t.createdAt) activeDays.add(t.createdAt.toISOString().slice(0, 10))
    if (t.completedAt) activeDays.add(t.completedAt.toISOString().slice(0, 10))
  }

  const portrait = computePortrait({
    tasksCreated,
    tasksCompleted,
    notesCreated,
    goalsUpdated: goals,
    activeDaysLast30: activeDays.size,
    distinctProjects: new Set(projects.map(p => p.projectDbId)).size,
    delegatedToFriends: 0, // delegation counts live in AppActionLog; kept 0 for v1
  })

  const weekly = await collectWeeklyStats(chatId)
  return { ...portrait, stats: weekly }
}
