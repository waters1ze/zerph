import { describe, it, expect } from 'vitest'
import {
  tzOffsetMs, zonedToUtc, localDateStr,
  dayPeriod, weekPeriod, monthPeriod, yearPeriod,
  monthWeekMondays, mondayOf, addDaysStr,
} from '@/lib/backend/tz'

const iso = (d: Date) => d.toISOString()

describe('timezone primitives', () => {
  it('Moscow is fixed +3 all year', () => {
    expect(tzOffsetMs(new Date('2026-01-15T00:00:00Z'), 'Europe/Moscow')).toBe(3 * 3600_000)
    expect(tzOffsetMs(new Date('2026-07-15T00:00:00Z'), 'Europe/Moscow')).toBe(3 * 3600_000)
  })

  it('Yekaterinburg is +5', () => {
    expect(tzOffsetMs(new Date('2026-06-01T00:00:00Z'), 'Asia/Yekaterinburg')).toBe(5 * 3600_000)
  })

  it('New York observes DST: -5 winter, -4 summer', () => {
    expect(tzOffsetMs(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-5 * 3600_000)
    expect(tzOffsetMs(new Date('2026-07-15T12:00:00Z'), 'America/New_York')).toBe(-4 * 3600_000)
  })

  it('localDateStr respects the zone (same instant = different dates)', () => {
    const instant = new Date('2026-03-10T21:30:00Z')
    expect(localDateStr(instant, 'Europe/Moscow')).toBe('2026-03-11') // 00:30 next day
    expect(localDateStr(instant, 'America/New_York')).toBe('2026-03-10') // 16:30 same day
  })
})

describe('dayPeriod boundaries', () => {
  it('Moscow day = [00:00+03, 00:00+03 next)', () => {
    const { start, end } = dayPeriod('2026-08-22', 'Europe/Moscow')
    expect(iso(start)).toBe('2026-08-21T21:00:00.000Z')
    expect(iso(end)).toBe('2026-08-22T21:00:00.000Z')
  })

  it('DST spring-forward day is 23h (America/New_York 2026-03-08)', () => {
    const { start, end } = dayPeriod('2026-03-08', 'America/New_York')
    const hours = (end.getTime() - start.getTime()) / 3600_000
    expect(hours).toBe(23)
  })

  it('DST fall-back day is 25h (America/New_York 2026-11-01)', () => {
    const { start, end } = dayPeriod('2026-11-01', 'America/New_York')
    expect((end.getTime() - start.getTime()) / 3600_000).toBe(25)
  })
})

describe('week / month / year boundaries', () => {
  it('mondayOf handles ISO weeks', () => {
    expect(mondayOf('2026-08-22')).toBe('2026-08-17') // Sat -> Mon
    expect(mondayOf('2026-08-17')).toBe('2026-08-17') // Mon stays
  })

  it('weekPeriod spans exactly 7 local days', async () => {
    const { start, end } = weekPeriod('2026-08-17', 'Europe/Moscow')
    expect((end.getTime() - start.getTime()) / (24 * 3600_000)).toBe(7)
  })

  it('monthWeekMondays: Mon-attributed weeks intersecting August 2026 (6 of them)', () => {
    const mondays = monthWeekMondays(2026, 8)
    // Aug-1 is Saturday; its Monday (Jul 27) still intersects the month,
    // and Aug-31 (Monday) starts the week that leaves the month.
    expect(mondays).toEqual([
      '2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31',
    ])
  })

  it('monthPeriod December rolls into next year', () => {
    const { end } = monthPeriod(2026, 12, 'Europe/Moscow')
    expect(localDateStr(end, 'Europe/Moscow')).toBe('2027-01-01')
  })

  it('yearPeriod spans Jan 1..Jan 1 local', () => {
    const { start, end } = yearPeriod(2026, 'Asia/Yekaterinburg')
    expect(localDateStr(start, 'Asia/Yekaterinburg')).toBe('2026-01-01')
    expect(localDateStr(end, 'Asia/Yekaterinburg')).toBe('2027-01-01')
  })

  it('zonedToUtc round-trips through localDateStr (leap year included)', () => {
    const inst = zonedToUtc(2028, 2, 29, 13, 45, 'Europe/Moscow')
    expect(localDateStr(inst, 'Europe/Moscow')).toBe('2028-02-29')
  })
})
