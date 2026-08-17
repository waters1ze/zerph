/**
 * Next.js API Route — Groq Chat Completion
 * POST /api/chat
 */
import { NextRequest, NextResponse } from 'next/server'
import { GROQ_API_KEY, GROQ_CHAT_MODEL } from '@/lib/config'
import { callGroqChatCompletion } from '@/lib/backend/groq-pool'

const SYSTEM_PROMPT = `Ты — Zerf AI, интеллектуальный персональный ассистент продуктивности в приложении Zerf.

У тебя есть полный доступ к рабочему пространству пользователя:
1. 👤 ДРУЗЬЯ (Friends): Личные контакты, обмен заметками, совместные задачи с подтверждением, дни рождения и графики. Если задача поступила от друга — четко указывай: «Эту задачу вам передал ваш друг [Имя / @username]» или «Задача от друга».
2. 🏢 КОМАНДЫ (Teams): Корпоративные рабочие пространства, совместные задачи и проекты без подтверждений. Если задача создана в команде — четко указывай: «Задача из команды [Название команды] (автор: [Имя])».
3. 📁 ПРОЕКТЫ (Projects): Структурированные деревья задач, канбан-доски, этапы и контрольные точки (milestones).
4. 📋 ЗАДАЧИ И НАПОМИНАНИЯ: Приоритеты (urgent/high/medium/low), дедлайны, таймеры.
5. 🎯 ЦЕЛИ: Долгосрочные ориентиры с дедлайнами и описаниями.
6. 🔥 ПРИВЫЧКИ: Ежедневные трекеры и серии (стрики).
7. 📌 ЗАМЕТКИ: Идеи, конспекты, документы, списки.

Правила ответов:
- Всегда отвечай на русском языке вежливо, четко, структурированно.
- Используй красивую лаконичную разметку Markdown (списки, жирный шрифт, аккуратные заголовки).
- Помогай планировать день, декомпозировать сложные цели на подзадачи, давать советы по тайм-менеджменту и отвечать на любые вопросы пользователя.
- Если пользователь спрашивает про свои задачи от друзей или из команды — давай точный контекстный ответ на основе переданных данных.`

import { getUserUsageAndLimits, incrementUserUsage, getExistingItemsContext } from '@/lib/backend/db'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized', requiresAuth: true }, { status: 401 })
    }
    const ownerChatId = authUser.chatId

    const limits = await getUserUsageAndLimits(ownerChatId)
    if (!limits.canSendChatMessage) {
      return NextResponse.json({
        error: '❌ Дневной лимит сообщений в ИИ чат исчерпан (10 сообщений в день на бесплатном тарифе). Оформите подписку Zerf Premium за 99 ₽ в Настройках!',
        limitReached: true,
      }, { status: 403 })
    }

    const body = await req.json()

    const { messages, apiKey, context: clientContext, mode } = body
    const groqApiKey = apiKey || req.headers.get('x-groq-api-key') || process.env.GROQ_API_KEY || GROQ_API_KEY

    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'Groq API key missing. Please add it in Settings → AI & Integrations.' },
        { status: 400 }
      )
    }

    const nowMsk = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'full',
      timeStyle: 'medium',
    })

    // Auto-fetch workspace context (notes, tasks, goals) for ownerChatId
    const serverContext = ownerChatId ? await getExistingItemsContext(ownerChatId) : ''

    // Build system message with context
    let systemContent =
      SYSTEM_PROMPT +
      `\n\nТОЧНОЕ ТЕКУЩЕЕ ВРЕМЯ И ДАТА ПОЛЬЗОВАТЕЛЯ (Москва, MSK): ${nowMsk}.\nПри ответах ориентируйся строго на это текущее время!`

    if (serverContext) {
      systemContent += `\n\n## Полный контекст пользователя (Заметки, Задачи, Цели):\n${serverContext}`
    } else if (clientContext) {
      systemContent += `\n\n## User Workspace Context:\n${JSON.stringify(clientContext, null, 2)}`
    }

    const result = await callGroqChatCompletion({
      messages: [{ role: 'system', content: systemContent }, ...messages],
      model: GROQ_CHAT_MODEL,
      temperature: mode === 'enhance' ? 0.8 : 0.7,
      max_tokens: mode === 'enhance' ? 2048 : 1024,
      apiKey: groqApiKey,
    })

    const content = result.content || 'No response from AI.'

    if (ownerChatId) {
      await incrementUserUsage(ownerChatId, 'chat')
    }

    return NextResponse.json({ content })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
