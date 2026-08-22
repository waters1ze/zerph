import fs from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from './prisma'

// In-memory set of executed keys: "taskName:date" or "taskName:userId:date"
const globalState = globalThis as unknown as {
  __cronSentKeys?: Set<string>
  __reminderCooldownMap?: Map<string, number>
}

if (!globalState.__cronSentKeys) {
  globalState.__cronSentKeys = new Set<string>()
}
if (!globalState.__reminderCooldownMap) {
  globalState.__reminderCooldownMap = new Map<string, number>()
}

const sentKeys = globalState.__cronSentKeys
const reminderCooldownMap = globalState.__reminderCooldownMap

// File lock path in temporary directory for cross-process/lambda lock persistence
const LOCK_FILE_PATH = path.join(os.tmpdir(), '.zerf_cron_lock_v2.json')

function loadFileLock(): Record<string, number> {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      const data = fs.readFileSync(LOCK_FILE_PATH, 'utf8')
      return JSON.parse(data) || {}
    }
  } catch (err) {
    // A corrupted lock file silently treated as "nothing done" caused
    // duplicate sends after restarts with zero log evidence (audit M-7).
    console.warn('[cron-lock] Failed to load lock file:', err)
  }
  return {}
}

function saveFileLock(lockData: Record<string, number>) {
  try {
    // Keep only records from the last 7 days to prevent unbounded growth
    const now = Date.now()
    const cleaned: Record<string, number> = {}
    for (const [key, ts] of Object.entries(lockData)) {
      if (now - ts < 7 * 24 * 60 * 60 * 1000) {
        cleaned[key] = ts
      }
    }
    fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(cleaned), 'utf8')
  } catch (err) {
    console.warn('[cron-lock] Failed to persist lock file:', err)
  }
}

/**
 * Check if a global cron task (channel post, weekly report, etc.) was already executed today
 */
export async function isCronAlreadyDoneToday(taskKey: string, todayStr: string): Promise<boolean> {
  const fullKey = `${taskKey}:${todayStr}`

  // 1. Check in-memory lock
  if (sentKeys.has(fullKey)) return true

  // 2. Check filesystem lock
  const fileLock = loadFileLock()
  if (fileLock[fullKey]) {
    sentKeys.add(fullKey)
    return true
  }

  // 3. Check DB Config table
  try {
    const config = await prisma.config.findUnique({
      where: { key: `cron_last_${taskKey}_date` },
    })
    if (config && config.value === todayStr) {
      sentKeys.add(fullKey)
      return true
    }
  } catch {}

  return false
}

/**
 * Mark a global cron task as executed for today (persists to Memory, File, and DB)
 */
export async function markCronDoneToday(taskKey: string, todayStr: string): Promise<void> {
  const fullKey = `${taskKey}:${todayStr}`

  // 1. Mark in-memory immediately (atomic guard)
  sentKeys.add(fullKey)

  // 2. Save to file lock
  try {
    const fileLock = loadFileLock()
    fileLock[fullKey] = Date.now()
    saveFileLock(fileLock)
  } catch {}

  // 3. Save to database Config table
  try {
    await prisma.config.upsert({
      where: { key: `cron_last_${taskKey}_date` },
      update: { value: todayStr },
      create: { key: `cron_last_${taskKey}_date`, value: todayStr },
    })
  } catch (err) {
    // Silent DB-persist failure = the task re-sends after restart/deploy
    // with no trace in logs (audit M-7). At minimum it must be visible.
    console.error(`[cron-lock] Failed to persist cron lock for ${taskKey}:`, err)
  }
}

/**
 * Optimistic atomic lock for global cron tasks.
 * Returns true if this process successfully acquired the lock (is the only sender today),
 * returns false if another instance or process already ran or is running today.
 */
export async function tryAcquireCronLock(taskKey: string, todayStr: string): Promise<boolean> {
  const fullKey = `${taskKey}:${todayStr}`
  const dbKey = `cron_last_${taskKey}_date`

  // In-memory quick check
  if (sentKeys.has(fullKey)) return false

  try {
    // Atomic acquisition: INSERT wins only for the very first caller today.
    // A unique-key violation means another instance already holds the lock.
    try {
      await prisma.config.create({ data: { key: dbKey, value: todayStr } })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Key exists: lock is already held for some date
        const existing = await prisma.config.findUnique({ where: { key: dbKey } })
        if (existing && existing.value === todayStr) {
          return false
        }
        // Stale lock from a previous day — claim it, but only if untouched
        const claimed = await prisma.config.updateMany({
          where: { key: dbKey, value: { not: todayStr } },
          data: { value: todayStr },
        })
        if (claimed.count === 0) return false
      } else {
        throw err
      }
    }

    // Memory guard is set ONLY after the distributed lock was successfully
    // acquired. Marking it earlier meant that a transient DB error would
    // permanently suppress the task for this instance while reporting a
    // false "already done" (audit finding C-7).
    sentKeys.add(fullKey)

    try {
      const fileLock = loadFileLock()
      fileLock[fullKey] = Date.now()
      saveFileLock(fileLock)
    } catch {}

    return true
  } catch (err) {
    // Transient failure: the lock was NOT acquired anywhere, so the memory
    // guard must stay unset — a retry within this process must be possible.
    console.error(`[tryAcquireCronLock] Error acquiring lock for ${fullKey}:`, err)
    return false
  }
}

/**
 * Check if a per-user cron task (Evening Review, Morning Greeting) was already sent to this user today
 */
export async function isUserCronDoneToday(taskKey: string, userId: string | number | bigint, todayStr: string): Promise<boolean> {
  const fullKey = `${taskKey}:user_${String(userId)}:${todayStr}`

  // 1. Memory check
  if (sentKeys.has(fullKey)) return true

  // 2. File lock check
  const fileLock = loadFileLock()
  if (fileLock[fullKey]) {
    sentKeys.add(fullKey)
    return true
  }

  // 3. DB check
  try {
    const config = await prisma.config.findUnique({
      where: { key: `cron_${taskKey}_u_${String(userId)}` },
    })
    if (config && config.value === todayStr) {
      sentKeys.add(fullKey)
      return true
    }
  } catch {}

  return false
}

/**
 * Mark per-user cron task as sent for today
 */
export async function markUserCronDoneToday(taskKey: string, userId: string | number | bigint, todayStr: string): Promise<void> {
  const fullKey = `${taskKey}:user_${String(userId)}:${todayStr}`

  // 1. Memory mark
  sentKeys.add(fullKey)

  // 2. File lock mark
  try {
    const fileLock = loadFileLock()
    fileLock[fullKey] = Date.now()
    saveFileLock(fileLock)
  } catch {}

  // 3. DB mark
  try {
    await prisma.config.upsert({
      where: { key: `cron_${taskKey}_u_${String(userId)}` },
      update: { value: todayStr },
      create: { key: `cron_${taskKey}_u_${String(userId)}`, value: todayStr },
    })
  } catch (err) {
    console.error(`[cron-lock] Failed to persist user cron lock for ${fullKey}:`, err)
  }
}

/**
 * Task Reminder Cooldown: prevents sending duplicate task reminders within 10 minutes for the same task & stage
 */
export function isReminderInCooldown(taskId: string, stage: string | number = 1, cooldownMs = 10 * 60 * 1000): boolean {
  const key = `${taskId}:${stage}`
  const lastTime = reminderCooldownMap.get(key)
  if (lastTime && Date.now() - lastTime < cooldownMs) {
    return true
  }
  return false
}

export function markReminderSent(taskId: string, stage: string | number = 1): void {
  const key = `${taskId}:${stage}`
  reminderCooldownMap.set(key, Date.now())
}
