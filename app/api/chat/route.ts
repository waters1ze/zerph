/**
 * Next.js API Route — Groq Chat Completion
 * POST /api/chat
 */
import { NextRequest, NextResponse } from 'next/server'
import { GROQ_API_KEY, GROQ_CHAT_MODEL } from '@/lib/config'

const SYSTEM_PROMPT = `You are Zerf AI — a highly intelligent personal productivity assistant embedded in the Zerf app, a premium personal command center for tasks, goals, notes, and projects.

You have access to the user's context (tasks, goals, notes) and can help them:
- Prioritize and plan their day
- Analyze overdue tasks and suggest actions
- Summarize goals and track progress
- Create task breakdowns and project plans
- Draft notes, meeting summaries, journal entries
- Answer productivity and time management questions
- Enhance voice transcriptions into beautiful structured notes

Be concise, smart, actionable. Use markdown formatting. Keep responses focused and helpful.
When enhancing voice input, add structure, formatting, and relevant details while preserving the original intent.`

import { getUserUsageAndLimits, incrementUserUsage, getExistingItemsContext } from '@/lib/backend/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { searchParams } = new URL(req.url)
    const ownerChatId = req.headers.get('x-chat-id') || body.ownerChatId || searchParams.get('chatId') || searchParams.get('chat_id')

    if (ownerChatId) {
      const limits = await getUserUsageAndLimits(ownerChatId)
      if (!limits.canSendChatMessage) {
        return NextResponse.json({
          error: '❌ Дневной лимит сообщений в ИИ чат исчерпан (10 сообщений в день на бесплатном тарифе). Оформите подписку Zerf Premium за 99 ₽ в Настройках!',
          limitReached: true,
        }, { status: 403 })
      }
    }

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

    const fallbackModels = [GROQ_CHAT_MODEL, 'llama-3.1-8b-instant', 'llama3-8b-8192']
    let lastResponse = null
    let content = ''

    for (const currentModel of fallbackModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [{ role: 'system', content: systemContent }, ...messages],
            temperature: mode === 'enhance' ? 0.8 : 0.7,
            max_tokens: mode === 'enhance' ? 2048 : 1024,
            stream: false,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          content = data.choices?.[0]?.message?.content || 'No response from AI.'
          break
        }
        
        const errText = await res.text()
        lastResponse = { status: res.status, text: errText, model: currentModel }
        console.warn(`Groq Chat model ${currentModel} failed: ${res.status} ${errText}`)
      } catch (e) {
        lastResponse = { status: 500, text: String(e), model: currentModel }
        console.warn(`Groq Chat model ${currentModel} exception: ${String(e)}`)
      }
    }

    if (!content && lastResponse) {
      return NextResponse.json({ error: `Groq API error on all fallback models. Last error from ${lastResponse.model}: ${lastResponse.text}` }, { status: lastResponse.status })
    }

    if (ownerChatId) {
      await incrementUserUsage(ownerChatId, 'chat')
    }

    return NextResponse.json({ content })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
