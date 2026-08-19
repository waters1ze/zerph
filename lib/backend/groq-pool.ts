/**
 * Zerf AI — High-Availability Groq API Key Pool & Rate-Limit Rotator
 * 
 * Capabilities:
 * - Automatically parses keys from:
 *   - GROQ_API_KEY (single or comma/space/semicolon/newline separated list of keys: gsk_1,gsk_2,...)
 *   - GROQ_API_KEYS (comma, newline, semicolon, or space separated)
 *   - GROQ_API_KEY_1 .. GROQ_API_KEY_20, GROQ_KEY_1 .. GROQ_KEY_20
 *   - Dynamic scan of all process.env matching GROQ_
 * - Round-robin request distribution across all healthy keys
 * - 429 Too Many Requests automatic detection with 60s cooldown and instant retry on next key
 * - Seamless fallback: Groq Multi-Key/Multi-Model -> Hugging Face Router Serverless Pool -> OpenAI (if set)
 * - Automatic model sanitization and normalization (maps legacy models like llama-3.3-70b-versatile to current Groq flagship)
 */

import { GROQ_CHAT_MODEL, GROQ_WHISPER_MODEL } from '@/lib/config'
import { normalizePlan } from '@/lib/plans'

export type AiTaskKind = 'chat' | 'parser' | 'goals' | 'reschedule' | 'analytics' | 'voice' | 'siri' | 'extensions'

export interface GroqModelMeta {
  id: string
  name: string
  paramsBillions: number
  category: 'production' | 'preview' | 'systems' | 'audio' | 'guard'
  minTier: 'free' | 'plus' | 'pro' | 'corp'
  desc: string
  speedTps?: number
  contextTokens?: number
  maxCompletionTokens?: number
  isGuard?: boolean
  isAudio?: boolean
  isExcluded?: boolean // e.g. very high price non-chat models
}

/**
 * Verified Groq model registry matching official Groq documentation
 */
export const VERIFIED_GROQ_MODELS: GroqModelMeta[] = [
  // ── Systems & Compound (Primary for Free & Plus) ──
  {
    id: 'groq/compound',
    name: 'Groq Compound',
    paramsBillions: 70,
    category: 'systems',
    minTier: 'free',
    desc: 'Комплексная система с авто-роутингом и оркестрацией инструментов (450 T/s, 131K контекст)',
    speedTps: 450,
    contextTokens: 131072,
    maxCompletionTokens: 8192,
  },
  {
    id: 'groq/compound-mini',
    name: 'Groq Compound Mini',
    paramsBillions: 20,
    category: 'systems',
    minTier: 'free',
    desc: 'Компактная сверхбыстрая система оркестрации инструментов (450 T/s, 131K контекст)',
    speedTps: 450,
    contextTokens: 131072,
    maxCompletionTokens: 8192,
  },

  // ── Cheap & Guard Models for Free Tier ──
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT OSS 20B',
    paramsBillions: 20,
    category: 'production',
    minTier: 'free',
    desc: 'Сверхбыстрый отклик (1000 T/s, 131K контекст), чистый русский язык, мгновенная обработка заметок и Siri',
    speedTps: 1000,
    contextTokens: 131072,
    maxCompletionTokens: 65536,
  },
  {
    id: 'meta-llama/llama-prompt-guard-2-22m',
    name: 'Prompt Guard 2 22M',
    paramsBillions: 0.022,
    category: 'guard',
    minTier: 'free',
    desc: 'Ультра-легковесная базовая модель Meta для фильтрации и быстрых команд ($0.03/1M)',
    speedTps: 1000,
    contextTokens: 512,
    isGuard: true,
    isExcluded: true,
  },
  {
    id: 'meta-llama/llama-prompt-guard-2-86m',
    name: 'Prompt Guard 2 86M',
    paramsBillions: 0.086,
    category: 'guard',
    minTier: 'free',
    desc: 'Компактная модель Meta ($0.04/1M) для базовой классификации',
    speedTps: 1000,
    contextTokens: 512,
    isGuard: true,
    isExcluded: true,
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    paramsBillions: 8,
    category: 'production',
    minTier: 'free',
    desc: 'Мгновенный отклик для базовых команд и заметок',
    speedTps: 700,
    contextTokens: 128000,
  },
  {
    id: 'openai/gpt-oss-safeguard-20b',
    name: 'Safety GPT OSS 20B',
    paramsBillions: 20,
    category: 'preview',
    minTier: 'free',
    desc: 'Безопасная скоростная 20B модель (1000 T/s, 131K контекст)',
    speedTps: 1000,
    contextTokens: 131072,
    maxCompletionTokens: 65536,
  },

  // ── Plus Models (up to 70B) ──
  {
    id: 'qwen/qwen3.6-27b',
    name: 'Qwen 3.6 27B',
    paramsBillions: 27,
    category: 'preview',
    minTier: 'plus',
    desc: 'Продвинутая логика, структурирование задач и анализ расписания (500 T/s, 131K контекст)',
    speedTps: 500,
    contextTokens: 131072,
    maxCompletionTokens: 16384,
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    paramsBillions: 70,
    category: 'production',
    minTier: 'plus',
    desc: 'Универсальная мощная 70B модель для сложных текстов и рассуждений',
    speedTps: 300,
    contextTokens: 128000,
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 70B Reasoning',
    paramsBillions: 70,
    category: 'preview',
    minTier: 'plus',
    desc: 'Пошаговое глубокое рассуждение и аналитическое мышление',
    speedTps: 280,
    contextTokens: 128000,
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B MoE',
    paramsBillions: 47,
    category: 'production',
    minTier: 'plus',
    desc: 'MoE архитектура с длинным контекстом 32K',
    speedTps: 450,
    contextTokens: 32768,
  },

  // ── Pro Models (up to 120B) ──
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    paramsBillions: 120,
    category: 'production',
    minTier: 'pro',
    desc: 'Флагманский максимальный интеллект (500 T/s, 131K контекст) для масштабных проектов и сложной логики',
    speedTps: 500,
    contextTokens: 131072,
    maxCompletionTokens: 65536,
  },

  // ── Corp & Enterprise Models (Unlimited) ──
  {
    id: 'minimaxai/minimax-m2.7',
    name: 'MiniMax M2.7 Enterprise',
    paramsBillions: 150,
    category: 'preview',
    minTier: 'corp',
    desc: 'Сверхмощная Enterprise-модель для комплексных многоэтапных задач (260 T/s, 196K контекст)',
    speedTps: 260,
    contextTokens: 196608,
    maxCompletionTokens: 131072,
  },

  // ── Excluded expensive specialized preview models ──
  {
    id: 'canopylabs/orpheus-v1-english',
    name: 'Orpheus V1 English',
    paramsBillions: 14,
    category: 'preview',
    minTier: 'corp',
    desc: 'Специализированная модель ($22/1M)',
    isExcluded: true,
  },
  {
    id: 'canopylabs/orpheus-arabic-saudi',
    name: 'Orpheus Arabic Saudi',
    paramsBillions: 14,
    category: 'preview',
    minTier: 'corp',
    desc: 'Специализированная арабская модель ($40/1M)',
    isExcluded: true,
  },
]

// ── Self-Healing Dynamic Health Pool ──
interface ModelHealth {
  failedUntil: number
  failedCount: number
  lastError?: string
}

const modelHealthMap = new Map<string, ModelHealth>()

export function markModelFailed(modelId: string, error?: string, cooldownMinutes = 30) {
  const current = modelHealthMap.get(modelId) || { failedUntil: 0, failedCount: 0 }
  current.failedCount++
  current.failedUntil = Date.now() + cooldownMinutes * 60 * 1000
  current.lastError = error
  modelHealthMap.set(modelId, current)
  console.warn(`[GroqPool Health] Model ${modelId} marked unavailable (${error || 'Error'}). Skipping for ${cooldownMinutes}m.`)

  // Automatically trigger background refresh to discover active replacement models
  triggerBackgroundModelRefresh()
}

export function markModelSuccess(modelId: string) {
  if (modelHealthMap.has(modelId)) {
    modelHealthMap.delete(modelId)
  }
}

export function isModelHealthy(modelId: string): boolean {
  const health = modelHealthMap.get(modelId)
  if (!health) return true
  return Date.now() > health.failedUntil
}

export function extractParamsBillions(modelId: string, modelName?: string): number {
  const s = `${modelId} ${modelName || ''}`.toLowerCase()
  if (s.includes('120b')) return 120
  if (s.includes('70b') || s.includes('72b')) return 70
  if (s.includes('32b')) return 32
  if (s.includes('27b')) return 27
  if (s.includes('20b')) return 20
  if (s.includes('14b')) return 14
  if (s.includes('9b')) return 9
  if (s.includes('8b')) return 8
  if (s.includes('7b')) return 7
  if (s.includes('compound-mini')) return 20
  if (s.includes('compound')) return 70
  if (s.includes('minimax') || s.includes('m2.7')) return 150
  if (s.includes('guard-2-86m')) return 0.086
  if (s.includes('guard-2-22m')) return 0.022
  if (s.includes('whisper')) return 1.5

  const matchB = s.match(/(\d+(?:\.\d+)?)\s*b\b/i)
  if (matchB) return parseFloat(matchB[1])

  const matchM = s.match(/(\d+(?:\.\d+)?)\s*m\b/i)
  if (matchM) return parseFloat(matchM[1]) / 1000

  return 20
}

export function classifyTierByParams(billions: number, category?: string): 'free' | 'plus' | 'pro' | 'corp' {
  if (category === 'guard') return 'free'
  // Up to 20B -> Free
  if (billions <= 20) return 'free'
  // Up to 70B -> Plus
  if (billions <= 70) return 'plus'
  // Up to 120B -> Pro
  if (billions <= 120) return 'pro'
  // > 120B -> Corp
  return 'corp'
}

const MODEL_CACHE_TTL_MS = 60 * 60 * 1000 // Exactly 1 hour

let dynamicModelsCache: { timestamp: number; models: GroqModelMeta[] } | null = null
let isRefreshingBackground = false

function triggerBackgroundModelRefresh() {
  if (isRefreshingBackground) return
  isRefreshingBackground = true
  setTimeout(async () => {
    try {
      dynamicModelsCache = null
      await getLiveGroqModels()
    } catch (e) {
      console.warn('[GroqPool] Background model scan error:', e)
    } finally {
      isRefreshingBackground = false
    }
  }, 500)
}

/**
 * Dynamically queries Groq /openai/v1/models every 1 hour upon AI message requests
 * and automatically adapts to newly released models without any hardcoding.
 */
export async function getLiveGroqModels(apiKey?: string): Promise<GroqModelMeta[]> {
  const now = Date.now()
  if (dynamicModelsCache && (now - dynamicModelsCache.timestamp < MODEL_CACHE_TTL_MS)) {
    return dynamicModelsCache.models
  }

  const keys = groqPool.getOrderedHealthyKeys(apiKey)
  if (keys.length === 0) {
    return VERIFIED_GROQ_MODELS.filter(m => !m.isExcluded)
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${keys[0]}` },
      signal: AbortSignal.timeout(3500),
    })

    if (res.ok) {
      const data = await res.json()
      const rawList: any[] = Array.isArray(data.data) ? data.data : []
      const knownMap = new Map(VERIFIED_GROQ_MODELS.map(m => [m.id, m]))

      const discovered: GroqModelMeta[] = []
      for (const item of rawList) {
        const id = item.id
        if (!id || typeof id !== 'string') continue
        if (id.startsWith('whisper') || id.includes('audio')) continue
        if (id.includes('orpheus') || id.includes('arabic')) continue // Skip expensive specialized preview models

        const existing = knownMap.get(id)
        if (existing && !existing.isExcluded) {
          discovered.push(existing)
        } else {
          // Dynamic auto-adaptation for new Groq models!
          const billions = extractParamsBillions(id)
          const minTier = classifyTierByParams(billions)
          discovered.push({
            id,
            name: id.split('/').pop()?.replace(/[-_]/g, ' ').toUpperCase() || id,
            paramsBillions: billions,
            category: 'production',
            minTier,
            desc: `Автоматически подключенная модель Groq (${billions}B параметров, доступ с тарифа ${minTier.toUpperCase()})`,
            contextTokens: item.context_window || 131072,
          })
        }
      }

      // Ensure verified core models are present if not excluded
      for (const vm of VERIFIED_GROQ_MODELS) {
        if (!discovered.some(d => d.id === vm.id) && !vm.isExcluded) {
          discovered.push(vm)
        }
      }

      dynamicModelsCache = { timestamp: now, models: discovered }
      return discovered
    }
  } catch (err) {
    console.warn('[GroqModels] 1-hour cache query notice (using cached models):', err)
  }

  return dynamicModelsCache?.models || VERIFIED_GROQ_MODELS.filter(m => !m.isExcluded)
}

export function isModelAllowedForPlan(modelId: string, userPlan?: string | null): boolean {
  const p = String(userPlan || '').toLowerCase()
  if (p === 'corp' || p === 'creator' || p === 'admin') return true
  const norm = normalizePlan(userPlan)

  const modelMeta = VERIFIED_GROQ_MODELS.find(m => m.id === modelId)
  if (modelMeta?.isExcluded) return false

  const billions = modelMeta ? modelMeta.paramsBillions : extractParamsBillions(modelId)

  if (norm === 'pro') {
    // Pro: up to 120B
    return billions <= 120
  }
  if (norm === 'plus') {
    // Plus: up to 70B
    return billions <= 70
  }
  // Free: up to 20B (and groq/compound)
  if (modelId === 'groq/compound' || modelId === 'groq/compound-mini') return true
  return billions <= 20
}

export function getModelsForPlan(userPlan?: string | null, models: GroqModelMeta[] = VERIFIED_GROQ_MODELS): GroqModelMeta[] {
  const norm = normalizePlan(userPlan)
  return models.filter(m => isModelAllowedForPlan(m.id, norm) && !m.isExcluded)
}

/**
 * Model allocation based on subscription tier:
 * - Free: groq/compound, groq/compound-mini, openai/gpt-oss-20b, llama-prompt-guard, llama-3.1-8b-instant
 * - Plus (99 ₽): models up to 70B (qwen/qwen3.6-27b, groq/compound, llama-3.3-70b-versatile, deepseek-r1-70b)
 * - Pro (299 ₽): models up to 120B (openai/gpt-oss-120b, and all Plus models)
 * - Corp & Admin: ALL models (minimaxai/minimax-m2.7, future 120B+ models, unrestricted)
 */
export function getModelForUserPlan(
  plan?: string | null,
  requestedModel?: string | null,
  taskKind?: AiTaskKind
): string {
  const p = String(plan || '').toLowerCase()
  const isCorp = p === 'corp' || p === 'creator' || p === 'admin'
  const norm = normalizePlan(plan)
  const req = requestedModel?.trim()

  if (isCorp) {
    if (req && isModelHealthy(req)) return req
    return isModelHealthy('openai/gpt-oss-120b') ? 'openai/gpt-oss-120b' : 'qwen/qwen3.6-27b'
  }

  if (norm === 'pro') {
    if (req && isModelAllowedForPlan(req, 'pro') && isModelHealthy(req)) return req
    if (taskKind === 'siri' || taskKind === 'voice') return isModelHealthy('openai/gpt-oss-20b') ? 'openai/gpt-oss-20b' : 'llama-3.1-8b-instant'
    if (isModelHealthy('openai/gpt-oss-120b')) return 'openai/gpt-oss-120b'
    if (isModelHealthy('qwen/qwen3.6-27b')) return 'qwen/qwen3.6-27b'
    return 'llama-3.3-70b-versatile'
  }

  if (norm === 'plus') {
    if (req && isModelAllowedForPlan(req, 'plus') && isModelHealthy(req)) return req
    if (taskKind === 'siri' || taskKind === 'voice') return isModelHealthy('openai/gpt-oss-20b') ? 'openai/gpt-oss-20b' : 'llama-3.1-8b-instant'
    if (isModelHealthy('qwen/qwen3.6-27b')) return 'qwen/qwen3.6-27b'
    if (isModelHealthy('llama-3.3-70b-versatile')) return 'llama-3.3-70b-versatile'
    if (isModelHealthy('groq/compound')) return 'groq/compound'
    return 'openai/gpt-oss-20b'
  }

  // Free:
  if (req && isModelAllowedForPlan(req, 'free') && isModelHealthy(req)) return req
  if (isModelHealthy('openai/gpt-oss-20b')) return 'openai/gpt-oss-20b'
  if (isModelHealthy('groq/compound-mini')) return 'groq/compound-mini'
  if (isModelHealthy('llama-3.1-8b-instant')) return 'llama-3.1-8b-instant'
  if (isModelHealthy('groq/compound')) return 'groq/compound'
  return 'openai/gpt-oss-20b'
}

export function getFallbacksForPlan(userPlan?: string | null, requestedModel?: string): string[] {
  const p = String(userPlan || '').toLowerCase()
  const isCorp = p === 'corp' || p === 'creator' || p === 'admin'
  const norm = normalizePlan(userPlan)

  let fullHierarchy: string[] = []
  if (isCorp || norm === 'pro') {
    fullHierarchy = [
      'openai/gpt-oss-120b',
      'qwen/qwen3.6-27b',
      'llama-3.3-70b-versatile',
      'deepseek-r1-distill-llama-70b',
      'openai/gpt-oss-20b',
      'llama-3.1-8b-instant',
      'groq/compound',
      'groq/compound-mini',
    ]
  } else if (norm === 'plus') {
    fullHierarchy = [
      'qwen/qwen3.6-27b',
      'llama-3.3-70b-versatile',
      'deepseek-r1-distill-llama-70b',
      'openai/gpt-oss-20b',
      'llama-3.1-8b-instant',
      'groq/compound',
      'groq/compound-mini',
    ]
  } else {
    fullHierarchy = [
      'openai/gpt-oss-20b',
      'llama-3.1-8b-instant',
      'groq/compound-mini',
      'groq/compound',
    ]
  }

  const filtered = fullHierarchy.filter(m => m !== requestedModel && isModelAllowedForPlan(m, userPlan) && isModelHealthy(m))
  return filtered.length > 0 ? filtered : ['openai/gpt-oss-20b', 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile']
}

export const KNOWN_GROQ_CHAT_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-safeguard-20b',
  'groq/compound',
  'groq/compound-mini',
  'qwen/qwen3.6-27b',
  'minimaxai/minimax-m2.7',
  'meta-llama/llama-prompt-guard-2-86m',
  'meta-llama/llama-prompt-guard-2-22m',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'deepseek-r1-distill-llama-70b',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
  'llama3-70b-8192',
  'llama3-8b-8192',
])

export function normalizeGroqChatModel(model?: string, userPlan?: string | null): string {
  if (!model) return getModelForUserPlan(userPlan)
  const trimmed = model.trim()
  if (KNOWN_GROQ_CHAT_MODELS.has(trimmed)) {
    return isModelAllowedForPlan(trimmed, userPlan) ? trimmed : getModelForUserPlan(userPlan)
  }
  
  const lower = trimmed.toLowerCase()
  if (lower.includes('120b') || lower.includes('flagship')) {
    return isModelAllowedForPlan('openai/gpt-oss-120b', userPlan) ? 'openai/gpt-oss-120b' : getModelForUserPlan(userPlan)
  }
  if (lower.includes('deepseek') || lower.includes('r1')) {
    return isModelAllowedForPlan('deepseek-r1-distill-llama-70b', userPlan) ? 'deepseek-r1-distill-llama-70b' : getModelForUserPlan(userPlan)
  }
  if (lower.includes('qwen') || lower.includes('27b')) {
    return isModelAllowedForPlan('qwen/qwen3.6-27b', userPlan) ? 'qwen/qwen3.6-27b' : getModelForUserPlan(userPlan)
  }
  if (lower.includes('compound-mini')) {
    return 'groq/compound-mini'
  }
  if (lower.includes('compound')) {
    return isModelAllowedForPlan('groq/compound', userPlan) ? 'groq/compound' : 'groq/compound-mini'
  }
  if (lower.includes('8b') || lower.includes('instant') || lower.includes('mini') || lower.includes('20b')) {
    return 'openai/gpt-oss-20b'
  }
  if (lower.includes('70b')) {
    return isModelAllowedForPlan('llama-3.3-70b-versatile', userPlan) ? 'llama-3.3-70b-versatile' : 'groq/compound-mini'
  }
  return getModelForUserPlan(userPlan)
}

export function normalizeGroqWhisperModel(model?: string): string {
  if (!model) return GROQ_WHISPER_MODEL
  const lower = model.trim().toLowerCase()
  if (lower === 'whisper-large-v3' || lower === 'whisper-large-v3-turbo') return lower
  return GROQ_WHISPER_MODEL
}

interface KeyStatus {
  key: string
  masked: string
  cooldownUntil: number
  failedCount: number
  successCount: number
}

function cleanTokenString(raw: string): string[] {
  if (!raw) return []
  return raw
    .split(/[\s,;\n\r]+/)
    .map(k => k.replace(/^['"]+|['"]+$/g, '').trim())
    .filter(k => k.length > 10)
}

export function stripThinkingTags(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/^<\/think>/i, '')
    .trim()
}

class GroqKeyPool {
  private keys: KeyStatus[] = []
  private currentIndex = 0
  private lastInitialized = 0

  constructor() {
    this.refreshKeys()
  }

  public refreshKeys(explicitKeys?: string[]): KeyStatus[] {
    const rawKeys: string[] = []

    if (explicitKeys && explicitKeys.length > 0) {
      for (const ek of explicitKeys) {
        rawKeys.push(...cleanTokenString(ek))
      }
    }

    if (process.env.GROQ_API_KEYS) {
      rawKeys.push(...cleanTokenString(process.env.GROQ_API_KEYS))
    }

    if (process.env.GROQ_API_KEY) {
      rawKeys.push(...cleanTokenString(process.env.GROQ_API_KEY))
    }

    if (process.env.GROQ_KEYS) {
      rawKeys.push(...cleanTokenString(process.env.GROQ_KEYS))
    }

    if (process.env.GROQ_KEY) {
      rawKeys.push(...cleanTokenString(process.env.GROQ_KEY))
    }

    // Dynamic scan of any numbered or custom GROQ_ env vars (GROQ_API_KEY_1..20, GROQ_KEY_1..20, etc.)
    for (const [envKey, envVal] of Object.entries(process.env)) {
      if (
        envVal &&
        /^(GROQ_API_KEY|GROQ_KEY|GROQ_TOKEN)(_\d+)?$/i.test(envKey) &&
        envKey !== 'GROQ_API_KEY' // already processed above
      ) {
        rawKeys.push(...cleanTokenString(envVal))
      }
    }

    const uniqueClean = Array.from(
      new Set(
        rawKeys
          .map(k => k.trim())
          .filter(k => k.length > 10 && (k.startsWith('gsk_') || k.length >= 20))
      )
    )

    // Preserve existing stats if keys were already known
    const existingMap = new Map(this.keys.map(k => [k.key, k]))

    this.keys = uniqueClean.map(k => {
      const existing = existingMap.get(k)
      if (existing) return existing
      const masked = `${k.slice(0, 7)}...${k.slice(-4)}`
      return {
        key: k,
        masked,
        cooldownUntil: 0,
        failedCount: 0,
        successCount: 0,
      }
    })

    this.lastInitialized = Date.now()
    return this.keys
  }

  public getKeysCount(): number {
    this.ensureFresh()
    return this.keys.length
  }

  public getAllKeys(): string[] {
    this.ensureFresh()
    return this.keys.map(k => k.key)
  }

  public getOrderedHealthyKeys(providedKey?: string): string[] {
    this.ensureFresh()

    if (providedKey) {
      const parsedProvided = cleanTokenString(providedKey)
      if (parsedProvided.length > 0) {
        this.refreshKeys(parsedProvided)
      }
    }

    if (this.keys.length === 0) return []

    const now = Date.now()
    // Sort keys: healthy ones first (rotated from currentIndex), then keys in cooldown by shortest remaining time
    const healthy: string[] = []
    const cooling: KeyStatus[] = []

    const total = this.keys.length
    for (let i = 0; i < total; i++) {
      const idx = (this.currentIndex + i) % total
      const item = this.keys[idx]
      if (item.cooldownUntil <= now) {
        healthy.push(item.key)
      } else {
        cooling.push(item)
      }
    }

    // Sort cooling keys by nearest expiry
    cooling.sort((a, b) => a.cooldownUntil - b.cooldownUntil)

    // Advance round-robin index for next call
    this.currentIndex = (this.currentIndex + 1) % total

    return [...healthy, ...cooling.map(c => c.key)]
  }

  public markKeySuccess(key: string) {
    const item = this.keys.find(k => k.key === key)
    if (item) {
      item.successCount++
      item.cooldownUntil = 0
    }
  }

  public markKeyRateLimited(key: string, cooldownSeconds = 60) {
    const item = this.keys.find(k => k.key === key)
    if (item) {
      item.failedCount++
      item.cooldownUntil = Date.now() + cooldownSeconds * 1000
      console.warn(`[GroqPool] Key ${item.masked} rate-limited. Cooldown for ${cooldownSeconds}s.`)
    }
  }

  public getPoolStats() {
    this.ensureFresh()
    const now = Date.now()
    return {
      totalKeys: this.keys.length,
      healthyKeys: this.keys.filter(k => k.cooldownUntil <= now).length,
      coolingKeys: this.keys.filter(k => k.cooldownUntil > now).length,
      keys: this.keys.map(k => ({
        masked: k.masked,
        status: k.cooldownUntil > now ? `Cooldown (${Math.ceil((k.cooldownUntil - now) / 1000)}s)` : 'Active',
        successCount: k.successCount,
        failedCount: k.failedCount,
      }))
    }
  }

  private ensureFresh() {
    if (Date.now() - this.lastInitialized > 60000 || this.keys.length === 0) {
      this.refreshKeys()
    }
  }
}

export const groqPool = new GroqKeyPool()

export function getHuggingFaceTokens(): string[] {
  const rawHfTokens: string[] = []
  if (process.env.HF_TOKEN) rawHfTokens.push(...cleanTokenString(process.env.HF_TOKEN))
  if (process.env.HF_TOKENS) rawHfTokens.push(...cleanTokenString(process.env.HF_TOKENS))
  if (process.env.HUGGINGFACE_API_KEY) rawHfTokens.push(...cleanTokenString(process.env.HUGGINGFACE_API_KEY))
  if (process.env.HUGGINGFACE_TOKEN) rawHfTokens.push(...cleanTokenString(process.env.HUGGINGFACE_TOKEN))
  if (process.env.HUGGING_FACE_HUB_TOKEN) rawHfTokens.push(...cleanTokenString(process.env.HUGGING_FACE_HUB_TOKEN))
  if (process.env.HF_API_KEY) rawHfTokens.push(...cleanTokenString(process.env.HF_API_KEY))

  for (const [envKey, envVal] of Object.entries(process.env)) {
    if (
      envVal &&
      /^(HF|HUGGINGFACE|HUGGING_FACE)_(TOKEN|API_KEY|KEY)(_\d+)?$/i.test(envKey)
    ) {
      rawHfTokens.push(...cleanTokenString(envVal))
    }
  }

  return Array.from(new Set(rawHfTokens.map(t => t.trim()).filter(t => t.startsWith('hf_') || t.length >= 20)))
}

/**
 * Execute Groq Chat Completion with full automatic key rotation and model fallback
 * Secondary fallback: Hugging Face Serverless Router Chat/LLM API Pool
 * Tertiary fallback: OpenAI (if OPENAI_API_KEY is configured)
 */
export async function callGroqChatCompletion(options: {
  messages: Array<{ role: string; content: any }>
  model?: string
  temperature?: number
  max_tokens?: number
  response_format?: { type: 'json_object' | 'text' }
  apiKey?: string
  fallbackModels?: string[]
  userPlan?: string | null
}): Promise<{ content: string; keyUsed: string; modelUsed: string }> {
  const keys = groqPool.getOrderedHealthyKeys(options.apiKey)

  const requestedModel = normalizeGroqChatModel(options.model, options.userPlan)
  const defaultFallbacks = getFallbacksForPlan(options.userPlan, requestedModel)
  const normalizedFallbacks = (options.fallbackModels !== undefined && options.fallbackModels.length > 0)
    ? options.fallbackModels.map(m => normalizeGroqChatModel(m, options.userPlan))
    : defaultFallbacks

  const models = [
    requestedModel,
    ...normalizedFallbacks
  ].filter((v, i, a) => a.indexOf(v) === i)

  let lastError: Error | null = null
  const tier1Deadline = Date.now() + 14_000

  // ── Tier 1: Groq Multi-Account Round-Robin Pool ──
  if (keys.length > 0) {
    for (const m of models) {
      let modelNotFound = false
      for (const key of keys) {
        if (Date.now() > tier1Deadline || modelNotFound) break
        try {
          const body: Record<string, any> = {
            model: m,
            messages: options.messages,
            temperature: options.temperature ?? 0.3,
          }
          if (options.max_tokens) body.max_tokens = options.max_tokens
          if (options.response_format) body.response_format = options.response_format

          let res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(6000),
          })

          // Smart recovery: if 400 occurred with response_format, retry immediately without response_format
          if (res.status === 400 && body.response_format) {
            delete body.response_format
            res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(6000),
            })
          }

          if (res.status === 429) {
            groqPool.markKeyRateLimited(key, 60)
            console.warn(`[GroqChat] 429 Rate Limit on key ${key.slice(0, 7)}..., rotating to next key...`)
            continue
          }

          if (res.status === 404) {
            const errText = await res.text()
            lastError = new Error(`Groq Chat error (404): ${errText}`)
            console.warn(`[GroqChat] Model ${m} returned 404, marking unavailable and auto-discovering replacements...`)
            markModelFailed(m, '404 Model Not Found', 15)
            modelNotFound = true
            break // Skip all remaining keys for this 404 model, jump directly to next model
          }

          if (!res.ok) {
            const errText = await res.text()
            if (errText.includes('rate_limit') || res.status === 413 || res.status === 503) {
              groqPool.markKeyRateLimited(key, 45)
              continue
            }
            if (res.status === 400 && (errText.includes('model') || errText.includes('not supported') || errText.includes('decommissioned'))) {
              markModelFailed(m, `HTTP ${res.status}: ${errText}`, 15)
              modelNotFound = true
              break
            }
            lastError = new Error(`Groq Chat error (${res.status}): ${errText}`)
            console.warn(`[GroqChat] Attempt failed on key ${key.slice(0, 7)}... with model ${m}: ${lastError.message}`)
            continue
          }

          const data = await res.json()
          const rawContent = data.choices?.[0]?.message?.content || ''
          const content = stripThinkingTags(rawContent)
          groqPool.markKeySuccess(key)
          markModelSuccess(m)
          return { content, keyUsed: key, modelUsed: m }
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err))
          console.warn(`[GroqChat] Attempt failed on key ${key.slice(0, 7)}... with model ${m}: ${lastError.message}`)
        }
      }
    }
  }

  // ── Tier 2: Hugging Face Serverless Chat LLM Pool ──
  const hfTokens = getHuggingFaceTokens()
  if (hfTokens.length > 0) {
    const tier2Deadline = Date.now() + 10_000
    const hfChatModels = [
      'meta-llama/Llama-3.3-70B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
      'meta-llama/Llama-3.1-8B-Instruct',
      'Qwen/Qwen2.5-7B-Instruct',
    ]

    for (const hfModel of hfChatModels) {
      for (const token of hfTokens) {
        if (Date.now() > tier2Deadline) break
        try {
          console.log(`[GroqChat Fallback] Switching to Hugging Face LLM: ${hfModel}...`)
          const hfRes = await fetch('https://router.huggingface.co/hf-inference/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: hfModel,
              messages: options.messages,
              temperature: options.temperature ?? 0.3,
              max_tokens: options.max_tokens ?? 1024,
            }),
            signal: AbortSignal.timeout(6000),
          })

          if (hfRes.ok) {
            const hfData = await hfRes.json()
            const content = hfData.choices?.[0]?.message?.content || ''
            if (content) {
              return { content, keyUsed: `${token.slice(0, 6)}...`, modelUsed: hfModel }
            }
          } else if (hfRes.status === 503) {
            console.warn(`[HF-Chat] Model ${hfModel} is loading (503 Cold Start), instantly skipping to next model...`)
            continue
          } else if (hfRes.status === 429) {
            console.warn(`[HF-Chat] Rate limit 429 on token ${token.slice(0, 6)}..., switching token/model...`)
            continue
          } else {
            const hfErrText = await hfRes.text()
            console.warn(`[HF-Chat] Model ${hfModel} HTTP ${hfRes.status}:`, hfErrText)
          }
        } catch (hfErr) {
          console.warn(`[HF-Chat] Model ${hfModel} error:`, hfErr)
        }
      }
    }
  }

  // ── Tier 3: OpenAI Fallback (if configured) ──
  const openAiKey = process.env.OPENAI_API_KEY
  if (openAiKey) {
    try {
      const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: options.messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.max_tokens ?? 1024,
        }),
        signal: AbortSignal.timeout(25000),
      })

      if (openAiRes.ok) {
        const oData = await openAiRes.json()
        const content = oData.choices?.[0]?.message?.content || ''
        if (content) {
          return { content, keyUsed: 'openai_key', modelUsed: 'gpt-4o-mini' }
        }
      }
    } catch (oErr) {
      console.warn('[OpenAI-Chat] error:', oErr)
    }
  }

  throw lastError || new Error('ИИ временно перегружен или недоступен. Пожалуйста, повторите попытку чуть позже.')
}

/**
 * Execute Groq Whisper Audio Transcription with automatic key rotation and model fallback
 */
export async function callGroqWhisper(options: {
  audioBuffer: Buffer
  filename: string
  apiKey?: string
  fallbackModels?: string[]
}): Promise<{ text: string; keyUsed: string; modelUsed: string }> {
  const keys = groqPool.getOrderedHealthyKeys(options.apiKey)
  const hfTokens = getHuggingFaceTokens()
  const openAiKey = process.env.OPENAI_API_KEY

  if (keys.length === 0 && hfTokens.length === 0 && !openAiKey) {
    throw new Error('No Groq or Hugging Face API keys configured. Please add GROQ_API_KEY to environment variables.')
  }

  const ext = options.filename.split('.').pop() || 'webm'
  const mimeType = ext === 'webm' ? 'audio/webm' : ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg'

  const models = [
    normalizeGroqWhisperModel(GROQ_WHISPER_MODEL),
    ...(options.fallbackModels || ['whisper-large-v3-turbo', 'whisper-large-v3'])
  ].filter((v, i, a) => a.indexOf(v) === i)

  let lastError: Error | null = null

  // ── Tier 1: Groq Whisper Pool ──
  if (keys.length > 0) {
    for (const m of models) {
      let modelNotFound = false
      for (const key of keys) {
        if (modelNotFound) break
        try {
          const formData = new FormData()
          formData.append('file', new Blob([options.audioBuffer], { type: mimeType }), options.filename)
          formData.append('model', m)
          formData.append('response_format', 'json')

          const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}` },
            body: formData,
            signal: AbortSignal.timeout(8000),
          })

          if (res.status === 429) {
            groqPool.markKeyRateLimited(key, 60)
            console.warn(`[GroqWhisper] 429 Rate Limit on key, rotating to next key...`)
            continue
          }

          if (res.status === 404) {
            const errText = await res.text()
            lastError = new Error(`Whisper error (404): ${errText}`)
            console.warn(`[GroqWhisper] Model ${m} returned 404, skipping to next model...`)
            modelNotFound = true
            break
          }

          if (!res.ok) {
            const errText = await res.text()
            if (errText.includes('rate_limit') || res.status === 503) {
              groqPool.markKeyRateLimited(key, 45)
              continue
            }
            lastError = new Error(`Whisper error (${res.status}): ${errText}`)
            console.warn(`[GroqWhisper] Attempt failed with model ${m}: ${lastError.message}`)
            continue
          }

          const data = await res.json()
          const text = data.text || ''
          groqPool.markKeySuccess(key)
          return { text, keyUsed: key, modelUsed: m }
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err))
          console.warn(`[GroqWhisper] Attempt failed with model ${m}: ${lastError.message}`)
        }
      }
    }
  }

  // ── Tier 2: Hugging Face Router Audio Inference Pool ──
  if (hfTokens.length > 0) {
    const hfModels = [
      'openai/whisper-large-v3-turbo',
      'openai/whisper-large-v3',
      'openai/whisper-small',
    ]

    for (const hfModel of hfModels) {
      for (const token of hfTokens) {
        try {
          console.log(`[Whisper Fallback] Attempting Hugging Face with model ${hfModel}...`)
          const hfRes = await fetch(`https://router.huggingface.co/hf-inference/models/${hfModel}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': mimeType,
            },
            body: options.audioBuffer,
            signal: AbortSignal.timeout(60000),
          })

          if (hfRes.ok) {
            const hfData = await hfRes.json()
            const transcribed = (hfData.text || '').trim()
            if (transcribed) {
              return { text: transcribed, keyUsed: `${token.slice(0, 6)}...`, modelUsed: hfModel }
            }
          }
        } catch (hfErr) {
          console.warn(`[HF-Whisper] Model ${hfModel} error:`, hfErr)
        }
      }
    }
  }

  // ── Tier 3: OpenAI Whisper API ──
  if (openAiKey) {
    try {
      console.log(`[Whisper Fallback] Attempting OpenAI Whisper API...`)
      const openAiFormData = new FormData()
      openAiFormData.append('file', new Blob([options.audioBuffer], { type: mimeType }), options.filename)
      openAiFormData.append('model', 'whisper-1')

      const openAiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openAiKey}` },
        body: openAiFormData,
        signal: AbortSignal.timeout(60000),
      })

      if (openAiRes.ok) {
        const oData = await openAiRes.json()
        if (oData.text) {
          return { text: oData.text, keyUsed: 'openai_key', modelUsed: 'whisper-1' }
        }
      }
    } catch (oErr) {
      console.warn('[OpenAI-Whisper] error:', oErr)
    }
  }

  throw lastError || new Error('All Groq Whisper keys and fallback providers failed.')
}
