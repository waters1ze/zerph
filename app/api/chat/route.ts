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

export async function POST(req: NextRequest) {
  try {
    const { messages, apiKey, context, mode } = await req.json()
    const groqApiKey =
      apiKey ||
      req.headers.get('x-groq-api-key') ||
      process.env.GROQ_API_KEY ||
      GROQ_API_KEY

    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'Groq API key missing. Please add it in Settings → AI & Integrations.' },
        { status: 400 }
      )
    }

    // Build system message with context
    let systemContent =
      SYSTEM_PROMPT +
      `\n\nCurrent date: ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`

    if (context) {
      systemContent += `\n\n## User's Current Workspace Context:\n${JSON.stringify(context, null, 2)}`
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
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

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Groq API error: ${err}` }, { status: res.status })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || 'No response from AI.'
    return NextResponse.json({ content })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
