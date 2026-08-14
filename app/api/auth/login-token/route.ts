import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { generateOnetimeToken } from '@/lib/backend/auth'

// POST /api/auth/login-token — generate a one-time web login token for a chatId
// Called only from the bot server-side (with ADMIN_SECRET)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { chatId, secret } = body

    const ADMIN_SECRET = process.env.ADMIN_SECRET || 'zerph-admin-2024'
    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!chatId) {
      return NextResponse.json({ error: 'chatId required' }, { status: 400 })
    }

    const token = generateOnetimeToken()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    await prisma.loginToken.create({
      data: {
        chatId: BigInt(chatId),
        token,
        expiresAt,
      },
    })

    return NextResponse.json({ token, expiresAt: expiresAt.toISOString() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET /api/auth/login-token?token=xxx — verify and consume a one-time token
export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token')
    if (!token) {
      return NextResponse.json({ valid: false, error: 'No token' }, { status: 400 })
    }

    const record = await prisma.loginToken.findUnique({ where: { token } })

    if (!record) {
      return NextResponse.json({ valid: false, error: 'Token not found' }, { status: 404 })
    }

    if (record.used) {
      return NextResponse.json({ valid: false, error: 'Token already used' }, { status: 403 })
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ valid: false, error: 'Token expired' }, { status: 403 })
    }

    // Mark as used (one-time only!)
    await prisma.loginToken.update({ where: { token }, data: { used: true } })

    return NextResponse.json({
      valid: true,
      chatId: Number(record.chatId),
    })
  } catch (err) {
    return NextResponse.json({ valid: false, error: String(err) }, { status: 500 })
  }
}
