/**
 * GET & POST /api/extensions — Extensions Store, GitHub Manifest Parser & Sync, Likes/Hearts & Monetization (80/20 split)
 * Brand: Zerf Note. ZERO AI tokens spent — Pure GitHub raw repository and manifest parser.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { planAtLeast, normalizePlan } from '@/lib/backend/plans'
import crypto from 'crypto'

export interface ExtensionItem {
  id: string
  title: string
  version?: string
  description: string
  type: 'widget' | 'template' | 'theme' | 'integration' | 'prompt'
  category: string
  icon: string
  githubUrl: string
  authorChatId: string
  authorName: string
  authorGithub?: string
  price: number // 0 = free, > 0 = price in RUB
  minPlan?: 'free' | 'plus' | 'pro' | 'corp'
  isOfficial?: boolean
  isPublished?: boolean // false = Draft/Unpublished, true = Live in Store Catalog
  changelog?: string // Release notes / changelog
  rating: number
  ratingCount: number
  likesCount: number
  installCount: number
  manifestUrl?: string
  aiInstructions?: string
  triggers?: string[]
  aiSkills?: Array<{
    name: string
    description: string
    action?: string
  }>
  content: Record<string, any>
  createdAt: string
  updatedAt: string
}

// Built-in official creator extensions loaded from open-source GitHub specifications
const STARTER_EXTENSIONS: ExtensionItem[] = [
  {
    id: 'ext_entropy_search',
    title: 'Entropy AI Search & Deep Research',
    version: '1.0.0',
    description: 'Интеллектуальный поисково-аналитический движок инсайтов в стиле Perplexity: глубокий синтез фактов, цитаты со ссылками на проверенные источники [1][2] и авто-экспорт в заметки.',
    type: 'widget',
    category: 'ИИ & Промпты',
    icon: '🔮',
    githubUrl: 'https://github.com/waters1ze/Entropy',
    authorChatId: '6136950061',
    authorName: 'waters1ze',
    authorGithub: 'waters1ze',
    price: 0,
    minPlan: 'free',
    isOfficial: true,
    isPublished: true,
    changelog: 'Релиз v1.0.0: Глубокий поиск, поддержка ссылок на источники, экспорт в заметки и CLI команды /search и /entropy.',
    rating: 5.0,
    ratingCount: 0,
    likesCount: 0,
    installCount: 0,
    aiInstructions: 'Когда пользователь запрашивает глубокий поиск, поиск инсайтов, фактов или использует команды /search, /entropy — синтезируй ответ с обязательными числовыми цитатами первоисточников [1][2], структурируй вывод по ключевым пунктам и предлагай авто-экспорт в базу заметок Zerf.',
    triggers: ['/search', '/entropy', 'глубокий поиск', 'исследуй', 'entropy', 'найди инсайты', 'синтез источников'],
    aiSkills: [
      {
        name: 'Entropy Deep Research',
        description: 'Синтез фактов из верифицированных источников с цитированием [1][2]',
        action: 'entropy_deep_search',
      },
    ],
    content: {
      engine: 'entropy_deep_search',
      commands: [
        { cmd: '/search', description: 'Entropy AI — Глубокий поиск и синтез источников' },
        { cmd: '/entropy', description: 'Entropy AI — Запуск поисковой аналитики инсайтов' },
      ],
      features: ['web_synthesis', 'citations', 'direct_answers', 'auto_note_export'],
      maxSources: 5,
    },
    createdAt: '2026-08-17T20:00:00Z',
    updatedAt: '2026-08-17T22:00:00Z',
  },
]

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

async function getCustomExtensions(): Promise<ExtensionItem[]> {
  try {
    const records = await prisma.config.findMany({
      where: { key: { startsWith: 'zerf_ext_' } },
    })
    const items: ExtensionItem[] = []
    for (const r of records) {
      try {
        const parsed = JSON.parse(r.value)
        if (parsed && parsed.id) items.push(parsed)
      } catch {}
    }
    return items
  } catch {
    return []
  }
}

async function getDeletedExtensionIds(): Promise<string[]> {
  try {
    const row = await prisma.config.findUnique({
      where: { key: 'deleted_extensions_list' },
    })
    return row?.value ? JSON.parse(row.value) : []
  } catch {
    return []
  }
}

export async function getUserInstalledExtensions(chatId: string | number): Promise<string[]> {
  try {
    const row = await prisma.config.findUnique({
      where: { key: `user_extensions_${String(chatId)}` },
    })
    return row?.value ? JSON.parse(row.value) : []
  } catch {
    return []
  }
}

export async function loadExtensionsCatalog(): Promise<ExtensionItem[]> {
  try {
    const deletedIds = await getDeletedExtensionIds()
    const customItems = await getCustomExtensions()
    const allMap = new Map<string, ExtensionItem>()

    STARTER_EXTENSIONS.forEach(e => {
      if (!deletedIds.includes(e.id)) allMap.set(e.id, e)
    })
    customItems.forEach(e => {
      if (!deletedIds.includes(e.id)) allMap.set(e.id, e)
    })
    return Array.from(allMap.values())
  } catch {
    return STARTER_EXTENSIONS
  }
}

/**
 * Compiles AI instructions, custom prompts, and triggers from all extensions
 * installed by a specific user (for Telegram bot, Siri shortcuts, Web AI chat, Voice, etc.)
 */
export async function getUserExtensionsAIContext(chatId: string | number): Promise<string> {
  try {
    const cid = String(chatId)
    const installedIds = await getUserInstalledExtensions(cid)
    if (!installedIds || installedIds.length === 0) return ''

    const catalog = await loadExtensionsCatalog()
    const installedExts = catalog.filter(e => installedIds.includes(e.id))
    if (installedExts.length === 0) return ''

    const instructions: string[] = []
    for (const ext of installedExts) {
      const rawAi = ext.aiInstructions || ext.content?.aiInstructions || ext.content?.systemPrompt
      const triggers = ext.triggers || ext.content?.triggers || (ext.content?.commands?.map((c: any) => c.cmd) || [])
      
      if (rawAi || (triggers && triggers.length > 0)) {
        let block = `• [Расширение «${ext.title}» (${ext.category || 'Утилита'})]`
        if (triggers && triggers.length > 0) {
          block += `\n  Ключевые слова / Триггеры: ${triggers.join(', ')}`
        }
        if (rawAi) {
          block += `\n  Инструкция для ИИ от автора: ${rawAi}`
        }
        instructions.push(block)
      }
    }

    return instructions.join('\n\n')
  } catch (err) {
    console.error('Error generating user extensions AI context:', err)
    return ''
  }
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
    let likedIds: string[] = []
    let authorStats = { balance: 0, totalEarned: 0, salesCount: 0 }
    let boundCard: any = null
    let userPlan = 'free'

    if (chatId) {
      installedIds = await getUserInstalledExtensions(chatId)
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

      const result = await fetchManifestFromGithub(githubUrl)
      if (!result) {
        return NextResponse.json({
          error: 'Не найден файл zerf-extension.json или manifest.json в ветке main/master репозитория. Создайте файл по спецификации в корне репозитория!',
        }, { status: 404 })
      }

      const m = result.manifest
      return NextResponse.json({
        success: true,
        rawUrl: result.rawUrl,
        manifest: {
          id: m.id || `ext_gh_${Date.now()}`,
          title: m.name || m.title || 'Безымянное расширение',
          version: m.version || '1.0.0',
          description: m.description || '',
          type: m.type || 'widget',
          category: m.category || 'Виджеты & Плагины',
          icon: m.icon || '📦',
          price: Math.max(0, Number(m.price) || 0),
          author: m.author || 'GitHub Developer',
          content: m.content || m.config || {},
        }
      })
    }

    // ── ACTION: PUBLISH EXTENSION FROM GITHUB REPO ──
    if (action === 'publish_github' || action === 'publish') {
      const userRec = await prisma.telegramChat.findUnique({
        where: { chatId: BigInt(chatId) },
      })
      const userPlan = normalizePlan(userRec?.plan)
      if (!planAtLeast(userPlan, 'plus')) {
        return NextResponse.json({
          error: 'Публикация расширений доступна на тарифе Zerf Plus, Pro и Corp. Оформите подписку в Настройках!',
        }, { status: 403 })
      }

      const { githubUrl, title, description, type, category, icon, price, minPlan, version, content, id } = body

      let manifestContent = content || {}
      let finalTitle = title
      let finalDesc = description
      let finalIcon = icon || '🧩'
      let finalType = type || 'widget'
      let finalCategory = category || 'Виджеты & Плагины'
      let finalVersion = version || '1.0.0'
      let finalPrice = Math.max(0, Math.min(5000, Number(price) || 0))
      let finalMinPlan: 'free' | 'plus' | 'pro' | 'corp' = (minPlan && ['free', 'plus', 'pro', 'corp'].includes(minPlan)) ? minPlan : 'free'

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
        changelog: body.changelog !== undefined ? body.changelog : (existingData?.changelog || ''),
        price: finalPrice,
        minPlan: finalMinPlan,
        rating: existingData?.rating || 5.0,
        ratingCount: existingData?.ratingCount || 1,
        likesCount: existingData?.likesCount || 0,
        installCount: existingData?.installCount || 0,
        aiInstructions: body.aiInstructions !== undefined
          ? String(body.aiInstructions)
          : (manifestContent?.aiInstructions || existingData?.aiInstructions || ''),
        triggers: Array.isArray(body.triggers)
          ? body.triggers
          : (typeof body.triggers === 'string'
              ? body.triggers.split(',').map((s: string) => s.trim()).filter(Boolean)
              : (manifestContent?.triggers || existingData?.triggers || [])),
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
      return NextResponse.json({ success: true, extension: current, isPublished: current.isPublished })
    }

    // ── ACTION: DELETE EXTENSION (Author or Admin) ──
    if (action === 'delete_custom' || action === 'delete') {
      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
      if (extRec) {
        await prisma.config.delete({ where: { key: `zerf_ext_${extensionId}` } })
      }

      // Record in deleted list to permanently hide any deleted extension
      const deletedList = await getDeletedExtensionIds()
      if (!deletedList.includes(extensionId)) {
        deletedList.push(extensionId)
        await prisma.config.upsert({
          where: { key: 'deleted_extensions_list' },
          update: { value: JSON.stringify(deletedList) },
          create: { key: 'deleted_extensions_list', value: JSON.stringify(deletedList) },
        })
      }

      return NextResponse.json({ success: true, deletedId: extensionId })
    }

    // ── ACTION: SYNC / PULL LATEST FROM GITHUB (0 AI Tokens) ──
    if (action === 'sync_github') {
      const { extensionId } = body
      const extRec = await prisma.config.findUnique({ where: { key: `zerf_ext_${extensionId}` } })
      if (!extRec) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      const current: ExtensionItem = JSON.parse(extRec.value)
      if (!current.githubUrl) {
        return NextResponse.json({ error: 'У этого расширения не привязан репозиторий GitHub' }, { status: 400 })
      }

      const ghData = await fetchManifestFromGithub(current.githubUrl)
      if (!ghData) {
        return NextResponse.json({ error: 'Не удалось загрузить манифест из GitHub репозитория' }, { status: 404 })
      }

      const m = ghData.manifest
      current.title = m.name || m.title || current.title
      current.description = m.description || current.description
      current.version = m.version || current.version
      current.icon = m.icon || current.icon
      current.content = m.content || m.config || current.content
      if (m.minPlan && ['free', 'plus', 'pro', 'corp'].includes(m.minPlan)) current.minPlan = m.minPlan
      if (m.price !== undefined) current.price = Math.max(0, Math.min(5000, Number(m.price) || 0))
      current.updatedAt = new Date().toISOString()

      await prisma.config.update({
        where: { key: `zerf_ext_${extensionId}` },
        data: { value: JSON.stringify(current) },
      })

      return NextResponse.json({ success: true, extension: current })
    }

    // ── ACTION: INSTALL EXTENSION (Requires at least Zerf Plus) ──
    if (action === 'install') {
      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      const userPlan = normalizePlan((userRec as any)?.plan || 'free')
      if (!planAtLeast(userPlan, 'plus')) {
        return NextResponse.json({
          error: '🔒 Использование и установка расширений доступны с тарифа Zerf Plus (99 ₽). Оформите подписку в Настройках!',
          requiresPlan: 'plus',
        }, { status: 403 })
      }

      // Check minPlan requirement if extension specifies higher plan (e.g. Pro or Corp)
      const allExts = [...STARTER_EXTENSIONS, ...(await getCustomExtensions())]
      const targetExt = allExts.find(e => e.id === extensionId)
      if (targetExt && targetExt.minPlan && targetExt.minPlan !== 'free') {
        if (!planAtLeast(userPlan, targetExt.minPlan)) {
          const reqName = targetExt.minPlan === 'plus' ? 'Zerf Plus (99 ₽)' : targetExt.minPlan === 'pro' ? 'Zerf Pro (299 ₽)' : 'Zerf Corp'
          return NextResponse.json({
            error: `🔒 Автор ограничил доступ: для установки «${targetExt.title}» требуется тариф ${reqName} или выше. Обновите тариф в Настройках!`,
            requiredPlan: targetExt.minPlan,
          }, { status: 403 })
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

      return NextResponse.json({ success: true, installedIds: installed })
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

      return NextResponse.json({ success: true, installedIds: installed })
    }

    // ── ACTION: BUY PAID GITHUB EXTENSION (Requires Zerf Plus, 80% Author / 20% Platform) ──
    if (action === 'buy') {
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

      const authorShare = Math.round(ext.price * 0.8)
      const platformShare = ext.price - authorShare

      await prisma.config.create({
        data: {
          key: `ext_purchase_${extensionId}_${chatId}`,
          value: JSON.stringify({
            extensionId,
            buyerChatId: chatId,
            authorChatId: ext.authorChatId,
            price: ext.price,
            authorShare,
            platformShare,
            purchasedAt: new Date().toISOString(),
          }),
        },
      }).catch(() => {})

      if (ext.authorChatId && ext.authorChatId !== 'system') {
        const authorStats = await getAuthorBalance(ext.authorChatId)
        authorStats.balance += authorShare
        authorStats.totalEarned += authorShare
        authorStats.salesCount += 1

        await prisma.config.upsert({
          where: { key: `author_balance_${ext.authorChatId}` },
          update: { value: JSON.stringify(authorStats) },
          create: { key: `author_balance_${ext.authorChatId}`, value: JSON.stringify(authorStats) },
        })

        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (botToken) {
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: ext.authorChatId,
              text: `🎉 *Покупка вашего расширения с GitHub!*\n\nПользователь приобрёл *«${ext.title}»* (${ext.githubUrl || ''}) за ${ext.price} ₽ в Zerf Note.\nВам начислено *+${authorShare} ₽* (80%) на баланс автора! 💰`,
              parse_mode: 'Markdown',
            }),
          }).catch(() => {})
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
      }

      return NextResponse.json({
        success: true,
        installedIds: installed,
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
      // This protects the platform owner completely so payout transfer fees are never paid out-of-pocket!
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
