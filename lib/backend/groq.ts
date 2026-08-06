/**
 * Zerf Backend — Groq AI Integration Module
 * whisper-large-v3 for speech · openai/gpt-oss-120b for intelligence
 */

import { GROQ_API_KEY as DEFAULT_KEY, GROQ_WHISPER_MODEL, GROQ_CHAT_MODEL } from '@/lib/config'

export interface ParsedItem {
  type: 'task' | 'goal' | 'note' | 'project' | 'reminder' | 'completion'
  action?: 'create' | 'update' | 'delete' | 'delete_all' | 'completion'
  targetId?: string | null
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

export function getDynamicSystemPrompt(existingItemsContext?: string): string {
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

  let prompt = `You are Zerf AI — an expert personal productivity assistant with a focus on Russian-speaking users.

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
- Always output "dueDate" in YYYY-MM-DD and "dueTime" in 24-hour HH:MM format.`

  if (existingItemsContext) {
    prompt += `\n\n══════════════════════════════════════════
📋 СУЩЕСТВУЮЩИЕ АКТИВНЫЕ ЭЛЕМЕНТЫ ПОЛЬЗОВАТЕЛЯ:
${existingItemsContext}
══════════════════════════════════════════
ИНСТРУКЦИЯ ПО РЕДАКТИРОВАНИЮ И УДАЛЕНИЮ:
- Если пользователь говорит "удали все задачи", "очисти все задачи", "удали всё", "очистить тодо" — установи "action": "delete_all".
- Если пользователь просит удалить КОНКРЕТНУЮ задачу/цель (например: "удали задачу Перейти на канал", "удали задачу Подрочить"):
  - Найди её в списке выше и установи "action": "delete", "targetId": "<ID элемента>", "targetTitle": "<название задачи>".
- Если пользователь просит ИЗМЕНИТЬ время, дату или название существующего элемента (например: "давай в 12:00 лучше", "поменяй время"):
  - Установи "action": "update", "targetId": "<ID элемента>" и укажи обновленные поля.`
  }

  prompt += `\n\n## Intent Detection & Actions

### action = "create" (по умолчанию, если создается новый элемент)
### action = "update" (если редактируется существующий элемент, укажи targetId)
### action = "delete" (если удаляется конкретная задача/цель, укажи targetId или targetTitle)
### action = "delete_all" (если пользователь просит удалить ВСЕ задачи / очистить список)
### action = "completion" (если пользователь говорит, что сделано)

## Dynamic Priority Rules
- "urgent": срочно, прямо сейчас, как можно скорее, ASAP, немедленно, критично, дедлайн сегодня
- "high":   очень важно, важно, проект, клиенту, начальнику, отчет, экзамен, обязательно
- "low":    когда будет время, потом, если получится, не к спеху, хобби, почитать
- "medium": standard routine without explicit urgency

Always respond with ONLY valid JSON (no markdown fences):
{
  "action": "create" | "update" | "delete" | "delete_all" | "completion",
  "targetId": "ID элемента если action update/delete" | null,
  "type": "task" | "goal" | "note" | "project" | "reminder" | "completion",
  "title": "Краткое описание (максимум 60 символов)",
  "summary": "1-2 предложения для задач/целей. Полный Markdown-документ для заметок.",
  "priority": "urgent" | "high" | "medium" | "low",
  "dueDate": "YYYY-MM-DD" | null,
  "dueTime": "HH:MM" | null,
  "targetTitle": "для типа completion или delete: название задачи" | null,
  "projectId": null,
  "goalId": null,
  "tags": ["тег1", "тег2"],
  "subtasks": ["подзадача 1", "подзадача 2"],
  "milestones": ["этап 1", "этап 2"],
  "motivation": "только для целей" | null,
  "rawText": "исходный текст пользователя"
}

Default priority is "medium". Output ONLY pure JSON.`

  return prompt
}

/**
 * Transcribe audio using Groq Whisper (whisper-large-v3)
 */
function getGroqKeys(providedKey?: string): string[] {
  const raw = providedKey || DEFAULT_KEY || process.env.GROQ_API_KEY || ''
  const keys = raw.split(/[\s,]+/).map(k => k.trim()).filter(Boolean)
  return keys.length > 0 ? keys : []
}

/**
 * Transcribe audio using Groq Whisper (whisper-large-v3) with multi-key fallback rotation
 */
export async function transcribeAudioWithGroq(
  audioBuffer: Buffer,
  filename: string,
  apiKey?: string
): Promise<string> {
  const keys = getGroqKeys(apiKey)
  if (keys.length === 0) throw new Error('Groq API Key missing.')

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

      if (!res.ok) {
        throw new Error(`Whisper Error (${res.status}): ${await res.text()}`)
      }
      const data = await res.json()
      return data.text || ''
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`Groq Key failed, trying next key... Error: ${lastError.message}`)
    }
  }

  throw lastError || new Error('All Groq API keys failed.')
}

/**
 * Parse intent from text using Groq LLM with multi-key fallback rotation
 */
export async function parseIntentWithGroq(
  text: string,
  apiKey?: string,
  model?: string,
  existingItemsContext?: string
): Promise<ParsedItem> {
  const keys = getGroqKeys(apiKey)
  if (keys.length === 0) throw new Error('Groq API Key missing.')

  const dynamicSystemPrompt = getDynamicSystemPrompt(existingItemsContext)
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

      if (!res.ok) {
        throw new Error(`Groq Chat Error (${res.status}): ${await res.text()}`)
      }

      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content || '{}'

      try {
        const p = JSON.parse(raw)
        return {
          action: p.action || (p.type === 'completion' ? 'completion' : 'create'),
          targetId: p.targetId || null,
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
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`Groq Key failed, trying next key... Error: ${lastError.message}`)
    }
  }

  throw lastError || new Error('All Groq API keys failed.')
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

/**
 * Generate a short 2-3 sentence motivational reminder context for a note/task.
 * Returns a ready-to-send Russian string.
 */
export async function generateReminderContext(
  noteTitle: string,
  noteContent: string,
  dueTime: string,
  apiKey?: string
): Promise<string> {
  const key = apiKey || DEFAULT_KEY
  if (!key) return `Напоминание: «${noteTitle}» в ${dueTime}. Удачи! 🚀`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: `Ты — дружелюбный AI-ассистент. Напиши 2-3 предложения на РУССКОМ языке:
1. Приятное пожелание или напоминание о предстоящем событии
2. 1 практическую рекомендацию или совет
Стиль: тёплый, поддерживающий, конкретный. Без шаблонных фраз. Без упоминания «Zerf».
Ответь ТОЛЬКО этими 2-3 предложениями, без лишнего текста.`,
          },
          {
            role: 'user',
            content: `Событие/тема: «${noteTitle}»\nВремя: ${dueTime}\nКонтекст: ${noteContent.slice(0, 400)}`,
          },
        ],
        temperature: 0.75,
        max_tokens: 200,
      }),
    })
    if (!res.ok) return `Напоминание: «${noteTitle}» в ${dueTime}. 🎯`
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || `Напоминание: «${noteTitle}» в ${dueTime}. 🎯`
  } catch {
    return `Напоминание: «${noteTitle}» в ${dueTime}. Удачи! 🚀`
  }
}

/**
 * Generate a personalized morning greeting based on user's recent tasks and notes.
 * Returns a ready-to-send Russian Telegram message (with Markdown).
 */
export async function generateMorningGreeting(
  firstName: string,
  recentTaskTitles: string[],
  recentNoteTitles: string[],
  pendingTasks: string[],
  apiKey?: string
): Promise<string> {
  const key = apiKey || DEFAULT_KEY

  const now = new Date()
  const dayName = now.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    weekday: 'long', day: 'numeric', month: 'long',
  })

  if (!key) {
    return (
      `☀️ *Доброе утро, ${firstName}!*\n\n` +
      `Сегодня ${dayName}.\n\n` +
      (pendingTasks.length
        ? `📋 У тебя ${pendingTasks.length} задач на сегодня:\n${pendingTasks.slice(0, 3).map(t => `• ${t}`).join('\n')}\n\n`
        : ``) +
      `_Продуктивного дня! 🚀_`
    )
  }

  try {
    const contextLines: string[] = []
    if (recentTaskTitles.length) contextLines.push(`Недавние задачи: ${recentTaskTitles.slice(0, 5).join(', ')}`)
    if (recentNoteTitles.length) contextLines.push(`Недавние заметки: ${recentNoteTitles.slice(0, 3).join(', ')}`)
    if (pendingTasks.length) contextLines.push(`Активные задачи сегодня: ${pendingTasks.slice(0, 5).join(', ')}`)

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: `Ты — персональный AI-ассистент пользователя в Telegram. Каждое утро ты пишешь ему тёплое, персонализированное сообщение.
Формат ответа — Markdown для Telegram. Пиши ТОЛЬКО на русском языке.
Структура (строго):
1. Приветствие с именем (1 строка)
2. Упоминание дня/даты
3. Персонализированный комментарий, основанный на известных задачах/заметках пользователя (2-3 предложения, как будто ты знаешь его жизнь — тепло и конкретно)
4. 2 практические рекомендации на основе его активностей
5. Мотивирующая фраза

Максимум 200 слов. Без шаблонных «Желаю тебе». Конкретно и по-дружески.`,
          },
          {
            role: 'user',
            content: `Имя: ${firstName}\nДата: ${dayName}\n${contextLines.join('\n')}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 350,
      }),
    })

    if (!res.ok) throw new Error('Groq error')
    const data = await res.json()
    const aiText = data.choices?.[0]?.message?.content?.trim() || ''
    return aiText || buildFallbackGreeting(firstName, dayName, pendingTasks)
  } catch {
    return buildFallbackGreeting(firstName, dayName, pendingTasks)
  }
}

function buildFallbackGreeting(firstName: string, dayName: string, pendingTasks: string[]): string {
  return (
    `☀️ *Доброе утро, ${firstName}!*\n\n` +
    `Сегодня ${dayName}.\n\n` +
    (pendingTasks.length
      ? `📋 *На сегодня (${pendingTasks.length}):*\n${pendingTasks.slice(0, 5).map(t => `• ${t}`).join('\n')}\n\n`
      : `✅ На сегодня задач нет — можно планировать что-то новое!\n\n`) +
    `_Продуктивного дня! 🚀_`
  )
}

