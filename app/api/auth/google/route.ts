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
    const body = await req.json()
    const { email, firstName } = body

    const cleanEmail = (email || '').trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ error: 'Пожалуйста, введите корректный Google Email' }, { status: 400 })
    }

    // 1. If currently logged in, link Google Email to this active account
    if (!authUser?.chatId) {
      return NextResponse.json({
        error: 'Для входа через Google используйте защищенный OAuth вход.',
        requiresOAuth: true,
      }, { status: 401 })
    }

    const cid = BigInt(authUser.chatId)

    // If a separate dummy account was previously created with this email, merge it
    const clash = await prisma.telegramChat.findFirst({
      where: {
        chatId: { not: cid },
        OR: [{ googleEmail: cleanEmail }, { email: cleanEmail }],
      }
    })
    if (clash) {
      try {
        await prisma.task.updateMany({ where: { ownerChatId: clash.chatId }, data: { ownerChatId: cid } })
        await prisma.note.updateMany({ where: { ownerChatId: clash.chatId }, data: { ownerChatId: cid } })
        await prisma.goal.updateMany({ where: { ownerChatId: clash.chatId }, data: { ownerChatId: cid } })
        await prisma.habit.updateMany({ where: { ownerChatId: clash.chatId }, data: { ownerChatId: cid } })
        await prisma.telegramChat.delete({ where: { chatId: clash.chatId } })
      } catch {}
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
