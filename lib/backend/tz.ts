/**
 * Timezone-aware period boundaries for the memory system.
 * No timezone is ever hardcoded: the user's IANA tz (TelegramChat.timezone)
 * drives every boundary. DST-safe via two-pass offset resolution.
 */

/** Offset (ms) of `tz` at the given UTC instant. */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts: Record<string, number> = {}
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value)
  }
  const asUtc = Date.UTC(
    parts.year, (parts.month || 1) - 1, parts.day || 1,
    parts.hour === 24 ? 0 : parts.hour, parts.minute || 0, parts.second || 0
  )
  return asUtc - date.getTime()
}

/** Convert local wall-clock time in `tz` to a UTC instant (two-pass, DST-safe). */
export function zonedToUtc(
  year: number, month1: number, day: number,
  hour = 0, minute = 0, timeZone: string
): Date {
  const guess = Date.UTC(year, month1 - 1, day, hour, minute)
  let offset = tzOffsetMs(new Date(guess), timeZone)
  let ts = guess - offset
  offset = tzOffsetMs(new Date(ts), timeZone) // re-resolve after shifting (DST edge)
  ts = guess - offset
  return new Date(ts)
}

/** Local YYYY-MM-DD string of an instant in `tz`. */
export function localDateStr(date: Date, timeZone: string): string {
  const y = Number(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(date))
  const m = Number(new Intl.DateTimeFormat('en-US', { timeZone, month: '2-digit' }).format(date))
  const d = Number(new Intl.DateTimeFormat('en-US', { timeZone, day: '2-digit' }).format(date))
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** [start, end) UTC instants of one LOCAL calendar day (DST-safe: uses the
 *  next calendar date rather than a naive +24h shift). */
export function dayPeriod(dateStr: string, timeZone: string): { start: Date; end: Date } {
  const nextStr = addDaysStr(dateStr, 1)
  return {
    start: zonedToUtc(...(splitYmd(dateStr)), 0, 0, timeZone),
    end: zonedToUtc(...(splitYmd(nextStr)), 0, 0, timeZone),
  }
}

function splitYmd(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split('-').map(Number)
  return [y, m, d]
}

export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

/** Monday of the ISO week containing dateStr. */
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dowMonFirst = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7 // 0=Mon
  return addDaysStr(dateStr, -dowMonFirst)
}

/** [start,end) of LOCAL week (Monday..Sunday). */
export function weekPeriod(mondayStr: string, timeZone: string): { start: Date; end: Date } {
  const startLocal = mondayOf(mondayStr)
  const endLocal = addDaysStr(startLocal, 7)
  return { start: dayPeriod(startLocal, timeZone).start, end: dayPeriod(endLocal, timeZone).start }
}

/** All Mondays whose Mon..Sun week intersects the given LOCAL month.
 *  A week is attributed to the month of its Monday for hierarchy keys. */
export function monthWeekMondays(year: number, month1: number): string[] {
  const pad = (n: number) => String(n).padStart(2, '0')
  const first = `${year}-${pad(month1)}-01`
  const lastDay = new Date(Date.UTC(year, month1, 0)).getUTCDate()
  const last = `${year}-${pad(month1)}-${pad(lastDay)}`

  const mondays: string[] = []
  let cur = mondayOf(addDaysStr(first, -6))
  while (cur <= last) {
    if (addDaysStr(cur, 6) >= first) mondays.push(cur)
    cur = addDaysStr(cur, 7)
  }
  return mondays
}

export function monthPeriod(year: number, month1: number, timeZone: string): { start: Date; end: Date } {
  const nextMonth = month1 === 12 ? { y: year + 1, m: 1 } : { y: year, m: month1 + 1 }
  return {
    start: zonedToUtc(year, month1, 1, 0, 0, timeZone),
    end: zonedToUtc(nextMonth.y, nextMonth.m, 1, 0, 0, timeZone),
  }
}

export function yearPeriod(year: number, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedToUtc(year, 1, 1, 0, 0, timeZone),
    end: zonedToUtc(year + 1, 1, 1, 0, 0, timeZone),
  }
}
