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
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production')
    const limit = isServerless ? '2' : '5'
    u.searchParams.set('connection_limit', limit)
    u.searchParams.set('pool_timeout', '30')
    u.searchParams.set('connect_timeout', '30')
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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: tunedDatabaseUrl(process.env.DATABASE_URL) } },
    log: ['error'],
  })

globalForPrisma.prisma = prisma
