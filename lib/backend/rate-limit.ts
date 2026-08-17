/**
 * In-memory rate limiting with TTL sliding windows.
 * Zero database overhead (avoids extra Prisma queries on high concurrency).
 */

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
