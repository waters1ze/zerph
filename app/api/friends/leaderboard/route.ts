import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { getFriendsLeaderboard } from '@/lib/backend/friends-streaks'

export const dynamic = 'force-dynamic'

/**
 * GET /api/friends/leaderboard — streak leaderboard among accepted friends.
 * Privacy: hidden streaks arrive as `streak: null` and are excluded from ranks.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
  }

  try {
    const myCid = BigInt(authUser.chatId)
    const { entries, nudges } = await getFriendsLeaderboard(myCid)
    return NextResponse.json({ success: true, entries, nudges })
  } catch (err) {
    console.error('[Friends Leaderboard] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
