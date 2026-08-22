import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

/** GET current visibility setting */
export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
  }
  const chat = await prisma.telegramChat.findUnique({
    where: { chatId: BigInt(authUser.chatId) },
    select: { streakDays: true, streakVisible: true },
  })
  return NextResponse.json({
    success: true,
    streakVisible: chat?.streakVisible ?? true,
    streakDays: chat?.streakDays ?? 0,
  })
}

/** PATCH { streakVisible: boolean } — social-layer opt-out (feature: friend streaks) */
export async function PATCH(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  if (typeof body.streakVisible !== 'boolean') {
    return NextResponse.json({ error: 'streakVisible boolean required' }, { status: 400 })
  }

  await prisma.telegramChat.update({
    where: { chatId: BigInt(authUser.chatId) },
    data: { streakVisible: body.streakVisible },
  })

  return NextResponse.json({ success: true, streakVisible: body.streakVisible })
}
