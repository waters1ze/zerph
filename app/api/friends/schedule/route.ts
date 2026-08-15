import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { getFriendSchedule } from '@/lib/backend/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const friendId = searchParams.get('friendId') || searchParams.get('chatId')
  const date = searchParams.get('date') || undefined
  const daysCount = parseInt(searchParams.get('days') || searchParams.get('daysCount') || '1', 10)

  if (!friendId) {
    return NextResponse.json({ error: 'friendId is required' }, { status: 400 })
  }

  try {
    let targetCid: bigint
    try {
      targetCid = BigInt(friendId)
    } catch {
      return NextResponse.json({ error: 'Invalid friendId' }, { status: 400 })
    }
    const schedule = await getFriendSchedule(authUser.chatId, targetCid, date, isNaN(daysCount) ? 1 : daysCount)
    if (!schedule) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }
    return NextResponse.json(schedule)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
