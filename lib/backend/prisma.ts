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
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '10')
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '20')
    if (!u.searchParams.has('connect_timeout')) u.searchParams.set('connect_timeout', '15')
    if (!u.searchParams.has('pgbouncer') && (url.includes('pooler.supabase.com') || url.includes('6543') || url.includes('pgbouncer=true'))) {
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
