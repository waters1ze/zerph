import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getFriends, syncFriendBirthdays } from '@/lib/backend/db'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

function getChatId(req: NextRequest): bigint | null {
  const { searchParams } = new URL(req.url)
  const header = req.headers.get('x-chat-id') || searchParams.get('chatId')
  if (!header) return null
  try { return BigInt(header) } catch { return null }
}

async function sendTgMessage(chatId: string | number | bigint, text: string, replyMarkup?: object) {
  if (!BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: 'Markdown',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {})
      }),
    })
  } catch {}
}

export async function GET(req: NextRequest) {
  const chatId = getChatId(req)
  if (!chatId) return NextResponse.json({ friends: [], pendingRequests: [] })

  try {
    const friends = await getFriends(chatId)

    // Find incoming pending friend requests (sent TO this user)
    const pendingFriendships = await prisma.friendship.findMany({
      where: {
        friendChatId: chatId,
        status: 'pending',
      },
    })

    const senderIds = pendingFriendships.map(f => f.userChatId)
    const senderChats = await prisma.telegramChat.findMany({
      where: { chatId: { in: senderIds } },
    })

    const pendingRequests = pendingFriendships.map(f => {
      const sender = senderChats.find(s => s.chatId === f.userChatId)
      const fullName = [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || 'Пользователь Telegram'
      return {
        id: f.id,
        fromChatId: f.userChatId.toString(),
        fromName: fullName,
        fromUsername: sender?.username ? `@${sender.username.replace(/^@/, '')}` : null,
        status: f.status,
      }
    })

    return NextResponse.json({ friends, pendingRequests })
  } catch (err) {
    return NextResponse.json({ friends: [], pendingRequests: [], error: String(err) })
  }
}

export async function POST(req: NextRequest) {
  const chatId = getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      `🤝 *Новое приглашение в команду Zerf AI!*\n\n` +
      `Пользователь *${senderName}* ${senderUname ? `(${senderUname})` : ''} хочет добавить вас в команду для совместной работы над задачами!\n\n` +
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
  const chatId = getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      await sendTgMessage(senderCid, `🎉 *${myName} принял ваше приглашение в команду Zerf AI!* Теперь вы можете совместно работать над задачами.`)

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
  const chatId = getChatId(req)
  if (!chatId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const friendId = searchParams.get('id')
    if (!friendId) return NextResponse.json({ error: 'friendId required' }, { status: 400 })

    const targetCid = BigInt(friendId)
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userChatId: chatId, friendChatId: targetCid },
          { userChatId: targetCid, friendChatId: chatId },
        ]
      }
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
