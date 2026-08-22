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
  
  // Detect active logged in user from session or cookies or query
  const authUser = await getAuthenticatedUser(req)
  const cookieCid = req.cookies.get('zerf_chat_id')?.value
  const paramCid = req.nextUrl.searchParams.get('chatId')
  const includeCalendar = req.nextUrl.searchParams.get('includeCalendar') === 'true'

  const targetChatId = authUser?.chatId ? String(authUser.chatId) : (cookieCid || paramCid || 'web_oauth_login')
  const authUrl = getGoogleAuthUrl(targetChatId, redirectUri, includeCalendar)
  return NextResponse.redirect(authUrl)
}

/**
 * POST: Direct Google Email sign in / registration / linking
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const body: any = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const email: unknown = body.email

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
      return NextResponse.json({ error: 'Укажите корректный Google Email' }, { status: 400 })
    }

    // 1. If currently logged in, link Google Email to this active account
    if (!authUser?.chatId) {
      return NextResponse.json({
        error: 'Для входа через Google используйте защищенный OAuth вход.',
        requiresOAuth: true,
      }, { status: 401 })
    }

    const cid = BigInt(authUser.chatId)

    // SECURITY (audit C-2): the previous implementation "merged" any existing
    // account that owned the submitted email — transferring ALL of its
    // tasks/notes/goals/habits to the caller and DELETING the victim's row.
    // The email here is client-supplied and never verified, so knowing just
    // someone's email enabled total content theft + account destruction.
    // Now a conflicting email is simply refused; linking proceeds only when
    // the email is free.
    const clash = await prisma.telegramChat.findFirst({
      where: {
        chatId: { not: cid },
        OR: [{ googleEmail: cleanEmail }, { email: cleanEmail }],
      },
      select: { chatId: true },
    })
    if (clash) {
      return NextResponse.json(
        { error: 'Этот Google Email уже привязан к другому аккаунту', code: 'email_taken' },
        { status: 409 }
      )
    }

    await prisma.telegramChat.update({
      where: { chatId: cid },
      data: { googleEmail: cleanEmail },
    })
    return NextResponse.json({
      success: true,
      message: 'Google аккаунт успешно привязан!',
      googleEmail: cleanEmail,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
