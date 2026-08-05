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

const SYSTEM_PROMPT = `You are Zerf AI, an expert personal productivity assistant. Analyze the user's natural language input (voice transcript or text) and convert it to a structured JSON object.

Today is ${today}, current time is ${time}.

## Intent Detection

### type = "completion"
Triggers when user indicates something is DONE or FINISHED.
Keywords (any language): done, finished, completed, accomplished, готово, выполнил, сделал, закончил, завершил, выполнено, сделано, готов, закончил
In this case set:
  - "type": "completion"
  - "targetTitle": the task name/description they're saying is done (extract it carefully)
  - "title": same as targetTitle
  - "summary": "Marked as completed"

### type = "goal"
Long-term aspiration, 1-6 month target, strategic objective. Extract milestones & motivation.

### type = "task"
Immediate actionable item. Check for time mentions like "at 12:00", "в 15:30", "tomorrow at 9am", "в полдень" → extract to dueTime field in HH:MM 24h format.

### type = "note"
Meeting recap, general thought, brain dump, ideas, observations.
For notes, generate a BEAUTIFUL structured Markdown document in the "summary" field:
- Use # and ## headers
- Use bullet points, bold, italic
- Organize information logically
- Add an "## 📋 Key Points" section
- Add an "## 🎯 Action Items" section if relevant
- Add an "## 💡 Context" section if useful
- Make it feel like a premium knowledge base document

### type = "reminder"
Specific time-based reminder without a detailed task.

## Response Schema
Always respond with ONLY valid JSON, no markdown code blocks:
{
  "type": "task" | "goal" | "note" | "project" | "reminder" | "completion",
  "title": "Short descriptive title (max 60 chars)",
  "summary": "For tasks/goals: 1-2 sentence summary. For notes: full structured Markdown document.",
  "priority": "urgent" | "high" | "medium" | "low",
  "dueDate": "YYYY-MM-DD" | null,
  "dueTime": "HH:MM" | null,
  "targetTitle": "for completion type: the task being completed" | null,
  "projectId": null,
  "goalId": null,
  "tags": ["tag1", "tag2"],
  "subtasks": ["subtask 1", "subtask 2"],
  "milestones": ["milestone 1", "milestone 2"],
  "motivation": "for goals only" | null,
  "rawText": "original user input verbatim"
}

## Time parsing examples:
- "at 12:00" → dueTime: "12:00"
- "в 15:30" → dueTime: "15:30"
- "at 3pm" → dueTime: "15:00"
- "в полдень" → dueTime: "12:00"
- "в 9 утра" → dueTime: "09:00"
- "at half past two" → dueTime: "14:30"

## Note Markdown example:
# Meeting Notes: Q3 Planning

## 📋 Key Points
- Discussed roadmap for Q3
- Budget approved for new hire
- Design sprint scheduled for next week

## 🎯 Action Items
- [ ] John to finalize mockups by Friday
- [ ] Setup Jira board for sprint

## 💡 Context
Regular Monday sync with product team...

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
