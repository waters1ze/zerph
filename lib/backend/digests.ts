import { prisma } from './prisma'
import { callGroqChatCompletion } from './groq-pool'
import {
  localDateStr, dayPeriod, weekPeriod, monthPeriod, yearPeriod,
  monthWeekMondays, addDaysStr,
} from './tz'

/**
 * Hierarchical memory engine: day -> week -> month -> year digests.
 *
 * Invariants (see MEMORY-SYSTEM.md):
 *  1. Raw data is never mutated or deleted — this is an additive layer.
 *  2. Level N is built ONLY from level N-1 rows; raw tables are read by
 *     "day" exclusively.
 *  3. Nothing is forgotten: any past period can be drilled into on demand.
 *  4. Idempotent: unique key (ownerChatId, level, periodStart) + upsert;
 *     existing digest => LLM never called again for that period.
 */

export type DigestLevel = 'day' | 'week' | 'month' | 'year'

const LEVEL_MODELS: Record<DigestLevel, string> = {
  day: 'llama-3.1-8b-instant',
  week: 'llama-3.1-8b-instant',
  month: 'openai/gpt-oss-120b',
  year: 'openai/gpt-oss-120b',
}

const RETRIES = 3

export interface DigestContent {
  empty?: boolean
  made?: string[]
  moved?: string[]
  missed?: string[]
  habits?: { done: string[]; broken: string[] }
  patterns?: string[]
  topTags?: string[]
  oneLiner?: string
  stats?: Record<string, number | string>
}

// ── Small helpers ───────────────────────────────────────────────────────────

const approxTokens = (s: string) => Math.ceil(s.length / 4)

async function getUserTz(chatId: bigint): Promise<string> {
  const chat = await prisma.telegramChat.findUnique({
    where: { chatId },
    select: { timezone: true },
  })
  return chat?.timezone || 'Europe/Moscow'
}

async function logTokens(chatId: bigint, level: DigestLevel, tokens: number): Promise<void> {
  if (tokens <= 0) return
  await prisma.appActionLog.create({
    data: { action: 'digest_tokens', chatId, details: `${level}:${tokens}` },
  }).catch(() => {})
}

/** Existing digest row or null. */
export async function getDigest(
  chatId: bigint, level: DigestLevel, periodStart: Date
): Promise<{ content: DigestContent; text: string; model: string; inputTokens: number } | null> {
  const row = await prisma.timeDigest.findUnique({
    where: { ownerChatId_level_periodStart: { ownerChatId: chatId, level, periodStart } },
    select: { content: true, text: true, model: true, inputTokens: true },
  }).catch(() => null)
  return (row as any) || null
}

async function upsertDigest(
  chatId: bigint,
  level: DigestLevel,
  start: Date,
  end: Date,
  content: DigestContent,
  text: string,
  model: string,
  inputTokens: number
): Promise<void> {
  await prisma.timeDigest.upsert({
    where: { ownerChatId_level_periodStart: { ownerChatId: chatId, level, periodStart: start } },
    update: { periodEnd: end, content: content as any, text, model, inputTokens },
    create: { ownerChatId: chatId, level, periodStart: start, periodEnd: end, content: content as any, text, model, inputTokens },
  })
}

/** Call Groq with retry/backoff. Throws after RETRIES attempts. */
async function callLlm(system: string, user: string, model: string): Promise<{ json: DigestContent; markdown: string; tokens: number }> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await callGroqChatCompletion({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 700,
      })
      const clean = (res.content || '{}').trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(clean) as DigestContent & { markdown?: string }
      const { markdown, ...json } = parsed
      return { json, markdown: markdown || '', tokens: approxTokens(system + user) }
    } catch (err) {
      lastErr = err
      await new Promise(r => setTimeout(r, attempt * 2000))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

// ── DAY (reads RAW data) ────────────────────────────────────────────────────

export async function generateDayDigest(chatId: bigint, dateStr: string): Promise<'built' | 'empty'> {
  const tz = await getUserTz(chatId)
  const { start, end } = dayPeriod(dateStr, tz)

  const existing = await getDigest(chatId, 'day', start)
  if (existing) return 'built'

  const [created, completed, overdueDueThatDay, notesDone, habitsDone, chat] = await Promise.all([
    prisma.task.count({ where: { ownerChatId: chatId, createdAt: { gte: start, lt: end } } }),
    prisma.task.findMany({
      where: { ownerChatId: chatId, status: 'done', completedAt: { gte: start, lt: end } },
      select: { title: true, tags: true },
      take: 50,
    }),
    prisma.task.findMany({
      where: { ownerChatId: chatId, dueDate: dateStr, status: { notIn: ['done', 'draft'] } },
      select: { title: true },
      take: 30,
    }),
    prisma.note.count({ where: { ownerChatId: chatId, createdAt: { gte: start, lt: end } } }),
    prisma.habit.findMany({
      where: { ownerChatId: chatId, lastCompletedAt: dateStr },
      select: { title: true },
    }),
    prisma.telegramChat.findUnique({ where: { chatId }, select: { streakDays: true } }),
  ])

  const isEmpty =
    created === 0 && completed.length === 0 && overdueDueThatDay.length === 0 &&
    notesDone === 0 && habitsDone.length === 0

  if (isEmpty) {
    // Empty periods NEVER reach the LLM (cost rule).
    await upsertDigest(
      chatId, 'day', start, end,
      { empty: true, stats: { created: 0, completed: 0, missed: 0 } },
      `_Пустой день (${dateStr})_`, 'empty-marker', 0
    )
    return 'empty'
  }

  const payload = JSON.stringify({
    date: dateStr,
    createdCount: created,
    completed: completed.map(t => t.title),
    tags: completed.flatMap(t => t.tags || []).slice(0, 20),
    notFinishedToday: overdueDueThatDay.map(t => t.title),
    notesCreated: notesDone,
    habitsCompleted: habitsDone.map(h => h.title),
    streakDays: chat?.streakDays ?? 0,
  })

  const { json, markdown, tokens } = await callLlm(
    'Ты — архиватор личной продуктивности Zerf. Суммаризуй день пользователя СТРОГО в JSON: {"made":[],"moved":[],"missed":[],"habits":{"done":[],"broken":[]},"patterns":[],"topTags":[],"oneLiner":"одна фраза","stats":{"created":N,"completed":N,"missed":N},"markdown":"краткий итог <=400 токенов в markdown"}. Пиши по-русски, без выдумок.',
    payload,
    LEVEL_MODELS.day
  )

  await upsertDigest(chatId, 'day', start, end, json as DigestContent, markdown, LEVEL_MODELS.day, tokens)
  await logTokens(chatId, 'day', tokens)
  return 'built'
}

// ── WEEK (from day digests ONLY) ────────────────────────────────────────────

async function childrenForRange(
  chatId: bigint, level: DigestLevel, starts: Array<{ key: string; start: Date }>
): Promise<Array<{ key: string; content: DigestContent }>> {
  if (starts.length === 0) return []
  const rows = await prisma.timeDigest.findMany({
    where: {
      ownerChatId: chatId,
      level,
      periodStart: { in: starts.map(s => s.start) },
    },
    select: { periodStart: true, content: true },
  })
  const byStart = new Map(rows.map(r => [r.periodStart.toISOString(), r.content as DigestContent]))
  return starts
    .map(s => ({ key: s.key, content: byStart.get(s.start.toISOString()) }))
    .filter((r): r is { key: string; content: DigestContent } => Boolean(r.content))
}

export async function generateWeekDigest(chatId: bigint, mondayStr: string): Promise<'built' | 'empty' | 'children-missing'> {
  const tz = await getUserTz(chatId)
  const { start, end } = weekPeriod(mondayStr, tz)

  const existing = await getDigest(chatId, 'week', start)
  if (existing) return 'built'

  const days = await childrenForRange(
    chatId, 'day',
    Array.from({ length: 7 }, (_, i) => ({ key: addDaysStr(mondayStr, i), start: dayPeriod(addDaysStr(mondayStr, i), tz).start }))
  )

  // Require the full week closed: all 7 day slots exist (incl. empty markers).
  if (days.length < 7) return 'children-missing'

  if (days.every(d => d.content.empty)) {
    await upsertDigest(chatId, 'week', start, end, { empty: true }, `_Пустая неделя (${mondayStr})_`, 'empty-marker', 0)
    return 'empty'
  }

  const payload = JSON.stringify({
    weekOf: mondayStr,
    days: days.map(d => ({ date: d.key, summary: d.content.empty ? '(пусто)' : (d.content.oneLiner || ''), made: (d.content.made || []).slice(0, 5), missed: (d.content.missed || []).slice(0, 3) })),
  })

  const { json, markdown, tokens } = await callLlm(
    'Суммаризуй НЕДЕЛЮ из 7 дневных сводок. Строго JSON: {"made":[],"moved":[],"missed":[],"patterns":[],"topTags":[],"oneLiner":"","stats":{},"markdown":""}. Русский язык, только факты из входа.',
    payload,
    LEVEL_MODELS.week
  )

  await upsertDigest(chatId, 'week', start, end, json as DigestContent, markdown, LEVEL_MODELS.week, tokens)
  await logTokens(chatId, 'week', tokens)

  // Weekly light portrait refresh (<=300 tokens of recent trends).
  await refreshRecentPortrait(chatId).catch(err =>
    console.error('[digests] recent portrait refresh failed:', err)
  )
  return 'built'
}

// ── MONTH (from week digests ONLY) ──────────────────────────────────────────

export async function generateMonthDigest(chatId: bigint, year: number, month1: number): Promise<'built' | 'empty' | 'children-missing'> {
  const tz = await getUserTz(chatId)
  const mondays = monthWeekMondays(year, month1)
  const { start, end } = monthPeriod(year, month1, tz)

  const existing = await getDigest(chatId, 'month', start)
  if (existing) return 'built'

  const weeks = await childrenForRange(chatId, 'week', mondays.map(m => ({ key: m, start: weekPeriod(m, tz).start })))
  if (weeks.length < mondays.length) return 'children-missing'
  if (weeks.every(w => w.content.empty)) {
    await upsertDigest(chatId, 'month', start, end, { empty: true }, `_Пустой месяц ${year}-${month1}_`, 'empty-marker', 0)
    return 'empty'
  }

  const payload = JSON.stringify({ month: `${year}-${String(month1).padStart(2, '0')}`, weeks: weeks.map(w => w.content.oneLiner || '(пусто)') })

  const { json, markdown, tokens } = await callLlm(
    'Собери МЕСЯЦ из недельных сводок. Строго JSON: {"made":[],"patterns":[],"topTags":[],"oneLiner":"","stats":{},"markdown":""}. Русский.',
    payload,
    LEVEL_MODELS.month
  )

  await upsertDigest(chatId, 'month', start, end, json as DigestContent, markdown, LEVEL_MODELS.month, tokens)
  await logTokens(chatId, 'month', tokens)

  // Monthly portrait merge fires once a new month lands.
  await mergeMonthlyPortrait(chatId).catch(err =>
    console.error('[digests] portrait merge failed:', err)
  )
  return 'built'
}

// ── YEAR (from 12 month digests ONLY) ───────────────────────────────────────

export async function generateYearDigest(chatId: bigint, year: number): Promise<'built' | 'empty' | 'children-missing'> {
  const tz = await getUserTz(chatId)
  const { start, end } = yearPeriod(year, tz)

  const existing = await getDigest(chatId, 'year', start)
  if (existing) return 'built'

  const months = await childrenForRange(
    chatId, 'month',
    Array.from({ length: 12 }, (_, i) => ({
      key: `${year}-${String(i + 1).padStart(2, '0')}`,
      start: monthPeriod(year, i + 1, tz).start,
    }))
  )
  if (months.length < 12) return 'children-missing'
  if (months.every(m => m.content.empty)) {
    await upsertDigest(chatId, 'year', start, end, { empty: true }, `_Пустой ${year} год_`, 'empty-marker', 0)
    return 'empty'
  }

  const payload = JSON.stringify({ year, months: months.map(m => m.content.oneLiner || '') })

  const { json, markdown, tokens } = await callLlm(
    'Собери ГОД из 12 месячных сводок (стиль Spotify-Wrapped). Строго JSON: {"made":[],"patterns":[],"oneLiner":"","stats":{"totalCompleted":N,"bestMonth":"..."},"markdown":"","cardData":{"topHabitStreak":N,"activeDays":N}}. cardData пойдёт в share-карточку года.',
    payload,
    LEVEL_MODELS.year
  )

  await upsertDigest(chatId, 'year', start, end, json as DigestContent, markdown, LEVEL_MODELS.year, tokens)
  await logTokens(chatId, 'year', tokens)
  return 'built'
}

// ── ensureDigestsDue (planned trigger) ──────────────────────────────────────

const GRACE_MS = 60 * 60 * 1000 // period must be closed >= 1h ago

export interface EnsureResult {
  built: number
  skippedEmpty: number
  pending: number
  rateLimitedLeft: number
}

let hourlyCounter = { windowStart: 0, used: 0 }
const HOURLY_LIMIT = Number(process.env.DIGEST_HOURLY_LIMIT || 60)

function takeRateSlot(): boolean {
  const now = Date.now()
  if (now - hourlyCounter.windowStart > 3600_000) {
    hourlyCounter = { windowStart: now, used: 0 }
  }
  if (hourlyCounter.used >= HOURLY_LIMIT) return false
  hourlyCounter.used++
  return true
}

/**
 * Planned trigger: builds every CLOSED-but-missing digest for active users.
 * Sequential per user, capped; safe to call often (idempotent).
 */
export async function ensureDigestsDue(opts?: { chatIds?: bigint[]; maxUsers?: number }): Promise<EnsureResult> {
  const result: EnsureResult = { built: 0, skippedEmpty: 0, pending: 0, rateLimitedLeft: 0 }

  let chatIds = opts?.chatIds
  if (!chatIds) {
    const since = new Date(Date.now() - 60 * 24 * 3600 * 1000) // active within 60d
    const users = await prisma.telegramChat.findMany({
      where: { lastActiveAt: { gte: since } },
      select: { chatId: true },
      take: opts?.maxUsers ?? 200,
      orderBy: { lastActiveAt: 'desc' },
    })
    chatIds = users.map(u => u.chatId)
  }

  for (const chatId of chatIds) {
    if (!takeRateSlot()) {
      result.rateLimitedLeft++
      continue
    }
    try {
      const tz = await getUserTz(chatId)
      const todayLocal = localDateStr(new Date(), tz)
      const yesterdayStr = addDaysStr(todayLocal, -1)

      // DAY: yesterday (closed >= 1h given midnight+grace logic)
      const yRes = await safeBuild(() => generateDayDigest(chatId, yesterdayStr), result)
      if (yRes === 'pending') continue

      // WEEK: previous ISO week fully closed
      const prevMonday = addDaysStr(mondayOfLocal(todayLocal), -7)
      await safeBuild(() => generateWeekDigest(chatId, prevMonday), result)

      // MONTH: previous calendar month
      const [py, pm] = prevMonthOf(todayLocal)
      await safeBuild(() => generateMonthDigest(chatId, py, pm), result)

      // YEAR: previous year during January window only
      const yearNow = Number(todayLocal.slice(0, 4))
      if (Number(todayLocal.slice(5, 7)) === 1) {
        await safeBuild(() => generateYearDigest(chatId, yearNow - 1), result)
      }
    } catch (err) {
      console.error(`[digests] ensure failed for ${chatId}:`, err)
    }
  }

  return result
}

type BuildOutcome = 'built' | 'empty' | 'children-missing' | 'pending' | 'exists'

async function safeBuild(
  fn: () => Promise<BuildOutcome>,
  result: EnsureResult
): Promise<BuildOutcome> {
  try {
    const outcome = await fn()
    if (outcome === 'built') result.built++
    else if (outcome === 'empty') result.skippedEmpty++
    else if (outcome === 'children-missing') result.pending++
    return outcome
  } catch (err) {
    // LLM failure after retries => period stays absent and will be retried
    console.error('[digests] build error:', err)
    result.pending++
    return 'pending'
  }
}

function mondayOfLocal(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dowMonFirst = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
  const t = new Date(Date.UTC(y, m - 1, d - dowMonFirst))
  return t.toISOString().slice(0, 10)
}

function prevMonthOf(dateStr: string): [number, number] {
  const [y, m] = dateStr.split('-').map(Number)
  return m === 1 ? [y - 1, 12] : [y, m - 1]
}

// ── UserPortrait ────────────────────────────────────────────────────────────

const PORTRAIT_CORE_SYSTEM = 'Слей старый портрет и месячные сводки в ОБНОВЛЁННЫЙ устойчивый портрет. Строго JSON: {"chronotype":"","style":"","pace":"","failureModes":[],"strengths":[],"oneLiner":""}. <=800 токенов, по-русски, без фантазий.'
const PORTRAIT_RECENT_SYSTEM = 'По дневным сводкам выдай тренды последних ~2 недель. Строго JSON: {"trends":[],"energy":"","focusShift":""}. <=300 токенов, по-русски.'

/** Monthly: merge existing core with recent month digest(s). */
export async function mergeMonthlyPortrait(chatId: bigint): Promise<void> {
  const months = await prisma.timeDigest.findMany({
    where: { ownerChatId: chatId, level: 'month' },
    orderBy: { periodStart: 'desc' },
    take: 5,
    select: { content: true },
  })
  const meaningful = months.filter(m => !(m.content as DigestContent).empty)
  if (meaningful.length === 0) return

  const prev = await prisma.userPortrait.findUnique({ where: { ownerChatId: chatId } })
  const payload = JSON.stringify({
    oldCore: prev?.core ?? null,
    months: meaningful.map(m => (m.content as DigestContent).oneLiner || ''),
    patterns: meaningful.flatMap(m => (m.content as DigestContent).patterns || []).slice(0, 15),
  })

  const { json, tokens } = await callLlm(PORTRAIT_CORE_SYSTEM, payload, LEVEL_MODELS.month)

  await prisma.userPortrait.upsert({
    where: { ownerChatId: chatId },
    update: { core: json as any, version: { increment: 1 } },
    create: { ownerChatId: chatId, core: json as any, recent: {} as any, version: 1 },
  })
  await logTokens(chatId, 'month', tokens)
}

/** Weekly light refresh of ecent from the last ~14 day digests. */
export async function refreshRecentPortrait(chatId: bigint): Promise<void> {
  const days = await prisma.timeDigest.findMany({
    where: { ownerChatId: chatId, level: 'day' },
    orderBy: { periodStart: 'desc' },
    take: 14,
    select: { content: true },
  })
  const meaningful = days.filter(d => !(d.content as DigestContent).empty)
  if (meaningful.length === 0) return

  const payload = JSON.stringify({
    days: meaningful.map(d => ({
      oneLiner: (d.content as DigestContent).oneLiner || '',
      missed: ((d.content as DigestContent).missed || []).slice(0, 2),
    })),
  })

  const { json, tokens } = await callLlm(PORTRAIT_RECENT_SYSTEM, payload, LEVEL_MODELS.week)

  await prisma.userPortrait.upsert({
    where: { ownerChatId: chatId },
    update: { recent: json as any, version: { increment: 1 } },
    create: { ownerChatId: chatId, core: {} as any, recent: json as any, version: 1 },
  })
  await logTokens(chatId, 'week', tokens)
}

/** Safe tz accessor for scripts. */
export async function getUserTzSafe(chatId: bigint): Promise<string> {
  return getUserTz(chatId)
}
