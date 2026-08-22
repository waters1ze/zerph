import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/digests?level=day|week|month|year&limit=30
 * Timeline for the "Архив" UI. Read-only over the additive digest layer.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
  }

  const url = new URL(req.url)
  const levelParam = url.searchParams.get('level')
  const levels = levelParam && ['day', 'week', 'month', 'year'].includes(levelParam)
    ? [levelParam]
    : ['day', 'week', 'month', 'year']
  const limit = Math.min(Number(url.searchParams.get('limit') || 60), 200)

  try {
    const rows = await prisma.timeDigest.findMany({
      where: { ownerChatId: BigInt(authUser.chatId), level: { in: levels }, model: { not: 'empty-marker' } },
      orderBy: { periodStart: 'desc' },
      take: limit,
      select: {
        id: true, level: true, periodStart: true, periodEnd: true,
        text: true, model: true, inputTokens: true,
      },
    })

    const totals = await prisma.timeDigest.aggregate({
      where: { ownerChatId: BigInt(authUser.chatId) },
      _sum: { inputTokens: true },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      digests: rows.map(r => ({
        ...r,
        periodStart: r.periodStart.toISOString(),
        periodEnd: r.periodEnd.toISOString(),
      })),
      stats: { totalTokensSpent: totals._sum.inputTokens || 0, totalDigests: totals._count },
    })
  } catch (err) {
    console.error('[Digests API] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
