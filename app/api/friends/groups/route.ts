import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

async function getChatId(req: NextRequest): Promise<string | null> {
  const authUser = await getAuthenticatedUser(req)
  return authUser ? authUser.chatId : null
}

export async function GET(req: NextRequest) {
  try {
    const chatId = await getChatId(req)
    if (!chatId) {
      return NextResponse.json({ groups: [] })
    }

    const conf = await prisma.config.findUnique({
      where: { key: `friend_groups_${chatId}` }
    })

    if (!conf || !conf.value) {
      return NextResponse.json({ groups: [] })
    }

    const groups = JSON.parse(conf.value)
    return NextResponse.json({ groups: Array.isArray(groups) ? groups : [] })
  } catch (err: any) {
    return NextResponse.json({ groups: [], error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const chatId = await getChatId(req)
    if (!chatId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { group } = body

    if (!group || !group.name) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    // Load existing groups
    const conf = await prisma.config.findUnique({
      where: { key: `friend_groups_${chatId}` }
    })

    let groups: any[] = []
    if (conf && conf.value) {
      try { groups = JSON.parse(conf.value) } catch {}
    }
    if (!Array.isArray(groups)) groups = []

    const newGroup = {
      id: group.id || `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: String(group.name).trim(),
      emoji: group.emoji || '👥',
      color: group.color || '#3b82f6',
      description: group.description ? String(group.description).trim() : '',
      memberIds: Array.isArray(group.memberIds) ? group.memberIds.map(String) : [],
      createdAt: group.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const existingIdx = groups.findIndex(g => g.id === newGroup.id)
    if (existingIdx >= 0) {
      groups[existingIdx] = { ...groups[existingIdx], ...newGroup }
    } else {
      groups.unshift(newGroup)
    }

    await prisma.config.upsert({
      where: { key: `friend_groups_${chatId}` },
      update: { value: JSON.stringify(groups) },
      create: { key: `friend_groups_${chatId}`, value: JSON.stringify(groups) },
    })

    return NextResponse.json({ success: true, group: newGroup, groups })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const chatId = await getChatId(req)
    if (!chatId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Group id required' }, { status: 400 })
    }

    const conf = await prisma.config.findUnique({
      where: { key: `friend_groups_${chatId}` }
    })

    if (conf && conf.value) {
      try {
        let groups: any[] = JSON.parse(conf.value)
        if (Array.isArray(groups)) {
          groups = groups.filter(g => g.id !== id)
          await prisma.config.update({
            where: { key: `friend_groups_${chatId}` },
            data: { value: JSON.stringify(groups) },
          })
        }
      } catch {}
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
