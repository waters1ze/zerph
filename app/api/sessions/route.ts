import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

// Parse a readable device name from User-Agent string
function parseDeviceName(ua: string): { name: string; type: string } {
  if (!ua) return { name: 'Неизвестное устройство', type: 'web' }

  let name = 'Браузер'
  let type = 'web'

  // Detect OS
  let os = ''
  if (ua.includes('Windows NT 10')) os = 'Windows 10'
  else if (ua.includes('Windows NT 11') || ua.includes('Windows NT 10.0; Win64')) os = 'Windows'
  else if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS X')) os = 'macOS'
  else if (ua.includes('iPhone')) { os = 'iPhone'; type = 'mobile' }
  else if (ua.includes('iPad')) { os = 'iPad'; type = 'mobile' }
  else if (ua.includes('Android')) { os = 'Android'; type = 'mobile' }
  else if (ua.includes('Linux')) os = 'Linux'

  // Detect browser
  let browser = ''
  if (ua.includes('YaBrowser')) browser = 'Яндекс Браузер'
  else if (ua.includes('OPR') || ua.includes('Opera')) browser = 'Opera'
  else if (ua.includes('Edg/')) browser = 'Microsoft Edge'
  else if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari')) browser = 'Safari'
  else if (ua.includes('Telegram')) { browser = 'Telegram'; type = 'telegram' }

  if (browser && os) name = `${browser} · ${os}`
  else if (browser) name = browser
  else if (os) name = os

  return { name, type }
}

// GET /api/sessions — list all sessions for the current user
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const chatId = authUser.chatId
    const authToken = req.headers.get('x-auth-token') || req.cookies.get('zerf_auth_token')?.value

    const sessions = await prisma.userSession.findMany({
      where: { chatId: BigInt(chatId), isRevoked: false },
      orderBy: { lastSeenAt: 'desc' },
    })

    // Mark current session
    const result = sessions.map(s => ({
      id: s.id,
      deviceName: s.deviceName || 'Устройство',
      deviceType: s.deviceType,
      ipAddress: s.ipAddress,
      lastSeenAt: s.lastSeenAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      isCurrent: authToken ? s.sessionToken === authToken : false,
    }))

    return NextResponse.json({ sessions: result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/sessions?id=xxx — revoke a specific session
// DELETE /api/sessions?all=true — revoke ALL sessions except current
export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const chatId = authUser.chatId
    const authToken = req.headers.get('x-auth-token') || req.cookies.get('zerf_auth_token')?.value

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const all = searchParams.get('all')

    if (all === 'true') {
      // Revoke all sessions except the current one
      await prisma.userSession.updateMany({
        where: {
          chatId: BigInt(chatId),
          isRevoked: false,
          ...(authToken ? { sessionToken: { not: authToken } } : {}),
        },
        data: { isRevoked: true },
      })
      return NextResponse.json({ success: true, revokedAll: true })
    }

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Can't revoke current session via this endpoint
    if (authToken) {
      const target = await prisma.userSession.findFirst({ where: { id, chatId: BigInt(chatId) } })
      if (target && target.sessionToken === authToken) {
        return NextResponse.json({ error: 'Нельзя завершить текущую сессию' }, { status: 400 })
      }
    }

    await prisma.userSession.updateMany({
      where: { id, chatId: BigInt(chatId) },
      data: { isRevoked: true },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// NOTE: there is intentionally no public POST handler.
// Sessions are created exclusively server-side (login-token consume, email/Google
// login) via createServerSession(). Accepting client-supplied session records
// would allow anyone to mint credentials for arbitrary accounts.

export { parseDeviceName }
