import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession } from '@/lib/backend/auth'
import { generateEmailChatId } from '@/lib/backend/passwords'
import { exchangeCodeForTokens, getRedirectUri, syncGoogleCalendar } from '@/lib/backend/google-calendar'

export const dynamic = 'force-dynamic'

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'zeprh.vercel.app'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error || !code) {
      return NextResponse.redirect(`${origin}/?google_calendar_error=${encodeURIComponent(error || 'no_code')}`)
    }

    let decodedState: any = {}
    if (state) {
      try {
        decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
      } catch {}
    }

    const redirectUri = getRedirectUri(origin)
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    if (!tokens.access_token) {
      throw new Error('Не получен токен от Google')
    }

    // Fetch user info from Google
    let googleEmail: string | null = null
    let googleName: string | null = null
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const userInfo = await userInfoRes.json()
      if (userInfo.email) googleEmail = String(userInfo.email).trim().toLowerCase()
      if (userInfo.name) googleName = userInfo.name
    } catch {}

    let targetChatId = decodedState.chatId

    // If web OAuth login or guest mode without valid chatId
    if (!targetChatId || targetChatId === 'web' || targetChatId === 'web_oauth_login' || targetChatId.startsWith('guest_')) {
      if (googleEmail) {
        let user = await prisma.telegramChat.findFirst({
          where: {
            OR: [
              { googleEmail: googleEmail },
              { email: googleEmail },
            ]
          }
        })

        if (!user) {
          let newCid = generateEmailChatId()
          for (let i = 0; i < 5; i++) {
            const clash = await prisma.telegramChat.findUnique({ where: { chatId: newCid } })
            if (!clash) break
            newCid = generateEmailChatId()
          }

          user = await prisma.telegramChat.create({
            data: {
              chatId: newCid,
              email: googleEmail,
              googleEmail: googleEmail,
              authProvider: 'google',
              firstName: googleName || googleEmail.split('@')[0],
              googleCalendarToken: JSON.stringify(tokens),
              googleCalendarSync: true,
              lastActiveAt: new Date(),
            }
          })
        } else {
          await prisma.telegramChat.update({
            where: { chatId: user.chatId },
            data: {
              googleEmail: googleEmail,
              googleCalendarToken: JSON.stringify(tokens),
              googleCalendarSync: true,
              lastActiveAt: new Date(),
            }
          })
        }

        targetChatId = String(user.chatId)
      }
    } else {
      // Existing user linking calendar
      try {
        const cid = BigInt(targetChatId)
        await prisma.telegramChat.update({
          where: { chatId: cid },
          data: {
            googleCalendarToken: JSON.stringify(tokens),
            googleCalendarSync: true,
            ...(googleEmail ? { googleEmail } : {}),
          },
        })
      } catch {}
    }

    if (targetChatId && !targetChatId.startsWith('guest_') && targetChatId !== 'web') {
      const cid = BigInt(targetChatId)
      // Perform initial calendar sync asynchronously
      syncGoogleCalendar(targetChatId).catch(() => {})

      const sessionToken = await createServerSession(
        cid,
        'Google OAuth Session',
        'web',
        req.headers.get('x-forwarded-for') || undefined,
        req.headers.get('user-agent') || undefined
      )

      const res = NextResponse.redirect(`${origin}/?google_auth_success=1`)
      res.cookies.set('zerf_chat_id', String(cid), COOKIE_OPTS)
      res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)
      return res
    }

    return NextResponse.redirect(`${origin}/?google_calendar_success=1`)
  } catch (err: any) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(`${origin}/?google_calendar_error=${encodeURIComponent(String(err.message || err))}`)
  }
}
