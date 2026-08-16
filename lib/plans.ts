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
  /** Notes creation per day */
  notesPerDay: number
  /** Reminder notifications pushed per day */
  remindersPerDay: number
  /** Siri / Apple Shortcuts requests per day */
  siriRequestsPerDay: number
  /** Total voice recognition seconds per day */
  voiceSecondsPerDay: number
  /** Photo (OCR) recognitions per day — 0 = feature locked */
  photosPerDay: number
  /** Goals created per day */
  goalsPerDay: number
  /** AI chat messages per day */
  chatMessagesPerDay: number
  /** Shared tasks/reminders with friends require one plus+ participant */
  sharedRequiresPlan: PlanId | null
  /** Can disable daily news digests (morning/evening) */
  canDisableNews: boolean
}

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    notesPerDay: UNLIMITED,
    remindersPerDay: 5,
    siriRequestsPerDay: 10,
    voiceSecondsPerDay: 60,
    photosPerDay: 0,
    goalsPerDay: 5,
    chatMessagesPerDay: 10,
    sharedRequiresPlan: 'plus',
    canDisableNews: false,
  },
  plus: {
    notesPerDay: UNLIMITED,
    remindersPerDay: UNLIMITED,
    siriRequestsPerDay: UNLIMITED,
    voiceSecondsPerDay: 300,
    photosPerDay: 10,
    goalsPerDay: UNLIMITED,
    chatMessagesPerDay: UNLIMITED,
    sharedRequiresPlan: null,
    canDisableNews: true,
  },
  pro: {
    notesPerDay: UNLIMITED,
    remindersPerDay: UNLIMITED,
    siriRequestsPerDay: UNLIMITED,
    voiceSecondsPerDay: UNLIMITED,
    photosPerDay: UNLIMITED,
    goalsPerDay: UNLIMITED,
    chatMessagesPerDay: UNLIMITED,
    sharedRequiresPlan: null,
    canDisableNews: true,
  },
  corp: {
    notesPerDay: UNLIMITED,
    remindersPerDay: UNLIMITED,
    siriRequestsPerDay: UNLIMITED,
    voiceSecondsPerDay: UNLIMITED,
    photosPerDay: UNLIMITED,
    goalsPerDay: UNLIMITED,
    chatMessagesPerDay: UNLIMITED,
    sharedRequiresPlan: null,
    canDisableNews: true,
  },
}

export interface PlanCatalogEntry {
  id: PlanId
  name: string
  priceMonthly: number | null // null = by request
  priceYearly: number | null
  tagline: string
  features: string[]
}

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    id: 'free',
    name: 'Базовый',
    priceMonthly: 0,
    priceYearly: 0,
    tagline: 'Начните пользоваться прямо сейчас',
    features: [
      '∞ заметок',
      '5 напоминаний в день',
      '10 запросов Siri в день',
      'Голосовое распознавание: 1 мин в день',
      '5 целей в день',
      'Общие задачи: нужен Plus у одного из участников',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    priceMonthly: 99,
    priceYearly: 1009,
    tagline: 'Для ежедневной продуктивности',
    features: [
      '∞ заметок',
      '∞ напоминаний',
      '∞ запросов Siri',
      'Голос: до 5 минут в день',
      'Распознавание по фото: 10 в день',
      '∞ целей в день',
      'Отключение новостных сводок',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 299,
    priceYearly: 3049,
    tagline: 'Полная свобода без лимитов ввода',
    features: [
      'Всё из Plus',
      '∞ голосовых распознаваний',
      '∞ распознаваний по фото',
    ],
  },
  {
    id: 'corp',
    name: 'Corp',
    priceMonthly: null,
    priceYearly: null,
    tagline: 'Для команд — всё безлимитно',
    features: ['Все возможности без ограничений', 'Тариф по запросу'],
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

