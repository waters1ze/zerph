/**
 * GET & POST /api/extensions — Extensions Store, Plugin Creation, Installation & Monetization (80/20 split)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { planAtLeast, normalizePlan } from '@/lib/backend/plans'
import crypto from 'crypto'

export interface ExtensionItem {
  id: string
  title: string
  description: string
  type: 'prompt' | 'template' | 'theme' | 'widget'
  category: string
  icon: string
  authorChatId: string
  authorName: string
  price: number // 0 = free, > 0 = price in RUB
  isOfficial?: boolean
  rating: number
  ratingCount: number
  installCount: number
  content: Record<string, any>
  createdAt: string
  updatedAt: string
}

// Built-in starter extensions
const STARTER_EXTENSIONS: ExtensionItem[] = [
  {
    id: 'ext_code_reviewer',
    title: 'Senior Code Reviewer & Refactor AI',
    description: 'Продвинутый промпт для глубокого аудита кода, поиска уязвимостей и оптимизации архитектуры.',
    type: 'prompt',
    category: 'Разработка & AI',
    icon: '💻',
    authorChatId: 'system',
    authorName: 'Zerf Core Team',
    price: 0,
    isOfficial: true,
    rating: 5.0,
    ratingCount: 142,
    installCount: 890,
    content: {
      systemPrompt: 'Ты — ведущий Senior Software Architect. Проводишь строгий аудит присланного кода по стандартам Clean Code, SOLID и OWASP. Указывай конкретные строки, баги и предлагай оптимизированный вариант с пояснениями.',
      sampleInput: 'Проверь мой компонент React на утечки памяти и производительность...',
    },
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 'ext_okr_template',
    title: 'Квартальный OKR & KPI Трекер',
    description: 'Готовая структура для декомпозиции глобальных целей на 3 ключевых результата (Key Results) и спринты.',
    type: 'template',
    category: 'Продуктивность',
    icon: '🎯',
    authorChatId: 'system',
    authorName: 'Zerf Core Team',
    price: 0,
    isOfficial: true,
    rating: 4.9,
    ratingCount: 98,
    installCount: 620,
    content: {
      templateType: 'goal',
      milestones: [
        { title: 'Определить 3 ключевые метрики (KR)', weight: 30 },
        { title: 'Запустить MVP и собрать первый фидбек', weight: 40 },
        { title: 'Достичь целевого значения KPI', weight: 30 },
      ],
    },
    createdAt: '2026-08-05T12:00:00Z',
    updatedAt: '2026-08-05T12:00:00Z',
  },
  {
    id: 'ext_cyberpunk_theme',
    title: 'Cyberpunk Neon Glass Theme',
    description: 'Эффектная темная тема с неоновыми изумрудными акцентами, матовым стеклом и улучшенным контрастом.',
    type: 'theme',
    category: 'Оформление',
    icon: '🌌',
    authorChatId: 'system',
    authorName: 'Zerf Design Lab',
    price: 0,
    isOfficial: true,
    rating: 4.8,
    ratingCount: 215,
    installCount: 1450,
    content: {
      primaryColor: '#10b981',
      accentColor: '#06b6d4',
      bgStyle: 'neon_glass',
    },
    createdAt: '2026-08-10T14:00:00Z',
    updatedAt: '2026-08-10T14:00:00Z',
  },
  {
    id: 'ext_water_tracker',
    title: 'Smart Hydration & Energy Widget',
    description: 'Интерактивный виджет водного баланса и энергии с напоминаниями выпить стакан воды каждые 2 часа.',
    type: 'widget',
    category: 'Здоровье & Фокус',
    icon: '💧',
    authorChatId: 'system',
    authorName: 'Health & Productivity Co.',
    price: 0,
    isOfficial: true,
    rating: 4.9,
    ratingCount: 76,
    installCount: 410,
    content: {
      widgetType: 'hydration',
      dailyGoalMl: 2500,
      intervalHours: 2,
    },
    createdAt: '2026-08-12T16:00:00Z',
    updatedAt: '2026-08-12T16:00:00Z',
  },
  {
    id: 'ext_startup_launch',
    title: 'SaaS Launch Checklist: От идеи до первых $1k MRR',
    description: 'Премиальный пошаговый план запуска цифрового продукта: 45 проверенных чекпоинтов, шаблоны CustDev и юридические чек-листы.',
    type: 'template',
    category: 'Бизнес & Стартапы',
    icon: '🚀',
    authorChatId: '6136950061',
    authorName: 'Alexander (SaaS Founder)',
    price: 79,
    rating: 5.0,
    ratingCount: 34,
    installCount: 88,
    content: {
      templateType: 'project',
      tasksCount: 45,
      stages: ['CustDev & Валидация', 'MVP за 10 дней', 'Маркетинг & Каналы', 'Первые продажи'],
    },
    createdAt: '2026-08-14T11:00:00Z',
    updatedAt: '2026-08-14T11:00:00Z',
  },
  {
    id: 'ext_deepwork_master',
    title: 'Deep Work AI Master Coach',
    description: 'Специализированная нейросетевая модель-наставник по технике Cal Newport: блокировка прокрастинации, аудит отвлечений и спринты.',
    type: 'prompt',
    category: 'Развитие & AI',
    icon: '🧠',
    authorChatId: '5078516086',
    authorName: 'Daria Pro',
    price: 49,
    rating: 4.9,
    ratingCount: 29,
    installCount: 65,
    content: {
      systemPrompt: 'Ты — строгий коуч по глубокой работе (Deep Work). Анализируй рабочий день, отсекай псевдо-занятость и структурируй 90-минутные интервалы непрерывной фокусировки.',
    },
    createdAt: '2026-08-15T09:00:00Z',
    updatedAt: '2026-08-15T09:00:00Z',
  },
]

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

async function getUserInstalledExtensions(chatId: string): Promise<string[]> {
  try {
    const row = await prisma.config.findUnique({
      where: { key: `user_extensions_${chatId}` },
    })
    return row?.value ? JSON.parse(row.value) : []
  } catch {
    return []
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

    const customItems = await getCustomExtensions()
    // Merge starter and custom items (custom items override starters if same ID)
    const allMap = new Map<string, ExtensionItem>()
    STARTER_EXTENSIONS.forEach(e => allMap.set(e.id, e))
    customItems.forEach(e => allMap.set(e.id, e))
    const catalog = Array.from(allMap.values())

    let installedIds: string[] = []
    let authorStats = { balance: 0, totalEarned: 0, salesCount: 0 }
    let userPlan = 'free'

    if (chatId) {
      installedIds = await getUserInstalledExtensions(chatId)
      authorStats = await getAuthorBalance(chatId)
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
      userPlan,
      canCreateExtensions: planAtLeast(userPlan, 'plus'),
      authorStats,
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

    const body = await req.json()
    const { action } = body

    // ── ACTION: PUBLISH / CREATE EXTENSION ──
    if (action === 'publish') {
      const userRec = await prisma.telegramChat.findUnique({
        where: { chatId: BigInt(chatId) },
      })
      const userPlan = normalizePlan(userRec?.plan)
      if (!planAtLeast(userPlan, 'plus')) {
        return NextResponse.json({
          error: 'Создание и публикация расширений доступна на тарифе Zerf Plus, Pro и Corp. Оформите подписку в Настройках!',
        }, { status: 403 })
      }

      const { title, description, type, category, icon, price, content, id } = body
      if (!title || !description || !type) {
        return NextResponse.json({ error: 'Заполните название, описание и тип расширения' }, { status: 400 })
      }

      const numPrice = Math.max(0, Math.min(5000, Number(price) || 0))
      const extId = id || `ext_usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`

      const authorName = [userRec?.firstName, userRec?.lastName].filter(Boolean).join(' ') || userRec?.firstName || 'Автор Zerf'

      const existingRecord = await prisma.config.findUnique({ where: { key: `zerf_ext_${extId}` } })
      const existingData = existingRecord?.value ? JSON.parse(existingRecord.value) : null

      const extItem: ExtensionItem = {
        id: extId,
        title: title.trim().slice(0, 100),
        description: description.trim().slice(0, 500),
        type: type as any,
        category: (category || 'Кастомные').trim().slice(0, 40),
        icon: icon || '🧩',
        authorChatId: chatId,
        authorName,
        price: numPrice,
        rating: existingData?.rating || 5.0,
        ratingCount: existingData?.ratingCount || 1,
        installCount: existingData?.installCount || 0,
        content: content || {},
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

    // ── ACTION: INSTALL EXTENSION ──
    if (action === 'install') {
      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      let installed = await getUserInstalledExtensions(chatId)
      if (!installed.includes(extensionId)) {
        installed.push(extensionId)
        await prisma.config.upsert({
          where: { key: `user_extensions_${chatId}` },
          update: { value: JSON.stringify(installed) },
          create: { key: `user_extensions_${chatId}`, value: JSON.stringify(installed) },
        })

        // Increment install count on custom extension if exists
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

    // ── ACTION: BUY PAID EXTENSION (80% Author / 20% Platform) ──
    if (action === 'buy') {
      const { extensionId } = body
      if (!extensionId) return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })

      const allItems = [...STARTER_EXTENSIONS, ...(await getCustomExtensions())]
      const ext = allItems.find(e => e.id === extensionId)
      if (!ext) return NextResponse.json({ error: 'Расширение не найдено' }, { status: 404 })

      const authorShare = Math.round(ext.price * 0.8) // 80% to creator
      const platformShare = ext.price - authorShare // 20% platform commission

      // Record purchase in DB
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

      // Credit author balance
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

        // Notify author via Telegram
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (botToken) {
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: ext.authorChatId,
              text: `🎉 *Покупка вашего расширения!*\n\nПользователь приобрел ваше расширение *«${ext.title}»* за ${ext.price} ₽.\nВам начислено *+${authorShare} ₽* (80%) на баланс автора! 💰\n\nПроверить баланс: откройте раздел «Расширения» на сайте.`,
              parse_mode: 'Markdown',
            }),
          }).catch(() => {})
        }
      }

      // Auto-install extension for buyer
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

    // ── ACTION: DELETE MY EXTENSION ──
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

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  } catch (err: unknown) {
    console.error('Extensions POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
