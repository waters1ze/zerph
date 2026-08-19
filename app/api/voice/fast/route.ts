/**
 * POST /api/voice/fast — Ultra-fast Edge voice parsing endpoint for iOS Siri & Quick Commands.
 * Returns parsed task structure in <300ms.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'

import { callGroqChatCompletion } from '@/lib/backend/groq-pool'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    const body = await req.json().catch(() => ({}))
    const text = (body?.text || body?.transcript || body?.query || '').trim()

    if (!text) {
      return NextResponse.json({
        ok: false,
        error: 'Отсутствует текст голосового сообщения для распознавания.',
      }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    // 1. Fast regex heuristic if needed for instant fallback
    const heuristicTask = {
      title: text,
      dueDate: null as string | null,
      dueTime: null as string | null,
      priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
      tags: [] as string[],
      category: 'inbox',
      confidence: 0.85,
    }

    if (/\b(срочно|важно|горит|asap)\b/i.test(text)) {
      heuristicTask.priority = 'urgent'
    } else if (/\b(сегодня|вечером|утром)\b/i.test(text)) {
      heuristicTask.dueDate = new Date().toISOString().split('T')[0]
    } else if (/\b(завтра)\b/i.test(text)) {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      heuristicTask.dueDate = d.toISOString().split('T')[0]
    }

    // 2. High-speed LLM instant structuring via Groq Key Pool (<250ms)
    try {
      const completion = await callGroqChatCompletion({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: `Ты — сверхбыстрый парсер голосовых задач Zerf Note. Текущее время: ${nowIso}.
Извлеки из текста пользователя задачу в формате JSON:
{
  "title": "краткая суть задачи без вводных слов",
  "dueDate": "YYYY-MM-DD или null",
  "dueTime": "HH:MM или null",
  "priority": "low" | "medium" | "high" | "urgent",
  "category": "work" | "personal" | "study" | "inbox",
  "tags": ["тег1"]
}
Отвечай ТОЛЬКО валидным JSON без markdown пояснений.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })

      if (completion.content) {
        const parsed = JSON.parse(completion.content)
        return NextResponse.json({
          ok: true,
          fast: true,
          source: completion.modelUsed || 'groq-openai-gpt-oss-20b',
          task: {
            title: parsed.title || heuristicTask.title,
            dueDate: parsed.dueDate || heuristicTask.dueDate,
            dueTime: parsed.dueTime || null,
            priority: parsed.priority || heuristicTask.priority,
            category: parsed.category || heuristicTask.category,
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          }
        })
      }
    } catch {}

    // Fallback to heuristic
    return NextResponse.json({
      ok: true,
      fast: true,
      source: 'heuristic_fallback',
      task: heuristicTask,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || 'Ошибка обработки голосового запроса',
    }, { status: 500 })
  }
}
