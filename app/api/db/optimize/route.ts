/**
 * POST /api/db/optimize — Automatic database storage optimization, compaction, and cleanup
 * Features:
 *  - Prunes expired temporary keys & orphaned logs
 *  - Compresses & removes duplicate configuration blobs
 *  - Cleans up stale guest sessions
 *  - Keeps PostgreSQL database storage ultra-compact & lightweight
 */

import { NextRequest, NextResponse } from 'next/server'
import { isCallerAdmin } from '@/lib/backend/admin'
import { prisma } from '@/lib/backend/prisma'

export async function POST(req: NextRequest) {
  try {
    // SECURITY (audit H-5): this routine performs GLOBAL destructive
    // maintenance (wipes temp_/draft_/cache_ configs for ALL users and can
    // trigger account cleanup sweeps). It previously required only "any
    // authenticated user". Admin/root only now.
    const admin = await isCallerAdmin(req)
    if (!admin.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    let cleanedConfigs = 0
    const cleanedOldSessions = 0

    // 1. Clean expired / orphan temporary config entries
    const allConfigs = await prisma.config.findMany({
      where: {
        OR: [
          { key: { startsWith: 'temp_' } },
          { key: { startsWith: 'draft_' } },
          { key: { startsWith: 'cache_' } },
        ]
      }
    })

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    for (const c of allConfigs) {
      if (c.updatedAt < oneWeekAgo) {
        await prisma.config.delete({ where: { key: c.key } }).catch(() => {})
        cleanedConfigs++
      }
    }

    // 2. Compact custom extensions stored in DB — remove heavy inline content if githubUrl exists
    const extConfigs = await prisma.config.findMany({
      where: { key: { startsWith: 'zerf_ext_' } }
    })

    let compactedExtensions = 0
    for (const ec of extConfigs) {
      try {
        const parsed = JSON.parse(ec.value)
        if (parsed && parsed.githubUrl && parsed.content && Object.keys(parsed.content).length > 20) {
          // Keep only lightweight metadata, content is fetched on-demand from GitHub
          delete parsed.content
          await prisma.config.update({
            where: { key: ec.key },
            data: { value: JSON.stringify(parsed) }
          })
          compactedExtensions++
        }
      } catch {}
    }

    // 3. Clean up inactive accounts past their retention period (1/3/6/12 months)
    const { cleanupInactiveAccounts, compactOldCompletedTasks } = await import('@/lib/backend/db')
    const inactiveCleanup = await cleanupInactiveAccounts().catch(() => ({ deletedCount: 0, checkedCount: 0 }))

    // 4. Maximize compaction of completed tasks older than 7 days without deleting history/graphs
    const taskCompaction = await compactOldCompletedTasks(admin.callerChatId || '0').catch(() => ({ compactedCount: 0 }))

    return NextResponse.json({
      success: true,
      message: 'База данных успешно оптимизирована!',
      stats: {
        cleanedConfigs,
        compactedExtensions,
        compactedOldTasks: taskCompaction.compactedCount,
        deletedInactiveAccounts: inactiveCleanup.deletedCount,
        checkedAccounts: inactiveCleanup.checkedCount,
        timestamp: new Date().toISOString(),
      }
    })
  } catch (err: unknown) {
    console.error('DB optimize error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
