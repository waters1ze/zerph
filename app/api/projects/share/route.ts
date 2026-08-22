import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser, getInternalPepper } from '@/lib/backend/auth'
import { checkInMemoryRateLimit, getClientIp } from '@/lib/backend/rate-limit'
import { isProjectMember } from '@/lib/backend/membership'

/**
 * SECURITY (audit H-1): previously ANY visitor knowing/guessing a project id
 * received the full project incl. every task and all members' identities.
 * Public access now requires a signed capability token (?t=), which owners
 * obtain via an authenticated call to this endpoint. Owner/members may still
 * read their own project by id alone. Responses are sanitized: internal
 * chatIds are never disclosed to non-members.
 */
function shareSignature(projectId: string): string {
  return crypto
    .createHmac('sha256', getInternalPepper() || 'zerf-share-pepper')
    .update(`project-share:${projectId}`)
    .digest('hex')
    .slice(0, 32)
}

export async function GET(req: NextRequest) {
  // Cost control: project + tasks + N member lookups per hit.
  if (!checkInMemoryRateLimit(`share:${getClientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    const project = await (prisma as any).projectDB.findUnique({ where: { id } })
    if (!project || project.status === 'archived') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Authorization: signed capability token OR owner/member session.
    let isMemberCaller = false
    const authUser = await getAuthenticatedUser(req).catch(() => null)
    if (authUser?.chatId) {
      const cid = BigInt(authUser.chatId)
      isMemberCaller = await isProjectMember(cid, id, project.ownerChatId)
    }

    const providedToken = searchParams.get('t')
    const tokenValid =
      typeof providedToken === 'string' &&
      providedToken.length >= 16 &&
      crypto.timingSafeEqual(
        Buffer.from(providedToken.slice(0, 64)),
        Buffer.from(shareSignature(id))
      )

    if (!isMemberCaller && !tokenValid) {
      return NextResponse.json(
        { error: 'Forbidden', hint: 'A valid share token (?t=) is required for public access' },
        { status: 403 }
      )
    }

    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
    })

    const memberInfos = await Promise.all(
      (project.memberIds || []).map(async (memberId: bigint) => {
        const chat = await prisma.telegramChat.findUnique({
          where: { chatId: memberId },
          select: { chatId: true, firstName: true, username: true },
        })
        const name = chat?.firstName || (chat?.username ? '@' + chat.username : String(memberId))
        return isMemberCaller
          ? { chatId: String(chat?.chatId ?? memberId), name }
          : { name } // public view: no identity disclosure
      })
    )

    const sanitizeTask = (t: any) => ({
      ...(isMemberCaller
        ? { ...t, ownerChatId: t.ownerChatId ? String(t.ownerChatId) : null, authorChatId: t.authorChatId ? String(t.authorChatId) : null }
        : {
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            dueTime: t.dueTime,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          }),
    })

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        color: project.color,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        // identity fields only for members/owner:
        ...(isMemberCaller && {
          ownerChatId: String(project.ownerChatId),
          memberIds: (project.memberIds || []).map(String),
        }),
        members: memberInfos,
        tasks: tasks.map(sanitizeTask),
      },
      // Owners can hand this URL to others:
      ...(isMemberCaller && { shareToken: shareSignature(id) }),
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
