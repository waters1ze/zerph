import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession } from '@/lib/backend/auth'
import { hashPassword, verifyPassword, isLegacyPasswordHash, generateEmailChatId } from '@/lib/backend/passwords'
import { checkHybridRateLimit, getClientIp } from '@/lib/backend/rate-limit'

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, email, password, firstName } = body

    // Brute-force protection: per-IP and per-IP+email limits on login/register
    // (hybrid: in-memory burst guard + DB-backed cap shared by all instances)
    const ip = getClientIp(req)
    if (!(await checkHybridRateLimit(`emailauth:ip:${ip}`, 30, 15 * 60 * 1000))) {
      return NextResponse.json({ error: 'Слишком много попыток входа. Попробуйте позже.' }, { status: 429 })
    }

    const cleanEmail = (email || '').trim().toLowerCase()
    if (action === 'login' && cleanEmail) {
      if (!(await checkHybridRateLimit(`emailauth:acct:${ip}:${cleanEmail}`, 10, 15 * 60 * 1000))) {
        return NextResponse.json({ error: 'Слишком много попыток входа для этого Email. Попробуйте через 15 минут.' }, { status: 429 })
      }
    }
    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json({ error: 'Пожалуйста, введите корректный Email' }, { status: 400 })
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен содержать не менее 6 символов' }, { status: 400 })
    }

    const passHash = hashPassword(password)

    if (action === 'register' || action === 'link') {
      const existing = await prisma.telegramChat.findUnique({
        where: { email: cleanEmail }
      })

      if (existing) {
        return NextResponse.json({ error: 'Пользователь с таким Email уже существует. Пожалуйста, выполните вход.' }, { status: 400 })
      }

      // Create a brand-new account with a random non-colliding ID.
      // (Never trust client-supplied chatId — it is not authenticated here.)
      let targetChatId = generateEmailChatId()
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await prisma.telegramChat.findUnique({ where: { chatId: targetChatId } })
        if (!clash) break
        targetChatId = generateEmailChatId()
      }

      const user = await prisma.telegramChat.create({
        data: {
          chatId: targetChatId,
          email: cleanEmail,
          passwordHash: passHash,
          authProvider: 'email',
          firstName: firstName || cleanEmail.split('@')[0],
          lastActiveAt: new Date()
        }
      })

      const sessionToken = await createServerSession(
        user.chatId,
        'Email Web Session',
        'web',
        req.headers.get('x-forwarded-for') || undefined,
        req.headers.get('user-agent') || undefined
      )

      const res = NextResponse.json({
        success: true,
        chatId: String(user.chatId),
        firstName: user.firstName,
        token: sessionToken,
        message: 'Регистрация успешна!'
      })

      res.cookies.set('zerf_chat_id', String(user.chatId), COOKIE_OPTS)
      res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)

      return res
    }

    // Default action: login
    const user = await prisma.telegramChat.findFirst({
      where: { email: cleanEmail }
    })

    if (!user) {
      // Generic message to prevent account enumeration
      return NextResponse.json({ error: 'Неверный Email или пароль' }, { status: 401 })
    }

    // Accounts without a password (e.g. Telegram users who only linked an email)
    // can NOT be claimed via this endpoint.
    if (!user.passwordHash) {
      return NextResponse.json({
        error: 'Этот Email привязан к аккаунту, входящему через Telegram/VK. Используйте вход через бота (/login).'
      }, { status: 403 })
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Неверный Email или пароль' }, { status: 401 })
    }

    // Transparent upgrade of legacy static-salt hashes
    if (isLegacyPasswordHash(user.passwordHash)) {
      await prisma.telegramChat.update({
        where: { chatId: user.chatId },
        data: { passwordHash: passHash }
      })
    }

    const sessionToken = await createServerSession(
      user.chatId,
      'Email Web Session',
      'web',
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    const res = NextResponse.json({
      success: true,
      chatId: String(user.chatId),
      firstName: user.firstName,
      token: sessionToken,
      message: 'Успешный вход!'
    })

    res.cookies.set('zerf_chat_id', String(user.chatId), COOKIE_OPTS)
    res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)

    return res
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
