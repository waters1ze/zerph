import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, isUserAdmin } from '@/lib/backend/auth'
import { getUserUsageAndLimits } from '@/lib/backend/db'
import { getGoogleAuthUrl, getRedirectUri } from '@/lib/backend/google-calendar'

export async function GET(req: NextRequest) {
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
        error: '🔒 Интеграция с Google Календарём доступна только на тарифах Zerf Pro и Corp. Оформите подписку в Настройках!',
        proRequired: true,
      }, { status: 403 })
    }

    const host = req.headers.get('host') || 'zerph.ru'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const origin = `${protocol}://${host}`

    const redirectUri = getRedirectUri(origin)
    const url = getGoogleAuthUrl(authUser.chatId, redirectUri, true)

    return NextResponse.json({ url })
  } catch (err: any) {
    console.error('Error generating Google Calendar Auth URL:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
