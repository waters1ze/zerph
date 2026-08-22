import { PrismaClient } from '@prisma/client'

/**
 * Tune the connection URL for the Supabase transaction pooler (pgbouncer):
 * serverless functions must keep a tiny connection pool, otherwise many
 * lambdas x default pool size exhausts the pooler and causes intermittent
 * "Can't reach database server" errors.
 */
function tunedDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    // Serverless-safe default: N lambdas × this limit hit the Supabase
    // pooler. 5 keeps a healthy headroom under Vercel concurrency
    // (audit H-7/B8: the previous default of 15 contradicted the
    // "tiny pool" requirement). Override with PRISMA_CONNECTION_LIMIT.
    const limit = process.env.PRISMA_CONNECTION_LIMIT || '5'
    u.searchParams.set('connection_limit', limit)
    u.searchParams.set('pool_timeout', '15')
    u.searchParams.set('connect_timeout', '15')
    if (url.includes('pooler.supabase.com') || url.includes('6543') || url.includes('pgbouncer=true')) {
      u.searchParams.set('pgbouncer', 'true')
    }
    return u.toString()
  } catch {
    return url
  }
}

// Prevent multiple Prisma instances across all environments (dev & serverless production)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Global BigInt JSON serialization support for Next.js API Routes & JSON.stringify
if (typeof BigInt !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  ;(BigInt.prototype as any).toJSON = function () {
    const num = Number(this)
    return Number.isSafeInteger(num) ? num : this.toString()
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: tunedDatabaseUrl(process.env.DATABASE_URL) } },
    log: ['error'],
  })

globalForPrisma.prisma = prisma

