import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession, getAuthenticatedUser } from '@/lib/backend/auth'
import { generateEmailChatId } from '@/lib/backend/passwords'
import { exchangeCodeForTokens, getGoogleAuthUrl, getRedirectUri } from '@/lib/backend/google-calendar'

export const dynamic = 'force-dynamic'

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

/**
 * GET: 1-Click Google OAuth entry (redirects to Google with whitelist redirect_uri)
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin || 'https://zeprh.vercel.app'
  const redirectUri = getRedirectUri(origin)
  const authUrl = getGoogleAuthUrl('web_oauth_login', redirectUri)
  return NextResponse.redirect(authUrl)
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
