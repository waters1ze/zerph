import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { planAtLeast } from '@/lib/backend/plans'
import { listTeamMembers, getTeamRole, addTeamMember } from '@/lib/backend/membership'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const numericChatId = BigInt(authUser.chatId)

    // Find all teams where user is owner OR in memberIds
    // Membership via relational table (audit B7)
    const myTeamMemberships = await prisma.teamMember.findMany({
      where: { chatId: numericChatId },
      select: { teamId: true },
    })
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { ownerChatId: numericChatId },
          ...(myTeamMemberships.length > 0 ? [{ id: { in: myTeamMemberships.map(r => r.teamId) } }] : [{ memberIds: { has: numericChatId } }]),
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    const formattedTeams = await Promise.all(teams.map(async t => {
      const members = await listTeamMembers(t as any)
      const myRole = await getTeamRole(t as any, numericChatId)
      const isOwner = t.ownerChatId === numericChatId
      const isAdmin = myRole === 'owner' || myRole === 'admin'

      return {
        id: t.id,
        name: t.name,
        ownerChatId: t.ownerChatId.toString(),
        memberCount: members.length,
        adminCount: members.filter(m => m.role === 'admin' || m.role === 'owner').length,
        plan: t.plan,
        inviteCode: t.inviteCode,
        inviteUrl: `https://t.me/zerph_bot?start=team_${t.inviteCode}`,
        myRole: isOwner ? 'owner' : (myRole || 'member'),
        isOwner,
        isAdmin,
        createdAt: t.createdAt.toISOString(),
      }
    }))

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
    // Relational membership seed (B7)
    await addTeamMember(team as any, numericChatId, 'owner').catch(err =>
      console.error(`[Teams POST] owner row seed failed for ${team.id}:`, err)
    )

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
