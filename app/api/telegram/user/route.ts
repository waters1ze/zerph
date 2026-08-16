/**
 * GET  /api/telegram/user — Returns connected user profile and linked auth providers
 * POST /api/telegram/user — Updates user profile, birthday, and links Email / Google / VK
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser, ROOT_ADMIN_IDS } from '@/lib/backend/auth'
import { hashPassword, verifyPassword } from '@/lib/backend/passwords'
import { normalizePlan, isNewsDisabled, planAtLeast } from '@/lib/backend/plans'

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 })
    }
    const cid = authUser.chatId

    try {
      const numericCid = /^\d+$/.test(cid) ? BigInt(cid) : null
      if (numericCid) {
        const chat = await prisma.telegramChat.findUnique({
          where: { chatId: numericCid },
        })

        if (chat) {
          const now = new Date()
          let activePlan = normalizePlan(chat.plan)
          if (activePlan !== 'free' && chat.subscriptionExpiry && new Date(chat.subscriptionExpiry) < now) {
            activePlan = 'free'
          }
          const isPremium = activePlan !== 'free'

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
            plan: activePlan,
            isPremium,
            subscriptionExpiry: chat.subscriptionExpiry?.toISOString() || null,
            isAdmin: Boolean(chat.isAdmin),
            newsDisabled: await isNewsDisabled(cid),
          })
        }
      }
    } catch (dbErr) {
      console.error('DB query error in /api/telegram/user:', dbErr)
      // Return safe fallback for active user to avoid frontend 500
      return NextResponse.json({
        connected: true,
        chatId: Number(cid) || 0,
        name: 'Пользователь Zerf',
        plan: 'free',
        isPremium: false,
        isAdmin: ROOT_ADMIN_IDS.includes(cid),
      })
    }

    return NextResponse.json({ connected: false })
  } catch (err: unknown) {
    return NextResponse.json({ connected: false, error: String(err) }, { status: 200 })
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

    const { birthday, name, email, password, currentPassword, vkId, googleEmail, newsDisabled } = await req.json()
    const { parseBirthday, broadcastMyBirthdayToFriends, updateUserNameCascade } = await import('@/lib/backend/db')
    const { setNewsDisabled, planAtLeast, PLANS } = await import('@/lib/backend/plans')

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
      if (password.length < 6) {
        return NextResponse.json({ error: 'Пароль должен быть не менее 6 символов' }, { status: 400 })
      }
      // If the account already has a password, changing it requires the current one
      const existingChat = await prisma.telegramChat.findUnique({
        where: { chatId: userCid },
        select: { passwordHash: true },
      })
      if (existingChat?.passwordHash) {
        if (!currentPassword || !verifyPassword(currentPassword, existingChat.passwordHash)) {
          return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 403 })
        }
      }
      updateData.passwordHash = hashPassword(password)
    }

    if (vkId !== undefined) {
      updateData.vkId = vkId ? String(vkId).trim() : null
    }

    if (googleEmail !== undefined) {
      updateData.googleEmail = googleEmail ? String(googleEmail).trim().toLowerCase() : null
    }

    // News digest opt-out — available on Plus and above
    let newsDisabledApplied = false
    if (newsDisabled !== undefined) {
      const currentChat = await prisma.telegramChat.findUnique({
        where: { chatId: userCid },
        select: { plan: true, subscriptionExpiry: true },
      })
      const active = currentChat && currentChat.subscriptionExpiry && new Date(currentChat.subscriptionExpiry) > new Date()
      if (!planAtLeast(currentChat?.plan, 'plus') || (!active && normalizePlan(currentChat?.plan) !== 'corp')) {
        return NextResponse.json({
          error: 'Отключение новостных сводок доступно на тарифе Plus или выше.',
        }, { status: 403 })
      }
      await setNewsDisabled(cid, Boolean(newsDisabled))
      newsDisabledApplied = true
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

    return NextResponse.json({
      success: true,
      message: newsDisabledApplied
        ? (newsDisabled ? 'Новостные сводки отключены.' : 'Новостные сводки включены.')
        : 'Профиль и способы входа успешно обновлены!',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
