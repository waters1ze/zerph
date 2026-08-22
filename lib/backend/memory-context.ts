import { prisma } from './prisma'
import {
  generateDayDigest, generateWeekDigest, generateMonthDigest,
} from './digests'
import { localDateStr, addDaysStr, mondayOf, monthPeriod, weekPeriod, dayPeriod } from './tz'

/**
 * Single entry point for AI memory. EVERY AI feature must take its memory
 * from buildMemoryContext() — token budgeting lives here and nowhere else.
 *
 * Assembly order (budget ~3000 tokens default):
 *   1. UserPortrait.core        (~600)
 *   2. current year+month       (~800)
 *   3. current week+yesterday   (~700)
 *   4. question-relevant past   (~600) — keyword match over digest text
 *   5. live tasks (48h + open)  (~300)
 */

const approxTokens = (s: string): number => Math.ceil(s.length / 4)

export interface MemoryContextOpts {
  question?: string
  /** deterministic clock for tests */
  now?: Date
  budgetTokens?: number
  /** default true; hot paths (mass briefings) pass false to read-only */
  lazy?: boolean
}

export interface BuiltMemoryContext {
  systemBlock: string
  usedTokens: number
  sections: Array<{ name: string; tokens: number }>
}

async function getUserTz(chatId: bigint): Promise<string> {
  const chat = await prisma.telegramChat.findUnique({
    where: { chatId },
    select: { timezone: true },
  })
  return chat?.timezone || 'Europe/Moscow'
}

/** Lazily create missing recent levels (idempotent; cheap when up-to-date). */
async function lazyEnsureRecent(chatId: bigint): Promise<void> {
  const tz = await getUserTz(chatId)
  const today = localDateStr(new Date(), tz)

  try { await generateDayDigest(chatId, addDaysStr(today, -1)) } catch {}
  try { await generateWeekDigest(chatId, mondayOf(addDaysStr(mondayOf(today), -7))) } catch {}

  const [py, pm] = today.slice(5) === '01'
    ? [Number(today.slice(0, 4)) - 1, 12]
    : [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1]
  try { await generateMonthDigest(chatId, py, pm) } catch {}
}

function clip(s: string, maxTokens: number): string {
  const maxChars = maxTokens * 4
  return s.length <= maxChars ? s : s.slice(0, maxChars - 1) + '…'
}

function extractKeywords(question: string): string[] {
  return Array.from(new Set(question.toLowerCase().match(/[a-zа-яё]{5,}/g) || [])).slice(0, 6)
}

/** Relevant PAST digests via keyword match over human text (pg_trgm later). */
async function findRelevantPast(chatId: bigint, question: string, limit = 3): Promise<string[]> {
  const keywords = extractKeywords(question)
  if (keywords.length === 0) return []

  const rows = await prisma.timeDigest.findMany({
    where: {
      ownerChatId: chatId,
      level: { in: ['week', 'month'] },
      model: { not: 'empty-marker' },
      OR: keywords.map(k => ({ text: { contains: k, mode: 'insensitive' as const } })),
    },
    orderBy: { periodStart: 'desc' },
    take: limit * 3,
    select: { periodStart: true, level: true, text: true },
  })

  const scored = rows.map(r => ({
    ...r,
    score: keywords.reduce((acc, k) => acc + (r.text.toLowerCase().includes(k) ? 1 : 0), 0),
  }))
  return scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => `[${r.level} ${r.periodStart.toISOString().slice(0, 10)}] ${clip(r.text, 200)}`)
}

/** Live data slice: open tasks + anything due within 48h. */
async function liveTasksSlice(chatId: bigint, tz: string): Promise<string> {
  const todayStr = localDateStr(new Date(), tz)
  const in48 = new Date(Date.now() + 48 * 3600 * 1000).toISOString()
  const rows = await prisma.task.findMany({
    where: {
      ownerChatId: chatId,
      status: { notIn: ['done', 'draft'] },
      OR: [{ dueDate: { gte: todayStr } }, { dueDate: null }],
    },
    orderBy: [{ dueDate: 'asc' }],
    take: 12,
    select: { title: true, dueDate: true, dueTime: true },
  })
  const soon = rows.filter(t => t.dueDate && new Date(`${t.dueDate}T23:59:59Z`).toISOString() <= in48)
  const rest = rows.filter(t => !soon.includes(t))
  const lines = [
    ...(soon.length ? [`Ближайшие 48ч: ${soon.map(t => `${t.title}${t.dueTime ? ` (${t.dueTime})` : ''}`).join('; ')}`] : []),
    ...rest.slice(0, 6).map(t => `- ${t.title}${t.dueDate ? ` (${t.dueDate})` : ''}`),
  ]
  return lines.join('\n')
}

export async function buildMemoryContext(
  chatId: bigint,
  opts?: MemoryContextOpts
): Promise<BuiltMemoryContext> {
  const budget = opts?.budgetTokens ?? 3000
  const sections: Array<{ name: string; tokens: number }> = []
  let remaining = budget

  // Lazy on-demand creation of missing recent levels (skippable for hot paths).
  if (opts?.lazy !== false) {
    await lazyEnsureRecent(chatId).catch(() => {})
  }

  const parts: string[] = []
  const push = (name: string, maxTokens: number, content: string | null | undefined): void => {
    if (!content || !content.trim()) return
    const clipped = clip(content.trim(), Math.min(maxTokens, Math.max(remaining, 0)))
    if (!clipped || clipped === '…') return
    const tok = approxTokens(clipped)
    parts.push(`### ${name}\n${clipped}`)
    sections.push({ name, tokens: tok })
    remaining -= tok
  }

  const tz = await getUserTz(chatId)
  const now = opts?.now ?? new Date()
  const todayStr = localDateStr(now, tz)
  const year = Number(todayStr.slice(0, 4))
  const month1 = Number(todayStr.slice(5, 7))

  // 1. Portrait core
  try {
    const portrait = await prisma.userPortrait.findUnique({ where: { ownerChatId: chatId } })
    if (portrait) push('Портрет пользователя', 600, JSON.stringify(portrait.core))
  } catch {}

  // 2-3. Digest pyramid
  const fetchText = async (level: 'year' | 'month' | 'week' | 'day', start: Date): Promise<string> => {
    const row = await prisma.timeDigest.findUnique({
      where: { ownerChatId_level_periodStart: { ownerChatId: chatId, level, periodStart: start } },
      select: { text: true, model: true },
    }).catch(() => null)
    return row && row.model !== 'empty-marker' ? row.text : ''
  }

  push('Итоги года', 300, await fetchText('year', monthPeriod(year, 1, tz).start))
  push('Итоги месяца', 500, await fetchText('month', monthPeriod(year, month1, tz).start))
  push('Итоги недели', 400, await fetchText('week', weekPeriod(mondayOf(todayStr), tz).start))
  push('Вчера', 300, await fetchText('day', dayPeriod(addDaysStr(todayStr, -1), tz).start))

  // 4. Question-relevant past
  if (opts?.question && remaining > 150) {
    try {
      const rel = await findRelevantPast(chatId, opts.question)
      if (rel.length) push('Релевантное прошлое', 600, rel.join('\n'))
    } catch {}
  }

  // 5. Live tasks
  if (remaining > 80) {
    try {
      push('Живые задачи', 300, await liveTasksSlice(chatId, tz))
    } catch {}
  }

  return {
    systemBlock: `## Память пользователя Zerf\n${parts.join('\n\n')}`,
    usedTokens: budget - Math.max(remaining, 0),
    sections,
  }
}
