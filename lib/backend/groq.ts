/**
 * Zerf Backend — Groq AI Integration Module
 * whisper-large-v3 for speech · openai/gpt-oss-120b for intelligence
 */

import { GROQ_API_KEY as DEFAULT_KEY, GROQ_WHISPER_MODEL, GROQ_CHAT_MODEL } from '@/lib/config'

export interface ParsedItem {
  type: 'task' | 'goal' | 'note' | 'project' | 'reminder' | 'completion'
  title: string
  summary: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  dueDate?: string | null
  dueTime?: string | null       // HH:MM — extracted from "at 12:00", "в 15:30" etc.
  recipientName?: string | null // Extracted name if sending a message to a contact e.g. "Артем", "Мама"
  targetTitle?: string          // for 'completion' type — the task being marked done
  projectId?: string | null
  goalId?: string | null
  tags: string[]
  subtasks?: string[]
  milestones?: string[]
  motivation?: string
  rawText: string
  originalText?: string         // same as rawText, for notes
}

const today = new Date().toISOString().slice(0, 10)
const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

const SYSTEM_PROMPT = `You are Zerf AI — an expert personal productivity assistant with a focus on Russian-speaking users.

══════════════════════════════════════════
🇷🇺 СТРОГОЕ ПРАВИЛО ЯЗЫКА (HIGHEST PRIORITY)
══════════════════════════════════════════
ЕСЛИ входной текст содержит ХОТЯ БЫ ОДНО русское слово — ВСЕ поля "title", "summary", "tags" ОБЯЗАНЫ быть ТОЛЬКО на русском языке.
НИКОГДА не переключайся на английский, если ввод был на русском.
НИКОГДА не смешивай языки в одном поле.
Примеры тегов на русском: ["встреча", "работа", "здоровье", "идеи", "проект"]
══════════════════════════════════════════

Today is ${today}, current time is ${time} (Moscow time, UTC+3).

## Intent Detection

### type = "completion"
Triggers when user indicates something is DONE.
Keywords: done, finished, готово, выполнил, сделал, закончил, завершил, сделано, готов
Set "targetTitle" = the task name they completed, "title" = same.

### type = "goal"
Long-term aspiration (1-6 months). Extract milestones & motivation.

### type = "task"
Immediate actionable item. Extract "dueTime" in HH:MM 24h format from natural language:
- "в 12:00" → "12:00", "в 15:30" → "15:30", "в 9 утра" → "09:00"
- "в полдень" → "12:00", "в полночь" → "00:00"
- "через 10 минут до 12:00" → calculate: "11:50"
- "at 3pm" → "15:00", "at half past two" → "14:30"

### type = "note"
Meeting recap, idea, observation, brain dump.
For notes, "summary" MUST be a BEAUTIFUL, STRUCTURED Markdown document with:
- Start with a # Заголовок (main topic)
- ## 📋 Ключевые мысли — key points as bullet list
- ## 🎯 Действия — action items (if any) as checkboxes [ ]
- ## 💡 Контекст — background or context if available
- ## 🔗 Связанные темы — suggest 1-3 [[Wiki Link]] references to related topics
  Example: [[Работа над проектом]], [[Планирование недели]]
- Use **bold** for key terms, *italic* for emphasis
- Use > blockquote for important quotes or insights
- Make it feel like a premium Obsidian knowledge base document
- MINIMUM 150 words, comprehensive and well-structured

### type = "reminder"
Specific time-based notification without full task details.

## Dynamic Priority Rules
- "urgent": срочно, прямо сейчас, как можно скорее, ASAP, немедленно, критично, дедлайн сегодня
- "high":   очень важно, важно, проект, клиенту, начальнику, отчет, экзамен, обязательно
- "low":    когда будет время, потом, если получится, не к спеху, хобби, почитать
- "medium": standard routine without explicit urgency

Always respond with ONLY valid JSON (no markdown fences):
{
  "type": "task" | "goal" | "note" | "project" | "reminder" | "completion",
  "title": "Краткое описание (максимум 60 символов)",
  "summary": "1-2 предложения для задач/целей. Полный Markdown-документ для заметок.",
  "priority": "urgent" | "high" | "medium" | "low",
  "dueDate": "YYYY-MM-DD" | null,
  "dueTime": "HH:MM" | null,
  "targetTitle": "для типа completion: название выполненной задачи" | null,
  "projectId": null,
  "goalId": null,
  "tags": ["тег1", "тег2"],
  "subtasks": ["подзадача 1", "подзадача 2"],
  "milestones": ["этап 1", "этап 2"],
  "motivation": "только для целей" | null,
  "rawText": "исходный текст пользователя"
}

Default priority is "medium". Output ONLY pure JSON.`

/**
 * Transcribe audio using Groq Whisper (whisper-large-v3)
 */
export async function transcribeAudioWithGroq(
  audioBuffer: Buffer,
  filename: string,
  apiKey?: string
): Promise<string> {
  const key = apiKey || DEFAULT_KEY
  if (!key) throw new Error('Groq API Key missing.')

  const ext = filename.split('.').pop() || 'webm'
  const mimeType = ext === 'webm' ? 'audio/webm' : ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg'

  const formData = new FormData()
  formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename)
  formData.append('model', GROQ_WHISPER_MODEL)
  formData.append('response_format', 'json')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  })

  if (!res.ok) throw new Error(`Whisper Error (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.text || ''
}

/**
 * Parse intent from text using Groq LLM (openai/gpt-oss-120b)
 */
export async function parseIntentWithGroq(
  text: string,
  apiKey?: string,
  model?: string
): Promise<ParsedItem> {
  const key = apiKey || DEFAULT_KEY
  if (!key) throw new Error('Groq API Key missing.')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || GROQ_CHAT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) throw new Error(`Groq Chat Error (${res.status}): ${await res.text()}`)

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content || '{}'

  try {
    const p = JSON.parse(raw)
    return {
      type: p.type || 'task',
      title: p.title || text.slice(0, 50),
      summary: p.summary || text,
      priority: p.priority || 'medium',
      dueDate: p.dueDate || null,
      dueTime: p.dueTime || null,
      targetTitle: p.targetTitle || null,
      projectId: p.projectId || null,
      goalId: p.goalId || null,
      tags: Array.isArray(p.tags) ? p.tags : [],
      subtasks: Array.isArray(p.subtasks) ? p.subtasks : [],
      milestones: Array.isArray(p.milestones) ? p.milestones : [],
      motivation: p.motivation || null,
      rawText: text,
      originalText: text,
    }
  } catch {
    return {
      type: 'task',
      title: text.slice(0, 50),
      summary: text,
      priority: 'medium',
      tags: ['voice-input'],
      rawText: text,
      originalText: text,
    }
  }
}

/**
 * Fuzzy similarity score between two strings (0–1)
 */
export function stringSimilarity(a: string, b: string): number {
  a = a.toLowerCase().trim()
  b = b.toLowerCase().trim()
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9

  const aWords = new Set(a.split(/\s+/))
  const bWords = new Set(b.split(/\s+/))
  const intersection = [...aWords].filter(w => bWords.has(w)).length
  const union = new Set([...aWords, ...bWords]).size
  return intersection / union
}
