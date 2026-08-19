/**
 * Next.js API Route — Zerf AI Full-Action Chat & Agent Engine
 * POST /api/chat
 */
import { NextRequest, NextResponse } from 'next/server'
import { GROQ_API_KEY } from '@/lib/config'
import { callGroqChatCompletion, groqPool, getHuggingFaceTokens, getModelForUserPlan } from '@/lib/backend/groq-pool'
import { parseIntentWithGroq } from '@/lib/backend/groq'
import {
  getUserUsageAndLimits,
  incrementUserUsage,
  getExistingItemsContext,
  saveParsedItemToDb,
  getAllTasks,
  getAllGoals,
  getAllNotes,
} from '@/lib/backend/db'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'
import { getUserExtensionsAIContext } from '@/lib/backend/extensions'

const SYSTEM_PROMPT = `Ты — Zerf AI, интеллектуальный персональный ассистент продуктивности в приложении Zerf.

У тебя есть полный доступ к рабочему пространству пользователя:
1. 👤 ДРУЗЬЯ (Friends): Личные контакты, обмен заметками, совместные задачи с подтверждением, дни рождения и графики.
2. 🏢 КОМАНДЫ (Teams): Корпоративные рабочие пространства, совместные задачи и проекты.
3. 📁 ПРОЕКТЫ (Projects): Структурированные деревья задач, канбан-доски, этапы и контрольные точки (milestones).
4. 📋 ЗАДАЧИ И НАПОМИНАНИЯ: Приоритеты (urgent/high/medium/low), дедлайны, таймеры.
5. 🎯 ЦЕЛИ: Долгосрочные ориентиры с дедлайнами и описаниями.
6. 🔥 ПРИВЫЧКИ: Ежедневные трекеры и серии (стрики).
7. 📌 ЗАМЕТКИ: Идеи, конспекты, документы, списки.
8. 🎨 ТЕМЫ И КАСТОМИЗАЦИЯ ОФОРМЛЕНИЯ (Themes & GitHub Design Engine).

Правила ответов:
- Всегда отвечай на русском языке вежливо, живо, стильно, современно.
- Используй программные и современные эмодзи (✨, ⚡, 🎯, 📊, 🚀, 💎, ⏳, 🛡️, 🔥, 💡).
- Используй красивую лаконичную разметку Markdown (списки, жирный шрифт, аккуратные блоки кода).
- Помогай планировать день, декомпозировать сложные цели на подзадачи, давать советы по тайм-менеджменту и отвечать на любые вопросы пользователя.`

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
    const { messages = [], apiKey, context: clientContext, mode } = body
    const groqApiKey = apiKey || req.headers.get('x-groq-api-key') || process.env.GROQ_API_KEY || GROQ_API_KEY
    const hasKeys = groqPool.getKeysCount() > 0 || getHuggingFaceTokens().length > 0 || Boolean(groqApiKey)

    if (!hasKeys) {
      return NextResponse.json(
        { error: 'Groq API key missing. Please add it in Settings → AI & Integrations.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const nowMsk = now.toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'full',
      timeStyle: 'medium',
    })
    const todayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now)

    // Extract the latest user input
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').slice(-1)[0]
    const userText = (lastUserMessage?.content || '').trim()
    const cleanLower = userText.toLowerCase().trim()

    // ── 1. FAST COMMAND DISPATCHERS (Stats, Today, Goals, Matrix, Notes) ──

    // A. Today's Plan (/today)
    if (cleanLower === '/today' || cleanLower === 'план на сегодня' || cleanLower === '📅 план на сегодня' || cleanLower === 'что на сегодня' || cleanLower === 'что у меня на сегодня?') {
      const allTasks = await getAllTasks(ownerChatId)
      const todayTasks = allTasks.filter(t => t.status !== 'done' && (t.dueDate === todayYmd || (!t.dueDate && t.status !== 'done')))
      const doneToday = allTasks.filter(t => t.status === 'done' && (t.completedAt?.slice(0, 10) === todayYmd || t.dueDate === todayYmd))

      let reply = `📅 **План на сегодня (${todayYmd})**\n\n`
      if (todayTasks.length === 0) {
        reply += `✨ **Все задачи на сегодня выполнены или список пуст!**\nОтличный повод спланировать новые цели или отдохнуть. 🌴\n`
      } else {
        reply += `⚡ **Активных задач:** \`${todayTasks.length}\`\n\n`
        todayTasks
          .sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'))
          .forEach((t, i) => {
            const timeStr = t.dueTime ? ` ⏰ \`${t.dueTime}\`` : ''
            const pEmoji = t.priority === 'urgent' ? '🔴' : t.priority === 'high' ? '🟠' : t.priority === 'medium' ? '🟢' : '🔵'
            reply += `${i + 1}. ${pEmoji} **${t.title}**${timeStr}\n`
          })
      }

      if (doneToday.length > 0) {
        reply += `\n✔️ **Уже завершено сегодня:** \`${doneToday.length}\` задач.\n`
      }

      if (ownerChatId) await incrementUserUsage(ownerChatId, 'chat')

      return NextResponse.json({
        content: reply,
        action: {
          type: 'schedule_view',
          targetType: 'today',
          title: 'План на сегодня',
        },
      })
    }

    // B. Goals Summary (/goals)
    if (cleanLower === '/goals' || cleanLower === 'сводка по целям' || cleanLower === '🎯 сводка по целям' || cleanLower === 'мои цели') {
      const goals = await getAllGoals(ownerChatId)
      let reply = `🎯 **Сводка по твоим целям**\n\n`
      if (goals.length === 0) {
        reply += `💡 **У вас пока нет добавленных целей.**\nНапишите мне: *«Поставь цель выучить английский до конца года»*, и я мгновенно сформирую цель с майлстоунами!\n`
      } else {
        goals.forEach(g => {
          const pct = Math.round(g.progress)
          const filled = Math.round(pct / 10)
          const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)
          reply += `🚩 **${g.title}**\n`
          reply += `\`${bar}\` **${pct}%**\n`
          if (g.deadline) reply += `⏳ Дедлайн: \`${g.deadline}\`\n`
          reply += `\n`
        })
      }

      if (ownerChatId) await incrementUserUsage(ownerChatId, 'chat')

      return NextResponse.json({
        content: reply,
        action: {
          type: 'stats_summary',
          targetType: 'goals',
          title: 'Сводка по целям',
        },
      })
    }

    // C. Analytics & Streaks (/stats)
    if (cleanLower === '/stats' || cleanLower === 'аналитика и стрик' || cleanLower === '📊 аналитика и стрик' || cleanLower === 'статистика') {
      const allTasks = await getAllTasks(ownerChatId)
      const done = allTasks.filter(t => t.status === 'done').length
      const active = allTasks.filter(t => t.status !== 'done').length
      const overdue = allTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayYmd).length
      const total = allTasks.length
      const rate = total > 0 ? Math.round((done / total) * 100) : 0

      let reply = `📊 **Живая аналитика продуктивности**\n\n`
      reply += `🔥 **Стрик активности:** активен\n`
      reply += `📈 **Процент выполнения:** \`${rate}%\`\n`
      reply += `✔️ **Выполнено:** \`${done}\` из \`${total}\`\n`
      reply += `⚡ **В процессе:** \`${active}\` задач\n`
      if (overdue > 0) {
        reply += `⚠️ **Требует внимания (просрочено):** \`${overdue}\`\n`
      } else {
        reply += `🛡️ **Просрочено:** \`0\` (всё чисто! ✨)\n`
      }

      if (ownerChatId) await incrementUserUsage(ownerChatId, 'chat')

      return NextResponse.json({
        content: reply,
        action: {
          type: 'stats_summary',
          targetType: 'stats',
          title: 'Аналитика продуктивности',
        },
      })
    }

    // D. Eisenhower Matrix (/matrix)
    if (cleanLower === '/matrix' || cleanLower === 'матрица эйзенхауэра' || cleanLower === 'приоритеты задач' || cleanLower === '📊 приоритеты задач') {
      const allTasks = await getAllTasks(ownerChatId)
      const active = allTasks.filter(t => t.status !== 'done')
      const urgentHigh = active.filter(t => t.priority === 'urgent' || t.priority === 'high')
      const medium = active.filter(t => t.priority === 'medium')
      const low = active.filter(t => t.priority === 'low')

      let reply = `🎯 **Матрица приоритетов Эйзенхауэра**\n\n`
      reply += `🔴 **Срочно и Важно (Сделать немедленно):** \`${urgentHigh.length}\`\n`
      urgentHigh.slice(0, 4).forEach(t => { reply += ` • **${t.title}**${t.dueTime ? ` (\`${t.dueTime}\`)` : ''}\n` })

      reply += `\n🟢 **Важно, но не срочно (Стратегический фокус):** \`${medium.length}\`\n`
      medium.slice(0, 4).forEach(t => { reply += ` • **${t.title}**\n` })

      reply += `\n🔵 **Текущие дела и рутина:** \`${low.length}\`\n`
      low.slice(0, 3).forEach(t => { reply += ` • ${t.title}\n` })

      if (ownerChatId) await incrementUserUsage(ownerChatId, 'chat')

      return NextResponse.json({
        content: reply,
        action: {
          type: 'stats_summary',
          targetType: 'tasks',
          title: 'Матрица Эйзенхауэра',
        },
      })
    }

    // E. Overdue Tasks (/overdue)
    if (cleanLower === '/overdue' || cleanLower === 'что просрочено?' || cleanLower === '⏰ что просрочено?') {
      const allTasks = await getAllTasks(ownerChatId)
      const overdue = allTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayYmd)

      let reply = ''
      if (overdue.length === 0) {
        reply = `🎉 **Отлично! У вас нет просроченных задач.**\nВсе дедлайны соблюдены и находятся под контролем. 🛡️✨`
      } else {
        reply = `⚠️ **Просроченные задачи (${overdue.length}):**\n\n`
        overdue.forEach((t, i) => {
          reply += `${i + 1}. ⏰ **${t.title}** (было на \`${t.dueDate}\`)\n`
        })
        reply += `\n💡 _Совет: напишите мне «Перенеси просроченные задачи на сегодня», чтобы обновить расписание!_`
      }

      if (ownerChatId) await incrementUserUsage(ownerChatId, 'chat')

      return NextResponse.json({
        content: reply,
        action: {
          type: 'schedule_view',
          targetType: 'tasks',
          title: 'Просроченные задачи',
        },
      })
    }

    // ── 2. INTENT PARSER & ACTION MUTATION (Create, Delete, Complete, Goal, Note) ──

    const serverContext = ownerChatId ? await getExistingItemsContext(ownerChatId) : ''
    const friendsContext = ''
    const extensionsContext = ownerChatId ? await getUserExtensionsAIContext(ownerChatId) : ''
    const effectiveModel = getModelForUserPlan(limits.plan, body.model, 'chat')

    // Parse user natural language intent using Groq
    const parsedItems = await parseIntentWithGroq(
      userText,
      groqApiKey,
      effectiveModel,
      serverContext,
      friendsContext,
      extensionsContext
    )

    const actionableItem = parsedItems.find(it => it.type !== 'answer' && it.action !== 'reply')

    if (actionableItem) {
      // Execute the action in the database
      const saveResult = await saveParsedItemToDb(actionableItem, ownerChatId)
      const saved = saveResult.item

      // Fetch the actual record from database to send full object back to client
      let createdOrUpdatedRecord: any = null
      if (saved.type === 'goal') {
        createdOrUpdatedRecord = await prisma.goal.findFirst({
          where: { ownerChatId: BigInt(ownerChatId || 0) },
          orderBy: { createdAt: 'desc' },
        })
      } else if (saved.type === 'note') {
        createdOrUpdatedRecord = await prisma.note.findFirst({
          where: { ownerChatId: BigInt(ownerChatId || 0) },
          orderBy: { createdAt: 'desc' },
        })
      } else {
        createdOrUpdatedRecord = await prisma.task.findFirst({
          where: { ownerChatId: BigInt(ownerChatId || 0) },
          orderBy: { createdAt: 'desc' },
        })
      }

      // Format stylish confirmation response
      let reply = ''
      let actionType: 'task_created' | 'goal_created' | 'note_created' | 'task_completed' | 'task_deleted' | 'task_updated' = 'task_created'
      let targetType: 'today' | 'tasks' | 'goals' | 'notes' | 'calendar' | 'stats' = 'tasks'

      if (saved.action === 'completion' || saved.type === 'completion') {
        actionType = 'task_completed'
        reply = `✔️ **Задача успешно выполнена!**\n\n📌 **${saved.targetTitle || saved.title}**\n\n🎉 Отличная работа! Ваш стрик активности и статистика продуктивности обновлены.`
      } else if (saved.action === 'delete' || saved.action === 'delete_all') {
        actionType = 'task_deleted'
        reply = saved.action === 'delete_all'
          ? `🗑️ **Все задачи успешно очищены из вашего списка.**`
          : `🗑️ **Задача удалена:** «${saved.targetTitle || saved.title}»`
      } else if (saved.type === 'goal') {
        actionType = 'goal_created'
        targetType = 'goals'
        reply = `🎯 **Новая цель успешно поставлена!**\n\n`
        reply += `🚩 **${saved.title}**\n`
        if (saved.summary && saved.summary !== saved.title) reply += `📝 ${saved.summary}\n`
        if (saved.dueDate) reply += `⏳ Дедлайн: \`${saved.dueDate}\`\n`
        if (saved.milestones && saved.milestones.length > 0) {
          reply += `\n**Ключевые этапы:**\n`
          saved.milestones.forEach((m: string) => { reply += ` • ${m}\n` })
        }
        reply += `\n🚀 _Цель добавлена в раздел Цели с отслеживанием прогресса!_`
      } else if (saved.type === 'note') {
        actionType = 'note_created'
        targetType = 'notes'
        reply = `📝 **Заметка сохранена!**\n\n`
        reply += `📌 **${saved.title}**\n`
        if (saved.summary) reply += `${saved.summary}\n`
        if (saved.tags && saved.tags.length > 0) {
          reply += `\n🏷️ ${saved.tags.map(t => `#${t}`).join(' ')}\n`
        }
        reply += `\n✨ _Заметка доступна в Базе знаний и поиске!_`
      } else {
        // Standard task
        actionType = 'task_created'
        targetType = 'tasks'
        const pEmoji = saved.priority === 'urgent' ? '🔴' : saved.priority === 'high' ? '🟠' : saved.priority === 'medium' ? '🟢' : '🔵'
        const pLabel = saved.priority === 'urgent' ? 'Срочно' : saved.priority === 'high' ? 'Высокий' : saved.priority === 'medium' ? 'Средний' : 'Низкий'

        reply = `✨ **Задача успешно добавлена!**\n\n`
        reply += `📌 **${saved.title}**\n`
        if (saved.dueTime || saved.dueDate) {
          reply += `⏰ Время: \`${saved.dueTime || 'Весь день'}\` · 📅 Дата: \`${saved.dueDate || todayYmd}\`\n`
        }
        reply += `${pEmoji} Приоритет: **${pLabel}**\n`
        if (saved.tags && saved.tags.length > 0) {
          reply += `🏷️ Теги: ${saved.tags.map(t => `#${t}`).join(' ')}\n`
        }
        if (saved.subtasks && saved.subtasks.length > 0) {
          reply += `\n📋 **Подзадачи:**\n`
          saved.subtasks.forEach((s: any) => {
            const stTitle = typeof s === 'string' ? s : s.title
            reply += ` • ${stTitle}\n`
          })
        }
        reply += `\n🚀 _Синхронизировано с вашим календарем и расписанием!_`
      }

      if (ownerChatId) await incrementUserUsage(ownerChatId, 'chat')

      return NextResponse.json({
        content: reply,
        action: {
          type: actionType,
          targetType,
          targetId: createdOrUpdatedRecord?.id || saved.targetId || undefined,
          title: saved.title,
          priority: saved.priority,
          dueTime: saved.dueTime,
          dueDate: saved.dueDate,
          tags: saved.tags,
          item: createdOrUpdatedRecord,
        },
      })
    }

    // ── 3. GENERAL CONVERSATIONAL INTELLIGENCE & ADVICE ──

    let systemContent =
      SYSTEM_PROMPT +
      `\n\nТОЧНОЕ ТЕКУЩЕЕ ВРЕМЯ И ДАТА ПОЛЬЗОВАТЕЛЯ (Москва, MSK): ${nowMsk}.\nПри ответах ориентируйся строго на это текущее время!`

    if (extensionsContext) {
      systemContent += `\n\n## 🧩 Инструкции и триггеры установленных расширений:\n${extensionsContext}`
    }

    if (serverContext) {
      systemContent += `\n\n## Полный контекст пользователя (Заметки, Задачи, Цели):\n${serverContext}`
    } else if (clientContext) {
      systemContent += `\n\n## User Workspace Context:\n${JSON.stringify(clientContext, null, 2)}`
    }

    const result = await callGroqChatCompletion({
      messages: [{ role: 'system', content: systemContent }, ...messages],
      model: effectiveModel,
      temperature: mode === 'enhance' ? 0.8 : 0.7,
      max_tokens: mode === 'enhance' ? 2048 : 1024,
      apiKey: groqApiKey,
    })

    const content = result.content || 'Готово! Чем ещё могу помочь?'

    if (ownerChatId) {
      await incrementUserUsage(ownerChatId, 'chat')
    }

    return NextResponse.json({ content })
  } catch (err: unknown) {
    console.error('[Chat API Error]:', err)
    const msg = err instanceof Error && !err.message.includes('Groq') && !err.message.includes('Hugging')
      ? err.message
      : 'Сервис ИИ временно перегружен или недоступен. Пожалуйста, попробуйте чуть позже.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
