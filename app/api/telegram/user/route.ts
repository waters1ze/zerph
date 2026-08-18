/**
 * GET  /api/telegram/user — Returns connected user profile and linked auth providers
 * POST /api/telegram/user — Updates user profile, birthday, and links Email / Google / VK
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { hashPassword, verifyPassword } from '@/lib/backend/passwords'
import { normalizePlan, isNewsDisabled, planAtLeast } from '@/lib/backend/plans'
import { getSiriUserKey } from '@/app/api/shortcuts/route'

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

          let city = 'Москва'
          try {
            const cityConf = await prisma.config.findUnique({ where: { key: `user_city_${cid}` } })
            if (cityConf?.value) city = cityConf.value
          } catch {}

          let avatarEmoji = 'zerfik_spirit'
          try {
            const emojiConf = await prisma.config.findUnique({ where: { key: `user_emoji_${cid}` } })
            if (emojiConf?.value) avatarEmoji = emojiConf.value
          } catch {}

          let aiModel: string | null = null
          let aiTaskModels: Record<string, string> = {}
          let siriMode = 'fast'
          try {
            const [modelConf, taskModelsConf, siriModeConf] = await Promise.all([
              prisma.config.findUnique({ where: { key: `user_ai_model_${cid}` } }),
              prisma.config.findUnique({ where: { key: `user_ai_task_models_${cid}` } }),
              prisma.config.findUnique({ where: { key: `user_siri_mode_${cid}` } }),
            ])
            if (modelConf?.value) aiModel = modelConf.value
            if (taskModelsConf?.value) aiTaskModels = JSON.parse(taskModelsConf.value)
            if (siriModeConf?.value) siriMode = siriModeConf.value
          } catch {}

          const siriKey = getSiriUserKey(chat.chatId)

          return NextResponse.json({
            connected: true,
            chatId: Number(chat.chatId),
            name: fullName,
            firstName: chat.firstName,
            lastName: chat.lastName,
            username: chat.username ? `@${chat.username.replace(/^@/, '')}` : null,
            email: chat.email || null,
            avatarEmoji,
            hasPassword: Boolean(chat.passwordHash),
            vkId: chat.vkId || null,
            googleEmail: chat.googleEmail || null,
            authProvider: chat.authProvider || 'telegram',
            birthday: chat.birthday || null,
            city,
            siriKey,
            timezone: chat.timezone || 'Europe/Moscow',
            reminderIntervalMinutes: chat.reminderIntervalMinutes ?? 5,
            reminderRepeatCount: chat.reminderRepeatCount ?? 3,
            ttsEnabled: Boolean(chat.ttsEnabled),
            aiModel,
            aiTaskModels,
            siriMode,
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
      return NextResponse.json(
        { connected: false, transient: true, error: 'DB temporarily unavailable' },
        { status: 503 }
      )
    }

    return NextResponse.json({ connected: false })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('db') || err.message.includes('Prisma') || (err as any)?.code)) {
      return NextResponse.json({ connected: false, transient: true }, { status: 503 })
    }
    return NextResponse.json({ connected: false, error: String(err) }, { status: 401 })
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

    const { birthday, name, email, password, currentPassword, vkId, googleEmail, newsDisabled, timezone, city, reminderIntervalMinutes, reminderRepeatCount, ttsEnabled, avatarEmoji, aiModel, aiTaskModels, siriMode } = await req.json()
    const { parseBirthday, broadcastMyBirthdayToFriends, updateUserNameCascade } = await import('@/lib/backend/db')
    const { setNewsDisabled, planAtLeast, PLANS } = await import('@/lib/backend/plans')

    const updateData: any = {}

    if (aiModel !== undefined) {
      const cleanModel = String(aiModel).trim()
      await prisma.config.upsert({
        where: { key: `user_ai_model_${cid}` },
        update: { value: cleanModel },
        create: { key: `user_ai_model_${cid}`, value: cleanModel },
      }).catch(() => {})
    }

    if (aiTaskModels !== undefined && typeof aiTaskModels === 'object') {
      await prisma.config.upsert({
        where: { key: `user_ai_task_models_${cid}` },
        update: { value: JSON.stringify(aiTaskModels) },
        create: { key: `user_ai_task_models_${cid}`, value: JSON.stringify(aiTaskModels) },
      }).catch(() => {})
    }

    if (siriMode !== undefined) {
      const cleanMode = String(siriMode).trim()
      await prisma.config.upsert({
        where: { key: `user_siri_mode_${cid}` },
        update: { value: cleanMode },
        create: { key: `user_siri_mode_${cid}`, value: cleanMode },
      }).catch(() => {})
    }

    if (avatarEmoji !== undefined) {
      const cleanEmoji = String(avatarEmoji).trim()
      await prisma.config.upsert({
        where: { key: `user_emoji_${cid}` },
        update: { value: cleanEmoji || 'zerfik_spirit' },
        create: { key: `user_emoji_${cid}`, value: cleanEmoji || 'zerfik_spirit' },
      }).catch(() => {})
    }

    if (city !== undefined) {
      const cleanCity = String(city).trim()
      await prisma.config.upsert({
        where: { key: `user_city_${cid}` },
        update: { value: cleanCity || 'Москва' },
        create: { key: `user_city_${cid}`, value: cleanCity || 'Москва' },
      }).catch(() => {})
    }

    if (birthday !== undefined) {
      const parsed = parseBirthday(birthday)
      updateData.birthday = parsed ? parsed.iso : (birthday || null)
    }

    if (timezone !== undefined) {
      updateData.timezone = String(timezone).trim()
    }

    if (reminderIntervalMinutes !== undefined) {
      updateData.reminderIntervalMinutes = Math.max(1, Math.min(120, Number(reminderIntervalMinutes) || 5))
    }

    if (reminderRepeatCount !== undefined) {
      updateData.reminderRepeatCount = Math.max(1, Math.min(10, Number(reminderRepeatCount) || 3))
    }

    if (ttsEnabled !== undefined) {
      updateData.ttsEnabled = Boolean(ttsEnabled)
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
      if (updateData.birthday !== undefined) {
        const { syncMyOwnBirthday } = await import('@/lib/backend/db')
        await syncMyOwnBirthday(userCid).catch(() => {})
        if (updateData.birthday) {
          await broadcastMyBirthdayToFriends(userCid).catch(() => {})
        }
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
