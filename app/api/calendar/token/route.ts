import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { exchangeCodeForTokens, getRedirectUri, syncGoogleCalendar } from '@/lib/backend/google-calendar'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    const host = req.headers.get('host') || 'zerph.ru'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const origin = `${protocol}://${host}`

    if (error || !code) {
      return NextResponse.redirect(`${origin}/settings?google_calendar_error=${encodeURIComponent(error || 'no_code')}`)
    }

    let chatId: string | null = null
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
        chatId = decoded.chatId
      } catch {}
    }

    if (!chatId) {
      return NextResponse.redirect(`${origin}/settings?google_calendar_error=invalid_state`)
    }

    const redirectUri = getRedirectUri(origin)
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    // Save tokens and enable sync
    await prisma.telegramChat.update({
      where: { chatId: BigInt(chatId) },
      data: {
        googleCalendarToken: JSON.stringify(tokens),
        googleCalendarSync: true,
      },
    })

    // Perform initial 2-way sync asynchronously
    syncGoogleCalendar(chatId).catch(err => console.error('Initial Google Calendar sync error:', err))

    return NextResponse.redirect(`${origin}/settings?google_calendar_success=1`)
  } catch (err: any) {
    console.error('Google Calendar OAuth callback error:', err)
    const host = req.headers.get('host') || 'zerph.ru'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const origin = `${protocol}://${host}`
    return NextResponse.redirect(`${origin}/settings?google_calendar_error=${encodeURIComponent(String(err.message || err))}`)
  }
}
