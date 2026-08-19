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
import { getUserUsageAndLimits, parseBirthday } from '@/lib/backend/db'

function getDaysUntilBirthday(bdayStr: string, now: Date): number | null {
  const parsed = parseBirthday(bdayStr)
  if (!parsed) return null

  const curYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12
  const currentDay = now.getDate()

  // Target date this year or next year
  let targetYear = curYear
  if (parsed.month < currentMonth || (parsed.month === currentMonth && parsed.day < currentDay)) {
    targetYear = curYear + 1
  }

  const targetDate = new Date(targetYear, parsed.month - 1, parsed.day)
  const todayDate = new Date(curYear, now.getMonth(), now.getDate())

  const diffMs = targetDate.getTime() - todayDate.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

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
    const { query, mode = 'web', isPro = false, focus, depth = 'high', apiKey, userNotes, userTasks, userGoals } = body

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

    const STOPWORDS = new Set([
      'какой', 'какую', 'какие', 'какая', 'каком', 'каких',
      'что', 'кто', 'где', 'когда', 'куда', 'откуда', 'почему', 'зачем', 'как',
      'информация', 'информацию', 'информации', 'информацией',
      'сегодня', 'сейчас', 'завтра', 'вчера', 'дня', 'день',
      'мне', 'меня', 'мной', 'тебе', 'тебя', 'тобой', 'нам', 'вас', 'вам',
      'дашь', 'дай', 'даст', 'покажи', 'расскажи', 'найди', 'посоветуй',
      'есть', 'быть', 'был', 'была', 'были', 'будет', 'будут',
      'на', 'в', 'во', 'по', 'к', 'ко', 'с', 'со', 'из', 'от', 'до', 'для', 'о', 'об', 'обо', 'про',
      'и', 'или', 'но', 'а', 'да', 'же', 'ли', 'бы', 'не', 'ни',
      'это', 'этот', 'эта', 'эти', 'этом', 'тот', 'та', 'те', 'том',
      'все', 'всё', 'весь', 'вся', 'всех', 'всем',
      'очень', 'просто', 'тоже', 'также', 'только', 'еще', 'ещё', 'уже',
    ])

    const now = new Date()
    const mskParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now)
    const todayStr = `${mskParts.find(p => p.type === 'year')?.value}-${mskParts.find(p => p.type === 'month')?.value}-${mskParts.find(p => p.type === 'day')?.value}`

    const isPersonalWorkspaceQuery = (
      mode === 'notes' ||
      /\b(?:мои|моя|моё|мое|мой|моих|мне|моем|моём|задач[аиеу]|дела|план[ыаов]|заметк[аиеу]|расписани[еи]|список|цел[ьи]|напоминани[яе])\b/i.test(cleanQuery)
    )

    const meaningfulWords = cleanQuery
      .toLowerCase()
      .split(/[\s,.;:!?\-#]+/)
      .filter(w => w.length >= 3 && !STOPWORDS.has(w))

    const isActualPendingTask = (t: any) => {
      if (t.status === 'done' || t.status === 'draft') return false
      if (t.completedAt) return false
      if (t.dueDate && t.dueDate < todayStr) return false // Past date
      // Exclude raw birthday reminder tasks (they are processed in the birthday engine)
      if (t.tags?.includes('день рождения') || t.tags?.includes('мой день рождения') || t.title.startsWith('🎂')) return false
      return true
    }

    // 2. Smart Client Workspace Context Integration (Notes, Tasks, Goals)
    const clientSources: any[] = []

    if (Array.isArray(userNotes) && userNotes.length > 0 && isPersonalWorkspaceQuery && meaningfulWords.length > 0) {
      const matchedClientNotes = userNotes.filter((n: any) => {
        const combined = ((n.title || '') + ' ' + (n.content || '') + ' ' + (n.tags || []).join(' ')).toLowerCase()
        return meaningfulWords.some(w => combined.includes(w))
      })
      matchedClientNotes.slice(0, 3).forEach((n: any) => {
        clientSources.push({
          title: `📝 Заметка: «${n.title || 'Без названия'}»`,
          url: `/notes?id=${n.id}`,
          domain: 'zerf.notes',
          snippet: (n.content || '').slice(0, 350) || `Теги: ${(n.tags || []).join(', ')}`,
          type: 'note',
          noteId: n.id,
        })
      })
    }

    if (Array.isArray(userTasks) && userTasks.length > 0 && isPersonalWorkspaceQuery) {
      const matchedClientTasks = userTasks.filter((t: any) => {
        if (!isActualPendingTask(t)) return false
        if (meaningfulWords.length === 0) return true // general tasks question
        const combined = ((t.title || '') + ' ' + (t.tags || []).join(' ')).toLowerCase()
        return meaningfulWords.some(w => combined.includes(w))
      })
      matchedClientTasks.slice(0, 3).forEach((t: any) => {
        clientSources.push({
          title: `✓ Задача: «${t.title}»`,
          url: `/tasks?id=${t.id}`,
          domain: 'zerf.tasks',
          snippet: `Актуальная задача: «${t.title}» (Срок: ${t.dueDate || 'сегодня'}, статус: в процессе)`,
          type: 'task',
          taskId: t.id,
        })
      })
    }

    if (Array.isArray(userGoals) && userGoals.length > 0 && isPersonalWorkspaceQuery) {
      const matchedClientGoals = userGoals.filter((g: any) => {
        if (meaningfulWords.length === 0) return true
        const combined = (g.title || '').toLowerCase()
        return meaningfulWords.some(w => combined.includes(w))
      })
      matchedClientGoals.slice(0, 2).forEach((g: any) => {
        clientSources.push({
          title: `🎯 Цель: «${g.title}»`,
          url: `/goals?id=${g.id}`,
          domain: 'zerf.goals',
          snippet: `Цель: «${g.title}» (Прогресс: ${g.progress || 0}%${g.deadline ? `, дедлайн: ${g.deadline}` : ''})`,
          type: 'goal',
          goalId: g.id,
        })
      })
    }

    if (clientSources.length > 0) {
      liveSources = [...clientSources, ...liveSources]
    }

    // 3. Search user's internal notes, tasks in DB (ONLY if personal workspace query)
    if (ownerChatId !== 'guest' && isPersonalWorkspaceQuery) {
      try {
        const numericOwnerId = BigInt(ownerChatId)

        const notes = await prisma.note.findMany({
          where: { ownerChatId: numericOwnerId },
          take: 35,
          orderBy: { updatedAt: 'desc' },
        })

        const tasks = await prisma.task.findMany({
          where: { ownerChatId: numericOwnerId },
          take: 35,
          orderBy: { updatedAt: 'desc' },
        })

        const matchedNotes = notes.filter((n: any) => {
          if (meaningfulWords.length === 0) return true
          const tagsStr = (n.tags || []).join(' ').toLowerCase()
          const combined = (n.title + ' ' + (n.content || '') + ' ' + tagsStr).toLowerCase()
          return meaningfulWords.some(w => combined.includes(w))
        })

        const matchedTasks = tasks.filter((t: any) => {
          if (!isActualPendingTask(t)) return false
          if (meaningfulWords.length === 0) return true
          const tagsStr = (t.tags || []).join(' ').toLowerCase()
          const combined = (t.title + ' ' + (t.description || '') + ' ' + tagsStr).toLowerCase()
          return meaningfulWords.some(w => combined.includes(w))
        })

        const chosenNotes = matchedNotes.slice(0, 3)
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
            snippet: `Актуальная задача: «${t.title}» (Срок: ${t.dueDate || 'сегодня'}, статус: в процессе)`,
            type: 'task',
            taskId: t.id,
          })),
        ]

        if (internalSources.length > 0) {
          const existingTitles = new Set(liveSources.map(s => s.title))
          const newInternal = internalSources.filter(s => !existingTitles.has(s.title))
          liveSources = [...newInternal, ...liveSources.slice(0, 6)]
        }
      } catch (err) {
        console.warn('[Entropy API] Internal notes/tasks lookup error:', err)
      }
    }

    // 4. Calculate Upcoming Birthdays within 7 days (За неделю до самого ДР)
    const upcomingBirthdays: { name: string; daysLeft: number; displayDate: string }[] = []

    const allBdayTasks = [
      ...(Array.isArray(userTasks) ? userTasks : []),
    ].filter((t: any) => t.tags?.includes('день рождения') || t.title.startsWith('🎂'))

    for (const bt of allBdayTasks) {
      if (bt.dueDate) {
        const days = getDaysUntilBirthday(bt.dueDate, now)
        if (days !== null && days >= 0 && days <= 7) {
          const cleanName = bt.title.replace(/^🎂\s*(?:День рождения:?\s*)?/, '').trim() || 'Друг'
          if (!upcomingBirthdays.some(b => b.name.toLowerCase() === cleanName.toLowerCase())) {
            upcomingBirthdays.push({
              name: cleanName,
              daysLeft: days,
              displayDate: bt.dueDate,
            })
          }
        }
      }
    }

    if (ownerChatId !== 'guest') {
      try {
        const numericOwnerId = BigInt(ownerChatId)
        const userChat = await prisma.telegramChat.findUnique({
          where: { chatId: numericOwnerId },
          select: { birthday: true, firstName: true },
        })
        if (userChat?.birthday) {
          const days = getDaysUntilBirthday(userChat.birthday, now)
          if (days !== null && days >= 0 && days <= 7) {
            upcomingBirthdays.unshift({
              name: 'Твой День рождения',
              daysLeft: days,
              displayDate: userChat.birthday,
            })
          }
        }

        const friendships = await prisma.friendship.findMany({
          where: { OR: [{ userChatId: numericOwnerId }, { friendChatId: numericOwnerId }] },
        })
        const friendIds = friendships.map(f => f.userChatId === numericOwnerId ? f.friendChatId : f.userChatId)
        if (friendIds.length > 0) {
          const friendChats = await prisma.telegramChat.findMany({
            where: { chatId: { in: friendIds }, birthday: { not: null } },
            select: { firstName: true, username: true, birthday: true },
          })
          for (const fc of friendChats) {
            if (fc.birthday) {
              const days = getDaysUntilBirthday(fc.birthday, now)
              if (days !== null && days >= 0 && days <= 7) {
                const fName = fc.firstName || (fc.username ? `@${fc.username}` : 'Друг')
                if (!upcomingBirthdays.some(b => b.name.toLowerCase() === fName.toLowerCase())) {
                  upcomingBirthdays.push({
                    name: fName,
                    daysLeft: days,
                    displayDate: fc.birthday,
                  })
                }
              }
            }
          }
        }
      } catch {}
    }

    liveSources = liveSources.map((s: any, idx: number) => ({ ...s, id: idx + 1 }))

    let liveContext = liveSources.length > 0
      ? `\n\nФАКТИЧЕСКИЕ ПЕРВОИСТОЧНИКИ И ЗАМЕТКИ:\n` + liveSources.map(s => `[${s.id}] "${s.title}" (${s.domain})\nURL: ${s.url}\nВыжимка: ${s.snippet}`).join('\n\n')
      : ''

    if (upcomingBirthdays.length > 0) {
      const bdaysText = upcomingBirthdays.map(b => {
        const when = b.daysLeft === 0 ? 'СЕГОДНЯ! 🎉' : b.daysLeft === 1 ? 'ЗАВТРА! 🎁' : `через ${b.daysLeft} дн. (${b.displayDate})`
        return `• 🎂 ${b.name}: ${when}`
      }).join('\n')
      liveContext += `\n\n🎂 БЛИЖАЙШИЕ ДНИ РОЖДЕНИЯ (в течение 7 дней):\n${bdaysText}\n(ОБЯЗАТЕЛЬНО упомяни эти ближайшие праздники в предложениях/рекомендациях и предложи идеи подарков/поздравлений!)`
    }

    let modePriorityInstruction = ''
    if (mode === 'academic') modePriorityInstruction = 'Академические исследования, научные публикации, методология.'
    else if (mode === 'code') modePriorityInstruction = 'Программный код, техническая документация, архитектурные примеры.'
    else if (mode === 'notes') modePriorityInstruction = 'Поиск по личным заметкам пользователя и синтез с внешними знаниями.'
    else if (mode === 'fast') modePriorityInstruction = 'Быстрый факт-чекинг, краткость, точность.'
    else modePriorityInstruction = 'Всемирная сеть, всесторонний поиск фактов и синтез источников.'

    const isDeepReport = depth === 'max' || isPro

    let depthInstruction = ''
    if (depth === 'lite') {
      depthInstruction = `ОБЪЁМ И СТРУКТУРА: РЕЖИМ LITE (КРАТКИЙ БЛИЦ, ДО 400 СИМВОЛОВ).
- Напиши краткий, ёмкий ответ в 1–2 предложения с главными фактами и сносками [1], [2]. Без лишних вводных слов.`
    } else if (depth === 'max') {
      depthInstruction = `ОБЪЁМ И СТРУКТУРА: РЕЖИМ MAX (РАЗВЕРНУТЫЙ ГЛУБОКИЙ ЛОНГРИД, 1500–2500 СИМВОЛОВ).
- ТРЕБОВАНИЕ: Напиши масштабный, детальный и всесторонний аналитический отчет из 3–5 развернутых абзацев!
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать короткий ответ в один абзац. Обязательно раскрой тему глубоко и подробно:
  1) 📌 Полная картина и ключевой контекст темы/событий;
  2) 🔍 Детальный разбор каждого факта или новости с цитатами и сносками [1], [2], [3], [4];
  3) 📊 Причины, статистика, историческая ретроспектива и мнения экспертов;
  4) 🔮 Анализ последствий, влияние на индустрию/общество и дальнейшие сценарии развития.
- Длина ответа "answer" ДОЛЖНА быть не менее 1500 символов!`
    } else {
      depthInstruction = `ОБЪЁМ И СТРУКТУРА: РЕЖИМ HIGH (РАЗВЕРНУТЫЙ АНАЛИЗ, 800–1200 СИМВОЛОВ).
- ОБЯЗАТЕЛЬНО напиши подробный, содержательный и структурированный ответ из 2–3 полноценных абзацев!
- Запрещено писать короткий ответ в 1-2 предложения! Разверни факты, контекст, предысторию и подробности со сносками [1], [2], [3].
- Объём ответа "answer" должен составлять от 800 до 1200 символов.`
    }

    if (isPro) {
      depthInstruction += `\n\n⚡ РЕЖИМ PRO SEARCH АКТИВИРОВАН:
- Проведи глубокую перекрестную верификацию источников, выдели неочевидные инсайты, скрытые нюансы и расширенную экспертную аналитику.
- Сделай ответ максимально профессиональным и всесторонне проработанным.`
    }

    // Build prompt for high-intelligence factual, human-friendly search with citations
    const prompt = `Ты — высокоинтеллектуальный исследовательский ИИ-движок Zerf AI (в стиле Perplexity AI Pro Search / ChatGPT Search) совместно с маскотом «Зерфик».

ПОЛЬЗОВАТЕЛЬСКИЙ ВОПРОС: "${cleanQuery}"
РЕЖИМ ПОИСКА: ${mode} (${modePriorityInstruction})
${isPro ? 'РЕЖИМ СКАНИРОВАНИЯ: ⚡ PRO SEARCH (Глубокий многоступенчатый анализ первоисточников, перекрестная верификация фактов и расширенные инсайты)' : 'РЕЖИМ СКАНИРОВАНИЯ: STANDARD SEARCH'}
${depthInstruction}
${focus ? `Фокус анализа: ${focus}` : ''}
${liveContext}

ИНСТРУКЦИИ:
1. Дай прямой, живой, фактологический и максимально полезный ответ на русском языке конкретно на вопрос пользователя.
2. ГЛУБОКИЙ КОНТЕКСТУАЛЬНЫЙ ИНТЕЛЛЕКТ:
   - Если вопрос касается ОБЩЕЙ СВОДКИ ИЛИ НОВОСТЕЙ НА СЕГОДНЯ («какую информацию на сегодня мне дашь?», «новости на сегодня», «что произошло в мире»):
     • Сформируй структурированную картину главных актуальных новостей дня (мировые события, технологии, культура, экономика) на основе новостных первоисточников.
     • КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО подмешивать личные выполненные задачи пользователя в мировые новости!
   - Если в контексте есть блок «БЛИЖАЙШИЕ ДНИ РОЖДЕНИЯ» (дни рождения за 7 дней до даты):
     • Обязательно выдели их в предложениях/рекомендациях: напомни поздравить человека и предложи 2–3 классные идеи подарка/сюрприза!
     • Внимание: упоминай дни рождения ТОЛЬКО если они указаны в блоке ближайших (до 7 дней). Если праздников нет или они дальше чем через неделю — не придумывай их.
   - Если вопрос касается ЗАДАЧ И РАСПИСАНИЯ ПОЛЬЗОВАТЕЛЯ:
     • Учитывай ИСКЛЮЧИТЕЛЬНО активные предстоящие задачи на сегодня и будущее. Прошлые выполненные дела полностью исключены.
   - Если вопрос касается ПОДАРКА или ДНЯ РОЖДЕНИЯ (например: «Что подарить на день рождения: Лерочч?»):
     • Предложи 4 конкретные вдохновляющие категории подарков:
       1) 🎁 Впечатления и эмоции (мастер-классы, спа, концерты, квесты).
       2) 💡 Практичные и полезные вещи (уют для дома, качественные аксессуары, полезный софт/подписки).
       3) ✨ Стильные и памятные подарки (украшения, персонализированные подарки, фотокниги).
       4) 📱 Современные гаджеты и хобби (наушники, умные лампы, книги, настолки).
     • Укажи варианты под разный бюджет (до 1500 ₽, 3000–5000 ₽, премиум).
     • Приведи 2 небанальных, красивых варианта поздравления и идею, как необычно упаковать или вручить.
   - Если вопрос касается ЗАДАЧИ, ПРОЕКТА, УЧЕБЫ, ПУТЕШЕСТВИЯ или ПОКУПКИ:
     • Дай четкий структурированный пошаговый план, лайфхаки, неочевидные подводные камни и чек-лист.
   - Если вопрос касается ПОЛИТИКИ, НОВОСТЕЙ, НАУКИ или ФАКТОВ:
     • Проведи объективный анализ первоисточников, укажи точные факты, хронологию и расставь сноски [1], [2], [3].
3. Категорически запрещено использовать абстрактные шаблоны про «архитектуру», «декомпозицию модулей» или «снижение расходов на 35%», если пользователь не задавал вопрос по программированию!
4. Если предоставлены первоисточники или личные заметки/задачи, обязательно опирайся на содержащиеся в них факты и расставляй сноски [1], [2], [3] в тексте.
5. Строго соблюдай запрошенный объём символов (${depth === 'lite' ? 'до 400 симв.' : depth === 'max' ? 'ОТ 1500 ДО 2500 симв. (длинный лонгрид!)' : 'ОТ 800 ДО 1200 симв. (2–3 развернутых абзаца)'}).
6. Сформируй 2-4 ключевых вывода/инсайта ("takeaways").
7. Предложи 2-3 логичных уточняющих вопроса ("followUpQuestions").
8. Напиши умный, тёплый и живой комментарий от Зерфика ("tikhonyaComment"), отражающий суть вопроса.

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
  "tikhonyaComment": "Зерфик исследовал тему и подготовил персональный ответ ✨"
}`

    const modelInfo = getEntropyModelForPlan(userPlan, isPro)
    const effectiveModel = modelInfo.model
    let llmResult: any = null

    const systemPrompt = isDeepReport
      ? 'You are Zerfik — a deep, comprehensive and analytical AI research engine (like Perplexity Pro Search). Write extensive, multi-paragraph in-depth reports in Russian with rich context, timeline, data points, nuances and precise source citations [1], [2], [3]. Never output short summaries when in Max or Pro Search mode. Always output pure valid JSON.'
      : depth === 'lite'
      ? 'You are Zerfik — a fast, ultra-concise AI search engine (Lite mode). Write brief 1-2 sentence answers in Russian with key source citations. Always output pure valid JSON.'
      : 'You are Zerfik — a smart, comprehensive and factual AI search engine. Write well-rounded, detailed 2-3 paragraph answers in Russian with rich context, key facts and source citations [1], [2]. Do not make the answer too brief or one-sentence. Always output pure valid JSON.'

    try {
      const completion = await callGroqChatCompletion({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: effectiveModel,
        apiKey: apiKey || process.env.GROQ_API_KEY,
        response_format: { type: 'json_object' },
        temperature: isDeepReport ? 0.35 : depth === 'lite' ? 0.2 : 0.28,
        max_tokens: isDeepReport ? 3500 : depth === 'lite' ? 800 : 2200,
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
