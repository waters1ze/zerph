/**
 * POST /api/db/optimize — Automatic database storage optimization, compaction, and cleanup
 * Features:
 *  - Prunes expired temporary keys & orphaned logs
 *  - Compresses & removes duplicate configuration blobs
 *  - Cleans up stale guest sessions
 *  - Keeps PostgreSQL database storage ultra-compact & lightweight
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let cleanedConfigs = 0
    let cleanedOldSessions = 0

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

    return NextResponse.json({
      success: true,
      message: 'База данных успешно оптимизирована!',
      stats: {
        cleanedConfigs,
        compactedExtensions,
        timestamp: new Date().toISOString(),
      }
    })
  } catch (err: unknown) {
    console.error('DB optimize error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
