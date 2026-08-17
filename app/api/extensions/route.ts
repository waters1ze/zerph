/**
 * GET & POST /api/extensions — Extensions Store, GitHub Manifest Parser & Sync, Likes/Hearts & Monetization (80/20 split)
 * Brand: Zerf Note. ZERO AI tokens spent — Pure GitHub raw repository and manifest parser.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { planAtLeast, normalizePlan } from '@/lib/backend/plans'
import { checkInMemoryRateLimit } from '@/lib/backend/rate-limit'
import {
  ExtensionItem,
  STARTER_EXTENSIONS,
  getUserExtensionsAIContext,
  getUserInstalledExtensions,
  getUserEnabledExtensions,
  loadExtensionsCatalog,
  getExtensionById,
  getCustomExtensions,
  getDeletedExtensionIds,
} from '@/lib/backend/extensions'
import crypto from 'crypto'

export type { ExtensionItem }
export {
  STARTER_EXTENSIONS,
  getUserExtensionsAIContext,
  getUserInstalledExtensions,
  getUserEnabledExtensions,
  loadExtensionsCatalog,
  getExtensionById,
}

/**
 * Normalizes any GitHub URL to raw manifest URLs (zerf-extension.json or manifest.json)
 */
export function getGithubRawUrls(repoUrl: string): string[] {
  let clean = repoUrl.trim().replace(/\/$/, '')
  
  if (clean.includes('raw.githubusercontent.com')) {
    return [clean]
  }

  const match = clean.match(/github\.com\/([^\/]+)\/([^\/]+)/i)
  if (!match) return []

  const owner = match[1]
  const repo = match[2].replace(/\.git$/, '')

  return [
    `https://raw.githubusercontent.com/${owner}/${repo}/main/zerf-extension.json`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/zerf-extension.json`,
    `https://raw.githubusercontent.com/${owner}/${repo}/main/manifest.json`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/manifest.json`,
  ]
}

/**
 * Fetches and parses manifest from GitHub with 0 AI tokens
 */
export async function fetchManifestFromGithub(githubUrl: string): Promise<{ manifest: any; rawUrl: string } | null> {
  const candidateUrls = getGithubRawUrls(githubUrl)
  if (candidateUrls.length === 0) return null

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Zerf-Note-Parser/1.0' },
        cache: 'no-store',
      })
      if (res.ok) {
        const text = await res.text()
        const parsed = JSON.parse(text)
        if (parsed && (parsed.name || parsed.title)) {
          return { manifest: parsed, rawUrl: url }
        }
      }
    } catch {}
  }
  return null
}

async function getUserLikedExtensions(chatId: string): Promise<string[]> {
  try {
    const row = await prisma.config.findUnique({
      where: { key: `user_ext_likes_${chatId}` },
    })
    return row?.value ? JSON.parse(row.value) : []
  } catch {
    return []
  }
}

async function getAuthorPayoutCard(chatId: string): Promise<any | null> {
  try {
    const row = await prisma.config.findUnique({
      where: { key: `author_payout_card_${chatId}` },
    })
    return row?.value ? JSON.parse(row.value) : null
  } catch {
    return null
  }
}

async function getAuthorBalance(chatId: string): Promise<{ balance: number; totalEarned: number; salesCount: number }> {
  try {
    const row = await prisma.config.findUnique({
      where: { key: `author_balance_${chatId}` },
    })
    return row?.value ? JSON.parse(row.value) : { balance: 0, totalEarned: 0, salesCount: 0 }
  } catch {
    return { balance: 0, totalEarned: 0, salesCount: 0 }
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const chatId = authUser?.chatId || null

    const allItems = await loadExtensionsCatalog()
    const isCreator = chatId === '6136950061' || chatId === '5078516086'
    const catalog = allItems.filter(ext => {
      if (ext.isPublished === false) {
        return chatId && (ext.authorChatId === chatId || isCreator)
      }
      return true
    })

    let installedIds: string[] = []
    let enabledIds: string[] = []
    let likedIds: string[] = []
    let authorStats = { balance: 0, totalEarned: 0, salesCount: 0 }
    let boundCard: any = null
    let userPlan = 'free'

    if (chatId) {
      installedIds = await getUserInstalledExtensions(chatId)
      enabledIds = await getUserEnabledExtensions(chatId)
      likedIds = await getUserLikedExtensions(chatId)
      authorStats = await getAuthorBalance(chatId)
      boundCard = await getAuthorPayoutCard(chatId)
      try {
        const userRec = await prisma.telegramChat.findUnique({
          where: { chatId: BigInt(chatId) },
          select: { plan: true },
        })
        userPlan = normalizePlan(userRec?.plan)
      } catch {}
    }

    return NextResponse.json({
      success: true,
      catalog,
      installedIds,
      enabledIds,
      likedIds,
      userPlan,
      canUseExtensions: planAtLeast(userPlan, 'plus'),
      canCreateExtensions: planAtLeast(userPlan, 'plus'),
      authorStats,
      boundCard,
      payoutConfig: {
        platformPercent: 20,
        authorPercent: 80,
        gatewayFeePercent: 3.5, // 3.5% banking/SBP payout gateway fee deducted from author on payout
        minPayoutRub: 100,
      },
      revenueShare: {
        authorPercent: 80,
        platformPercent: 20,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=360',
      }
    })
  } catch (err: unknown) {
    console.error('Extensions GET error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }
    const chatId = authUser.chatId
    const userRec = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } }).catch(() => null)

    const body = await req.json()
    const { action } = body

    // ── ACTION: LIKE / UNLIKE EXTENSION (HEART) ──
    if (action === 'like') {
      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      let liked = await getUserLikedExtensions(chatId)
      const isCurrentlyLiked = liked.includes(extensionId)
      const nextLiked = isCurrentlyLiked
        ? liked.filter(id => id !== extensionId)
        : [...liked, extensionId]

      await prisma.config.upsert({
        where: { key: `user_ext_likes_${chatId}` },
        update: { value: JSON.stringify(nextLiked) },
        create: { key: `user_ext_likes_${chatId}`, value: JSON.stringify(nextLiked) },
      })

      // Update likes count on custom extension if stored in DB
      let updatedLikesCount = 0
      try {
        const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
        if (extRec?.value) {
          const parsed = JSON.parse(extRec.value)
          parsed.likesCount = Math.max(0, (parsed.likesCount || 0) + (isCurrentlyLiked ? -1 : 1))
          updatedLikesCount = parsed.likesCount
          await prisma.config.update({
            where: { key: `zerf_ext_${extensionId}` },
            data: { value: JSON.stringify(parsed) },
          })
        }
      } catch {}

      return NextResponse.json({
        success: true,
        likedIds: nextLiked,
        isLiked: !isCurrentlyLiked,
        likesCount: updatedLikesCount,
      })
    }

    // ── ACTION: APPLY TEMPLATE EXTENSION (Creates Real Tasks/Projects in Zerf Note) ──
    if (action === 'apply_template') {
      const userPlan = normalizePlan((userRec as any)?.plan || 'free')
      if (!planAtLeast(userPlan, 'plus')) {
        return NextResponse.json({
          error: '🔒 Импорт шаблонов из каталога расширений доступен с тарифа Zerf Plus (99 ₽). Оформите подписку в Настройках!',
          requiresPlus: true,
        }, { status: 403 })
      }

      const { extensionId } = body
      const allItems = [...STARTER_EXTENSIONS, ...(await getCustomExtensions())]
      const ext = allItems.find(e => e.id === extensionId)
      if (!ext) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      const tasks = ext.content?.tasks || ext.content?.sections || []
      const todayStr = new Date().toISOString().slice(0, 10)
      let createdCount = 0

      for (const t of tasks) {
        const title = typeof t === 'string' ? t : (t.title || t.name)
        if (title) {
          await prisma.task.create({
            data: {
              title: String(title),
              description: `Импортировано из шаблона Zerf Note: «${ext.title}»`,
              priority: 'medium',
              status: 'todo',
              dueDate: todayStr,
              ownerChatId: BigInt(chatId),
              tags: ['шаблон', ext.category.toLowerCase()],
            } as any
          })
          createdCount++
        }
      }

      return NextResponse.json({ success: true, createdCount })
    }

    // ── ACTION: PARSE GITHUB MANIFEST IN REAL-TIME (0 AI Tokens) ──
    if (action === 'parse_github') {
      const { githubUrl } = body
      if (!githubUrl || !githubUrl.includes('github.com')) {
        return NextResponse.json({ error: 'Укажите корректную ссылку на GitHub репозиторий (например: https://github.com/user/repo)' }, { status: 400 })
      }

      const ghData = await fetchManifestFromGithub(githubUrl)
      if (!ghData) {
        return NextResponse.json({
          error: 'Не удалось найти zerf-extension.json или manifest.json в корне репозитория (ветки main или master). Проверьте структуру репозитория.',
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        manifest: ghData.manifest,
        manifestUrl: ghData.rawUrl,
      })
    }

    // ── ACTION: PUBLISH / UPDATE EXTENSION (Requires Zerf Plus) ──
    if (action === 'publish_github' || action === 'publish') {
      if (!checkInMemoryRateLimit(`publish:${chatId}`, 10, 60 * 60 * 1000)) {
        return NextResponse.json({ error: 'Слишком много попыток публикации. Попробуйте позже.' }, { status: 429 })
      }

      const userPlan = normalizePlan((userRec as any)?.plan || 'free')
      if (!planAtLeast(userPlan, 'plus')) {
        return NextResponse.json({
          error: '🔒 Публикация расширений доступна с тарифа Zerf Plus (99 ₽). Оформите подписку в Настройках!',
          requiresPlus: true,
        }, { status: 403 })
      }

      const {
        id,
        title,
        description,
        type = 'widget',
        category = 'Другое',
        icon = '🧩',
        githubUrl = '',
        price = 0,
        minPlan = 'free',
        content = {},
        version = '1.0.0',
      } = body

      let finalTitle = title
      let finalDesc = description
      let finalIcon = icon
      let finalType = type
      let finalCategory = category
      let finalMinPlan = minPlan
      let finalPrice = Math.max(0, Math.min(5000, Number(price) || 0))
      let finalVersion = version
      let manifestContent = content

      if (githubUrl && githubUrl.includes('github.com')) {
        const ghData = await fetchManifestFromGithub(githubUrl)
        if (ghData) {
          const m = ghData.manifest
          if (m.name || m.title) finalTitle = m.name || m.title
          if (m.description) finalDesc = m.description
          if (m.icon) finalIcon = m.icon
          if (m.type) finalType = m.type
          if (m.category) finalCategory = m.category
          if (m.version) finalVersion = m.version
          if (m.minPlan && ['free', 'plus', 'pro', 'corp'].includes(m.minPlan)) finalMinPlan = m.minPlan
          if (m.price !== undefined) finalPrice = Math.max(0, Math.min(5000, Number(m.price) || 0))
          manifestContent = m.content || m.config || manifestContent
        }
      }

      if (!finalTitle || !finalDesc) {
        return NextResponse.json({ error: 'Заполните название и описание расширения' }, { status: 400 })
      }

      // Security validations against prompt injection & forbidden triggers
      const rawAiInstructions = body.aiInstructions !== undefined
        ? String(body.aiInstructions)
        : (manifestContent?.aiInstructions || '')

      const FORBIDDEN_AI_PATTERNS = [
        /ignore\s+previous/i,
        /system\s*:/i,
        /jailbreak/i,
        /bypass\s+safety/i,
        /forget\s+all\s+instructions/i,
      ]

      for (const pattern of FORBIDDEN_AI_PATTERNS) {
        if (pattern.test(rawAiInstructions)) {
          return NextResponse.json({ error: 'Инструкции для ИИ содержат недопустимые паттерны безопасности.' }, { status: 400 })
        }
      }

      const rawTriggers: string[] = Array.isArray(body.triggers)
        ? body.triggers
        : (typeof body.triggers === 'string'
            ? body.triggers.split(',').map((s: string) => s.trim()).filter(Boolean)
            : (manifestContent?.triggers || []))

      const FORBIDDEN_COMMAND_TRIGGERS = ['/pay', '/admin', '/login', '/logout', '/delete', '/sudo', '/root', '/eval']
      for (const trig of rawTriggers) {
        if (FORBIDDEN_COMMAND_TRIGGERS.includes(trig.toLowerCase())) {
          return NextResponse.json({ error: `Триггер ${trig} зарезервирован системой и не может быть использован в расширениях.` }, { status: 400 })
        }
      }

      const extId = id || `ext_gh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
      const isCreator = chatId === '6136950061' || chatId === '5078516086' || (userRec as any)?.isAdmin === true
      const authorName = isCreator
        ? 'Создатель'
        : ([userRec?.firstName, userRec?.lastName].filter(Boolean).join(' ') || (userRec?.username ? `@${userRec.username}` : 'Автор расширения'))

      const existingRecord = await prisma.config.findUnique({ where: { key: `zerf_ext_${extId}` } })
      const existingData = existingRecord?.value ? JSON.parse(existingRecord.value) : null

      if (existingData && existingData.authorChatId !== chatId && !isCreator) {
        return NextResponse.json({ error: 'У вас нет прав на редактирование этого расширения' }, { status: 403 })
      }

      const extItem: ExtensionItem = {
        id: extId,
        title: finalTitle.trim().slice(0, 100),
        version: finalVersion,
        description: finalDesc.trim().slice(0, 500),
        type: finalType as any,
        category: finalCategory.trim().slice(0, 40),
        icon: finalIcon,
        githubUrl: githubUrl || '',
        authorChatId: existingData?.authorChatId || chatId,
        authorName: existingData?.authorName || authorName,
        isOfficial: existingData ? existingData.isOfficial : isCreator,
        isPublished: body.isPublished !== undefined
          ? Boolean(body.isPublished)
          : (existingData?.isPublished !== undefined ? existingData.isPublished : false),
        isRunnable: body.isRunnable !== undefined
          ? Boolean(body.isRunnable)
          : (manifestContent?.isRunnable !== undefined ? Boolean(manifestContent.isRunnable) : (existingData?.isRunnable || false)),
        changelog: body.changelog !== undefined ? body.changelog : (existingData?.changelog || ''),
        price: finalPrice,
        minPlan: finalMinPlan,
        rating: existingData?.rating || 5.0,
        ratingCount: existingData?.ratingCount || 1,
        likesCount: existingData?.likesCount || 0,
        installCount: existingData?.installCount || 0,
        aiInstructions: rawAiInstructions,
        triggers: rawTriggers,
        aiSkills: Array.isArray(body.aiSkills)
          ? body.aiSkills
          : (manifestContent?.aiSkills || existingData?.aiSkills || []),
        content: manifestContent,
        createdAt: existingData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await prisma.config.upsert({
        where: { key: `zerf_ext_${extId}` },
        update: { value: JSON.stringify(extItem) },
        create: { key: `zerf_ext_${extId}`, value: JSON.stringify(extItem) },
      })

      return NextResponse.json({ success: true, extension: extItem })
    }

    // ── ACTION: TOGGLE PUBLICATION STATUS ──
    if (action === 'toggle_publish') {
      const { extensionId, isPublished } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
      if (!extRec) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      const current: ExtensionItem = JSON.parse(extRec.value)
      const isCreator = chatId === '6136950061' || chatId === '5078516086' || (userRec as any)?.isAdmin === true
      if (current.authorChatId !== chatId && !isCreator) {
        return NextResponse.json({ error: 'У вас нет прав на изменение статуса публикации' }, { status: 403 })
      }

      current.isPublished = typeof isPublished === 'boolean' ? isPublished : !current.isPublished
      current.updatedAt = new Date().toISOString()

      await prisma.config.update({
        where: { key: `zerf_ext_${extensionId}` },
        data: { value: JSON.stringify(current) },
      })

      return NextResponse.json({ success: true, isPublished: current.isPublished })
    }

    // ── ACTION: DELETE CUSTOM EXTENSION ──
    if (action === 'delete_custom') {
      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
      if (!extRec) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      const current: ExtensionItem = JSON.parse(extRec.value)
      const isCreator = chatId === '6136950061' || chatId === '5078516086' || (userRec as any)?.isAdmin === true
      if (current.authorChatId !== chatId && !isCreator) {
        return NextResponse.json({ error: 'У вас нет прав на удаление этого расширения' }, { status: 403 })
      }

      await prisma.config.delete({ where: { key: `zerf_ext_${extensionId}` } })

      // Track deleted ID so it won't reappear
      const deleted = await getDeletedExtensionIds()
      if (!deleted.includes(extensionId)) {
        deleted.push(extensionId)
        await prisma.config.upsert({
          where: { key: 'deleted_extensions_list' },
          update: { value: JSON.stringify(deleted) },
          create: { key: 'deleted_extensions_list', value: JSON.stringify(deleted) },
        })
      }

      return NextResponse.json({ success: true, deletedId: extensionId })
    }

    // ── ACTION: SYNC GITHUB MANIFEST ──
    if (action === 'sync_github') {
      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
      if (!extRec) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      const current: ExtensionItem = JSON.parse(extRec.value)
      const isCreator = chatId === '6136950061' || chatId === '5078516086' || (userRec as any)?.isAdmin === true
      if (current.authorChatId !== chatId && !isCreator) {
        return NextResponse.json({ error: 'У вас нет прав на синхронизацию этого расширения' }, { status: 403 })
      }

      if (!current.githubUrl) {
        return NextResponse.json({ error: 'У расширения не указан GitHub URL' }, { status: 400 })
      }

      const ghData = await fetchManifestFromGithub(current.githubUrl)
      if (!ghData) {
        return NextResponse.json({ error: 'Не удалось загрузить манифест с GitHub' }, { status: 404 })
      }

      const m = ghData.manifest
      if (m.name || m.title) current.title = (m.name || m.title).slice(0, 100)
      if (m.description) current.description = m.description.slice(0, 500)
      if (m.icon) current.icon = m.icon
      if (m.type) current.type = m.type
      if (m.category) current.category = m.category.slice(0, 40)
      if (m.version) current.version = m.version
      if (m.minPlan && ['free', 'plus', 'pro', 'corp'].includes(m.minPlan)) current.minPlan = m.minPlan
      if (m.price !== undefined) current.price = Math.max(0, Math.min(5000, Number(m.price) || 0))
      if (m.aiInstructions) current.aiInstructions = String(m.aiInstructions)
      if (m.triggers) current.triggers = Array.isArray(m.triggers) ? m.triggers : []
      if (m.aiSkills) current.aiSkills = Array.isArray(m.aiSkills) ? m.aiSkills : []
      current.content = m.content || m.config || current.content
      current.manifestUrl = ghData.rawUrl
      current.updatedAt = new Date().toISOString()

      await prisma.config.update({
        where: { key: `zerf_ext_${extensionId}` },
        data: { value: JSON.stringify(current) },
      })

      return NextResponse.json({ success: true, extension: current })
    }

    // ── ACTION: INSTALL EXTENSION (Requires Zerf Plus) ──
    if (action === 'install') {
      if (!checkInMemoryRateLimit(`install:${chatId}`, 20, 60 * 1000)) {
        return NextResponse.json({ error: 'Слишком много запросов. Пожалуйста, подождите.' }, { status: 429 })
      }

      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      const userPlan = normalizePlan((userRec as any)?.plan || 'free')
      if (!planAtLeast(userPlan, 'plus')) {
        return NextResponse.json({
          error: '🔒 Установка расширений доступна с тарифа Zerf Plus (99 ₽). Оформите подписку в Настройках!',
          requiresPlan: 'plus',
        }, { status: 403 })
      }

      const allItems = [...STARTER_EXTENSIONS, ...(await getCustomExtensions())]
      const ext = allItems.find(e => e.id === extensionId)
      if (!ext) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      // Check minPlan requirement of extension
      if (ext.minPlan && ext.minPlan !== 'free' && !planAtLeast(userPlan, ext.minPlan)) {
        return NextResponse.json({
          error: `🔒 Для этого расширения требуется тариф Zerf ${ext.minPlan.toUpperCase()} или выше.`,
          requiresPlan: ext.minPlan,
        }, { status: 403 })
      }

      // Check if extension is paid and not yet purchased
      if (ext.price > 0 && ext.authorChatId !== chatId) {
        const purchaseRec = await prisma.config.findUnique({
          where: { key: `ext_purchase_${extensionId}_${chatId}` }
        })
        if (!purchaseRec) {
          return NextResponse.json({
            error: `Это платное расширение (${ext.price} ₽). Сначала приобретите его.`,
            requiresPurchase: true,
            price: ext.price,
          }, { status: 402 })
        }
      }

      let installed = await getUserInstalledExtensions(chatId)
      if (!installed.includes(extensionId)) {
        installed.push(extensionId)
        await prisma.config.upsert({
          where: { key: `user_extensions_${chatId}` },
          update: { value: JSON.stringify(installed) },
          create: { key: `user_extensions_${chatId}`, value: JSON.stringify(installed) },
        })

        // Increment install counter
        try {
          const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
          if (extRec?.value) {
            const parsed = JSON.parse(extRec.value)
            parsed.installCount = (parsed.installCount || 0) + 1
            await prisma.config.update({
              where: { key: `zerf_ext_${extensionId}` },
              data: { value: JSON.stringify(parsed) },
            })
          }
        } catch {}
      }

      // Auto-enable on install
      let enabled = await getUserEnabledExtensions(chatId)
      if (!enabled.includes(extensionId)) {
        enabled.push(extensionId)
        await prisma.config.upsert({
          where: { key: `user_enabled_extensions_${chatId}` },
          update: { value: JSON.stringify(enabled) },
          create: { key: `user_enabled_extensions_${chatId}`, value: JSON.stringify(enabled) },
        })
      }

      return NextResponse.json({ success: true, installedIds: installed, enabledIds: enabled })
    }

    // ── ACTION: TOGGLE ENABLE EXTENSION ──
    if (action === 'toggle_enable') {
      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      let enabled = await getUserEnabledExtensions(chatId)
      const isEnabled = enabled.includes(extensionId)
      const nextEnabled = isEnabled
        ? enabled.filter(id => id !== extensionId)
        : [...enabled, extensionId]

      await prisma.config.upsert({
        where: { key: `user_enabled_extensions_${chatId}` },
        update: { value: JSON.stringify(nextEnabled) },
        create: { key: `user_enabled_extensions_${chatId}`, value: JSON.stringify(nextEnabled) },
      })

      return NextResponse.json({ success: true, enabledIds: nextEnabled })
    }

    // ── ACTION: UNINSTALL EXTENSION ──
    if (action === 'uninstall') {
      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      let installed = await getUserInstalledExtensions(chatId)
      installed = installed.filter(id => id !== extensionId)
      await prisma.config.upsert({
        where: { key: `user_extensions_${chatId}` },
        update: { value: JSON.stringify(installed) },
        create: { key: `user_extensions_${chatId}`, value: JSON.stringify(installed) },
      })

      let enabled = await getUserEnabledExtensions(chatId)
      enabled = enabled.filter(id => id !== extensionId)
      await prisma.config.upsert({
        where: { key: `user_enabled_extensions_${chatId}` },
        update: { value: JSON.stringify(enabled) },
        create: { key: `user_enabled_extensions_${chatId}`, value: JSON.stringify(enabled) },
      })

      return NextResponse.json({ success: true, installedIds: installed, enabledIds: enabled })
    }

    // ── ACTION: BUY PAID GITHUB EXTENSION (Requires Zerf Plus, 80% Author / 20% Platform) ──
    // Zero-exploit model: Creates verified YooMoney checkout. Author revenue credited strictly on webhook.
    if (action === 'buy') {
      if (!checkInMemoryRateLimit(`buy:${chatId}`, 10, 60 * 1000)) {
        return NextResponse.json({ error: 'Слишком много попыток покупки. Подождите.' }, { status: 429 })
      }

      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      const userPlan = normalizePlan((userRec as any)?.plan || 'free')
      if (!planAtLeast(userPlan, 'plus')) {
        return NextResponse.json({
          error: '🔒 Покупка и установка расширений доступны с тарифа Zerf Plus (99 ₽). Оформите подписку в Настройках!',
          requiresPlan: 'plus',
        }, { status: 403 })
      }

      const allItems = [...STARTER_EXTENSIONS, ...(await getCustomExtensions())]
      const ext = allItems.find(e => e.id === extensionId)
      if (!ext) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      // Free extensions can be installed directly
      if (ext.price <= 0) {
        let installed = await getUserInstalledExtensions(chatId)
        if (!installed.includes(extensionId)) {
          installed.push(extensionId)
          await prisma.config.upsert({
            where: { key: `user_extensions_${chatId}` },
            update: { value: JSON.stringify(installed) },
            create: { key: `user_extensions_${chatId}`, value: JSON.stringify(installed) },
          })
        }
        return NextResponse.json({ success: true, isFree: true, installedIds: installed })
      }

      const authorShare = Math.round(ext.price * 0.8)
      const platformShare = ext.price - authorShare

      // Unique tracking label for YooMoney: ext_<id>_<chatId>_<timestamp>
      const label = `ext_${ext.id}_${chatId}_${Date.now()}`
      const receiver = process.env.YOOMONEY_RECEIVER || '4100119573095433'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
      const successUrl = `${appUrl}/?ext_purchased=${ext.id}`

      // Create YooMoney QuickPay checkout URL
      const params = new URLSearchParams({
        receiver: receiver,
        'quickpay-form': 'shop',
        targets: `Покупка расширения Zerf Note: «${ext.title}»`,
        paymentType: 'AC',
        sum: String(ext.price),
        label: label,
        successURL: successUrl,
      })

      const paymentUrl = `https://yoomoney.ru/quickpay/confirm?${params.toString()}`

      // Store pending purchase record in DB
      await prisma.config.create({
        data: {
          key: `ext_pending_${label}`,
          value: JSON.stringify({
            extensionId: ext.id,
            buyerChatId: chatId,
            authorChatId: ext.authorChatId,
            price: ext.price,
            authorShare,
            platformShare,
            createdAt: new Date().toISOString(),
          }),
        },
      })

      return NextResponse.json({
        success: true,
        paymentUrl,
        label,
        amount: ext.price,
        authorShare,
        platformShare,
      })
    }

    // ── ACTION: DELETE EXTENSION ──
    if (action === 'delete') {
      const { extensionId } = body
      const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
      if (!extRec) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      const parsed = JSON.parse(extRec.value)
      if (parsed.authorChatId !== chatId && chatId !== '6136950061' && chatId !== '5078516086') {
        return NextResponse.json({ error: 'У вас нет прав на удаление этого расширения' }, { status: 403 })
      }

      await prisma.config.delete({ where: { key: `zerf_ext_${extensionId}` } })
      return NextResponse.json({ success: true })
    }

    // ── ACTION: BIND PAYOUT CARD / SBP DETAILS ──
    if (action === 'bind_card') {
      const { payoutType, cardNumber, phone, bankName, recipientName } = body
      if (!cardNumber && !phone) {
        return NextResponse.json({ error: 'Укажите номер карты или номер телефона СБП' }, { status: 400 })
      }

      const cardData = {
        payoutType: payoutType || 'card', // 'card' | 'sbp' | 'yoomoney'
        cardNumber: cardNumber ? String(cardNumber).replace(/\s+/g, '') : '',
        phone: phone ? String(phone).trim() : '',
        bankName: bankName ? String(bankName).trim() : '',
        recipientName: recipientName ? String(recipientName).trim() : '',
        updatedAt: new Date().toISOString(),
      }

      await prisma.config.upsert({
        where: { key: `author_payout_card_${chatId}` },
        update: { value: JSON.stringify(cardData) },
        create: { key: `author_payout_card_${chatId}`, value: JSON.stringify(cardData) },
      })

      return NextResponse.json({ success: true, boundCard: cardData })
    }

    // ── ACTION: UNBIND PAYOUT CARD ──
    if (action === 'unbind_card') {
      await prisma.config.delete({ where: { key: `author_payout_card_${chatId}` } }).catch(() => {})
      return NextResponse.json({ success: true })
    }

    // ── ACTION: REQUEST SECURE PAYOUT (Fee is deducted from author payout, owner 20% untouched) ──
    if (action === 'request_payout') {
      if (!checkInMemoryRateLimit(`payout:${chatId}`, 3, 60 * 60 * 1000)) {
        return NextResponse.json({ error: 'Слишком много запросов на вывод. Попробуйте через час.' }, { status: 429 })
      }

      const authorStats = await getAuthorBalance(chatId)
      const requestedAmount = Number(body.amount) || authorStats.balance
      const minPayout = 100

      if (authorStats.balance < minPayout || requestedAmount < minPayout) {
        return NextResponse.json({ error: `Минимальная сумма для вывода: ${minPayout} ₽` }, { status: 400 })
      }
      if (requestedAmount > authorStats.balance) {
        return NextResponse.json({ error: 'Недостаточно средств на балансе автора' }, { status: 400 })
      }

      const boundCard = await getAuthorPayoutCard(chatId)
      const details = body.payoutDetails || boundCard
      if (!details || (!details.cardNumber && !details.phone)) {
        return NextResponse.json({ error: 'Привяжите банковскую карту или укажите телефон СБП для вывода' }, { status: 400 })
      }

      // Calculation of net amount after banking payout gateway fee (3.5%)
      const gatewayFeePercent = 3.5
      const gatewayFeeRub = Math.round(requestedAmount * (gatewayFeePercent / 100))
      const netPayoutRub = requestedAmount - gatewayFeeRub

      // Deduct requested balance
      authorStats.balance -= requestedAmount
      await prisma.config.upsert({
        where: { key: `author_balance_${chatId}` },
        update: { value: JSON.stringify(authorStats) },
        create: { key: `author_balance_${chatId}`, value: JSON.stringify(authorStats) },
      })

      // Log payout request in database
      const payoutId = `payout_${Date.now()}_${chatId}`
      await prisma.config.create({
        data: {
          key: `payout_req_${payoutId}`,
          value: JSON.stringify({
            payoutId,
            chatId,
            requestedAmount,
            gatewayFeeRub,
            netPayoutRub,
            details,
            status: 'pending',
            createdAt: new Date().toISOString(),
          }),
        },
      }).catch(() => {})

      // Send telegram notification to admin
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (botToken) {
        const destStr = details.payoutType === 'sbp'
          ? `⚡ СБП: ${details.phone} (${details.bankName || 'Банк не указан'})`
          : details.payoutType === 'yoomoney'
          ? `🟣 ЮMoney: ${details.cardNumber}`
          : `💳 Карта: ${details.cardNumber} (${details.bankName || ''})`

        const adminMsg = `💸 *Новая заявка на вывод средств от автора расширений!*\n\n` +
          `👤 ChatID: \`${chatId}\`\n` +
          `💰 Сумма списания: *${requestedAmount} ₽*\n` +
          `📉 Комиссия шлюза выплат (3.5%): *${gatewayFeeRub} ₽*\n` +
          `💵 *К зачислению автору: ${netPayoutRub} ₽*\n\n` +
          `📌 Реквизиты:\n${destStr}\n` +
          (details.recipientName ? `Получатель: ${details.recipientName}\n` : '') +
          `\n✅ Доля платформы (20%) остаётся нетронутой.`

        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: '6136950061',
            text: adminMsg,
            parse_mode: 'Markdown',
          }),
        }).catch(() => {})
      }

      return NextResponse.json({
        success: true,
        authorStats,
        payout: {
          requestedAmount,
          gatewayFeeRub,
          netPayoutRub,
        },
      })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  } catch (err: unknown) {
    console.error('Extensions POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
