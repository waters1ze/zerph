import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getFriends, syncFriendBirthdays } from '@/lib/backend/db'
import { getAuthenticatedUser } from '@/lib/backend/auth'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function getChatId(req: NextRequest): Promise<bigint | null> {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) return null
  try { return BigInt(authUser.chatId) } catch { return null }
}

async function sendTgMessage(chatId: string | number | bigint, htmlText: string, replyMarkup?: object) {
  if (!BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text: htmlText,
        parse_mode: 'HTML',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {})
      }),
    })
  } catch (e) {
    console.error('sendTgMessage error:', e)
  }
}

export async function GET(req: NextRequest) {
  const chatId = await getChatId(req)
  if (!chatId) return NextResponse.json({ friends: [], pendingRequests: [], outgoingRequests: [] })

  try {
    const friends = await getFriends(chatId)

    // 1. Incoming pending friend requests (sent TO this user)
    const incomingPending = await prisma.friendship.findMany({
      where: {
        friendChatId: chatId,
        status: 'pending',
      },
    })

    // 2. Outgoing pending friend requests (sent BY this user)
    const outgoingPending = await prisma.friendship.findMany({
      where: {
        userChatId: chatId,
        status: 'pending',
      },
    })

    const senderIds = incomingPending.map(f => f.userChatId)
    const targetIds = outgoingPending.map(f => f.friendChatId)
    const allRelatedIds = Array.from(new Set([...senderIds, ...targetIds]))

    const relatedChats = await prisma.telegramChat.findMany({
      where: { chatId: { in: allRelatedIds } },
    })

    const pendingRequests = incomingPending.map(f => {
      const sender = relatedChats.find(s => s.chatId === f.userChatId)
      const fullName = [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || 'Пользователь Telegram'
      return {
        id: f.id,
        fromChatId: f.userChatId.toString(),
        fromName: fullName,
        fromUsername: sender?.username ? `@${sender.username.replace(/^@/, '')}` : null,
        status: f.status,
      }
    })

    const outgoingRequests = outgoingPending.map(f => {
      const target = relatedChats.find(s => s.chatId === f.friendChatId)
      const fullName = [target?.firstName, target?.lastName].filter(Boolean).join(' ') || 'Пользователь Telegram'
      return {
        id: f.id,
        toChatId: f.friendChatId.toString(),
        toName: fullName,
        toUsername: target?.username ? `@${target.username.replace(/^@/, '')}` : null,
        status: f.status,
      }
    })

    return NextResponse.json({ friends, pendingRequests, outgoingRequests })
  } catch (err) {
    return NextResponse.json({ friends: [], pendingRequests: [], outgoingRequests: [], error: String(err) })
  }
}

export async function POST(req: NextRequest) {
  const chatId = await getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })

  try {
    const body = await req.json()
    const rawUsername = body.username || body.inviteEmail || ''
    const customName = body.name || body.inviteName || ''

    const cleanUsername = rawUsername.replace(/^@/, '').trim()
    if (!cleanUsername) {
      return NextResponse.json({ error: 'Укажите Telegram @username' }, { status: 400 })
    }

    // Look up target user in TelegramChat by username or chatId
    let targetUser = await prisma.telegramChat.findFirst({
      where: { username: { equals: cleanUsername, mode: 'insensitive' } }
    })

    if (!targetUser && !isNaN(Number(cleanUsername))) {
      targetUser = await prisma.telegramChat.findUnique({
        where: { chatId: BigInt(cleanUsername) }
      })
    }

    if (!targetUser) {
      return NextResponse.json({
        success: false,
        notFound: true,
        message: `Пользователь @${cleanUsername} пока не пользуется ботом. Отправьте ему ссылку-приглашение!`,
      })
    }

    const targetChatId = targetUser.chatId

    if (targetChatId === chatId) {
      return NextResponse.json({ error: 'Вы не можете отправить приглашение самому себе' }, { status: 400 })
    }

    // Get current sender info
    const sender = await prisma.telegramChat.findUnique({ where: { chatId } })
    const senderName = [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || sender?.firstName || 'Коллега'
    const senderUname = sender?.username ? `@${sender.username.replace(/^@/, '')}` : ''

    // Create or update friendship as pending
    await prisma.friendship.upsert({
      where: {
        userChatId_friendChatId: {
          userChatId: chatId,
          friendChatId: targetChatId,
        }
      },
      update: { status: 'pending' },
      create: {
        userChatId: chatId,
        friendChatId: targetChatId,
        status: 'pending',
      }
    })

    // Send Telegram Push Notification to the target user with 1-click accept/decline buttons
    await sendTgMessage(
      targetChatId,
      `🤝 <b>Новое приглашение в друзья в Zerf Note!</b>\n\n` +
      `Пользователь <b>${escapeHtml(senderName)}</b> ${senderUname ? `(${escapeHtml(senderUname)})` : ''} хочет добавить вас в друзья для совместной работы над задачами и напоминаниями!\n\n` +
      `Нажмите кнопку ниже, чтобы принять:`,
      {
        inline_keyboard: [
          [
            { text: '✅ Принять приглашение', callback_data: `friend_accept_${chatId}` },
            { text: '❌ Отклонить', callback_data: `friend_decline_${chatId}` }
          ]
        ]
      }
    )

    const targetFullName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || `@${cleanUsername}`

    return NextResponse.json({
      success: true,
      message: `Приглашение успешно отправлено пользователю ${targetFullName}! Ему отправлено сообщение в Telegram.`,
      userFound: true,
    })
  } catch (err: unknown) {
    console.error('Add friend API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const chatId = await getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })

  try {
    const { fromChatId, action } = await req.json() // action: 'accept' | 'decline'
    if (!fromChatId || !action) {
      return NextResponse.json({ error: 'fromChatId and action required' }, { status: 400 })
    }

    const senderCid = BigInt(fromChatId)

    if (action === 'accept') {
      // Set status accepted for both directions
      await prisma.friendship.upsert({
        where: { userChatId_friendChatId: { userChatId: senderCid, friendChatId: chatId } },
        update: { status: 'accepted', allowTasks: true },
        create: { userChatId: senderCid, friendChatId: chatId, status: 'accepted', allowTasks: true }
      })
      await prisma.friendship.upsert({
        where: { userChatId_friendChatId: { userChatId: chatId, friendChatId: senderCid } },
        update: { status: 'accepted', allowTasks: true },
        create: { userChatId: chatId, friendChatId: senderCid, status: 'accepted', allowTasks: true }
      })

      // Sync birthdays
      await syncFriendBirthdays(chatId).catch(() => {})
      await syncFriendBirthdays(senderCid).catch(() => {})

      // Notify inviter
      const myProfile = await prisma.telegramChat.findUnique({ where: { chatId } })
      const myName = [myProfile?.firstName, myProfile?.lastName].filter(Boolean).join(' ') || 'Ваш коллега'
      await sendTgMessage(senderCid, `🎉 <b>${escapeHtml(myName)} принял ваше приглашение в друзья в Zerf Note!</b> Теперь вы можете совместно работать над задачами.`)

      return NextResponse.json({ success: true, message: 'Приглашение принято!' })
    } else {
      // Decline
      await prisma.friendship.deleteMany({
        where: {
          userChatId: senderCid,
          friendChatId: chatId,
        }
      })
      return NextResponse.json({ success: true, message: 'Приглашение отклонено' })
    }
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const chatId = await getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })

  try {
    const { friendId, allowTasks, birthday } = await req.json()
    if (!friendId) return NextResponse.json({ error: 'friendId required' }, { status: 400 })

    const targetCid = BigInt(friendId)

    if (allowTasks !== undefined) {
      await prisma.friendship.upsert({
        where: {
          userChatId_friendChatId: {
            userChatId: chatId,
            friendChatId: targetCid,
          }
        },
        update: { allowTasks: Boolean(allowTasks) },
        create: {
          userChatId: chatId,
          friendChatId: targetCid,
          status: 'accepted',
          allowTasks: Boolean(allowTasks),
        },
      })
    }

    if (birthday !== undefined) {
      const { parseBirthday, broadcastMyBirthdayToFriends } = await import('@/lib/backend/db')
      const parsed = parseBirthday(birthday)
      const normalizedBday = parsed ? parsed.iso : (birthday || null)
      await prisma.telegramChat.update({
        where: { chatId: targetCid },
        data: { birthday: normalizedBday },
      })
      await broadcastMyBirthdayToFriends(targetCid)
      await syncFriendBirthdays(chatId)
    }

    return NextResponse.json({ ok: true, allowTasks, birthday })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const chatId = await getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const friendId = searchParams.get('id')
    if (!friendId) return NextResponse.json({ error: 'friendId required' }, { status: 400 })

    let targetCid: bigint | null = null
    try {
      targetCid = BigInt(friendId)
    } catch {
      const clean = friendId.replace(/^@/, '').trim()
      const chat = await prisma.telegramChat.findFirst({
        where: {
          OR: [
            { username: { equals: clean, mode: 'insensitive' } },
            { firstName: { equals: clean, mode: 'insensitive' } },
          ]
        }
      })
      if (chat) targetCid = chat.chatId
    }

    if (targetCid) {
      await prisma.friendship.deleteMany({
        where: {
          OR: [
            { userChatId: chatId, friendChatId: targetCid },
            { userChatId: targetCid, friendChatId: chatId },
          ]
        }
      })
    } else {
      // If passed a friendship record cuid
      await prisma.friendship.deleteMany({
        where: {
          id: friendId,
          OR: [{ userChatId: chatId }, { friendChatId: chatId }]
        }
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
