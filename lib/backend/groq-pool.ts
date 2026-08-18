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

export type AiTaskKind = 'chat' | 'parser' | 'goals' | 'reschedule' | 'analytics' | 'voice' | 'siri'

export const FREE_ALLOWED_MODELS = [
  'llama-3.1-8b-instant',
  'groq/compound-mini',
]

export const PLUS_ALLOWED_MODELS = [
  'qwen/qwen3.6-27b',
  'llama-3.1-8b-instant',
  'groq/compound-mini',
]

/**
 * Model allocation based on subscription tier:
 * - Free: Strictly limited to lightweight models <= 8B (Llama 3.1 8B Instant, Compound Mini)
 * - Plus (99 ₽): Models up to 27B (Qwen 3.6 27B, Llama 3.1 8B Instant)
 * - Pro (299 ₽) & Corp: Full access to all models (GPT-OSS 120B Flagship, GPT-OSS 20B, Llama 3.3 70B, etc.) and per-task custom routing
 */
export function getModelForUserPlan(
  plan?: string | null,
  requestedModel?: string | null,
  taskKind?: AiTaskKind
): string {
  const norm = normalizePlan(plan)
  const req = requestedModel?.trim()

  // Pro & Corp: full freedom to use ANY model for each task
  if (norm === 'pro' || norm === 'corp') {
    if (req) return req
    if (taskKind === 'siri' || taskKind === 'voice') return 'openai/gpt-oss-20b'
    return 'openai/gpt-oss-120b'
  }

  // Plus: up to 27B (Qwen 3.6 27B or Llama 3.1 8B)
  if (norm === 'plus') {
    if (req && (PLUS_ALLOWED_MODELS.includes(req) || req === 'qwen/qwen3.6-27b' || req === 'llama-3.1-8b-instant' || req === 'groq/compound-mini')) {
      return req
    }
    return 'qwen/qwen3.6-27b'
  }

  // Free: strictly <= 8B (Llama 3.1 8B Instant or Compound Mini)
  if (req && (FREE_ALLOWED_MODELS.includes(req) || req === 'llama-3.1-8b-instant' || req === 'groq/compound-mini')) {
    return req
  }
  return 'llama-3.1-8b-instant'
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

const KNOWN_GROQ_CHAT_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'groq/compound',
  'groq/compound-mini',
  'allam-2-7b',
  'canopylabs/orpheus-v1-english',
])

export function normalizeGroqChatModel(model?: string): string {
  if (!model) return GROQ_CHAT_MODEL
  const trimmed = model.trim()
  if (KNOWN_GROQ_CHAT_MODELS.has(trimmed)) return trimmed
  
  const lower = trimmed.toLowerCase()
  // Map any legacy names to current fast Groq models
  if (lower.includes('llama-3.1-8b') || lower.includes('llama-3.2') || lower.includes('instant') || lower.includes('mini')) {
    return 'llama-3.1-8b-instant'
  }
  if (lower.includes('70b') || lower.includes('versatile') || lower.includes('72b')) {
    return 'llama-3.3-70b-versatile'
  }
  if (lower.includes('qwen') || lower.includes('mixtral')) {
    return 'qwen/qwen3.6-27b'
  }
  if (lower.includes('20b')) {
    return 'openai/gpt-oss-20b'
  }
  if (lower.includes('120b')) {
    return 'openai/gpt-oss-120b'
  }
  return GROQ_CHAT_MODEL
}

export function normalizeGroqWhisperModel(model?: string): string {
  if (!model) return GROQ_WHISPER_MODEL
  const lower = model.trim().toLowerCase()
  if (lower === 'whisper-large-v3' || lower === 'whisper-large-v3-turbo') return lower
  return GROQ_WHISPER_MODEL
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
}): Promise<{ content: string; keyUsed: string; modelUsed: string }> {
  const keys = groqPool.getOrderedHealthyKeys(options.apiKey)

  const requestedModel = normalizeGroqChatModel(options.model)
  const defaultFallbacks = ['openai/gpt-oss-20b', 'qwen/qwen3.6-27b', 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile']
  const normalizedFallbacks = (options.fallbackModels !== undefined && options.fallbackModels.length > 0)
    ? options.fallbackModels.map(m => normalizeGroqChatModel(m))
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

          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(6000),
          })

          if (res.status === 429) {
            groqPool.markKeyRateLimited(key, 60)
            console.warn(`[GroqChat] 429 Rate Limit on key ${key.slice(0, 7)}..., rotating to next key...`)
            continue
          }

          if (res.status === 404) {
            const errText = await res.text()
            lastError = new Error(`Groq Chat error (404): ${errText}`)
            console.warn(`[GroqChat] Model ${m} returned 404, skipping to next fallback model...`)
            modelNotFound = true
            break // Skip all remaining keys for this 404 model, jump directly to next model
          }

          if (!res.ok) {
            const errText = await res.text()
            if (errText.includes('rate_limit') || res.status === 413 || res.status === 503) {
              groqPool.markKeyRateLimited(key, 45)
              continue
            }
            lastError = new Error(`Groq Chat error (${res.status}): ${errText}`)
            console.warn(`[GroqChat] Attempt failed on key ${key.slice(0, 7)}... with model ${m}: ${lastError.message}`)
            continue
          }

          const data = await res.json()
          const rawContent = data.choices?.[0]?.message?.content || ''
          const content = stripThinkingTags(rawContent)
          groqPool.markKeySuccess(key)
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
      'meta-llama/Llama-3.1-8B-Instruct',
      'Qwen/Qwen2.5-7B-Instruct',
      'meta-llama/Llama-3.2-3B-Instruct',
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

  throw lastError || new Error('All Groq keys and Hugging Face fallback models failed.')
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
