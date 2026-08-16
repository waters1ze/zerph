/**
 * Server-side plan helpers: daily usage counters & user preferences (Prisma-backed).
 * Pure plan data lives in lib/plans.ts.
 */

import { prisma } from './prisma'

export * from '../plans'

// ── Daily usage counters (Config-backed, no schema migration needed) ─────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function counterKey(kind: string, chatId: string | number | bigint): string {
  return `cnt_${kind}_${chatId}_${todayKey()}`
}

export async function getDailyCount(kind: string, chatId: string | number | bigint): Promise<number> {
  try {
    const row = await prisma.config.findUnique({ where: { key: counterKey(kind, chatId) } })
    return row ? parseInt(row.value, 10) || 0 : 0
  } catch {
    return 0
  }
}

export async function incrementDailyCount(
  kind: string,
  chatId: string | number | bigint,
  by = 1
): Promise<number> {
  const key = counterKey(kind, chatId)
  try {
    const row = await prisma.config.upsert({
      where: { key },
      update: { value: String((parseInt((await prisma.config.findUnique({ where: { key } }))?.value || '0', 10) || 0) + by) },
      create: { key, value: String(by) },
    })
    return parseInt(row.value, 10) || 0
  } catch {
    return 0
  }
}

// Counter kinds used across the app
export const COUNTERS = {
  siri: 'siri',
  photo: 'photo',
  goal: 'goal',
  reminder: 'reminder',
} as const

/** User preference keys (Config-backed settings). */
export const USER_SETTINGS = {
  newsDisabled: (chatId: string) => `news_disabled_${chatId}`,
} as const

export async function isNewsDisabled(chatId: string | number | bigint): Promise<boolean> {
  try {
    const row = await prisma.config.findUnique({ where: { key: USER_SETTINGS.newsDisabled(String(chatId)) } })
    return row?.value === 'true'
  } catch {
    return false
  }
}

export async function setNewsDisabled(chatId: string | number | bigint, disabled: boolean): Promise<void> {
  await prisma.config.upsert({
    where: { key: USER_SETTINGS.newsDisabled(String(chatId)) },
    update: { value: disabled ? 'true' : 'false' },
    create: { key: USER_SETTINGS.newsDisabled(String(chatId)), value: disabled ? 'true' : 'false' },
  }).catch(() => {})
}
