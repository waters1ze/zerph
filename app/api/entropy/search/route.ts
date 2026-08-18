/**
 * GET/POST /api/entropy/search
 * Entropy AI Search — Deep Knowledge & Research Engine (Perplexity AI Style)
 * Supports depth modes: 'lite' (<=500 chars), 'high' (<=1000 chars), 'max' (<=2000 chars)
 * Powered by Groq flagship models: openai/gpt-oss-120b, qwen/qwen3.6-27b
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, isUserAdmin, ROOT_ADMIN_IDS } from '@/lib/backend/auth'
import { prisma } from '@/lib/backend/prisma'
import { aggregateLiveKnowledgeSources, type LiveSource } from '@/lib/backend/entropy-sources'
import { callGroqChatCompletion } from '@/lib/backend/groq-pool'
import {
  getDailyCount,
  incrementDailyCount,
  COUNTERS,
} from '@/lib/backend/plans'
import { getUserUsageAndLimits } from '@/lib/backend/db'

// ── Standard Search Daily Limits (Per-Day Quota) ───────────────────────────
export const ENTROPY_ROLE_LIMITS: Record<string, number> = {
  free: 10,    // 10 searches / day
  plus: 100,   // 100 searches / day
  pro: -1,     // Unlimited
  corp: -1,    // Unlimited
  creator: -1, // Unlimited
  admin: -1,   // Unlimited
}

// ── Pro Search Daily Limits (Deep Multi-Step Web Reasoning) ────────────────
export const ENTROPY_PRO_ROLE_LIMITS: Record<string, number> = {
  free: 0,     // Pro Search is locked on Free tier
  plus: 3,     // 3 Pro searches per day on Zerf Plus (99 RUB)
  pro: 20,     // 20 Pro searches per day on Zerf Pro (299 RUB)
  corp: 100,   // 100 Pro searches per day on Corp
  creator: -1, // Unlimited
  admin: -1,   // Unlimited
}

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
  depth?: 'lite' | 'high' | 'max'
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
    return { model: 'qwen/qwen3.6-27b', displayName: 'Qwen 3.6 27B Fast Reasoning' }
  }
  return { model: 'openai/gpt-oss-20b', displayName: 'GPT-OSS 20B Instant' }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const ownerChatId = authUser?.chatId || 'guest'

    const userLimits = ownerChatId !== 'guest' ? await getUserUsageAndLimits(ownerChatId) : null
    const userPlan = userLimits?.plan || 'free'
    const { regularLimit, proLimit, isUnlimited } = getUserLimits(ownerChatId, userPlan)

    const regUsed = ownerChatId !== 'guest' ? await getDailyCount(COUNTERS.entropy, ownerChatId) : 0
    const proUsed = ownerChatId !== 'guest' ? await getDailyCount(COUNTERS.entropyPro, ownerChatId) : 0

    const modelInfo = getEntropyModelForPlan(userPlan)

    return NextResponse.json({
      success: true,
      usage: {
        used: regUsed,
        limit: regularLimit,
        remaining: regularLimit === -1 ? 999999 : Math.max(0, regularLimit - regUsed),
        isUnlimited: regularLimit === -1,
        plan: userPlan,
        model: modelInfo.model,
        modelDisplayName: modelInfo.displayName,
        pro: {
          used: proUsed,
          limit: proLimit,
          remaining: proLimit === -1 ? 999999 : Math.max(0, proLimit - proUsed),
          isAllowed: proLimit !== 0,
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
    const { query, mode = 'web', isPro = false, focus, depth = 'high', apiKey, userNotes } = body

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Поисковый запрос обязателен' }, { status: 400 })
    }

    const cleanQuery = query.trim()

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

    const words = cleanQuery.toLowerCase().split(/[\s,.;:!?\-#]+/).filter(w => w.length >= 2)

    // 2. Smart Client/User Notes Context Integration
    if (Array.isArray(userNotes) && userNotes.length > 0) {
      const matchedClientNotes = userNotes.filter((n: any) => {
        const combined = ((n.title || '') + ' ' + (n.content || '') + ' ' + (n.tags || []).join(' ')).toLowerCase()
        return words.some(w => combined.includes(w))
      })
      if (matchedClientNotes.length > 0) {
        const noteSources = matchedClientNotes.slice(0, 4).map((n: any) => ({
          title: `📝 Личная заметка: «${n.title || 'Без названия'}»`,
          url: `/notes?id=${n.id}`,
          domain: 'zerf.notes',
          snippet: (n.content || '').slice(0, 300) || `Теги: ${(n.tags || []).join(', ')}`,
          type: 'note',
          noteId: n.id,
        }))
        liveSources = [...noteSources, ...liveSources]
      }
    }

    // 3. Search user's internal notes, tasks and graph knowledge in DB
    if (ownerChatId !== 'guest') {
      try {
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
            const existingTitles = new Set(liveSources.map(s => s.title))
            const newInternal = internalSources.filter(s => !existingTitles.has(s.title))
            liveSources = [...newInternal, ...liveSources.slice(0, 6)]
          }
        }
      } catch (err) {
        console.warn('[Entropy API] Internal notes/tasks lookup error:', err)
      }
    }

    liveSources = liveSources.map((s: any, idx: number) => ({ ...s, id: idx + 1 }))

    const liveContext = liveSources.length > 0
      ? `\n\nФАКТИЧЕСКИЕ ПЕРВОИСТОЧНИКИ И ЗАМЕТКИ:\n` + liveSources.map(s => `[${s.id}] "${s.title}" (${s.domain})\nURL: ${s.url}\nВыжимка: ${s.snippet}`).join('\n\n')
      : ''

    let modePriorityInstruction = ''
    if (mode === 'academic') modePriorityInstruction = 'Академические исследования, научные публикации, методология.'
    else if (mode === 'code') modePriorityInstruction = 'Программный код, техническая документация, архитектурные примеры.'
    else if (mode === 'notes') modePriorityInstruction = 'Поиск по личным заметкам пользователя и синтез с внешними знаниями.'
    else if (mode === 'fast') modePriorityInstruction = 'Быстрый факт-чекинг, краткость, точность.'
    else modePriorityInstruction = 'Всемирная сеть, всесторонний поиск фактов и синтез источников.'

    let depthInstruction = ''
    if (depth === 'lite') {
      depthInstruction = `ОБЪЁМ ОТВЕТА: РЕЖИМ LITE (КРАТКИЙ БЛИЦ).
- Длина ответа: СТРОГО ДО 500 СИМВОЛОВ.
- Стиль: 1-2 кратких емких предложения с ключевой сутью и сносками [1], [2]. Без лишних вводных слов.`
    } else if (depth === 'max') {
      depthInstruction = `ОБЪЁМ ОТВЕТА: РЕЖИМ MAX (ГЛУБОКИЙ АНАЛИТИЧЕСКИЙ ОТЧЕТ).
- Длина ответа: ДО 2000 СИМВОЛОВ (полноценный развернутый лонгрид).
- Стиль: исчерпывающий разбор предыстории, хронологии, ключевых нюансов, мнений экспертов и последствий. Используй структурированные абзацы и множественные сноски [1], [2], [3], [4].`
    } else {
      depthInstruction = `ОБЪЁМ ОТВЕТА: РЕЖИМ HIGH (СТАНДАРТНЫЙ АНАЛИЗ).
- Длина ответа: ДО 1000 СИМВОЛОВ.
- Стиль: подробный структурированный ответ с ключевыми подробностями, аргументами, фактами и сносками [1], [2].`
    }

    // Build prompt for factual, human-friendly search with citations
    const prompt = `Ты — поисковый исследовательский ИИ-движок Zerf AI (в стиле Perplexity AI Pro Search) совместно с маскотом «Зерфик».

ПОЛЬЗОВАТЕЛЬСКИЙ ВОПРОС: "${cleanQuery}"
РЕЖИМ ПОИСКА: ${mode} (${modePriorityInstruction})
${isPro ? 'РЕЖИМ СКАНИРОВАНИЯ: ⚡ PRO SEARCH (Глубокий многоступенчатый анализ первоисточников, перекрестная верификация фактов и расширенные инсайты)' : 'РЕЖИМ СКАНИРОВАНИЯ: STANDARD SEARCH'}
${depthInstruction}
${focus ? `Фокус анализа: ${focus}` : ''}
${liveContext}

ИНСТРУКЦИИ:
1. Дай прямой, ясный, фактологический и понятный ответ на русском языке конкретно на вопрос пользователя.
2. Отвечай СТРОГО ПО СУТИ ВОПРОСА! Категорически запрещено использовать абстрактные шаблоны про «архитектуру», «декомпозицию модулей» или «снижение расходов на 35%», если пользователь не задавал технический вопрос по программированию.
3. Если предоставлены первоисточники или личные заметки, обязательно опирайся на содержащиеся в них факты и расставляй сноски [1], [2], [3] в тексте.
4. Строго соблюдай запрошенный объём символов (${depth === 'lite' ? 'до 500 симв.' : depth === 'max' ? 'до 2000 симв.' : 'до 1000 симв.'}).
5. Сформируй 2-4 ключевых факта ("takeaways").
6. Предложи 2-3 логичных уточняющих вопроса ("followUpQuestions").
7. Напиши милую и умную реплику от Зерфика ("tikhonyaComment").

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
  "answer": "Прямой, фактологический и точный ответ на вопрос со сносками [1], [2]...",
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
        apiKey: apiKey || process.env.GROQ_API_KEY,
        response_format: { type: 'json_object' },
        temperature: 0.2,
      })

      const raw = completion.content || '{}'
      const jsonStart = raw.indexOf('{')
      const jsonEnd = raw.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd !== -1) {
        llmResult = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
      }
    } catch (err: any) {
      console.warn('[Entropy API] Primary Groq model error, attempting fallback synthesis:', err?.message)
      llmResult = generateFallbackResearch(cleanQuery, liveSources, mode, isPro, depth)
    }

    if (!llmResult || !llmResult.answer) {
      llmResult = generateFallbackResearch(cleanQuery, liveSources, mode, isPro, depth)
    }

    // Merge live sources with LLM sources
    const finalSources: EntropySource[] = (liveSources.length > 0 ? liveSources : (llmResult.sources || [])).map((s: any, idx: number) => ({
      id: idx + 1,
      title: s.title || `Источник #${idx + 1}`,
      url: s.url || '',
      domain: s.domain || (s.url ? new URL(s.url).hostname : 'web'),
      snippet: s.snippet || '',
      type: s.type || 'web',
      noteId: s.noteId,
      taskId: s.taskId,
    }))

    // Increment user usage counter in DB
    if (ownerChatId !== 'guest') {
      await incrementDailyCount(isPro ? COUNTERS.entropyPro : COUNTERS.entropy, ownerChatId)
    }

    const payload: EntropySearchResult = {
      query: cleanQuery,
      mode,
      depth: depth as 'lite' | 'high' | 'max',
      isPro,
      sources: finalSources,
      answer: llmResult.answer || 'Ответ подготовлен на основе собранных первоисточников.',
      takeaways: Array.isArray(llmResult.takeaways) ? llmResult.takeaways : [],
      followUpQuestions: Array.isArray(llmResult.followUpQuestions) ? llmResult.followUpQuestions : [],
      tikhonyaComment: llmResult.tikhonyaComment || 'Зерфик проверил актуальные источники.',
      createdAt: new Date().toISOString(),
      usage: {
        used: (isPro ? proUsed : regUsed) + 1,
        limit: isPro ? proLimit : regularLimit,
        remaining: (isPro ? proLimit : regularLimit) === -1 ? 999999 : Math.max(0, (isPro ? proLimit : regularLimit) - ((isPro ? proUsed : regUsed) + 1)),
        isUnlimited: (isPro ? proLimit : regularLimit) === -1,
        plan: userPlan,
        model: effectiveModel,
        modelDisplayName: modelInfo.displayName,
        pro: {
          used: proUsed + (isPro ? 1 : 0),
          limit: proLimit,
          remaining: proLimit === -1 ? 999999 : Math.max(0, proLimit - (proUsed + (isPro ? 1 : 0))),
          isAllowed: proLimit !== 0,
          isUnlimited: proLimit === -1,
        },
      },
    }

    return NextResponse.json(payload)
  } catch (error: any) {
    console.error('[Entropy API] POST Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Ошибка обработки поискового запроса' },
      { status: 500 }
    )
  }
}

/**
 * Fallback research generator when LLM inference is unreachable
 */
function generateFallbackResearch(
  query: string,
  liveSources: any[],
  mode: string,
  isPro: boolean,
  depth: string = 'high'
) {
  const sources = liveSources.length > 0
    ? liveSources
    : [
        {
          id: 1,
          title: `Материалы и публикации по теме «${query}»`,
          url: 'https://news.google.com',
          domain: 'news.google.com',
          snippet: 'Актуальные материалы и новости из открытых источников.',
        },
      ]

  const citations = sources.slice(0, 3).map((_, i) => `[${i + 1}]`).join('')

  let answer = ''
  if (sources.length > 0 && sources[0].snippet) {
    const snippetsText = sources.slice(0, 3).map(s => s.snippet).filter(Boolean).join('. ')
    answer = `По запросу «${query}» найдены следующие актуальные данные: ${snippetsText} ${citations}`
  } else {
    answer = `По запросу «${query}» сформирована сводка на основе ${sources.length} первоисточников ${citations}.`
  }

  return {
    sources,
    answer,
    takeaways: [
      `Найдено ${sources.length} актуальных источников по запросу.`,
      `Первоисточники содержат подтвержденные данные о событии.`,
    ],
    followUpQuestions: [
      `Узнать подробности о «${query}»?`,
      `Посмотреть хронологию событий?`,
    ],
    tikhonyaComment: 'Зерфик собрал ключевые материалы из открытых источников.',
  }
}
