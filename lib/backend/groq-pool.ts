/**
 * Zerf AI — High-Availability Groq API Key Pool & Rate-Limit Rotator
 * 
 * Capabilities:
 * - Automatically parses keys from:
 *   - GROQ_API_KEY (single or comma/space separated list of keys: gsk_1,gsk_2,...)
 *   - GROQ_API_KEYS (comma, newline, or space separated)
 *   - GROQ_API_KEY_1, GROQ_API_KEY_2, ..., GROQ_API_KEY_10
 * - Round-robin request distribution across all healthy keys
 * - 429 Too Many Requests automatic detection with 60s cooldown and instant retry on next key
 * - Model fallback hierarchy for chat completions
 */

import { GROQ_CHAT_MODEL, GROQ_WHISPER_MODEL } from '@/lib/config'

interface KeyStatus {
  key: string
  masked: string
  cooldownUntil: number
  failedCount: number
  successCount: number
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
      rawKeys.push(...explicitKeys)
    }

    if (process.env.GROQ_API_KEYS) {
      rawKeys.push(...process.env.GROQ_API_KEYS.split(/[\s,;\n]+/))
    }

    if (process.env.GROQ_API_KEY) {
      rawKeys.push(...process.env.GROQ_API_KEY.split(/[\s,;\n]+/))
    }

    // Check individual numbered env vars (GROQ_API_KEY_1 .. GROQ_API_KEY_10)
    for (let i = 1; i <= 10; i++) {
      const k = process.env[`GROQ_API_KEY_${i}`]
      if (k) rawKeys.push(k.trim())
    }

    const uniqueClean = Array.from(
      new Set(
        rawKeys
          .map(k => k.trim())
          .filter(k => k.length > 10 && (k.startsWith('gsk_') || k.length > 20))
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
      const parsedProvided = providedKey.split(/[\s,;\n]+/).map(k => k.trim()).filter(Boolean)
      if (parsedProvided.length > 0) {
        this.refreshKeys(parsedProvided)
      }
    }

    if (this.keys.length === 0) return []

    const now = Date.now()
    // Sort keys: healthy ones first (rotated from currentIndex), then keys in cooldown by shortest remaining time
    const healthy: string[] = []
    const cooling: string[] = []

    const total = this.keys.length
    for (let i = 0; i < total; i++) {
      const idx = (this.currentIndex + i) % total
      const item = this.keys[idx]
      if (item.cooldownUntil <= now) {
        healthy.push(item.key)
      } else {
        cooling.push(item.key)
      }
    }

    // Advance round-robin index for next call
    this.currentIndex = (this.currentIndex + 1) % total

    return [...healthy, ...cooling]
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
  if (process.env.HF_TOKEN) rawHfTokens.push(...process.env.HF_TOKEN.split(/[\s,;\n]+/))
  if (process.env.HF_TOKENS) rawHfTokens.push(...process.env.HF_TOKENS.split(/[\s,;\n]+/))
  if (process.env.HUGGINGFACE_API_KEY) rawHfTokens.push(...process.env.HUGGINGFACE_API_KEY.split(/[\s,;\n]+/))
  if (process.env.HUGGINGFACE_TOKEN) rawHfTokens.push(...process.env.HUGGINGFACE_TOKEN.split(/[\s,;\n]+/))
  for (let i = 1; i <= 10; i++) {
    const t = process.env[`HF_TOKEN_${i}`]
    if (t) rawHfTokens.push(t.trim())
  }
  return Array.from(new Set(rawHfTokens.map(t => t.trim()).filter(t => t.startsWith('hf_') || t.length > 20)))
}

/**
 * Execute Groq Chat Completion with full automatic key rotation and model fallback
 * Secondary fallback: Hugging Face Serverless Chat/LLM API Pool
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

  const primaryModel = options.model || GROQ_CHAT_MODEL
  const models = [
    primaryModel,
    ...(options.fallbackModels || ['llama-3.1-8b-instant', 'llama3-8b-8192', 'mixtral-8x7b-32768'])
  ].filter((v, i, a) => a.indexOf(v) === i)

  let lastError: Error | null = null

  // ── Tier 1: Groq Multi-Account Round-Robin Pool ──
  if (keys.length > 0) {
    for (const m of models) {
      for (const key of keys) {
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
          })

          if (res.status === 429) {
            groqPool.markKeyRateLimited(key, 60)
            console.warn(`[GroqChat] 429 Rate Limit on key, rotating to next key...`)
            continue
          }

          if (!res.ok) {
            const errText = await res.text()
            if (errText.includes('rate_limit') || res.status === 413 || res.status === 503) {
              groqPool.markKeyRateLimited(key, 45)
              continue
            }
            throw new Error(`Groq Chat error (${res.status}): ${errText}`)
          }

          const data = await res.json()
          const content = data.choices?.[0]?.message?.content || ''
          groqPool.markKeySuccess(key)
          return { content, keyUsed: key, modelUsed: m }
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err))
          console.warn(`[GroqChat] Attempt failed with model ${m}: ${lastError.message}`)
        }
      }
    }
  }

  // ── Tier 2: Hugging Face Serverless Chat LLM Pool ──
  const hfTokens = getHuggingFaceTokens()
  if (hfTokens.length > 0) {
    const hfChatModels = [
      'meta-llama/Llama-3.3-70B-Instruct',
      'meta-llama/Llama-3.1-8B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'mistralai/Mistral-7B-Instruct-v0.3',
    ]

    for (const hfModel of hfChatModels) {
      for (const token of hfTokens) {
        try {
          console.log(`[GroqChat Fallback] Switching to Hugging Face LLM: ${hfModel}...`)
          const hfRes = await fetch(`https://api-inference.huggingface.co/models/${hfModel}/v1/chat/completions`, {
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
              ...(options.response_format ? { response_format: options.response_format } : {})
            }),
          })

          if (hfRes.ok) {
            const hfData = await hfRes.json()
            const content = hfData.choices?.[0]?.message?.content || ''
            if (content) {
              return { content, keyUsed: `${token.slice(0, 6)}...`, modelUsed: hfModel }
            }
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
  if (keys.length === 0) {
    throw new Error('No Groq API keys configured. Please add GROQ_API_KEY to environment variables.')
  }

  const ext = options.filename.split('.').pop() || 'webm'
  const mimeType = ext === 'webm' ? 'audio/webm' : ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg'

  const models = [
    GROQ_WHISPER_MODEL,
    ...(options.fallbackModels || ['whisper-large-v3-turbo', 'distil-whisper-large-v3-en'])
  ].filter((v, i, a) => a.indexOf(v) === i)

  let lastError: Error | null = null

  for (const m of models) {
    for (const key of keys) {
      try {
        const formData = new FormData()
        formData.append('file', new Blob([options.audioBuffer], { type: mimeType }), options.filename)
        formData.append('model', m)
        formData.append('response_format', 'json')

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
          body: formData,
        })

        if (res.status === 429) {
          groqPool.markKeyRateLimited(key, 60)
          console.warn(`[GroqWhisper] 429 Rate Limit on key, rotating to next key...`)
          continue
        }

        if (!res.ok) {
          const errText = await res.text()
          if (errText.includes('rate_limit') || res.status === 503) {
            groqPool.markKeyRateLimited(key, 45)
            continue
          }
          throw new Error(`Whisper error (${res.status}): ${errText}`)
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

  // ── Multi-Provider Secondary Fallbacks (Hugging Face / OpenAI / Cloudflare) ──

  // 1. Hugging Face Inference API Pool (Free & Serverless)
  const hfTokens = getHuggingFaceTokens()

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
          const hfRes = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': mimeType,
            },
            body: options.audioBuffer,
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

  // 2. OpenAI Whisper API (if OPENAI_API_KEY is configured)
  const openAiKey = process.env.OPENAI_API_KEY
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
