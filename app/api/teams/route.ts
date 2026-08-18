import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { planAtLeast } from '@/lib/backend/plans'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const numericChatId = BigInt(authUser.chatId)

    // Find all teams where user is owner OR in memberIds
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { ownerChatId: numericChatId },
          { memberIds: { has: numericChatId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    const formattedTeams = teams.map(t => {
      const isOwner = t.ownerChatId === numericChatId
      const isAdmin = isOwner || t.adminIds.includes(numericChatId)
      const myRole = isOwner ? 'owner' : isAdmin ? 'admin' : 'member'

      return {
        id: t.id,
        name: t.name,
        ownerChatId: t.ownerChatId.toString(),
        memberCount: t.memberIds.length,
        adminCount: t.adminIds.length,
        plan: t.plan,
        inviteCode: t.inviteCode,
        inviteUrl: `https://t.me/zerph_bot?start=team_${t.inviteCode}`,
        myRole,
        isOwner,
        isAdmin,
        createdAt: t.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      teams: formattedTeams,
    })
  } catch (error: any) {
    console.warn('[Teams GET] Fallback to empty:', error)
    return NextResponse.json({ success: true, teams: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const numericChatId = BigInt(authUser.chatId)
    const body = await req.json().catch(() => ({}))
    const name = (body.name || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Укажите название команды' }, { status: 400 })
    }

    // Check user plan — creation of teams is available on Plus, Pro, Corp or trial
    const user = await prisma.telegramChat.findUnique({
      where: { chatId: numericChatId },
    })

    const isRoot = authUser.isRoot
    const canCreate = isRoot || planAtLeast(user?.plan, 'plus') || (user?.trialActivatedAt && new Date(user.trialActivatedAt).getTime() + 86400000 > Date.now())

    if (!canCreate) {
      return NextResponse.json({
        error: 'Создание команд доступно на тарифах Plus, Pro и Corp. Оформите подписку или активируйте промокод.',
      }, { status: 403 })
    }

    // Generate clean invite code
    const inviteCode = crypto.randomBytes(4).toString('hex').toLowerCase()

    const team = await prisma.team.create({
      data: {
        name,
        ownerChatId: numericChatId,
        memberIds: [numericChatId],
        adminIds: [numericChatId],
        plan: 'corp',
        inviteCode,
      },
    })

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        ownerChatId: team.ownerChatId.toString(),
        memberCount: 1,
        adminCount: 1,
        plan: team.plan,
        inviteCode: team.inviteCode,
        inviteUrl: `https://t.me/zerph_bot?start=team_${team.inviteCode}`,
        myRole: 'owner',
        isOwner: true,
        isAdmin: true,
        createdAt: team.createdAt.toISOString(),
      },
      message: `Команда «${name}» успешно создана!`,
    })
  } catch (error: any) {
    console.error('[Teams POST] Error:', error)
    return NextResponse.json({ error: 'Ошибка создания команды' }, { status: 500 })
  }
}
