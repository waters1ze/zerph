import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession } from '@/lib/backend/auth'

function generateDeterministicChatId(email: string): bigint {
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i)
    hash |= 0
  }
  const positive = Math.abs(hash)
  return BigInt(`80${String(positive).padStart(8, '0').slice(0, 8)}`)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, name, avatar } = body

    const cleanEmail = (email || '').trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ error: 'Некорректный Email от Google' }, { status: 400 })
    }

    const deterministicId = generateDeterministicChatId(cleanEmail)

    const user = await prisma.telegramChat.upsert({
      where: { email: cleanEmail },
      update: {
        firstName: name || cleanEmail.split('@')[0],
        authProvider: 'google',
        lastActiveAt: new Date()
      },
      create: {
        chatId: deterministicId,
        email: cleanEmail,
        firstName: name || cleanEmail.split('@')[0],
        authProvider: 'google',
        lastActiveAt: new Date()
      }
    })

    const sessionToken = await createServerSession(
      user.chatId,
      'Google OAuth Session',
      'web',
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    const res = NextResponse.json({
      success: true,
      chatId: String(user.chatId),
      firstName: user.firstName,
      token: sessionToken,
      message: 'Успешный вход через Google!'
    })

    res.cookies.set('zerf_chat_id', String(user.chatId), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    res.cookies.set('zerf_auth_token', sessionToken, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })

    return res
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
