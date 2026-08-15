import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession } from '@/lib/backend/auth'
import crypto from 'crypto'

function hashPassword(password: string): string {
  const salt = 'zerf_salt_2026'
  return crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex')
}

function generateDeterministicChatId(email: string): bigint {
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i)
    hash |= 0
  }
  // Generate positive unique 10-digit ID starting with 90
  const positive = Math.abs(hash)
  return BigInt(`90${String(positive).padStart(8, '0').slice(0, 8)}`)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, email, password, firstName } = body

    const cleanEmail = (email || '').trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ error: 'Пожалуйста, введите корректный Email' }, { status: 400 })
    }

    if (!password || password.length < 4) {
      return NextResponse.json({ error: 'Пароль должен содержать не менее 4 символов' }, { status: 400 })
    }

    const passHash = hashPassword(password)

    if (action === 'register') {
      const existing = await prisma.telegramChat.findUnique({
        where: { email: cleanEmail }
      })

      if (existing) {
        return NextResponse.json({ error: 'Пользователь с таким Email уже существует. Пожалуйста, выполните вход.' }, { status: 400 })
      }

      const newChatId = generateDeterministicChatId(cleanEmail)

      const user = await prisma.telegramChat.upsert({
        where: { chatId: newChatId },
        update: {
          email: cleanEmail,
          passwordHash: passHash,
          authProvider: 'email',
          firstName: firstName || cleanEmail.split('@')[0],
          lastActiveAt: new Date()
        },
        create: {
          chatId: newChatId,
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

      res.cookies.set('zerf_chat_id', String(user.chatId), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
      res.cookies.set('zerf_auth_token', sessionToken, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })

      return res
    }

    // Default action: login
    const user = await prisma.telegramChat.findFirst({
      where: { email: cleanEmail }
    })

    if (!user) {
      return NextResponse.json({ error: 'Аккаунт с таким Email не найден. Нажмите «Зарегистрироваться».' }, { status: 404 })
    }

    if (user.passwordHash && user.passwordHash !== passHash) {
      return NextResponse.json({ error: 'Неверный пароль. Попробуйте снова.' }, { status: 401 })
    }

    // Update password if previously unset
    if (!user.passwordHash) {
      await prisma.telegramChat.update({
        where: { chatId: user.chatId },
        data: { passwordHash: passHash, authProvider: 'email' }
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

    res.cookies.set('zerf_chat_id', String(user.chatId), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    res.cookies.set('zerf_auth_token', sessionToken, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })

    return res
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
