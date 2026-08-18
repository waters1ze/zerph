import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { getGoogleAuthUrl, getRedirectUri } from '@/lib/backend/google-calendar'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const host = req.headers.get('host') || 'zerph.ru'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const origin = `${protocol}://${host}`

    const redirectUri = getRedirectUri(origin)
    const url = getGoogleAuthUrl(authUser.chatId, redirectUri)

    return NextResponse.json({ url })
  } catch (err: any) {
    console.error('Error generating Google Calendar Auth URL:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
