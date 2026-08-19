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

    const isCalendarRequested = Boolean(decodedState.includeCalendar)
    let targetChatId = decodedState.chatId

    if (googleEmail) {
      // Find if this Google Email is already attached to any existing account
      const existingUserWithEmail = await prisma.telegramChat.findFirst({
        where: {
          OR: [
            { googleEmail: googleEmail },
            { email: googleEmail },
          ],
        },
      })

      const isExplicitLink = targetChatId && !targetChatId.startsWith('guest_') && targetChatId !== 'web' && targetChatId !== 'web_oauth_login'

      if (isExplicitLink) {
        // Active user is linking Google to their existing account
        const primaryCid = BigInt(targetChatId)

        // If a separate dummy account was previously created with this email, merge it
        if (existingUserWithEmail && existingUserWithEmail.chatId !== primaryCid) {
          try {
            await prisma.task.updateMany({ where: { ownerChatId: existingUserWithEmail.chatId }, data: { ownerChatId: primaryCid } })
            await prisma.note.updateMany({ where: { ownerChatId: existingUserWithEmail.chatId }, data: { ownerChatId: primaryCid } })
            await prisma.telegramChat.delete({ where: { chatId: existingUserWithEmail.chatId } })
          } catch {}
        }

        await prisma.telegramChat.update({
          where: { chatId: primaryCid },
          data: {
            googleEmail: googleEmail,
            ...(isCalendarRequested ? {
              googleCalendarToken: JSON.stringify(tokens),
              googleCalendarSync: true,
            } : {}),
            lastActiveAt: new Date(),
          },
        }).catch(() => {})
      } else if (existingUserWithEmail) {
        // User logging in via Google OAuth — log into their existing unified account
        targetChatId = String(existingUserWithEmail.chatId)
        await prisma.telegramChat.update({
          where: { chatId: existingUserWithEmail.chatId },
          data: {
            googleEmail: googleEmail,
            ...(isCalendarRequested ? {
              googleCalendarToken: JSON.stringify(tokens),
              googleCalendarSync: true,
            } : {}),
            lastActiveAt: new Date(),
          },
        }).catch(() => {})
      } else {
        // Brand new user registering via Google OAuth
        let newCid = generateEmailChatId()
        for (let i = 0; i < 5; i++) {
          const clash = await prisma.telegramChat.findUnique({ where: { chatId: newCid } })
          if (!clash) break
          newCid = generateEmailChatId()
        }

        const newUser = await prisma.telegramChat.create({
          data: {
            chatId: newCid,
            email: googleEmail,
            googleEmail: googleEmail,
            authProvider: 'google',
            firstName: googleName || googleEmail.split('@')[0],
            ...(isCalendarRequested ? {
              googleCalendarToken: JSON.stringify(tokens),
              googleCalendarSync: true,
            } : {
              googleCalendarSync: false,
            }),
            lastActiveAt: new Date(),
          },
        })
        targetChatId = String(newUser.chatId)
      }
    }

    if (targetChatId && !targetChatId.startsWith('guest_') && targetChatId !== 'web') {
      const cid = BigInt(targetChatId)
      if (isCalendarRequested) {
        syncGoogleCalendar(targetChatId).catch(() => {})
      }

      const sessionToken = await createServerSession(
        cid,
        'Google OAuth Session',
        'web',
        req.headers.get('x-forwarded-for') || undefined,
        req.headers.get('user-agent') || undefined
      )

      const res = NextResponse.redirect(`${origin}/?google_auth_success=1${googleEmail ? `&email=${encodeURIComponent(googleEmail)}` : ''}#settings`)
      res.cookies.set('zerf_chat_id', String(cid), COOKIE_OPTS)
      res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)
      return res
    }

    return NextResponse.redirect(`${origin}/?google_calendar_success=1${googleEmail ? `&email=${encodeURIComponent(googleEmail)}` : ''}#settings`)
  } catch (err: any) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(`${origin}/?google_calendar_error=${encodeURIComponent(String(err.message || err))}`)
  }
}
