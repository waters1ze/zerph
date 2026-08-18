/**
 * Next.js API Route — Entropy AI Deep Search & Research Engine (Perplexity Style)
 * GET/POST /api/entropy/search
 */

import { NextRequest, NextResponse } from 'next/server'
import { callGroqChatCompletion, groqPool, getHuggingFaceTokens, getModelForUserPlan } from '@/lib/backend/groq-pool'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { getUserUsageAndLimits } from '@/lib/backend/db'
import { getDailyCount, incrementDailyCount, COUNTERS } from '@/lib/backend/plans'
import { aggregateLiveKnowledgeSources, type LiveSource } from '@/lib/backend/entropy-sources'

// ── Regular Search Daily Limits ────────────────────────────────────────────
export const ENTROPY_ROLE_LIMITS: Record<string, number> = {
  free: 15,
  plus: 100,
  pro: 500,
  corp: 2000,
  creator: -1, // Unlimited
  admin: -1,   // Unlimited
}

// ── Pro Search Daily Limits (Deep Multi-Step Web Reasoning) ────────────────
export const ENTROPY_PRO_ROLE_LIMITS: Record<string, number> = {
  free: 0,     // Pro Search is locked on Free tier
  plus: 3,     // 3 Pro searches per day on Zerf Plus (99 ₽)
  pro: 20,     // 20 Pro searches per day on Zerf Pro (299 ₽)
  corp: 100,   // 100 Pro searches per day on Corp
  creator: -1, // Unlimited
  admin: -1,   // Unlimited
}

import { ROOT_ADMIN_IDS } from '@/lib/backend/auth'

// ── Role Limit Overrides ───────────────────
export const ENTROPY_USER_LIMIT_OVERRIDES: Record<string, { regular: number; pro: number }> = {}

function getUserLimits(chatId?: string, userPlan: string = 'free') {
  if (!chatId) {
    return {
      regularLimit: ENTROPY_ROLE_LIMITS.free,
      proLimit: ENTROPY_PRO_ROLE_LIMITS.free,
      isUnlimited: false,
    }
  }

  const plan = userPlan.toLowerCase()
  if (plan === 'creator' || plan === 'admin' || plan === 'corp' || ROOT_ADMIN_IDS.includes(chatId)) {
    return { regularLimit: -1, proLimit: -1, isUnlimited: true }
  }

  // Check custom user override if set
  if (chatId in ENTROPY_USER_LIMIT_OVERRIDES) {
    const override = ENTROPY_USER_LIMIT_OVERRIDES[chatId]
    return {
      regularLimit: override.regular,
      proLimit: override.pro,
      isUnlimited: override.regular === -1 && override.pro === -1,
    }
  }

  const regularLimit = ENTROPY_ROLE_LIMITS[plan] ?? ENTROPY_ROLE_LIMITS.free
  const proLimit = ENTROPY_PRO_ROLE_LIMITS[plan] ?? ENTROPY_PRO_ROLE_LIMITS.free
  return { regularLimit, proLimit, isUnlimited: false }
}

export interface EntropySource {
  id: number
  title: string
  url: string
  domain: string
  snippet: string
  type?: 'web' | 'note' | 'task'
  noteId?: string
  taskId?: string
}

export interface EntropySearchResult {
  query: string
  mode: string
  isPro?: boolean
  sources: EntropySource[]
  answer: string
  takeaways: string[]
  followUpQuestions: string[]
  tikhonyaComment: string
  createdAt: string
  usage?: {
    used: number
    limit: number
    remaining: number
    isUnlimited: boolean
    plan: string
    model?: string
    modelDisplayName?: string
    pro: {
      used: number
      limit: number
      remaining: number
      isAllowed: boolean
      isUnlimited: boolean
    }
  }
}

export function getEntropyModelForPlan(userPlan?: string, isPro = false): { model: string; displayName: string } {
  const norm = String(userPlan || 'free').toLowerCase()
  if (norm === 'corp' || norm === 'creator' || norm === 'admin' || norm === 'pro' || isPro) {
    return { model: 'openai/gpt-oss-120b', displayName: 'GPT-OSS 120B Flagship' }
  }
  if (norm === 'plus') {
    return { model: 'qwen/qwen3.6-27b', displayName: 'Qwen 3.6 27B Reasoning' }
  }
  return { model: 'openai/gpt-oss-20b', displayName: 'GPT-OSS 20B High Speed' }
}

// GET: Return user's daily search quotas and usage
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const ownerChatId = authUser?.chatId || 'guest'
    const limits = ownerChatId !== 'guest' ? await getUserUsageAndLimits(ownerChatId) : null
    const userPlan = limits?.plan || 'free'

    const { regularLimit, proLimit, isUnlimited } = getUserLimits(ownerChatId, userPlan)

    const regUsed = ownerChatId !== 'guest' ? await getDailyCount(COUNTERS.entropy, ownerChatId) : 0
    const proUsed = ownerChatId !== 'guest' ? await getDailyCount(COUNTERS.entropyPro, ownerChatId) : 0

    const regRemaining = regularLimit === -1 ? 999999 : Math.max(0, regularLimit - regUsed)
    const proRemaining = proLimit === -1 ? 999999 : Math.max(0, proLimit - proUsed)
    const activeModel = getEntropyModelForPlan(userPlan, false)

    return NextResponse.json({
      success: true,
      usage: {
        used: regUsed,
        limit: regularLimit,
        remaining: regRemaining,
        isUnlimited: regularLimit === -1,
        plan: userPlan,
        model: activeModel.model,
        modelDisplayName: activeModel.displayName,
        pro: {
          used: proUsed,
          limit: proLimit,
          remaining: proRemaining,
          isAllowed: proLimit > 0 || proLimit === -1,
          isUnlimited: proLimit === -1,
        },
        roleLimits: {
          regular: ENTROPY_ROLE_LIMITS,
          pro: ENTROPY_PRO_ROLE_LIMITS,
        },
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error checking limits' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const ownerChatId = authUser?.chatId || 'guest'

    const body = await req.json()
    const { query, mode = 'web', isPro = false, focus, apiKey } = body

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Поисковый запрос обязателен' }, { status: 400 })
    }

    const cleanQuery = query.trim()

    // ── Check Daily Limits ───────────────────────────────────────────────
    const userLimits = ownerChatId !== 'guest' ? await getUserUsageAndLimits(ownerChatId) : null
    const userPlan = userLimits?.plan || 'free'
    const { regularLimit, proLimit, isUnlimited } = getUserLimits(ownerChatId, userPlan)

    const regUsed = ownerChatId !== 'guest' ? await getDailyCount(COUNTERS.entropy, ownerChatId) : 0
    const proUsed = ownerChatId !== 'guest' ? await getDailyCount(COUNTERS.entropyPro, ownerChatId) : 0

    // Check Pro Search permission and quota
    if (isPro) {
      if (proLimit === 0) {
        return NextResponse.json(
          {
            error: '🔒 Режим Pro Search недоступен на бесплатном тарифе FREE. Оформите Zerf Plus (3 Pro-поиска в день) или Zerf Pro (20 в день)!',
            proRequired: true,
            plan: userPlan,
          },
          { status: 403 }
        )
      }

      if (proLimit !== -1 && proUsed >= proLimit) {
        return NextResponse.json(
          {
            error: `❌ Дневной лимит Pro Search исчерпан (${proUsed}/${proLimit} для тарифа ${userPlan.toUpperCase()}). Лимит обновится в 03:00 по МСК, либо перейдите на более высокий тариф.`,
            proLimitReached: true,
            used: proUsed,
            limit: proLimit,
            plan: userPlan,
          },
          { status: 429 }
        )
      }
    } else {
      if (regularLimit !== -1 && regUsed >= regularLimit) {
        return NextResponse.json(
          {
            error: `❌ Дневной лимит поисковых запросов исчерпан (${regUsed}/${regularLimit} для тарифа ${userPlan.toUpperCase()}). Подключите Zerf Plus для 100 запросов в день! Лимит обновится в 03:00 по МСК.`,
            limitReached: true,
            used: regUsed,
            limit: regularLimit,
            plan: userPlan,
          },
          { status: 429 }
        )
      }
    }

    // 1. Fetch real-time live open knowledge sources
    let liveSources: any[] = await aggregateLiveKnowledgeSources(cleanQuery, mode, isPro)

    // 2. Search user's internal notes, tasks and graph knowledge in DB
    if (ownerChatId !== 'guest') {
      try {
        const words = cleanQuery.toLowerCase().split(/[\s,.;:!?\-#]+/).filter(w => w.length >= 2)
        const numericOwnerId = BigInt(ownerChatId)

        // Fetch recent notes for user
        const notes = await prisma.note.findMany({
          where: { ownerChatId: numericOwnerId },
          take: 35,
          orderBy: { updatedAt: 'desc' },
        })

        // Fetch recent tasks & reminders for user
        const tasks = await prisma.task.findMany({
          where: { ownerChatId: numericOwnerId },
          take: 35,
          orderBy: { updatedAt: 'desc' },
        })

        const matchedNotes = notes.filter((n: any) => {
          const tagsStr = (n.tags || []).join(' ').toLowerCase()
          const combined = (n.title + ' ' + (n.content || '') + ' ' + tagsStr).toLowerCase()
          return words.some(w => combined.includes(w))
        })

        const matchedTasks = tasks.filter((t: any) => {
          const tagsStr = (t.tags || []).join(' ').toLowerCase()
          const combined = (t.title + ' ' + (t.description || '') + ' ' + tagsStr).toLowerCase()
          return words.some(w => combined.includes(w))
        })

        const chosenNotes = mode === 'notes' && matchedNotes.length === 0
          ? notes.slice(0, 4)
          : matchedNotes.slice(0, 4)

        const chosenTasks = matchedTasks.slice(0, 3)

        const internalSources: any[] = [
          ...chosenNotes.map((n: any) => ({
            title: `📝 Заметка: «${n.title}»`,
            url: `/notes?id=${n.id}`,
            domain: 'zerf.note',
            snippet: (n.content || '').slice(0, 300) || `Заметка с тегами: ${(n.tags || []).join(', ')}`,
            type: 'note',
            noteId: n.id,
          })),
          ...chosenTasks.map((t: any) => ({
            title: `✓ Задача: «${t.title}»`,
            url: `/tasks?id=${t.id}`,
            domain: 'zerf.task',
            snippet: (t.description || t.title) + (t.dueDate ? ` (Срок: ${t.dueDate} ${t.dueTime || ''})` : ''),
            type: 'task',
            taskId: t.id,
          })),
        ]

        if (internalSources.length > 0) {
          if (mode === 'notes') {
            liveSources = [...internalSources, ...liveSources.slice(0, 3)]
          } else {
            liveSources = [...internalSources, ...liveSources.slice(0, 5)]
          }
        }
        liveSources = liveSources.map((s: any, idx: number) => ({ ...s, id: idx + 1 }))
      } catch (err) {
        console.warn('[Entropy API] Internal notes/tasks lookup error:', err)
      }
    }

    const liveContext = liveSources.length > 0
      ? `\n\nФАКТИЧЕСКИЕ ПЕРВОИСТОЧНИКИ:\n` + liveSources.map(s => `[${s.id}] "${s.title}" (${s.domain})\nURL: ${s.url}\nВыжимка: ${s.snippet}`).join('\n\n')
      : ''

    let modePriorityInstruction = ''
    if (mode === 'academic') modePriorityInstruction = 'Академические исследования, научные публикации, методология.'
    else if (mode === 'code') modePriorityInstruction = 'Программный код, техническая документация, архитектурные примеры.'
    else if (mode === 'notes') modePriorityInstruction = 'Поиск по личным заметкам пользователя и синтез с внешними знаниями.'
    else if (mode === 'fast') modePriorityInstruction = 'Быстрый факт-чекинг, краткость, точность.'
    else modePriorityInstruction = 'Всемирная сеть, всесторонний поиск фактов и синтез источников.'

    // Build prompt for factual, human-friendly search with citations
    const prompt = `Ты — поисковый исследовательский ИИ-движок Zerf AI (в стиле Perplexity AI Pro Search) совместно с маскотом «Зерфик».

ПОЛЬЗОВАТЕЛЬСКИЙ ВОПРОС: "${cleanQuery}"
РЕЖИМ: ${mode} (${modePriorityInstruction})
${isPro ? 'РЕЖИМ: PRO SEARCH (Глубокий анализ первоисточников и расширенные инсайты)' : 'РЕЖИМ: STANDARD SEARCH'}
${focus ? `Фокус: ${focus}` : ''}
${liveContext}

ИНСТРУКЦИИ:
1. Дай прямой, ясный, фактологический и понятный ответ на русском языке конкретно на вопрос пользователя.
2. Отвечай СТРОГО ПО СУТИ ВОПРОСА! Категорически запрещено использовать абстрактные шаблоны про «архитектуру», «декомпозицию модулей» или «снижение расходов на 35%», если пользователь не задавал технический вопрос по программированию.
3. Если предоставлены первоисточники, обязательно опирайся на содержащиеся в них факты и расставляй сноски [1], [2], [3] в тексте.
4. Сформируй 2-4 ключевых факта ("takeaways").
5. Предложи 2-3 логичных уточняющих вопроса ("followUpQuestions").
6. Напиши милую и умную реплику от Зерфика ("tikhonyaComment").

ОТВЕТЬ ИСКЛЮЧИТЕЛЬНО В ФОРМАТЕ JSON:
{
  "sources": [
    {
      "id": 1,
      "title": "Название источника",
      "url": "https://domain.com/...",
      "domain": "domain.com",
      "snippet": "Краткая цитата из источника"
    }
  ],
  "answer": "Прямой, фактологический и развернутый ответ на вопрос со сносками [1], [2]...",
  "takeaways": [
    "Ключевой факт 1",
    "Ключевой факт 2"
  ],
  "followUpQuestions": [
    "Уточняющий вопрос 1?",
    "Уточняющий вопрос 2?"
  ],
  "tikhonyaComment": "Зерфик проанализировал источники и подготовил ответ."
}`

    const modelInfo = getEntropyModelForPlan(userPlan, isPro)
    const effectiveModel = modelInfo.model
    let llmResult: any = null

    try {
      const completion = await callGroqChatCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are Zerfik — a factual, concise and smart AI search engine. Always output pure valid JSON adhering to schema. Answer in natural Russian directly to the point. Cite sources as [1], [2]. Never output irrelevant technical jargon or engineering templates when asked about everyday, news, or general knowledge topics.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: effectiveModel,
        apiKey: apiKey || undefined,
        fallbackModels: ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b', 'groq/compound-mini'],
      })

      if (completion?.content) {
        let text = completion.content.trim()
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          text = jsonMatch[0]
        }
        llmResult = JSON.parse(text)
      }
    } catch (e) {
      console.warn('[Entropy API] LLM JSON parse fallback:', e)
    }

    // High quality factual fallback synthesis if LLM failed completely
    if (!llmResult || !Array.isArray(llmResult.sources) || !llmResult.answer) {
      llmResult = generateFallbackResearch(cleanQuery, mode, isPro, liveSources)
    }

    const cleanStr = (s: any) => (typeof s === 'string' ? s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').trim() : '')

    const cleanSources: EntropySource[] = Array.isArray(llmResult.sources) && llmResult.sources.length > 0
      ? llmResult.sources.map((s: any, idx: number) => ({
          id: typeof s.id === 'number' ? s.id : idx + 1,
          title: cleanStr(s.title) || `Источник [${idx + 1}]`,
          url: cleanStr(s.url) || `https://google.com/search?q=${encodeURIComponent(cleanQuery)}`,
          domain: cleanStr(s.domain) || 'web',
          snippet: cleanStr(s.snippet) || '',
        }))
      : liveSources.length > 0
        ? liveSources.map((s, idx) => ({ ...s, id: idx + 1 }))
        : []

    // Increment user's daily usage (persisted in DB)
    if (ownerChatId !== 'guest') {
      await incrementDailyCount(isPro ? COUNTERS.entropyPro : COUNTERS.entropy, ownerChatId)
    }

    const newRegUsed = isPro ? regUsed : regUsed + 1
    const newProUsed = isPro ? proUsed + 1 : proUsed

    const responsePayload: EntropySearchResult = {
      query: cleanQuery,
      mode,
      isPro,
      sources: cleanSources,
      answer: cleanStr(llmResult.answer) || `По запросу «${cleanQuery}» нет прямых совпадений. Попробуйте уточнить формулировку.`,
      takeaways: Array.isArray(llmResult.takeaways)
        ? llmResult.takeaways.map(cleanStr).filter(Boolean)
        : [],
      followUpQuestions: Array.isArray(llmResult.followUpQuestions)
        ? llmResult.followUpQuestions.map(cleanStr).filter(Boolean)
        : [],
      tikhonyaComment: cleanStr(llmResult.tikhonyaComment) || 'Зерфик подготовил ответ на основе проверенных первоисточников.',
      createdAt: new Date().toISOString(),
      usage: {
        used: newRegUsed,
        limit: regularLimit,
        remaining: regularLimit === -1 ? 999999 : Math.max(0, regularLimit - newRegUsed),
        isUnlimited: regularLimit === -1,
        plan: userPlan,
        model: modelInfo.model,
        modelDisplayName: modelInfo.displayName,
        pro: {
          used: newProUsed,
          limit: proLimit,
          remaining: proLimit === -1 ? 999999 : Math.max(0, proLimit - newProUsed),
          isAllowed: proLimit > 0 || proLimit === -1,
          isUnlimited: proLimit === -1,
        },
      },
    }

    return NextResponse.json({ success: true, result: responsePayload })
  } catch (error: any) {
    console.error('[Entropy Search API] Fatal error:', error)
    return NextResponse.json(
      {
        error: 'Внутренняя ошибка поискового движка. Попробуйте повторить запрос позже.',
        details: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}

function generateFallbackResearch(query: string, mode: string, isPro: boolean, liveSources: LiveSource[] = []) {
  const defaultSources: EntropySource[] = [
    {
      id: 1,
      title: `Поиск: ${query}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      domain: 'google.com',
      snippet: `Актуальная информация и результаты поиска по теме: ${query}.`,
    },
    {
      id: 2,
      title: `Энциклопедическая справка: ${query}`,
      url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(query)}`,
      domain: 'wikipedia.org',
      snippet: `Общая информация и хронология по теме ${query}.`,
    },
  ]

  const sources: EntropySource[] = liveSources.length > 0
    ? liveSources.map((s, idx) => ({ ...s, id: idx + 1 }))
    : defaultSources

  let answer = ''
  if (liveSources.length > 0) {
    const items = liveSources
      .filter(s => s.snippet && s.snippet.length > 5)
      .slice(0, 4)
      .map((s, idx) => `• **${s.title}** [${idx + 1}]:\n  ${s.snippet}`)
      .join('\n\n')

    answer = `По вашему запросу **«${query}»** найдены следующие факты из открытых источников:\n\n${items}\n\n_Данные получены из новостных и открытых источников сети._`
  } else {
    answer = `По запросу **«${query}»** не найдено прямых результатов. Попробуйте переформулировать запрос или переключить режим поиска на «Все источники».`
  }

  const takeaways = liveSources.slice(0, 3).map((s, idx) => `[${idx + 1}] ${s.title}`)
  if (takeaways.length === 0) {
    takeaways.push(`Поиск по теме «${query}» завершён.`)
  }

  const followUpQuestions = [
    `Узнать больше подробностей по теме «${query}»?`,
    `Какие ещё вопросы по теме «${query}» вас интересуют?`,
  ]

  return {
    sources,
    answer,
    takeaways,
    followUpQuestions,
    tikhonyaComment: `Зерфик нашел ${sources.length} источников и структурировал факты.`,
  }
}

