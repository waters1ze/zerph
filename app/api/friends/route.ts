import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getFriends } from '@/lib/backend/db'

function getChatId(req: NextRequest): bigint | null {
  const header = req.headers.get('x-chat-id')
  if (!header) return null
  try { return BigInt(header) } catch { return null }
}

export async function GET(req: NextRequest) {
  const chatId = getChatId(req)
  if (!chatId) return NextResponse.json({ friends: [] })

  try {
    const friends = await getFriends(chatId)
    return NextResponse.json({ friends })
  } catch (err) {
    return NextResponse.json({ friends: [], error: String(err) })
  }
}

export async function PATCH(req: NextRequest) {
  const chatId = getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { friendId, allowTasks, birthday } = await req.json()
    if (!friendId) return NextResponse.json({ error: 'friendId required' }, { status: 400 })

    const targetCid = BigInt(friendId)

    if (allowTasks !== undefined) {
      await (prisma.friendship as any).updateMany({
        where: {
          OR: [
            { userChatId: chatId, friendChatId: targetCid },
            { userChatId: targetCid, friendChatId: chatId },
          ],
        },
        data: { allowTasks: Boolean(allowTasks) },
      })
    }

    if (birthday !== undefined) {
      await prisma.telegramChat.update({
        where: { chatId: targetCid },
        data: { birthday: birthday || null },
      })
      const { syncFriendBirthdays } = await import('@/lib/backend/db')
      await syncFriendBirthdays(chatId)
    }

    return NextResponse.json({ ok: true, allowTasks, birthday })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
