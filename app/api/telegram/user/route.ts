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
          const { ROOT_ADMIN_IDS } = await import('@/lib/backend/admin')
          const isRoot = ROOT_ADMIN_IDS.includes(String(chat.chatId).trim())
          let activePlan = isRoot ? 'corp' : normalizePlan(chat.plan)
          const isPermanent = activePlan === 'corp' || isRoot || !chat.subscriptionExpiry
          if (activePlan !== 'free' && !isPermanent && chat.subscriptionExpiry && new Date(chat.subscriptionExpiry) < now) {
            activePlan = 'free'
          }
          const isPremium = activePlan !== 'free'
          const fullName = [chat.firstName, chat.lastName].filter(Boolean).join(' ') || chat.firstName || 'Пользователь Zerf'

          // Fetch all config in ONE round-trip
          const [
            cityConf, emojiConf, modelConf, taskModelsConf, siriModeConf,
            githubConf, sidebarConf, groqKeyConf, aiKeysConf, autoDelConf, newsConf
          ] = await Promise.all([
            prisma.config.findUnique({ where: { key: `user_city_${cid}` } }),
            prisma.config.findUnique({ where: { key: `user_emoji_${cid}` } }),
            prisma.config.findUnique({ where: { key: `user_ai_model_${cid}` } }),
            prisma.config.findUnique({ where: { key: `user_ai_task_models_${cid}` } }),
            prisma.config.findUnique({ where: { key: `user_siri_mode_${cid}` } }),
            prisma.config.findUnique({ where: { key: `user_github_${cid}` } }),
            prisma.config.findUnique({ where: { key: `user_sidebar_config_${cid}` } }),
            prisma.config.findUnique({ where: { key: `user_groq_api_key_${cid}` } }),
            prisma.config.findUnique({ where: { key: `user_ai_keys_${cid}` } }),
            prisma.config.findUnique({ where: { key: `user_auto_delete_${cid}` } }),
            prisma.config.findUnique({ where: { key: `news_disabled_${cid}` } }),
          ]).catch(() => Array(11).fill(null))

          const city = cityConf?.value || 'Москва'
          const avatarEmoji = emojiConf?.value || 'zerfik_spirit'
          const aiModel = modelConf?.value || null
          let aiTaskModels: Record<string, string> = {}
          try { if (taskModelsConf?.value) aiTaskModels = JSON.parse(taskModelsConf.value) } catch {}
          const siriMode = siriModeConf?.value || 'fast'
          let githubUsername = githubConf?.value || null
          let sidebarConfig: any = null
          try { if (sidebarConf?.value) sidebarConfig = JSON.parse(sidebarConf.value) } catch {}
          const groqApiKey = groqKeyConf?.value || null
          let aiKeys: { openaiKey?: string; anthropicKey?: string; geminiKey?: string } = {}
          try { if (aiKeysConf?.value) aiKeys = JSON.parse(aiKeysConf.value) } catch {}
          let autoDeleteMonths = 6
          if (autoDelConf?.value) { const p = Number(autoDelConf.value); if (!isNaN(p)) autoDeleteMonths = p }
          const newsDisabled = newsConf?.value === 'true'

          // Resolve googleEmail from all sources
          let finalGoogleEmail: string | null = chat.googleEmail || (chat.authProvider === 'google' ? chat.email : null)
          if (!finalGoogleEmail && chat.email && chat.email.includes('@gmail.com')) {
            finalGoogleEmail = chat.email
          }

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
            googleEmail: finalGoogleEmail,
            githubUsername,
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
            sidebarConfig,
            groqApiKey,
            openaiKey: aiKeys.openaiKey || null,
            anthropicKey: aiKeys.anthropicKey || null,
            geminiKey: aiKeys.geminiKey || null,
            googleCalendarSync: Boolean(chat.googleCalendarSync),
            autoDeleteMonths,
            plan: activePlan,
            isPremium,
            subscriptionExpiry: chat.subscriptionExpiry?.toISOString() || null,
            isAdmin: Boolean(chat.isAdmin),
            newsDisabled,
          })
        }
      }
    } catch (dbErr) {
      console.warn('DB query error in /api/telegram/user:', dbErr)
      return NextResponse.json(
        { connected: false, transient: true, error: 'DB temporarily unavailable' },
        { status: 200 }
      )
    }

    return NextResponse.json({ connected: false }, { status: 200 })
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

    const {
      birthday, name, email, password, currentPassword, vkId, googleEmail,
      githubUsername, githubToken, newsDisabled, timezone, city,
      reminderIntervalMinutes, reminderRepeatCount, ttsEnabled,
      avatarEmoji, aiModel, aiTaskModels, siriMode, sidebarConfig,
      groqApiKey, apiKey, openaiKey, anthropicKey, geminiKey, autoDeleteMonths
    } = await req.json()
    const { parseBirthday, broadcastMyBirthdayToFriends, updateUserNameCascade } = await import('@/lib/backend/db')
    const { setNewsDisabled, planAtLeast, PLANS } = await import('@/lib/backend/plans')

    if (autoDeleteMonths !== undefined) {
      const monthsVal = String(Number(autoDeleteMonths) || 0)
      await prisma.config.upsert({
        where: { key: `user_auto_delete_${cid}` },
        update: { value: monthsVal },
        create: { key: `user_auto_delete_${cid}`, value: monthsVal },
      }).catch(() => {})
    }

    if (sidebarConfig !== undefined) {
      await prisma.config.upsert({
        where: { key: `user_sidebar_config_${cid}` },
        update: { value: JSON.stringify(sidebarConfig) },
        create: { key: `user_sidebar_config_${cid}`, value: JSON.stringify(sidebarConfig) },
      }).catch(() => {})
    }

    const effectiveGroqKey = groqApiKey !== undefined ? groqApiKey : apiKey
    if (effectiveGroqKey !== undefined) {
      const cleanKey = String(effectiveGroqKey).trim()
      if (cleanKey) {
        await prisma.config.upsert({
          where: { key: `user_groq_api_key_${cid}` },
          update: { value: cleanKey },
          create: { key: `user_groq_api_key_${cid}`, value: cleanKey },
        }).catch(() => {})
      } else {
        await prisma.config.delete({ where: { key: `user_groq_api_key_${cid}` } }).catch(() => {})
      }
    }

    if (openaiKey !== undefined || anthropicKey !== undefined || geminiKey !== undefined) {
      const currentAiKeysConf = await prisma.config.findUnique({ where: { key: `user_ai_keys_${cid}` } }).catch(() => null)
      let parsedAiKeys: any = {}
      if (currentAiKeysConf?.value) {
        try { parsedAiKeys = JSON.parse(currentAiKeysConf.value) } catch {}
      }
      if (openaiKey !== undefined) parsedAiKeys.openaiKey = String(openaiKey).trim()
      if (anthropicKey !== undefined) parsedAiKeys.anthropicKey = String(anthropicKey).trim()
      if (geminiKey !== undefined) parsedAiKeys.geminiKey = String(geminiKey).trim()

      await prisma.config.upsert({
        where: { key: `user_ai_keys_${cid}` },
        update: { value: JSON.stringify(parsedAiKeys) },
        create: { key: `user_ai_keys_${cid}`, value: JSON.stringify(parsedAiKeys) },
      }).catch(() => {})
    }

    if (githubUsername !== undefined) {
      const cleanGh = githubUsername ? String(githubUsername).trim().replace(/^@/, '').replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '').trim() : ''
      if (cleanGh) {
        await prisma.config.upsert({
          where: { key: `user_github_${cid}` },
          update: { value: cleanGh },
          create: { key: `user_github_${cid}`, value: cleanGh },
        }).catch(() => {})
      } else {
        await prisma.config.delete({ where: { key: `user_github_${cid}` } }).catch(() => {})
      }
    }

    if (githubToken !== undefined) {
      const cleanToken = String(githubToken).trim()
      if (cleanToken) {
        await prisma.config.upsert({
          where: { key: `user_github_token_${cid}` },
          update: { value: cleanToken },
          create: { key: `user_github_token_${cid}`, value: cleanToken },
        }).catch(() => {})
      } else {
        await prisma.config.delete({ where: { key: `user_github_token_${cid}` } }).catch(() => {})
      }
    }

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

    // Real-Time Cross-Device Synchronization via SSE
    try {
      const { notifyDataChanged, broadcastToUser } = await import('@/lib/backend/sse')
      notifyDataChanged(userCid)
      if (sidebarConfig !== undefined) {
        broadcastToUser(userCid, 'sidebar_config_changed', { sidebarConfig })
      }
    } catch {}

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
