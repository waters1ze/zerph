import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession, getAuthenticatedUser } from '@/lib/backend/auth'
import { generateEmailChatId } from '@/lib/backend/passwords'
import { exchangeCodeForTokens, getGoogleAuthUrl } from '@/lib/backend/google-calendar'

export const dynamic = 'force-dynamic'

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

function getGoogleRedirectUri(requestOrigin?: string): string {
  if (requestOrigin) {
    return `${requestOrigin.replace(/\/$/, '')}/api/auth/google`
  }
  if (process.env.GOOGLE_AUTH_REDIRECT_URI) {
    return process.env.GOOGLE_AUTH_REDIRECT_URI
  }
  return 'https://zeprh.vercel.app/api/auth/google'
}

/**
 * GET: 1-Click Google OAuth entry & callback
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin || 'https://zeprh.vercel.app'
  const redirectUri = getGoogleRedirectUri(origin)
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  // If user clicked "Войти через Google", start OAuth flow
  if (!code && !error) {
    const authUrl = getGoogleAuthUrl('web_oauth_login', redirectUri)
    return NextResponse.redirect(authUrl)
  }

  if (error || !code) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error || 'cancelled')}`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    if (!tokens.access_token) {
      throw new Error('No access token received from Google')
    }

    // Fetch user profile from Google UserInfo
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoRes.json()
    const email = userInfo.email ? String(userInfo.email).trim().toLowerCase() : null
    const name = userInfo.name || userInfo.given_name || (email ? email.split('@')[0] : 'Пользователь Google')

    if (!email) {
      return NextResponse.redirect(`${origin}/?auth_error=no_email_returned`)
    }

    // Find existing account by googleEmail or email
    let user = await prisma.telegramChat.findFirst({
      where: {
        OR: [
          { googleEmail: email },
          { email: email },
        ]
      }
    })

    if (!user) {
      // Create new Google-authenticated user account
      let targetChatId = generateEmailChatId()
      for (let i = 0; i < 5; i++) {
        const clash = await prisma.telegramChat.findUnique({ where: { chatId: targetChatId } })
        if (!clash) break
        targetChatId = generateEmailChatId()
      }

      user = await prisma.telegramChat.create({
        data: {
          chatId: targetChatId,
          email: email,
          googleEmail: email,
          authProvider: 'google',
          firstName: name,
          googleCalendarToken: JSON.stringify(tokens),
          googleCalendarSync: true,
          lastActiveAt: new Date(),
        }
      })
    } else {
      // Update existing account
      await prisma.telegramChat.update({
        where: { chatId: user.chatId },
        data: {
          googleEmail: email,
          googleCalendarToken: JSON.stringify(tokens),
          googleCalendarSync: true,
          lastActiveAt: new Date(),
        }
      })
    }

    const sessionToken = await createServerSession(
      user.chatId,
      'Google OAuth Session',
      'web',
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    const res = NextResponse.redirect(`${origin}/?google_auth_success=1`)
    res.cookies.set('zerf_chat_id', String(user.chatId), COOKIE_OPTS)
    res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)
    return res
  } catch (err: any) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(err.message || 'google_auth_failed')}`)
  }
}

/**
 * POST: Direct Google Email sign in / registration / linking
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const body = await req.json()
    const { email, firstName } = body

    const cleanEmail = (email || '').trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ error: 'Пожалуйста, введите корректный Google Email' }, { status: 400 })
    }

    // 1. If currently logged in, link Google Email to this active account
    if (authUser?.chatId) {
      const cid = BigInt(authUser.chatId)
      await prisma.telegramChat.update({
        where: { chatId: cid },
        data: { googleEmail: cleanEmail },
      })
      return NextResponse.json({
        success: true,
        message: 'Google аккаунт успешно привязан!',
        googleEmail: cleanEmail,
      })
    }

    // 2. If guest mode (unauthenticated), find or register a new Google account
    let user = await prisma.telegramChat.findFirst({
      where: {
        OR: [
          { googleEmail: cleanEmail },
          { email: cleanEmail },
        ]
      }
    })

    if (!user) {
      let targetChatId = generateEmailChatId()
      for (let i = 0; i < 5; i++) {
        const clash = await prisma.telegramChat.findUnique({ where: { chatId: targetChatId } })
        if (!clash) break
        targetChatId = generateEmailChatId()
      }

      user = await prisma.telegramChat.create({
        data: {
          chatId: targetChatId,
          email: cleanEmail,
          googleEmail: cleanEmail,
          authProvider: 'google',
          firstName: firstName || cleanEmail.split('@')[0],
          lastActiveAt: new Date(),
        }
      })
    } else if (!user.googleEmail) {
      await prisma.telegramChat.update({
        where: { chatId: user.chatId },
        data: { googleEmail: cleanEmail },
      })
    }

    const sessionToken = await createServerSession(
      user.chatId,
      'Google Web Session',
      'web',
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    const res = NextResponse.json({
      success: true,
      chatId: String(user.chatId),
      firstName: user.firstName,
      token: sessionToken,
      googleEmail: cleanEmail,
      message: 'Успешный вход через Google!',
    })

    res.cookies.set('zerf_chat_id', String(user.chatId), COOKIE_OPTS)
    res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)
    return res
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
