/**
 * In-memory rate limiting with TTL sliding windows.
 * Zero database overhead (avoids extra Prisma queries on high concurrency).
 */

import { prisma } from './prisma'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Automatically purge expired rate limit entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, val] of rateLimitStore.entries()) {
      if (val.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000).unref?.()
}

/**
 * Checks if a given key is within the rate limit.
 * @param key Unique identifier (e.g. `install:${chatId}`)
 * @param maxReqs Maximum number of requests allowed in window
 * @param windowMs Time window in milliseconds
 * @returns boolean `true` if request is allowed, `false` if rate limit is exceeded
 */
export function checkInMemoryRateLimit(key: string, maxReqs: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxReqs) {
    return false
  }

  entry.count++
  return true
}

/**
 * Best-effort client IP extraction for rate limiting (first hop of
 * x-forwarded-for, falling back to x-real-ip). On serverless platforms the
 * proxy sets these headers, so they are usable for throttling even though
 * they must never be trusted for authorization decisions.
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * DB-backed fixed-window rate limit that works ACROSS serverless instances
 * (the in-memory Map above is per-lambda-instance, so on Vercel the effective
 * cap is multiplied by the instance count — a real problem for brute-force
 * targets like login PINs).
 *
 * Approximate by design: read-modify-write races may undercount slightly,
 * which only marginally relaxes the cap while still defeating per-instance
 * multiplication. Buckets live in the Config table and old indexes are swept
 * lazily by subsequent requests from the same key.
 *
 * Fails OPEN when the DB is unreachable (the in-memory layer still applies) —
 * throttling must never take down the endpoint it protects.
 */
export async function checkDbRateLimit(key: string, maxReqs: number, windowMs: number): Promise<boolean> {
  try {
    const now = Date.now()
    const windowIdx = Math.floor(now / windowMs)
    const bucketKey = `rl_bucket:${key}:${windowIdx}`
    const value = JSON.stringify({ count: 1, resetAt: now + windowMs })

    const existing = await prisma.config.findUnique({ where: { key: bucketKey } })
    if (!existing) {
      try {
        await prisma.config.create({ data: { key: bucketKey, value } })
      } catch (err: any) {
        // Lost a create race against another instance — re-read and enforce.
        if (err?.code === 'P2002') {
          const raced = await prisma.config.findUnique({ where: { key: bucketKey } }).catch(() => null)
          if (raced) {
            let c = 0
            try { c = Number(JSON.parse(raced.value)?.count) || 0 } catch {}
            if (c + 1 > maxReqs) return false
            await prisma.config.update({
              where: { key: bucketKey },
              data: { value: JSON.stringify({ count: c + 1, resetAt: now + windowMs }) },
            })
          }
        } else {
          throw err
        }
      }
    } else {
      let c = 0
      try { c = Number(JSON.parse(existing.value)?.count) || 0 } catch {}
      if (c + 1 > maxReqs) return false
      await prisma.config.update({
        where: { key: bucketKey },
        data: { value: JSON.stringify({ count: c + 1, resetAt: now + windowMs }) },
      })
    }

    // Lazy sweep of this key's expired buckets (keeps Config tidy without cron)
    prisma.config.deleteMany({
      where: { key: { startsWith: `rl_bucket:${key}:` }, NOT: { key: bucketKey } },
    }).catch(() => {})

    return true
  } catch {
    return true // fail open
  }
}

/**
 * Two-layer limit: in-memory (cheap, blocks bursts within an instance)
 * AND db-backed (enforces the global cap across all serverless instances).
 */
export async function checkHybridRateLimit(key: string, maxReqs: number, windowMs: number): Promise<boolean> {
  if (!checkInMemoryRateLimit(key, maxReqs, windowMs)) return false
  return checkDbRateLimit(key, maxReqs, windowMs)
}
