import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, isUserAdmin } from '@/lib/backend/auth'
import { getUserUsageAndLimits } from '@/lib/backend/db'
import { syncGoogleCalendar } from '@/lib/backend/google-calendar'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userLimits = await getUserUsageAndLimits(authUser.chatId)
    const userPlan = userLimits?.plan || 'free'
    const isAdmin = await isUserAdmin(authUser.chatId)
    const isProOrHigher = ['pro', 'corp', 'creator', 'admin'].includes(userPlan) || isAdmin

    if (!isProOrHigher) {
      return NextResponse.json({
        error: '🔒 Синхронизация с Google Календарём доступна только на тарифах Zerf Pro и Corp.',
        proRequired: true,
        success: false
      }, { status: 403 })
    }

    const result = await syncGoogleCalendar(authUser.chatId)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Error syncing Google Calendar:', err)
    return NextResponse.json({ error: String(err), success: false }, { status: 500 })
  }
}
