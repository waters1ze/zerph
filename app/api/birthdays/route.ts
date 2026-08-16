import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) return NextResponse.json([], { status: 200 })

    const cidStr = authUser.chatId
    const cid = /^\d+$/.test(cidStr) ? BigInt(cidStr) : null
    if (!cid) return NextResponse.json([], { status: 200 })

    // Get all friendships for this user
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userChatId: cid }, { friendChatId: cid }] },
    })

    const friendChatIds = friendships.map(f => f.userChatId === cid ? f.friendChatId : f.userChatId)
    if (friendChatIds.length === 0) return NextResponse.json([])

    // Get telegramChat records for all friends
    const friendChats = await prisma.telegramChat.findMany({
      where: { chatId: { in: friendChatIds } },
    })

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const results = []

    for (const friend of friendChats) {
      let birthday = friend.birthday

      // If no birthday set, try fetching from Telegram API
      if (!birthday && botToken) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: Number(friend.chatId) }),
          })
          const data = await res.json()
          
          if (data?.ok && data.result) {
            const fetchedBirthday = data.result.birthdate
            if (fetchedBirthday) {
              const bdayStr = `${fetchedBirthday.day.toString().padStart(2, '0')}-${fetchedBirthday.month.toString().padStart(2, '0')}${fetchedBirthday.year ? `-${fetchedBirthday.year}` : ''}`
              birthday = bdayStr
              
              // Save to DB
              await prisma.telegramChat.update({
                where: { chatId: friend.chatId },
                data: { birthday: bdayStr }
              }).catch(() => {})
            }
          }
        } catch (e) {
          console.error('Failed to fetch chat info', e)
        }
      }

      if (birthday) {
        const name = [friend.firstName, friend.lastName].filter(Boolean).join(' ') || (friend.username ? `@${friend.username}` : `Участник #${friend.chatId.toString().slice(-4)}`)
        results.push({
          chatId: Number(friend.chatId),
          name,
          birthday,
          username: friend.username,
        })
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    console.error('Error in /api/birthdays:', err)
    return NextResponse.json([])
  }
}
