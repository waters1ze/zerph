import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { generateOnetimeToken, getAdminSecret, secretsMatch } from '@/lib/backend/auth'
import { checkInMemoryRateLimit, getClientIp } from '@/lib/backend/rate-limit'
import crypto from 'crypto'

// POST /api/auth/login-token — generate a one-time web login token for a chatId
// Called only from the bot server-side (with ADMIN_SECRET)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { chatId, secret } = body

    const adminSecret = getAdminSecret()
    if (!adminSecret || !secretsMatch(secret, adminSecret)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!chatId || !/^\d{3,20}$/.test(String(chatId))) {
      return NextResponse.json({ error: 'chatId required' }, { status: 400 })
    }

    const token = generateOnetimeToken()
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    await Promise.all([
      prisma.loginToken.create({
        data: {
          chatId: BigInt(chatId),
          token,
          expiresAt,
        },
      }),
      prisma.loginToken.create({
        data: {
          chatId: BigInt(chatId),
          token: code,
          expiresAt,
        },
      }),
    ])

    return NextResponse.json({ token, code, expiresAt: expiresAt.toISOString() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET /api/auth/login-token?token=xxx — verify and consume a one-time token or 6-digit PIN
// Returns chatId + a long-lived session token, or sets cookies and redirects directly to /
export async function GET(req: NextRequest) {
  try {
    // The 6-digit PIN form has only 10^6 combinations — throttle guessing per IP
    if (!checkInMemoryRateLimit(`logintoken:${getClientIp(req)}`, 40, 10 * 60 * 1000)) {
      return NextResponse.json({ valid: false, error: 'Too many attempts' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const rawParam = searchParams.get('token') || searchParams.get('code')
    const token = (rawParam || '').trim().replace(/\s+/g, '')
    const shouldRedirect = searchParams.get('redirect') === 'true' || req.headers.get('accept')?.includes('text/html')

    if (!token) {
      if (shouldRedirect) {
        return NextResponse.redirect(new URL('/?auth_error=no_token', req.url))
      }
      return NextResponse.json({ valid: false, error: 'No token' }, { status: 400 })
    }

    const record = await prisma.loginToken.findUnique({ where: { token } })

    if (!record) {
      if (shouldRedirect) {
        return NextResponse.redirect(new URL('/?auth_error=token_not_found', req.url))
      }
      return NextResponse.json({ valid: false, error: 'Token not found' }, { status: 404 })
    }

    if (record.used) {
      // One-time tokens must never be replayed
      if (shouldRedirect) {
        return NextResponse.redirect(new URL('/?auth_error=token_used', req.url))
      }
      return NextResponse.json({ valid: false, error: 'Token already used' }, { status: 403 })
    }

    if (new Date() > record.expiresAt) {
      await prisma.loginToken.delete({ where: { token } }).catch(() => {})
      if (shouldRedirect) {
        return NextResponse.redirect(new URL('/?auth_error=token_expired', req.url))
      }
      return NextResponse.json({ valid: false, error: 'Token expired' }, { status: 403 })
    }

    // Atomically consume the token: updateMany only succeeds if still unused,
    // which prevents both replay and concurrent-request race conditions.
    const consumed = await prisma.loginToken.updateMany({
      where: { token, used: false },
      data: { used: true },
    })
    if (consumed.count === 0) {
      if (shouldRedirect) {
        return NextResponse.redirect(new URL('/?auth_error=token_used', req.url))
      }
      return NextResponse.json({ valid: false, error: 'Token already used' }, { status: 403 })
    }

    // Cleanup expired tokens occasionally
    prisma.loginToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {})

    // Generate a long-lived session token
    const sessionToken = crypto.randomBytes(24).toString('hex')
    const chatIdStr = String(record.chatId)

    // Detect device info from request
    const ua = req.headers.get('user-agent') || ''
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') || ''

    function parseDeviceName(uaStr: string): { name: string; type: string } {
      if (!uaStr) return { name: 'Неизвестное устройство', type: 'web' }
      let os = ''
      let browser = ''
      let type = 'web'
      if (uaStr.includes('iPhone')) { os = 'iPhone'; type = 'mobile' }
      else if (uaStr.includes('iPad')) { os = 'iPad'; type = 'mobile' }
      else if (uaStr.includes('Android')) { os = 'Android'; type = 'mobile' }
      else if (uaStr.includes('Windows NT')) os = 'Windows'
      else if (uaStr.includes('Mac OS X')) os = 'macOS'
      else if (uaStr.includes('Linux')) os = 'Linux'
      if (uaStr.includes('YaBrowser')) browser = 'Яндекс Браузер'
      else if (uaStr.includes('OPR') || uaStr.includes('Opera')) browser = 'Opera'
      else if (uaStr.includes('Edg/')) browser = 'Edge'
      else if (uaStr.includes('Chrome')) browser = 'Chrome'
      else if (uaStr.includes('Firefox')) browser = 'Firefox'
      else if (uaStr.includes('Safari')) browser = 'Safari'
      const name = browser && os ? `${browser} · ${os}` : browser || os || 'Браузер'
      return { name, type }
    }

    const { name: deviceName, type: deviceType } = parseDeviceName(ua)

    // Register session in DB
    await prisma.userSession.create({
      data: {
        chatId: record.chatId,
        sessionToken,
        deviceName,
        deviceType,
        ipAddress: ip || null,
        userAgent: ua || null,
        isRevoked: false,
      },
    }).catch(() => {}) // non-blocking

    const isProd = process.env.NODE_ENV === 'production'
    if (shouldRedirect) {
      const redirectUrl = new URL('/', req.url)
      redirectUrl.searchParams.set('chat_id', chatIdStr)
      redirectUrl.searchParams.set('auth_token', sessionToken)
      const res = NextResponse.redirect(redirectUrl)
      res.cookies.set('zerf_chat_id', chatIdStr, { path: '/', maxAge: 31536000, sameSite: 'lax', secure: isProd })
      res.cookies.set('zerf_auth_token', sessionToken, { path: '/', maxAge: 31536000, sameSite: 'lax', secure: isProd })
      return res
    }

    const res = NextResponse.json({
      valid: true,
      chatId: Number(record.chatId),
      sessionToken,
    })
    res.cookies.set('zerf_chat_id', chatIdStr, { path: '/', maxAge: 31536000, sameSite: 'lax', secure: isProd })
    res.cookies.set('zerf_auth_token', sessionToken, { path: '/', maxAge: 31536000, sameSite: 'lax', secure: isProd })
    return res
  } catch (err) {
    return NextResponse.json({ valid: false, error: String(err) }, { status: 500 })
  }
}
