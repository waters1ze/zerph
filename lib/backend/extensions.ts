import { prisma } from '@/lib/backend/prisma'
import { isUserAdmin } from '@/lib/backend/auth'

export interface ExtensionCommand {
  cmd: string
  description: string
}

export interface ExtensionSkill {
  name: string
  description: string
  action?: string
}

export interface ExtensionItem {
  id: string
  title: string
  version?: string
  description: string
  type: 'widget' | 'template' | 'theme' | 'integration' | 'preset' | 'prompt'
  category: string
  icon: string
  githubUrl: string
  manifestUrl?: string
  hostingUrl?: string
  selfHosted?: boolean
  authorChatId: string
  authorName: string
  authorGithub?: string
  authorAvatar?: string
  price: number // 0 = free, > 0 = price in RUB
  minPlan?: 'free' | 'plus' | 'pro' | 'corp'
  isOfficial?: boolean
  isPublished?: boolean // false = Draft/Unpublished, true = Live in Store Catalog
  isDisabledByOwner?: boolean
  isRunnable?: boolean // true if extension has an interactive app/runner window (e.g. Entropy Search)
  changelog?: string // Release notes / changelog
  rating: number
  ratingCount: number
  likesCount: number
  installCount: number
  aiInstructions?: string
  triggers?: string[]
  aiSkills?: ExtensionSkill[]
  content: any
  createdAt: string
  updatedAt: string
}

export const STARTER_EXTENSIONS: ExtensionItem[] = [
  {
    id: 'ext_entropy_search',
    title: 'Entropy AI Search & Deep Research',
    version: '1.0.0',
    description: 'Интеллектуальный поисково-аналитический движок инсайтов в стиле Perplexity: глубокий синтез фактов, цитаты со ссылками на проверенные источники [1][2] и авто-экспорт в заметки.',
    type: 'widget',
    category: 'Виджеты & Фокус',
    icon: '🔮',
    githubUrl: 'https://github.com/waters1ze/Entropy',
    authorChatId: 'system',
    authorName: 'Zerf Official',
    authorGithub: 'zerf-official',
    price: 0,
    minPlan: 'plus',
    isOfficial: true,
    isPublished: true,
    isRunnable: true,
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
  {
    id: 'ext_zerfic_live',
    title: 'Zerfic Live: Голосовой компаньон',
    version: '1.0.0',
    description: 'Полноценный живой разговорный ИИ-собеседник с мужским голосом Зерфика, живой речью, анимациями (сидит на стуле, машет руками), жестами и интеграцией во все ваши дела.',
    type: 'widget',
    category: 'Виджеты & Фокус',
    icon: '🎙️',
    githubUrl: 'https://github.com/waters1ze/zerfic-live',
    authorChatId: 'system',
    authorName: 'Zerf Official',
    authorGithub: 'waters1ze',
    price: 0,
    minPlan: 'plus',
    isOfficial: true,
    isPublished: true,
    isRunnable: true,
    changelog: 'Релиз v1.0.0: Мужские голоса Зерфика, анимация сидения на стуле, жесты, Push-to-Talk и ответы голосовыми в Telegram-боте.',
    rating: 5.0,
    ratingCount: 0,
    likesCount: 0,
    installCount: 0,
    aiInstructions: 'Когда пользователь обращается к Зерфику или запускает Zerfic Live — веди живой разговор от мужского лица, используй естественные междометия («а...», «мм...», «кстати»), проявляй дружелюбие и помогай по задачам и планам.',
    triggers: ['/live', '/zerfic', 'зерфик', 'поговори со мной', 'зерфик лайв', 'zerfic live'],
    aiSkills: [
      {
        name: 'Zerfic Live Conversation',
        description: 'Живой двусторонний голосовой диалог с мужским голосом Зерфика, рассуждениями и эмоциями',
        action: 'zerfic_live_chat',
      },
    ],
    content: {
      engine: 'zerfic_live_voice',
      voices: [
        { id: 'zerfik_original', name: 'Зерфик (Фирменный)', gender: 'male', desc: 'Задорный, молодой, живой тембр' },
        { id: 'zerfik_intellect', name: 'Зерфик (Интеллект)', gender: 'male', desc: 'Вдумчивый, глубокий мужской голос' },
        { id: 'zerfik_coach', name: 'Зерфик (Драйв / Коуч)', gender: 'male', desc: 'Бодрый, мотивирующий тембр' },
      ],
      features: ['voice_synthesis', 'gestures', 'mascot_animations', 'telegram_voice_replies'],
    },
    createdAt: '2026-08-19T18:00:00Z',
    updatedAt: '2026-08-19T18:00:00Z',
  },
]

export async function getDeletedExtensionIds(): Promise<string[]> {
  try {
    const row = await prisma.config.findUnique({ where: { key: 'deleted_extensions_list' } })
    return row?.value ? JSON.parse(row.value) : []
  } catch {
    return []
  }
}

export async function getCustomExtensions(): Promise<ExtensionItem[]> {
  try {
    const rows = await prisma.config.findMany({
      where: { key: { startsWith: 'zerf_ext_' } },
    })
    return rows.map(r => JSON.parse(r.value) as ExtensionItem)
  } catch {
    return []
  }
}

export async function getUserInstalledExtensions(chatId: string | number): Promise<string[]> {
  try {
    const cid = String(chatId)
    const row = await prisma.config.findUnique({
      where: { key: `user_extensions_${cid}` },
    })
    if (row?.value) {
      return JSON.parse(row.value)
    }
    return []
  } catch {
    return []
  }
}

export async function getUserEnabledExtensions(chatId: string | number): Promise<string[]> {
  try {
    const cid = String(chatId)
    const row = await prisma.config.findUnique({
      where: { key: `user_enabled_extensions_${cid}` },
    })
    if (row?.value) {
      return JSON.parse(row.value)
    }
    return await getUserInstalledExtensions(cid)
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

export async function getExtensionById(extensionId: string): Promise<ExtensionItem | null> {
  const catalog = await loadExtensionsCatalog()
  return catalog.find(e => e.id === extensionId) || null
}

/**
 * Compiles AI instructions, custom prompts, and triggers from all ENABLED extensions
 * installed by a specific user (for Telegram bot, Siri shortcuts, Web AI chat, Voice, etc.)
 */
export async function getUserExtensionsAIContext(chatId: string | number): Promise<string> {
  try {
    const cid = String(chatId)
    const enabledIds = await getUserEnabledExtensions(cid)
    if (!enabledIds || enabledIds.length === 0) return ''

    const catalog = await loadExtensionsCatalog()
    const activeExts = catalog.filter(e => enabledIds.includes(e.id))
    if (activeExts.length === 0) return ''

    const instructions: string[] = []
    for (const ext of activeExts) {
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
