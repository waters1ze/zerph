/**
 * Zerf Backend — Groq AI Integration Module with Multi-Key Auto-Rotation
 * whisper-large-v3 for speech · llama-3.3-70b-versatile for intelligence
 */

import { GROQ_API_KEY as DEFAULT_KEY, GROQ_API_KEYS, GROQ_WHISPER_MODEL, GROQ_CHAT_MODEL } from '@/lib/config'

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

let currentKeyIndex = 0

function getKeysToTry(customKey?: string): string[] {
  if (customKey && customKey.trim().startsWith('gsk_')) {
    return [customKey.trim(), ...GROQ_API_KEYS]
  }
  const pool = [...GROQ_API_KEYS]
  const start = currentKeyIndex % pool.length
  currentKeyIndex = (currentKeyIndex + 1) % pool.length
  return [...pool.slice(start), ...pool.slice(0, start)]
}

export function getDynamicSystemPrompt(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

  const mskDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
  const mskTime = `${getPart('hour')}:${getPart('minute')}`

  return `You are Zerf AI — an expert personal productivity assistant with a focus on Russian-speaking users.

══════════════════════════════════════════
🇷🇺 СТРОГОЕ ПРАВИЛО ЯЗЫКА (HIGHEST PRIORITY)
══════════════════════════════════════════
ЕСЛИ входной текст содержит ХОТЯ БЫ ОДНО русское слово — ВСЕ поля "title", "summary", "tags" ОБЯЗАНЫ быть ТОЛЬКО на русском языке.
НИКОГДА не переключайся на английский, если ввод был на русском.
НИКОГДА не смешивай языки в одном поле.
Примеры тегов на русском: ["встреча", "работа", "здоровье", "идеи", "проект"]
══════════════════════════════════════════

📍 EXACT CURRENT REAL TIME IN MOSCOW (MSK / UTC+3):
Today's Date: ${mskDate} (YYYY-MM-DD)
Current Time Right Now: ${mskTime} (24-hour HH:MM format, Europe/Moscow timezone)

CRITICAL INSTRUCTIONS FOR TIME CALCULATIONS:
- All relative time phrases (e.g., "через минуту", "напиши мне через 1 минуту", "через 10 минут", "в 15:00", "завтра в 9 утра") MUST be calculated STRICTLY relative to CURRENT MOSCOW TIME ${mskTime} on ${mskDate}!
- Example: If current Moscow time is "${mskTime}" and user says "через минуту" or "через 1 минуту", dueTime MUST be calculated as current minute + 1 minute (e.g. if current is 22:57, dueTime is 22:58). DO NOT SHIFT TIME OR ADD EXTRA HOURS!
- Always output "dueDate" in YYYY-MM-DD and "dueTime" in 24-hour HH:MM format.

## Intent Detection

### type = "completion"
Triggers when user indicates something is DONE.
Keywords: done, finished, готово, выполнил, сделал, закончил, завершил, сделано, готов
Set "targetTitle" = the task name they completed, "title" = same.

### type = "goal"
Long-term aspiration (1-6 months). Extract milestones & motivation.

### type = "task"
Immediate actionable item. Extract "dueTime" in HH:MM 24h format from natural language.

### type = "note"
Meeting recap, idea, observation, brain dump.

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
}

/**
 * Transcribe audio using Groq Whisper (whisper-large-v3) with Auto-Key Rotation
 */
export async function transcribeAudioWithGroq(
  audioBuffer: Buffer,
  filename: string,
  apiKey?: string
): Promise<string> {
  const keys = getKeysToTry(apiKey)
  const ext = filename.split('.').pop() || 'webm'
  const mimeType = ext === 'webm' ? 'audio/webm' : ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg'

  let lastError: Error | null = null

  for (const key of keys) {
    try {
      const formData = new FormData()
      formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename)
      formData.append('model', GROQ_WHISPER_MODEL)
      formData.append('response_format', 'json')

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: formData,
      })

      if (res.status === 429) {
        console.warn(`[Groq Multi-Key] Key ${key.slice(0, 10)}... Rate limited (429). Rotating to next key...`)
        continue
      }

      if (!res.ok) {
        throw new Error(`Whisper Error (${res.status}): ${await res.text()}`)
      }

      const data = await res.json()
      return data.text || ''
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw lastError || new Error('All Groq API keys exhausted or rate limited.')
}

/**
 * Parse intent from text using Groq LLM (openai/gpt-oss-120b) with Auto-Key Rotation
 */
export async function parseIntentWithGroq(
  text: string,
  apiKey?: string,
  model?: string
): Promise<ParsedItem> {
  const keys = getKeysToTry(apiKey)
  const dynamicSystemPrompt = getDynamicSystemPrompt()

  let lastError: Error | null = null

  for (const key of keys) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || GROQ_CHAT_MODEL,
          messages: [
            { role: 'system', content: dynamicSystemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      })

      if (res.status === 429) {
        console.warn(`[Groq Multi-Key] Key ${key.slice(0, 10)}... Rate limited (429). Rotating to next key...`)
        continue
      }

      if (!res.ok) {
        throw new Error(`Groq Chat Error (${res.status}): ${await res.text()}`)
      }

      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content || '{}'

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
        tags: p.tags || [],
        subtasks: p.subtasks || [],
        milestones: p.milestones || [],
        motivation: p.motivation || null,
        rawText: text,
        originalText: text,
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw lastError || new Error('All Groq API keys exhausted or rate limited.')
}

/**
 * Generate context message for reminders
 */
export async function generateReminderContext(
  title: string,
  summary: string,
  dueTime?: string
): Promise<string> {
  const prompt = `Пользователь просил напомнить о задаче "${title}"${dueTime ? ` в ${dueTime}` : ''}.\nКонтекст: ${summary}\n\nНапиши 1-2 мотивирующих предложения на русском языке с эмодзи.`

  const keys = getKeysToTry()
  for (const key of keys) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_CHAT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 150,
        }),
      })

      if (res.status === 429) continue
      if (!res.ok) continue

      const data = await res.json()
      return data.choices?.[0]?.message?.content?.trim() || `Напоминание: ${title}!`
    } catch {}
  }

  return `Напоминание: ${title}!`
}

export async function generateMorningGreeting(
  name: string,
  recentTasks: string[],
  recentNotes: string[],
  pendingToday: string[],
  apiKey?: string
): Promise<string> {
  const prompt = `Пользователь: ${name}\nЗадачи на сегодня: ${pendingToday.join(', ') || 'нет'}\n\nНапиши бодрое утреннее приветствие и план на день на русском языке с эмодзи.`
  const keys = getKeysToTry(apiKey)
  for (const key of keys) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_CHAT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 250,
        }),
      })
      if (res.status === 429) continue
      if (!res.ok) continue
      const data = await res.json()
      return data.choices?.[0]?.message?.content?.trim() || `Доброе утро, ${name}!`
    } catch {}
  }
  return `Доброе утро, ${name}!`
}

export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  if (s1 === s2) return 1.0
  if (s1.includes(s2) || s2.includes(s1)) return 0.8
  const pairs1 = getBigrams(s1)
  const pairs2 = getBigrams(s2)
  if (!pairs1.length || !pairs2.length) return 0
  let union = pairs1.length + pairs2.length
  let intersection = 0
  for (const p1 of pairs1) {
    for (let i = 0; i < pairs2.length; i++) {
      if (p1 === pairs2[i]) {
        intersection++
        pairs2.splice(i, 1)
        break
      }
    }
  }
  return (2 * intersection) / union
}

function getBigrams(str: string): string[] {
  const s = str.toLowerCase()
  const bg: string[] = []
  for (let i = 0; i < s.length - 1; i++) {
    bg.push(s.slice(i, i + 2))
  }
  return bg
}
