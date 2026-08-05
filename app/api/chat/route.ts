/**
 * Next.js API Route — Groq Chat Completion with Multi-Key Rotation
 * POST /api/chat
 */
import { NextRequest, NextResponse } from 'next/server'
import { GROQ_API_KEY, GROQ_API_KEYS, GROQ_CHAT_MODEL } from '@/lib/config'

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

export async function POST(req: NextRequest) {
  try {
    const { messages, apiKey, context, mode } = await req.json()
    const userApiKey = apiKey || req.headers.get('x-groq-api-key') || process.env.GROQ_API_KEY

    // Key pool (custom user key first, followed by system multi-key pool)
    const keysToTry = userApiKey && userApiKey.startsWith('gsk_')
      ? [userApiKey, ...GROQ_API_KEYS]
      : GROQ_API_KEYS

    const nowMsk = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      dateStyle: 'full',
      timeStyle: 'medium',
    })

    // Build system message with context
    let systemContent =
      SYSTEM_PROMPT +
      `\n\nТОЧНОЕ ТЕКУЩЕЕ ВРЕМЯ И ДАТА ПОЛЬЗОВАТЕЛЯ (Москва, MSK): ${nowMsk}.\nПри ответах, составлении расписания и планировании ориентируйся строго на это текущее время!`

    if (context) {
      systemContent += `\n\n## User's Current Workspace Context:\n${JSON.stringify(context, null, 2)}`
    }

    let lastErrText = ''

    for (const key of keysToTry) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: GROQ_CHAT_MODEL,
            messages: [{ role: 'system', content: systemContent }, ...messages],
            temperature: mode === 'enhance' ? 0.8 : 0.7,
            max_tokens: mode === 'enhance' ? 2048 : 1024,
            stream: false,
          }),
        })

        if (res.status === 429) {
          console.warn(`[Groq Multi-Key] Chat key ${key.slice(0, 8)}... Rate limited. Trying next...`)
          continue
        }

        if (!res.ok) {
          lastErrText = await res.text()
          continue
        }

        const data = await res.json()
        const content = data.choices?.[0]?.message?.content || 'No response from AI.'
        return NextResponse.json({ content })
      } catch (err: unknown) {
        lastErrText = err instanceof Error ? err.message : String(err)
      }
    }

    return NextResponse.json({ error: `Groq API error: ${lastErrText}` }, { status: 500 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
