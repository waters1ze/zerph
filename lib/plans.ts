/**
 * Subscription plans & limits — single source of truth (pure data, safe for client import).
 *
 * Tiers: free | plus (99 ₽/мес) | pro (299 ₽/мес) | corp (по запросу)
 * Legacy DB values are normalized: premium -> plus, unlimited -> corp.
 *
 * To add or change a plan, edit PLANS / PLAN_CATALOG below — every
 * enforcement point (voice, Siri, photo, goals, reminders, shared items,
 * news opt-out, payments) reads from here.
 */

export type PlanId = 'free' | 'plus' | 'pro' | 'corp'

export const PLAN_RANK: Record<PlanId, number> = { free: 0, plus: 1, pro: 2, corp: 3 }

const LEGACY_PLAN_MAP: Record<string, PlanId> = { premium: 'plus', unlimited: 'corp' }

export function normalizePlan(raw: string | null | undefined): PlanId {
  const v = (raw || 'free').toLowerCase()
  if (v in PLAN_RANK) return v as PlanId
  if (v in LEGACY_PLAN_MAP) return LEGACY_PLAN_MAP[v]
  return 'free'
}

/** True when the (raw) plan is at least `min` tier. */
export function planAtLeast(raw: string | null | undefined, min: PlanId): boolean {
  return PLAN_RANK[normalizePlan(raw)] >= PLAN_RANK[min]
}

export const PLAN_NAMES_RU: Record<PlanId, string> = {
  free: 'Базовый',
  plus: 'Plus',
  pro: 'Pro',
  corp: 'Corp',
}

/** Infinity marker for readable limit definitions. */
export const UNLIMITED = Number.POSITIVE_INFINITY

export interface PlanLimits {
  /** Maximum active stored notes in user account */
  maxStoredNotes: number
  /** Maximum active non-holiday/non-birthday reminders simultaneously */
  maxActiveReminders: number
  /** Maximum installed / active extensions */
  maxExtensions: number
  /** Lifetime Siri / Apple Shortcuts requests */
  siriLifetimeRequests: number
  /** Total voice recognition seconds per day */
  voiceSecondsPerDay: number
  /** Photo (OCR) recognitions per day — 0 = feature locked */
  photosPerDay: number
  /** Goals created per day */
  goalsPerDay: number
  /** AI chat messages per day */
  chatMessagesPerDay: number
  /** CLI requests / mutations per day */
  cliRequestsPerDay: number
  /** Shared tasks/reminders with friends require one plus+ participant */
  sharedRequiresPlan: PlanId | null
  /** Can disable daily news digests (morning/evening) */
  canDisableNews: boolean
}

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    maxStoredNotes: 20,
    maxActiveReminders: 10,
    maxExtensions: 5, // До 5 расширений на Базовом тарифе
    siriLifetimeRequests: 10,
    voiceSecondsPerDay: 90, // 1 мин 30 сек в день
    photosPerDay: 0,
    goalsPerDay: 5,
    chatMessagesPerDay: 10,
    cliRequestsPerDay: 0, // CLI требует Plus+
    sharedRequiresPlan: 'plus',
    canDisableNews: false,
  },
  plus: {
    maxStoredNotes: 250,
    maxActiveReminders: 100,
    maxExtensions: 10, // До 10 расширений на Plus
    siriLifetimeRequests: 250,
    voiceSecondsPerDay: 900, // 15 минут в день
    photosPerDay: 25,
    goalsPerDay: 25,
    chatMessagesPerDay: 150,
    cliRequestsPerDay: 300,
    sharedRequiresPlan: null,
    canDisableNews: true,
  },
  pro: {
    maxStoredNotes: 5000,
    maxActiveReminders: 1000,
    maxExtensions: 50, // До 50 расширений на Pro
    siriLifetimeRequests: 5000,
    voiceSecondsPerDay: 7200, // 2 часа голоса в день
    photosPerDay: 200,
    goalsPerDay: 100,
    chatMessagesPerDay: 1000, // 1000 запросов к ИИ в день
    cliRequestsPerDay: 1500, // 1500 запросов в терминале
    sharedRequiresPlan: null,
    canDisableNews: true,
  },
  corp: {
    maxStoredNotes: 25000,
    maxActiveReminders: 5000,
    maxExtensions: UNLIMITED, // Безлимитно на Corp
    siriLifetimeRequests: 25000,
    voiceSecondsPerDay: 28800, // 8 часов голоса в день (на команду из ~4 человек)
    photosPerDay: 500,
    goalsPerDay: 500,
    chatMessagesPerDay: 4000, // 4000 запросов к ИИ в день
    cliRequestsPerDay: 8000, // 8000 CLI операций в день
    sharedRequiresPlan: null,
    canDisableNews: true,
  },
}

export interface PlanCatalogEntry {
  id: PlanId
  name: string
  aiModel: string
  priceMonthly: number | null // null = by request
  priceYearly: number | null
  tagline: string
  features: string[]
}

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    id: 'free',
    name: 'Базовый',
    aiModel: 'GPT-OSS 20B / Llama 3.1 8B',
    priceMonthly: 0,
    priceYearly: 0,
    tagline: 'Начните пользоваться прямо сейчас',
    features: [
      '🤖 ИИ: GPT-OSS 20B / Llama 3.1 8B',
      '🧩 До 5 активных расширений и виджетов',
      'До 20 заметок в аккаунте',
      'До 10 активных напоминаний',
      '10 запросов Siri за всё время',
      '🎙 Голос: 1:30 мин в день',
      '💬 ИИ-сообщения: 10 в день',
      '🎯 5 целей в день',
      '👥 Общие задачи с друзьями (нужен Plus у одного)',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    aiModel: 'Qwen 3.6 27B',
    priceMonthly: 99,
    priceYearly: 1009,
    tagline: 'Для ежедневной продуктивности',
    features: [
      '🤖 ИИ: Qwen 3.6 27B (продвинутая логика)',
      '🧩 До 10 активных расширений и виджетов',
      '250 заметок в аккаунте',
      '100 активных напоминаний',
      '250 запросов Siri',
      '🎙 Голос: 15 минут в день',
      '📷 Vision OCR (распознавание фото/расписаний): 25 в день',
      '💬 ИИ-сообщения: 150 в день',
      '💻 Zerf CLI: 300 запросов в день',
      '🎯 25 целей в день',
      '🚫 Отключение дайджестов новостей',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    aiModel: 'GPT-OSS 120B Flagship',
    priceMonthly: 299,
    priceYearly: 3049,
    tagline: 'Максимальный интеллект и глубокая автоматизация',
    features: [
      '🧠 Флагманский ИИ: OpenAI GPT-OSS 120B',
      '🧩 До 50 активных расширений и виджетов',
      '🔌 Подключение своей нейросети по API (OpenAI, Claude, Gemini, Ollama)',
      '💻 Создание и запуск расширений через Local CLI и Студию',
      '🎛 Кастомизация моделей под каждую задачу (Siri, чат, аналитика)',
      '5 000 заметок в аккаунте',
      '1 000 активных напоминаний',
      '5 000 запросов Siri',
      '🎙 Голос: 2 часа (120 мин) в день',
      '📷 Vision OCR: 200 распознаваний в день',
      '💬 ИИ-сообщения: 1 000 в день',
      '💻 Zerf CLI: 1 500 запросов в день',
      '🎯 100 целей в день',
      '⚡ Smart Reschedule: авто-перепланирование дня',
      '📊 Еженедельная персональная AI-аналитика продуктивности',
    ],
  },
  {
    id: 'corp',
    name: 'Corp',
    aiModel: 'GPT-OSS 120B Flagship',
    priceMonthly: null,
    priceYearly: null,
    tagline: 'Для команд и организаций — всё без ограничений',
    features: [
      '🧠 Флагманский ИИ: GPT-OSS 120B + Local CLI (agy, claude, gemini, ollama)',
      '🧩 Безлимитные расширения и виджеты (Unlimited)',
      '⚡ Наивысший приоритет ИИ-запросов (обработка без очередей над всеми пользователями)',
      '🤖 Персональный ИИ-менеджер и выделенная поддержка',
      '25 000 заметок в аккаунте',
      '5 000 активных напоминаний',
      '25 000 запросов Siri',
      '🎙 Голос: 8 часов (480 мин) в день',
      '💬 ИИ-сообщения: 4 000 в день',
      '💻 Zerf CLI: 8 000 операций в день',
      '🏢 Неограниченные командные пространства (Workspaces)',
      '👥 Роли участников и контроль доступов',
      '📁 Командный трекинг эффективности и KPI',
    ],
  },
]

/** Payment products: plan + period -> price, days, YooMoney label suffix. */
export interface PaymentProduct {
  plan: PlanId
  days: number
  minAmount: number
  labelSuffix: string
}

export const PAYMENT_PRODUCTS: PaymentProduct[] = [
  { plan: 'plus', days: 30, minAmount: 95, labelSuffix: 'plus30' },
  { plan: 'plus', days: 365, minAmount: 950, labelSuffix: 'plus365' },
  { plan: 'pro', days: 30, minAmount: 285, labelSuffix: 'pro30' },
  { plan: 'pro', days: 365, minAmount: 2900, labelSuffix: 'pro365' },
]

/** Legacy labels kept working after the tariff migration. */
const LEGACY_LABEL_MAP: Record<string, PaymentProduct> = {
  '30': { plan: 'plus', days: 30, minAmount: 95, labelSuffix: '30' },
  '365': { plan: 'plus', days: 365, minAmount: 950, labelSuffix: '365' },
}

export function findPaymentProduct(label: string): (PaymentProduct & { isGift?: boolean; buyerChatId?: string }) | null {
  // Support gift label: gift_<chatId>_<suffix>
  const isGift = label.startsWith('gift_')
  const cleanLabel = isGift ? label.replace(/^gift_/, '') : label

  const m = cleanLabel.match(/^(\d{3,20})_(.+)$/)
  if (!m) return null
  const buyerChatId = m[1]
  const suffix = m[2]
  const product = PAYMENT_PRODUCTS.find(p => p.labelSuffix === suffix) || LEGACY_LABEL_MAP[suffix]
  if (!product) return null

  return { ...product, isGift, buyerChatId }
}

