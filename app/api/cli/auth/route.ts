import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser, createServerSession } from '@/lib/backend/auth'
import { getUserUsageAndLimits } from '@/lib/backend/db'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface CliAuthEntry {
  createdAt: number
  expiresAt: number
  status: 'pending' | 'approved' | 'rejected'
  chatId?: string
  token?: string
  plan?: string
  /** Когда CLI забрал токен — запись живёт ещё 90 с для повторной выдачи
   *  (обрыв сети в момент ответа больше не теряет токен навсегда) */
  claimedAt?: number
}

/** Окно повторной выдачи токена после первого GET */
const CLAIM_GRACE_MS = 90 * 1000

async function getAuthEntry(code: string): Promise<CliAuthEntry | null> {
  try {
    const row = await prisma.config.findUnique({
      where: { key: `cli_auth_${code}` }
    })
    if (!row) return null
    const entry: CliAuthEntry = JSON.parse(row.value)
    if (Date.now() > entry.expiresAt) {
      await prisma.config.delete({ where: { key: `cli_auth_${code}` } }).catch(() => {})
      return null
    }
    return entry
  } catch {
    return null
  }
}

async function saveAuthEntry(code: string, entry: CliAuthEntry): Promise<void> {
  await prisma.config.upsert({
    where: { key: `cli_auth_${code}` },
    create: {
      key: `cli_auth_${code}`,
      value: JSON.stringify(entry),
    },
    update: {
      value: JSON.stringify(entry),
    }
  })
}

async function deleteAuthEntry(code: string): Promise<void> {
  await prisma.config.delete({
    where: { key: `cli_auth_${code}` }
  }).catch(() => {})
}

// POST /api/cli/auth — Generate new pairing code for CLI
export async function POST(req: NextRequest) {
  try {
    const { deviceName = 'Terminal Client' } = await req.json().catch(() => ({}))

    // Generate random 8-character human-friendly pairing code
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase()
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}` // e.g. "82B1-FE01"

    const now = Date.now()
    const entry: CliAuthEntry = {
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes TTL
      status: 'pending',
    }

    await saveAuthEntry(code, entry)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
    const authUrl = `${appUrl}/cli-auth?code=${code}`

    return NextResponse.json({
      success: true,
      code,
      authUrl,
      expiresInSeconds: 600,
    })
  } catch (err: unknown) {
    console.error('CLI auth start error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET /api/cli/auth?code=XXXX-XXXX — Poll pairing status from CLI
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')?.trim().toUpperCase()

    if (!code) {
      return NextResponse.json({ error: 'Auth code required' }, { status: 400 })
    }

    const entry = await getAuthEntry(code)
    if (!entry) {
      return NextResponse.json({ error: 'Invalid or expired auth code' }, { status: 404 })
    }

    if (entry.status === 'pending') {
      return NextResponse.json({ status: 'pending' })
    }

    if (entry.status === 'approved') {
      // Идемпотентная выдача: первые 90 секунд токен можно забрать повторно
      // тем же кодом (страховка от обрыва сети), затем запись удаляется
      if (entry.claimedAt && Date.now() - entry.claimedAt > CLAIM_GRACE_MS) {
        await deleteAuthEntry(code)
        return NextResponse.json({ error: 'Auth code already used' }, { status: 404 })
      }
      if (!entry.claimedAt) {
        entry.claimedAt = Date.now()
        await saveAuthEntry(code, entry)
      }
      return NextResponse.json({
        status: 'approved',
        token: entry.token,
        chatId: entry.chatId,
        plan: entry.plan,
      })
    }

    if (entry.status === 'rejected') {
      await deleteAuthEntry(code)
      return NextResponse.json({ status: 'rejected' })
    }

    return NextResponse.json({ status: 'pending' })
  } catch (err: unknown) {
    console.error('CLI auth poll error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PUT /api/cli/auth — Confirm pairing from Web page with user session
export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized. Please login on the website first.', requiresAuth: true }, { status: 401 })
    }

    const { code, action = 'approve' } = await req.json().catch(() => ({}))
    const cleanCode = (code || '').trim().toUpperCase()

    if (!cleanCode) {
      return NextResponse.json({ error: 'Auth code is required' }, { status: 400 })
    }

    const entry = await getAuthEntry(cleanCode)
    if (!entry) {
      return NextResponse.json({ error: 'Срок действия кода истёк или код недействителен' }, { status: 404 })
    }

    if (entry.status !== 'pending') {
      return NextResponse.json({ error: 'Этот код уже был использован. Запросите новый в терминале: zerf login' }, { status: 400 })
    }

    if (action === 'reject') {
      entry.status = 'rejected'
      await saveAuthEntry(cleanCode, entry)
      return NextResponse.json({ success: true, status: 'rejected' })
    }

    // Check user plan
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

    // Generate permanent CLI session token (deviceType: 'cli', 365 days)
    const token = await createServerSession(
      authUser.chatId,
      'Zerf CLI Terminal',
      'cli'
    )

    entry.status = 'approved'
    entry.chatId = String(authUser.chatId)
    entry.token = token
    entry.plan = normPlan

    await saveAuthEntry(cleanCode, entry)

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
    console.error('CLI auth confirm error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
