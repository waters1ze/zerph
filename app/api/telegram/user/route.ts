/**
 * GET  /api/telegram/user — Returns connected user profile and linked auth providers
 * POST /api/telegram/user — Updates user profile, birthday, and links Email / Google / VK
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import crypto from 'crypto'

function hashPassword(password: string): string {
  const salt = 'zerf_salt_2026'
  return crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex')
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 })
    }
    const cid = authUser.chatId

    const chat = await prisma.telegramChat.findUnique({
      where: { chatId: BigInt(cid) },
    })

    if (chat) {
      const now = new Date()
      let isPremium = chat.plan === 'premium'
      if (isPremium && chat.subscriptionExpiry && new Date(chat.subscriptionExpiry) < now) {
        isPremium = false
      }

      const fullName = [chat.firstName, chat.lastName].filter(Boolean).join(' ') || chat.firstName || 'Пользователь Zerf'

      return NextResponse.json({
        connected: true,
        chatId: Number(chat.chatId),
        name: fullName,
        firstName: chat.firstName,
        lastName: chat.lastName,
        username: chat.username ? `@${chat.username.replace(/^@/, '')}` : null,
        email: chat.email || null,
        hasPassword: Boolean(chat.passwordHash),
        vkId: chat.vkId || null,
        googleEmail: chat.googleEmail || null,
        authProvider: chat.authProvider || 'telegram',
        birthday: chat.birthday || null,
        plan: isPremium ? 'premium' : 'free',
        isPremium,
        subscriptionExpiry: chat.subscriptionExpiry?.toISOString() || null,
        isAdmin: Boolean(chat.isAdmin),
      })
    }

    return NextResponse.json({ connected: false })
  } catch (err: unknown) {
    return NextResponse.json({ connected: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const cid = authUser.chatId
    const userCid = BigInt(cid)

    const { birthday, name, email, password, vkId, googleEmail } = await req.json()
    const { parseBirthday, broadcastMyBirthdayToFriends, updateUserNameCascade } = await import('@/lib/backend/db')

    const updateData: any = {}

    if (birthday !== undefined) {
      const parsed = parseBirthday(birthday)
      updateData.birthday = parsed ? parsed.iso : (birthday || null)
    }

    if (name !== undefined) {
      const trimmed = name.trim()
      const parts = trimmed.split(/\s+/)
      const firstName = parts[0] || trimmed
      const lastName = parts.slice(1).join(' ') || null
      await updateUserNameCascade(userCid, firstName, lastName)
    }

    if (email !== undefined) {
      const cleanEmail = email.trim().toLowerCase()
      if (cleanEmail) {
        // Check uniqueness across other users
        const existing = await prisma.telegramChat.findUnique({ where: { email: cleanEmail } })
        if (existing && existing.chatId !== userCid) {
          return NextResponse.json({ error: 'Этот Email уже привязан к другому аккаунту' }, { status: 400 })
        }
        updateData.email = cleanEmail
      } else {
        updateData.email = null
      }
    }

    if (password) {
      if (password.length < 4) {
        return NextResponse.json({ error: 'Пароль должен быть не менее 4 символов' }, { status: 400 })
      }
      updateData.passwordHash = hashPassword(password)
    }

    if (vkId !== undefined) {
      updateData.vkId = vkId ? String(vkId).trim() : null
    }

    if (googleEmail !== undefined) {
      updateData.googleEmail = googleEmail ? String(googleEmail).trim().toLowerCase() : null
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.telegramChat.upsert({
        where: { chatId: userCid },
        update: updateData,
        create: { chatId: userCid, ...updateData },
      })
      if (updateData.birthday) {
        await broadcastMyBirthdayToFriends(userCid)
      }
    }

    return NextResponse.json({ success: true, message: 'Профиль и способы входа успешно обновлены!' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
