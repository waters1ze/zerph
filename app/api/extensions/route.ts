/**
 * GET & POST /api/extensions — Extensions Store, GitHub Manifest Parser & Sync, Likes/Hearts & Monetization (80/20 split)
 * Brand: Zerf Note. ZERO AI tokens spent — Pure GitHub raw repository and manifest parser.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, isUserAdmin, ROOT_ADMIN_IDS } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { planAtLeast, normalizePlan, PLANS, UNLIMITED } from '@/lib/backend/plans'
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

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    if (action === 'user_repos') {
      let username = searchParams.get('username') || ''
      let token = searchParams.get('token') || ''
      if (!username && chatId) {
        try {
          const ghRow = await prisma.config.findUnique({ where: { key: `user_github_${chatId}` } })
          if (ghRow?.value) username = ghRow.value
        } catch {}
      }
      if (!token && chatId) {
        try {
          const tokenRow = await prisma.config.findUnique({ where: { key: `user_github_token_${chatId}` } })
          if (tokenRow?.value) token = tokenRow.value
        } catch {}
      }

      if (!username && !token) {
        return NextResponse.json({ success: false, error: 'Укажите логин GitHub для загрузки репозиториев', repos: [] })
      }

      const headers: Record<string, string> = {
        'User-Agent': 'Zerf-Note-Extensions/1.0',
        'Accept': 'application/vnd.github.v3+json',
      }
      if (token) {
        headers['Authorization'] = `token ${token}`
      }

      try {
        const ghUrl = token 
          ? 'https://api.github.com/user/repos?sort=updated&per_page=100'
          : `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`

        const ghRes = await fetch(ghUrl, { headers, cache: 'no-store' })
        if (!ghRes.ok) {
          return NextResponse.json({
            success: false,
            error: ghRes.status === 404 ? `Пользователь GitHub @${username} не найден` : `Ошибка GitHub API (${ghRes.status})`,
            repos: []
          })
        }
        const ghData = await ghRes.json()
        if (Array.isArray(ghData)) {
          const repos = ghData.map((r: any) => ({
            name: r.name,
            fullName: r.full_name,
            description: r.description || '',
            htmlUrl: r.html_url,
            isPrivate: Boolean(r.private),
            stars: r.stargazers_count || 0,
            forks: r.forks_count || 0,
            language: r.language || 'Code',
            updatedAt: r.updated_at,
            defaultBranch: r.default_branch || 'main',
          }))
          return NextResponse.json({
            success: true,
            username,
            repos,
          })
        }
        return NextResponse.json({ success: true, username, repos: [] })
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message, repos: [] })
      }
    }

    if (action === 'get_reviews') {
      const extensionId = searchParams.get('extensionId')
      if (!extensionId) return NextResponse.json({ success: false, error: 'extensionId required' }, { status: 400 })
      try {
        const reviewsRow = await prisma.config.findUnique({ where: { key: `ext_reviews_${extensionId}` } })
        const reviews = reviewsRow?.value ? JSON.parse(reviewsRow.value) : []
        return NextResponse.json({ success: true, reviews })
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message, reviews: [] })
      }
    }

    const allItems = await loadExtensionsCatalog()
    const isCreator = await isUserAdmin(chatId)
    const catalog = allItems.filter(ext => {
      if (ext.isPublished === false) {
        return chatId && (ext.authorChatId === chatId || isCreator)
      }
      return true
    })

    // Dynamic real-time installCount calculation from all users
    try {
      const userExtRows = await prisma.config.findMany({
        where: { key: { startsWith: 'user_extensions_' } },
      })
      const installCountsMap = new Map<string, number>()
      for (const row of userExtRows) {
        try {
          const ids = JSON.parse(row.value)
          if (Array.isArray(ids)) {
            ids.forEach((id: string) => {
              installCountsMap.set(id, (installCountsMap.get(id) || 0) + 1)
            })
          }
        } catch {}
      }
      catalog.forEach(ext => {
        const dynamicInstalls = installCountsMap.get(ext.id)
        if (dynamicInstalls !== undefined) {
          ext.installCount = dynamicInstalls
        }
      })
    } catch {}

    const myExtensions = chatId ? allItems.filter(e => e.authorChatId === chatId) : []

    let installedIds: string[] = []
    let enabledIds: string[] = []
    let likedIds: string[] = []
    let authorStats = { balance: 0, totalEarned: 0, salesCount: 0 }
    let boundCard: any = null
    let userPlan = 'free'
    let userGithubUsername: string | null = null
    let autoRenewEnabled = true

    if (chatId) {
      try {
        const [
          instIds,
          enIds,
          lkIds,
          stats,
          card,
          userRec,
          ghRow,
          arRow
        ] = await Promise.all([
          getUserInstalledExtensions(chatId),
          getUserEnabledExtensions(chatId),
          getUserLikedExtensions(chatId),
          getAuthorBalance(chatId),
          getAuthorPayoutCard(chatId),
          prisma.telegramChat.findUnique({
            where: { chatId: BigInt(chatId) },
            select: { plan: true },
          }),
          prisma.config.findUnique({ where: { key: `user_github_${chatId}` } }),
          prisma.config.findUnique({ where: { key: `user_autorenew_${chatId}` } }),
        ])

        installedIds = instIds
        enabledIds = enIds
        likedIds = lkIds
        authorStats = stats
        boundCard = card
        userPlan = normalizePlan(userRec?.plan)
        if (ghRow?.value) userGithubUsername = ghRow.value
        if (arRow?.value !== undefined) {
          autoRenewEnabled = arRow.value === 'true'
        }
      } catch {}
    }

    const userLimits = (PLANS as any)[userPlan] || PLANS.free
    const maxExtensions = userLimits.maxExtensions ?? 5

    return NextResponse.json({
      success: true,
      catalog,
      installedIds,
      enabledIds,
      likedIds,
      githubUsername: userGithubUsername,
      userPlan,
      maxExtensions: maxExtensions === UNLIMITED ? -1 : maxExtensions,
      canUseExtensions: true, // All users can install up to their plan limit (Free: 5, Plus: 10, Pro: 50, Corp: ∞)
      canCreateExtensions: planAtLeast(userPlan, 'plus'),
      authorStats,
      boundCard: boundCard ? { ...boundCard, autoRenewEnabled } : null,
      autoRenewEnabled,
      payoutConfig: {
        platformPercent: 20,
        authorPercent: 80,
      },
      revenueShare: {
        authorPercent: 80,
        platformPercent: 20,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
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
      const taskEntries: any[] = []

      for (const t of tasks) {
        const title = typeof t === 'string' ? t : (t.title || t.name)
        if (title) {
          taskEntries.push({
            title: String(title),
            description: `Импортировано из шаблона Zerf Note: «${ext.title}»`,
            priority: 'medium',
            status: 'todo',
            dueDate: null,
            ownerChatId: BigInt(chatId),
            tags: ['шаблон', ext.category.toLowerCase()],
          })
        }
      }

      if (taskEntries.length > 0) {
        await prisma.task.createMany({
          data: taskEntries,
        })
      }

      return NextResponse.json({ success: true, createdCount: taskEntries.length })
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
      let finalIcon = icon || '🧩'
      let finalType = type
      let finalCategory = category
      let finalMinPlan = minPlan
      let finalPrice = Math.max(0, Math.min(5000, Number(price) || 0))
      let finalVersion = version
      let manifestContent = content

      // Only fetch from GitHub if title/description were empty (initial import)
      if (githubUrl && githubUrl.includes('github.com') && (!id || !title || !description)) {
        const ghData = await fetchManifestFromGithub(githubUrl)
        if (ghData) {
          const m = ghData.manifest
          if (!finalTitle && (m.displayName || m.name || m.title)) finalTitle = m.displayName || m.name || m.title
          if (!finalDesc && m.description) finalDesc = m.description
          if ((!finalIcon || finalIcon === '🧩') && m.icon) finalIcon = m.icon
          if (!finalType && m.type) finalType = m.type
          if (!finalCategory && m.category) finalCategory = m.category
          if (!finalVersion && m.version) finalVersion = m.version
          if (m.minPlan && ['free', 'plus', 'pro', 'corp'].includes(m.minPlan)) finalMinPlan = m.minPlan
          if (m.price !== undefined && price === undefined) finalPrice = Math.max(0, Math.min(5000, Number(m.price) || 0))
          if (m.isRunnable !== undefined && body.isRunnable === undefined) body.isRunnable = Boolean(m.isRunnable)
          if (m.triggers && (!body.triggers || body.triggers.length === 0)) body.triggers = m.triggers
          if (m.aiSkills && (!body.aiSkills || body.aiSkills.length === 0)) body.aiSkills = m.aiSkills
          if (!manifestContent || Object.keys(manifestContent).length === 0) {
            manifestContent = m.content || m.config || manifestContent
          }
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
      const isCreator = await isUserAdmin(chatId)
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
        manifestUrl: existingData?.manifestUrl || '',
        hostingUrl: body.hostingUrl !== undefined
          ? String(body.hostingUrl).trim()
          : (manifestContent?.hostingUrl || existingData?.hostingUrl || ''),
        selfHosted: body.selfHosted !== undefined
          ? Boolean(body.selfHosted)
          : (manifestContent?.selfHosted !== undefined ? Boolean(manifestContent.selfHosted) : (existingData?.selfHosted || false)),
        isDisabledByOwner: body.isDisabledByOwner !== undefined
          ? Boolean(body.isDisabledByOwner)
          : (existingData?.isDisabledByOwner || false),
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
      const isCreator = await isUserAdmin(chatId)
      if (current.authorChatId !== chatId && !isCreator) {
        return NextResponse.json({ error: 'У вас нет прав на изменение статуса публикации' }, { status: 403 })
      }

      current.isPublished = typeof isPublished === 'boolean' ? isPublished : !current.isPublished
      current.isDisabledByOwner = !current.isPublished
      current.updatedAt = new Date().toISOString()

      await prisma.config.update({
        where: { key: `zerf_ext_${extensionId}` },
        data: { value: JSON.stringify(current) },
      })

      return NextResponse.json({ success: true, isPublished: current.isPublished, isDisabledByOwner: current.isDisabledByOwner })
    }

    // ── ACTION: DELETE CUSTOM EXTENSION ──
    if (action === 'delete_custom') {
      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
      if (!extRec) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      const current: ExtensionItem = JSON.parse(extRec.value)
      const isCreator = await isUserAdmin(chatId)
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
      const isCreator = await isUserAdmin(chatId)
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
      if (m.aiInstructions) {
        const rawAiInstructions = String(m.aiInstructions)
        const FORBIDDEN_AI_PATTERNS = [
          /ignore\s+previous/i,
          /system\s*:/i,
          /jailbreak/i,
          /bypass\s+safety/i,
          /forget\s+all\s+instructions/i,
        ]

        for (const pattern of FORBIDDEN_AI_PATTERNS) {
          if (pattern.test(rawAiInstructions)) {
            return NextResponse.json({ error: 'Инструкции для ИИ из GitHub содержат недопустимые паттерны безопасности.' }, { status: 400 })
          }
        }
        current.aiInstructions = rawAiInstructions
      }
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

    // ── ACTION: INSTALL EXTENSION (Tiered limits: Free 5, Plus 10, Pro 50, Corp Unlimited) ──
    if (action === 'install') {
      if (!checkInMemoryRateLimit(`install:${chatId}`, 20, 60 * 1000)) {
        return NextResponse.json({ error: 'Слишком много запросов. Пожалуйста, подождите.' }, { status: 429 })
      }

      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      const userPlan = normalizePlan((userRec as any)?.plan || 'free')
      const planLimits = (PLANS as any)[userPlan] || PLANS.free
      const maxAllowed = planLimits.maxExtensions ?? 5

      let installed = await getUserInstalledExtensions(chatId)
      if (!installed.includes(extensionId) && maxAllowed !== UNLIMITED && installed.length >= maxAllowed) {
        return NextResponse.json({
          error: `🔒 Превышен лимит расширений для вашего тарифа (${installed.length}/${maxAllowed} шт.). Для установки до 10 расширений подключите Plus, до 50 — Pro, или безлимит на тарифе Corp!`,
          requiresUpgrade: true,
          currentCount: installed.length,
          maxAllowed,
          userPlan,
        }, { status: 403 })
      }

      const allItems = [...STARTER_EXTENSIONS, ...(await getCustomExtensions())]
      const ext = allItems.find(e => e.id === extensionId)
      if (!ext) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      const isCreator = await isUserAdmin(chatId)
      if ((ext.isPublished === false || ext.isDisabledByOwner === true) && ext.authorChatId !== chatId && !isCreator) {
        return NextResponse.json({
          error: '🔴 Это расширение временно отключено автором и недоступно для установки.',
          isDisabledByOwner: true,
        }, { status: 403 })
      }

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

    // ── ACTION: RATE & REVIEW EXTENSION ──
    if (action === 'rate_extension') {
      const { extensionId, rating, comment } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })
      const numRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)))
      const textComment = typeof comment === 'string' ? comment.trim().slice(0, 1000) : ''

      const authorName = [userRec?.firstName, userRec?.lastName].filter(Boolean).join(' ') || (userRec?.username ? `@${userRec.username}` : 'Пользователь')

      const reviewsRow = await prisma.config.findUnique({ where: { key: `ext_reviews_${extensionId}` } })
      let reviews: any[] = reviewsRow?.value ? JSON.parse(reviewsRow.value) : []

      const existingIdx = reviews.findIndex(r => String(r.chatId) === String(chatId))
      const newReview = {
        id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        chatId: String(chatId),
        authorName,
        authorUsername: userRec?.username || undefined,
        rating: numRating,
        comment: textComment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      if (existingIdx !== -1) {
        reviews[existingIdx] = { ...reviews[existingIdx], ...newReview, createdAt: reviews[existingIdx].createdAt }
      } else {
        reviews.unshift(newReview)
      }

      await prisma.config.upsert({
        where: { key: `ext_reviews_${extensionId}` },
        update: { value: JSON.stringify(reviews) },
        create: { key: `ext_reviews_${extensionId}`, value: JSON.stringify(reviews) },
      })

      // Calculate new average rating
      const totalScore = reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0)
      const avgRating = Math.round((totalScore / reviews.length) * 10) / 10
      const ratingCount = reviews.length

      // Update extension DB record if exists
      const extRow = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
      if (extRow?.value) {
        try {
          const parsedExt = JSON.parse(extRow.value)
          parsedExt.rating = avgRating
          parsedExt.ratingCount = ratingCount
          await prisma.config.update({
            where: { key: `zerf_ext_${extensionId}` },
            data: { value: JSON.stringify(parsedExt) },
          })
        } catch {}
      }

      return NextResponse.json({
        success: true,
        reviews,
        rating: avgRating,
        ratingCount,
        userReview: newReview,
      })
    }

    // ── ACTION: DELETE REVIEW ──
    if (action === 'delete_review') {
      const { extensionId, reviewId } = body
      if (!extensionId || !reviewId) return NextResponse.json({ error: 'extensionId and reviewId required' }, { status: 400 })
      const isCreator = await isUserAdmin(chatId)

      const reviewsRow = await prisma.config.findUnique({ where: { key: `ext_reviews_${extensionId}` } })
      let reviews: any[] = reviewsRow?.value ? JSON.parse(reviewsRow.value) : []

      reviews = reviews.filter(r => {
        if (r.id === reviewId) {
          return !(String(r.chatId) === String(chatId) || isCreator)
        }
        return true
      })

      await prisma.config.upsert({
        where: { key: `ext_reviews_${extensionId}` },
        update: { value: JSON.stringify(reviews) },
        create: { key: `ext_reviews_${extensionId}`, value: JSON.stringify(reviews) },
      })

      const totalScore = reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0)
      const avgRating = reviews.length > 0 ? Math.round((totalScore / reviews.length) * 10) / 10 : 5.0
      const ratingCount = reviews.length

      const extRow = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
      if (extRow?.value) {
        try {
          const parsedExt = JSON.parse(extRow.value)
          parsedExt.rating = avgRating
          parsedExt.ratingCount = ratingCount
          await prisma.config.update({
            where: { key: `zerf_ext_${extensionId}` },
            data: { value: JSON.stringify(parsedExt) },
          })
        } catch {}
      }

      return NextResponse.json({ success: true, reviews, rating: avgRating, ratingCount })
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

      // 80/20 Revenue share: 80% to author, 20% platform fee
      const price = ext.price
      const authorShare = Math.round(price * 0.80)
      const platformShare = price - authorShare

      // Unique tracking label for YooMoney: ext_<chatId>_<timestamp>_<hex> (< 40 chars, safe from YooMoney 64 char limit)
      const receiver = process.env.YOOMONEY_RECEIVER || '4100119573095433'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
      const successUrl = `${appUrl}/?view=extensions&ext_purchased=${ext.id}`

      const label = `ext_${chatId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`

      await prisma.config.create({
        data: {
          key: `ext_pending_${label}`,
          value: JSON.stringify({
            extensionId: ext.id,
            extensionTitle: ext.title,
            buyerChatId: chatId,
            authorChatId: ext.authorChatId,
            price: ext.price,
            authorShare,
            platformShare,
            createdAt: new Date().toISOString(),
          }),
        },
      })

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

      return NextResponse.json({
        success: true,
        paymentUrl,
        label,
        amount: ext.price,
        authorShare,
        platformShare,
      })
    }

    // ── ACTION: PING SELF-HOSTED SERVER (Health Check) ──
    if (action === 'ping_host') {
      const { hostingUrl } = body
      if (!hostingUrl || typeof hostingUrl !== 'string') {
        return NextResponse.json({ error: 'Укажите корректный URL сервера' }, { status: 400 })
      }
      const cleanUrl = hostingUrl.trim()
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        return NextResponse.json({ error: 'URL должен начинаться с https:// или http://' }, { status: 400 })
      }

      const start = Date.now()
      try {
        const res = await fetch(cleanUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'Zerf-Note-HostCheck/1.0' },
          signal: AbortSignal.timeout(5000),
        })
        const latencyMs = Date.now() - start
        return NextResponse.json({
          success: true,
          reachable: res.status < 500,
          status: res.status,
          statusText: res.statusText,
          latencyMs,
        })
      } catch (pingErr: any) {
        const latencyMs = Date.now() - start
        return NextResponse.json({
          success: true,
          reachable: false,
          error: pingErr.message || 'Сервер недоступен (Timeout / Connection Refused)',
          latencyMs,
        })
      }
    }

    // ── ACTION: TOGGLE SUBSCRIPTION AUTO-RENEWAL ──
    if (action === 'toggle_autorenew') {
      const { enabled } = body
      const isAutoRenew = Boolean(enabled)

      await prisma.config.upsert({
        where: { key: `user_autorenew_${chatId}` },
        update: { value: isAutoRenew ? 'true' : 'false' },
        create: { key: `user_autorenew_${chatId}`, value: isAutoRenew ? 'true' : 'false' },
      })

      // Also update inside boundCard if present
      const cardRow = await prisma.config.findUnique({ where: { key: `author_payout_card_${chatId}` } })
      if (cardRow?.value) {
        const cardObj = JSON.parse(cardRow.value)
        cardObj.autoRenewEnabled = isAutoRenew
        await prisma.config.update({
          where: { key: `author_payout_card_${chatId}` },
          data: { value: JSON.stringify(cardObj) },
        })
      }

      return NextResponse.json({ success: true, autoRenewEnabled: isAutoRenew })
    }

    // ── ACTION: DELETE EXTENSION ──
    if (action === 'delete') {
      const { extensionId } = body
      const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
      if (!extRec) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      const parsed = JSON.parse(extRec.value)
      if (parsed.authorChatId !== chatId && !(await isUserAdmin(chatId))) {
        return NextResponse.json({ error: 'У вас нет прав на удаление этого расширения' }, { status: 403 })
      }

      await prisma.config.delete({ where: { key: `zerf_ext_${extensionId}` } })
      return NextResponse.json({ success: true })
    }

    // ── ACTION: BIND PAYOUT CARD / YOOMONEY DETAILS & AUTO-RENEW TOGGLE ──
    if (action === 'bind_card') {
      const { payoutType, cardNumber, phone, bankName, recipientName, autoRenewEnabled } = body
      if (!cardNumber && !phone) {
        return NextResponse.json({ error: 'Укажите номер счёта ЮMoney или номер карты' }, { status: 400 })
      }

      const isAutoRenew = autoRenewEnabled !== undefined ? Boolean(autoRenewEnabled) : true

      const cardData = {
        payoutType: payoutType === 'card' ? 'card' : 'yoomoney',
        cardNumber: cardNumber ? String(cardNumber).replace(/\s+/g, '') : '',
        phone: phone ? String(phone).trim() : '',
        bankName: bankName ? String(bankName).trim() : '',
        recipientName: recipientName ? String(recipientName).trim() : '',
        autoRenewEnabled: isAutoRenew,
        updatedAt: new Date().toISOString(),
      }

      await Promise.all([
        prisma.config.upsert({
          where: { key: `author_payout_card_${chatId}` },
          update: { value: JSON.stringify(cardData) },
          create: { key: `author_payout_card_${chatId}`, value: JSON.stringify(cardData) },
        }),
        prisma.config.upsert({
          where: { key: `user_payment_card_${chatId}` },
          update: { value: JSON.stringify(cardData) },
          create: { key: `user_payment_card_${chatId}`, value: JSON.stringify(cardData) },
        }),
        prisma.config.upsert({
          where: { key: `user_autorenew_${chatId}` },
          update: { value: isAutoRenew ? 'true' : 'false' },
          create: { key: `user_autorenew_${chatId}`, value: isAutoRenew ? 'true' : 'false' },
        }),
      ])

      return NextResponse.json({ success: true, boundCard: cardData, autoRenewEnabled: isAutoRenew })
    }

    // ── ACTION: UNBIND PAYOUT CARD ──
    if (action === 'unbind_card') {
      await Promise.all([
        prisma.config.delete({ where: { key: `author_payout_card_${chatId}` } }).catch(() => {}),
        prisma.config.delete({ where: { key: `user_payment_card_${chatId}` } }).catch(() => {}),
      ])
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  } catch (err: unknown) {
    console.error('Extensions POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
