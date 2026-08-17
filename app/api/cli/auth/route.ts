import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser, createServerSession } from '@/lib/backend/auth'
import { normalizePlan } from '@/lib/plans'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// In-memory / temporary DB table storage for pending CLI auth codes (TTL: 10 mins)
const pendingAuthCodes = new Map<string, {
  createdAt: number
  expiresAt: number
  status: 'pending' | 'approved' | 'rejected'
  chatId?: string
  token?: string
  plan?: string
}>()

function cleanExpiredCodes() {
  const now = Date.now()
  for (const [code, entry] of pendingAuthCodes.entries()) {
    if (entry.expiresAt < now) {
      pendingAuthCodes.delete(code)
    }
  }
}

// POST /api/cli/auth — Generate new pairing code for CLI
export async function POST(req: NextRequest) {
  try {
    cleanExpiredCodes()
    const { deviceName = 'Terminal Client' } = await req.json().catch(() => ({}))

    // Generate random 8-character human-friendly pairing code
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase()
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}` // e.g. "A1B2-C3D4"

    const now = Date.now()
    pendingAuthCodes.set(code, {
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes TTL
      status: 'pending',
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
    const authUrl = `${appUrl}/cli-auth?code=${code}`

    return NextResponse.json({
      success: true,
      code,
      authUrl,
      expiresInSeconds: 600,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET /api/cli/auth?code=XXXX-XXXX — Poll pairing status from CLI
export async function GET(req: NextRequest) {
  try {
    cleanExpiredCodes()
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')?.trim().toUpperCase()

    if (!code || !pendingAuthCodes.has(code)) {
      return NextResponse.json({ error: 'Invalid or expired auth code' }, { status: 404 })
    }

    const entry = pendingAuthCodes.get(code)!
    if (entry.status === 'pending') {
      return NextResponse.json({ status: 'pending' })
    }

    if (entry.status === 'approved') {
      // Return generated token and clear code so it cannot be reused
      const responsePayload = {
        status: 'approved',
        token: entry.token,
        chatId: entry.chatId,
        plan: entry.plan,
      }
      pendingAuthCodes.delete(code)
      return NextResponse.json(responsePayload)
    }

    return NextResponse.json({ status: 'rejected' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PUT /api/cli/auth — Confirm pairing from Web page with user session
export async function PUT(req: NextRequest) {
  try {
    cleanExpiredCodes()
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized. Please login on the website first.', requiresAuth: true }, { status: 401 })
    }

    const { code, action = 'approve' } = await req.json().catch(() => ({}))
    const cleanCode = String(code || '').trim().toUpperCase()

    if (!cleanCode || !pendingAuthCodes.has(cleanCode)) {
      return NextResponse.json({ error: 'Auth code expired or not found. Please request a new one in the terminal.' }, { status: 404 })
    }

    const entry = pendingAuthCodes.get(cleanCode)!
    if (entry.expiresAt < Date.now()) {
      pendingAuthCodes.delete(cleanCode)
      return NextResponse.json({ error: 'Auth code expired' }, { status: 400 })
    }

    if (action === 'reject') {
      entry.status = 'rejected'
      return NextResponse.json({ success: true, message: 'CLI authorization rejected.' })
    }

    // Check user plan
    const { getUserUsageAndLimits } = await import('@/lib/backend/db')
    const limits = await getUserUsageAndLimits(authUser.chatId)
    const normPlan = limits.plan

    const chat = await prisma.telegramChat.findUnique({
      where: { chatId: BigInt(authUser.chatId) },
      select: {
        chatId: true,
        firstName: true,
        lastName: true,
        username: true,
      }
    })

    // Generate permanent CLI session token
    const token = await createServerSession(
      authUser.chatId,
      'Zerf CLI Terminal',
      'cli'
    )

    entry.status = 'approved'
    entry.chatId = String(authUser.chatId)
    entry.token = token
    entry.plan = normPlan

    return NextResponse.json({
      success: true,
      message: 'Zerf CLI успешно авторизован! Вы можете вернуться в терминал.',
      user: {
        chatId: String(authUser.chatId),
        name: [chat?.firstName, chat?.lastName].filter(Boolean).join(' ') || chat?.username || 'Пользователь',
        plan: normPlan,
      }
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
