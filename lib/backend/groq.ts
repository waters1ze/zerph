/**
 * Zerf Backend — Groq AI Integration Module
 * whisper-large-v3 for speech · openai/gpt-oss-120b for intelligence
 */

import { GROQ_API_KEY as DEFAULT_KEY, GROQ_WHISPER_MODEL, GROQ_CHAT_MODEL } from '@/lib/config'

export interface ParsedSubtask {
  title: string
  dueTime?: string | null
  dueDate?: string | null
  durationDays?: number | null
}

export interface ParsedItem {
  type: 'task' | 'goal' | 'note' | 'project' | 'habit' | 'reminder' | 'completion' | 'delegate' | 'schedule' | 'answer'
  action?: 'create' | 'update' | 'delete' | 'delete_all' | 'cancel_schedule' | 'cancel_recurring_schedule' | 'completion' | 'set_my_birthday' | 'get_schedule' | 'reply'
  targetId?: string | null
  title: string
  summary: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  dueDate?: string | null
  dueTime?: string | null       // HH:MM — extracted from "at 12:00", "в 15:30" etc.
  daysCount?: number | null     // 1 for 1 day, 7 for week, etc.
  recipientName?: string | null // Extracted name if sending a message to a contact or asking schedule e.g. "Лера", "Артем"
  isPluralRecipient?: boolean   // True if sending to multiple people e.g. "Артемам"
  isBothShared?: boolean        // True if task is for BOTH ("нам", "для нас", "совместная"), False if for single friend only ("дай Вове", "поручи Лере")
  targetTitle?: string          // for 'completion' type — the task being marked done
  projectId?: string | null
  goalId?: string | null
  folder?: string | null
  members?: string[] | null
  icon?: string | null
  frequency?: string | null
  tags: string[]
  subtasks?: Array<string | ParsedSubtask>
  milestones?: string[]
  motivation?: string
  rawText: string
  originalText?: string         // same as rawText, for notes
  isShared?: boolean
  assignees?: string[]
  source?: string | null
  repeat?: string | null
  reminderOffsetMinutes?: number | null
  tasksToCreate?: { title: string; dueDate: string | null; dueTime: string | null }[]
}

export function getDynamicSystemPrompt(existingItemsContext?: string, friendsContext?: string, extensionsContext?: string): string {
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

  let prompt = `You are Zerf AI — the official intelligent personal productivity assistant for Zerf (zerph).
Language: Russian only if user input contains Russian words. Never switch to English if input is Russian.
Current Moscow Time: ${mskDate} ${mskTime} (24-hour MSK).

CRITICAL TIME RULES:
- Calculate all relative dates/times strictly relative to ${mskDate} ${mskTime}.
- EXACT TIME: If user specifies format with minutes or exact time (e.g. "в 10:00", "в 11:30", "в 09:15"), STRICTLY keep that exact time ("10:00", "11:30", "09:15")!
- FUTURE DAYS: If scheduled for tomorrow or a future date ("завтра в 10:00", "завтра в 10", "в пятницу в 9"), keep the morning hour ("10:00", "09:00").
- TODAY'S BARE NUMBERS: Only for TODAY if user says a bare number without minutes ("в 6", "в 7 часов") and morning hour passed today (${mskTime} > 06:00), use evening ("18:00", "19:00").
- Time ranges ("с 8 до 15", "с 18:00 до 20:00"): set "dueTime": "08:00 - 15:00".

OUTPUT STRICT VALID PURE JSON ONLY without markdown fences:
{
  "items": [
    {
      "action": "create" | "update" | "delete" | "delete_all" | "reply" | "set_my_birthday" | "cancel_schedule" | "cancel_recurring_schedule" | "get_schedule",
      "type": "task" | "goal" | "note" | "habit" | "project" | "answer" | "delegate" | "schedule",
      "title": "Clear informative title with essence of action (in Russian)",
      "summary": "Detailed, comprehensive description (2-3 sentences) or helpful complete answer",
      "priority": "urgent" | "high" | "medium" | "low",
      "dueDate": "YYYY-MM-DD" | null,
      "dueTime": "HH:MM" | "HH:MM - HH:MM" | null,
      "daysCount": number | null,
      "repeat": "daily" | "weekly" | "weekdays" | "monthly" | "yearly" | null,
      "reminderOffsetMinutes": 0 | 5 | 10 | 15 | 30 | 60 | 1440 | null,
      "targetTitle": string | null,
      "targetId": string | null,
      "recipientName": string | null,
      "isBothShared": boolean,
      "members": string[] | null,
      "folder": string | null,
      "icon": string | null,
      "frequency": "daily" | "weekly" | "weekdays" | null,
      "tags": ["работа" | "личное" | "учеба" | "спорт" | "идеи" | "срочно"],
      "subtasks": [] | string[] | [{"title": string, "dueTime"?: string, "dueDate"?: string, "durationDays"?: number}]
    }
  ]
}

FEATURE INSTRUCTIONS & INTENT ROUTING:
1. GREETINGS / QUESTIONS / MATH / ADVICE / CONVERSATION:
   - If input is a greeting ("привет", "как дела"), question ("сколько будет 145*18?", "что такое интеграл?"), advice request ("как составить план?"), or explanation:
     Set "type": "answer", "action": "reply", "title": "...", "summary": "Full, polite, helpful and direct answer in Russian". DO NOT create tasks or notes!
2. TASKS & REMINDERS ("type": "task", "action": "create"):
   - Default for actions, todos, voice dictation ("купить молоко", "напомни в 17:00", "созвон в 11:00").
   - "subtasks": [] for normal simple tasks. Generate subtasks ONLY for complex projects or if explicitly requested ("разбей на шаги", "4 этапа").
   - If subtasks have individual times/dates, specify array of objects: [{"title": "1 этап: ...", "dueTime": "10:00", "dueDate": "YYYY-MM-DD"}].
3. NOTES ("type": "note", "action": "create"):
   - ONLY if explicitly requested: "запиши заметку", "сохрани мысль", "запиши конспект", "сохрани идею".
   - CRITICAL: If user specifies a time or reminder in a note request (e.g. "добавь заметку в час ночи поиграть в кс2", "запиши заметку на 15:00"): generate BOTH:
     1) "type": "note", "action": "create" — for knowledge base;
     2) "type": "task", "action": "create" with exact "dueTime" and "dueDate" — to trigger the reminder at that exact hour!
4. DELEGATE & SHARED TASKS ("type": "delegate"):
   - Shared for both ("нам", "для нас", "мне и Вове", "вместе", "общая"): "isBothShared": true, "recipientName": "Name".
   - Assigned to one friend ("дай Вове задачу", "поручи Лере", "передай Артему"): "isBothShared": false, "recipientName": "Name".
5. HABITS & PROJECTS:
   - Habit ("привычка пить 2л воды каждое утро"): "type": "habit", "icon": "💧", "frequency": "daily".
   - Project ("проект Сайт с Лерой и Артемом"): "type": "project", "members": ["Лера", "Артем"].
6. SCHOOL SCHEDULES & ROUTINES:
   - Lessons list: "tags": ["учеба", "школа", "расписание"].
   - Day off / cancel school for day ("завтра выходной", "отмени уроки на среду"): "action": "cancel_schedule", "type": "task", "dueDate": "YYYY-MM-DD".
   - Cancel recurring routine ("отмени бассейн по пятницам"): "action": "cancel_recurring_schedule", "targetTitle": "Бассейн".
7. EDIT & DELETE (SINGLE & COMBINED ACTIONS):
   - "удали задачу X": "action": "delete", "type": "task", "targetTitle": "X".
   - "удали заметку X": "action": "delete", "type": "note", "targetTitle": "X".
   - "удали все задачи": "action": "delete_all".
   - "перенеси на 18:00 / поменяй название": "action": "update", "targetTitle": "X", "dueDate": "...", "dueTime": "...".
   - MULTI-ACTION (e.g. "удали эту заметку, сделай чтобы это была задача все таки", "удали задачу X и создай напоминание Y"):
     ALWAYS output ALL actions in the "items" array in exact sequence!
     Example for "удали эту заметку, сделай задачу на 01:00":
     Item 1: {"action": "delete", "type": "note", "targetTitle": "Название заметки"}
     Item 2: {"action": "create", "type": "task", "title": "Название задачи", "dueTime": "01:00", "dueDate": "YYYY-MM-DD"}
8. BIRTHDAYS & HOLIDAYS:
   - Holiday / birthday of friend ("день рождения друга 15 мая", "Новый год 31 декабря"): "type": "task", "repeat": "yearly", "dueTime": "00:00", "tags": ["праздник", "календарь"].
   - User's own birthday ("мой др 3 апреля"): "action": "set_my_birthday", "dueDate": "YYYY-MM-DD".
9. MULTI-ITEM INPUT:
   - If multiple tasks/actions/notes are mentioned (e.g. "купить хлеб и еще через 2 часа позвонить маме"), extract ALL items into the "items" array.`

  if (extensionsContext) {
    prompt += `\n\n🧩 Активные расширения:\n${extensionsContext.slice(0, 1500)}`
  }

  if (existingItemsContext) {
    prompt += `\n\n📋 Существующие элементы:\n${existingItemsContext.slice(0, 2000)}`
  }

  if (friendsContext) {
    prompt += `\n\n👥 Контакты и друзья:\n${friendsContext.slice(0, 1000)}`
  }

  return prompt
}

import { callGroqChatCompletion, callGroqWhisper } from './groq-pool'

/**
 * Transcribe audio using Groq Whisper (whisper-large-v3) with multi-key pool rotation
 */
export async function transcribeAudioWithGroq(
  audioBuffer: Buffer,
  filename: string,
  apiKey?: string
): Promise<string> {
  const result = await callGroqWhisper({
    audioBuffer,
    filename,
    apiKey,
  })
  return result.text
}

/**
 * Parse intent from text using Groq LLM with multi-key pool rotation
 * Can extract 1 or multiple items from a single voice/text message
 */
export async function parseIntentWithGroq(
  text: string,
  apiKey?: string,
  model?: string,
  existingItemsContext?: string,
  friendsContext?: string,
  extensionsContext?: string,
  userPlan?: string | null
): Promise<ParsedItem[]> {
  const dynamicSystemPrompt = getDynamicSystemPrompt(existingItemsContext, friendsContext, extensionsContext)

  const result = await callGroqChatCompletion({
    messages: [
      { role: 'system', content: dynamicSystemPrompt },
      { role: 'user', content: text },
    ],
    model: model || GROQ_CHAT_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    apiKey,
    userPlan,
  })

  const raw = result.content || '{}'

  // Clean up any markdown json wrappers the LLM might have output
  let cleanRaw = raw.trim()
  if (cleanRaw.startsWith('```json')) cleanRaw = cleanRaw.replace(/^```json\s*/i, '')
  if (cleanRaw.startsWith('```')) cleanRaw = cleanRaw.replace(/^```\s*/i, '')
  if (cleanRaw.endsWith('```')) cleanRaw = cleanRaw.replace(/```\s*$/i, '')
  cleanRaw = cleanRaw.trim()

  try {
    const p = JSON.parse(cleanRaw)
    let rawItems = Array.isArray(p.items) && p.items.length > 0 ? p.items : [p]

    rawItems = rawItems.filter((item: any) => {
      if (item.action === 'set_my_birthday') return true
      if (item.action === 'delete_all') return true
      const t = (item.title || '').toLowerCase()
      return item.title && !t.includes('неизвестное сообщение') && !t.includes('нечитаемое сообщение') && !t.includes('неизвестный текст')
    })

    if (rawItems.length === 0) return []

    return rawItems.map((item: any) => {
      const { recipientName: cleanRecName, isBothShared: cleanIsBothShared } = extractCleanRecipientAndSharing(
        text,
        item.recipientName,
        item.isBothShared
      )

      const effectiveType = (cleanRecName || item.type === 'delegate') ? 'delegate' : (item.type || 'task')

      const { dueDate: smartDueDate, dueTime: smartDueTime } = normalizeSmartTimeAndDate(
        item.dueDate,
        item.dueTime,
        text
      )

      return {
        action: item.action || (item.type === 'completion' ? 'completion' : 'create'),
        targetId: item.targetId || null,
        type: effectiveType,
        title: item.title || text.slice(0, 50),
        summary: item.summary || text,
        priority: item.priority || 'medium',
        dueDate: smartDueDate,
        dueTime: smartDueTime,
        daysCount: item.daysCount !== undefined ? Number(item.daysCount) : null,
        recipientName: cleanRecName,
        isBothShared: cleanIsBothShared,
        repeat: item.repeat || ((item.title || text).toLowerCase().match(/день рожд|др|праздник|годовщин/) ? 'yearly' : null),
        targetTitle: item.targetTitle || null,
        projectId: item.projectId || null,
        goalId: item.goalId || null,
        folder: item.folder || null,
        members: Array.isArray(item.members) ? item.members : null,
        tags: Array.isArray(item.tags) ? item.tags : [],
        subtasks: Array.isArray(item.subtasks) ? item.subtasks : [],
        milestones: Array.isArray(item.milestones) ? item.milestones : [],
        motivation: item.motivation || null,
        rawText: text,
        originalText: text,
      }
    })
  } catch {
    const { recipientName: cleanRecName, isBothShared: cleanIsBothShared } = extractCleanRecipientAndSharing(text)
    const { dueDate: smartDueDate, dueTime: smartDueTime } = normalizeSmartTimeAndDate(null, null, text)
    return [{
      type: cleanRecName ? 'delegate' : 'task',
      recipientName: cleanRecName,
      isBothShared: cleanIsBothShared,
      title: text.slice(0, 50),
      summary: text,
      priority: 'medium',
      dueDate: smartDueDate,
      dueTime: smartDueTime,
      tags: ['voice-input'],
      rawText: text,
      originalText: text,
    }]
  }
}

/**
 * Normalizes ambiguous relative times (e.g. "в 6 часов" -> 18:00 if morning has passed, or tomorrow if evening passed)
 */
export function normalizeSmartTimeAndDate(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined,
  rawText: string = '',
  referenceDate: Date = new Date()
): { dueDate: string | null; dueTime: string | null } {
  // Format reference date in Europe/Moscow timezone
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(referenceDate)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
  const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
  const curHour = parseInt(getPart('hour'), 10)
  const curMin = parseInt(getPart('minute'), 10)

  // Calculate tomorrow's date string
  const tomorrowDate = new Date(referenceDate.getTime() + 24 * 60 * 60 * 1000)
  const tmParts = formatter.formatToParts(tomorrowDate)
  const getTmPart = (type: string) => tmParts.find(p => p.type === type)?.value || '00'
  const tomorrowStr = `${getTmPart('year')}-${getTmPart('month')}-${getTmPart('day')}`

  let finalDate = dueDate || todayStr
  let finalTime = dueTime ? dueTime.trim() : null

  // If no dueTime was extracted by LLM, check if rawText mentions a time like "в 6", "в 6 часов", "в 18:00", "в 7:30"
  if (!finalTime && rawText) {
    const timeMatch = rawText.match(/(?:^|\s)в\s*(\d{1,2})(?::(\d{2}))?\s*(?:час(?:а|ов|ом)?)?(?:\s*(утра|вечера|дня|ночи))?/i)
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10)
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
      const period = (timeMatch[3] || '').toLowerCase()
      if (period.includes('вечер') || period.includes('дня')) {
        if (h < 12) h += 12
      } else if (period.includes('ноч') || period.includes('утр')) {
        if (h === 12) h = 0
      }
      finalTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  if (!finalTime) {
    return { dueDate: dueDate || null, dueTime: null }
  }

  // Check for simple HH:MM time format
  const match = finalTime.match(/^(\d{1,2}):(\d{2})$/)
  if (match) {
    let hour = parseInt(match[1], 10)
    const min = parseInt(match[2], 10)
    const textLower = rawText.toLowerCase()
    const hasExplicitMorning = textLower.includes('утра') || textLower.includes('утром') || textLower.includes('ночи') || textLower.includes('am')
    const hasExplicitEvening = textLower.includes('вечера') || textLower.includes('вечером') || textLower.includes('дня') || textLower.includes('pm')
    const hasTomorrow = textLower.includes('завтра') || textLower.includes('послезавтра')

    // If hour <= 12 and no explicit morning indicator, resolve ambiguity ONLY for TODAY
    if (hour <= 12 && !hasExplicitMorning) {
      if (hasExplicitEvening) {
        if (hour < 12) hour += 12
      } else if (!hasTomorrow && (!dueDate || dueDate === todayStr)) {
        // Ambiguous hour on TODAY (e.g. "в 6", "в 6 часов", "в 7", "в 2")
        // Check if morning hour has already passed today
        const morningPassed = curHour > hour || (curHour === hour && curMin >= min)
        const pmHour = hour === 12 ? 12 : hour + 12
        const pmPassed = curHour > pmHour || (curHour === pmHour && curMin >= min)

        if (morningPassed && !pmPassed) {
          // e.g. currently 16:00, user said "в 6" -> 18:00 today!
          hour = pmHour
        } else if (morningPassed && pmPassed) {
          // e.g. currently 19:30, user said "в 6" -> both passed today -> 18:00 tomorrow!
          hour = pmHour
          finalDate = tomorrowStr
        }
      }
    }

    // Check if the scheduled time is in the past for today (and user didn't specify a future date or recurring)
    const targetPassedToday = curHour > hour || (curHour === hour && curMin > min)
    if (targetPassedToday && (!dueDate || dueDate === todayStr) && !hasTomorrow) {
      // Time has already passed today -> schedule for tomorrow
      finalDate = tomorrowStr
    }

    finalTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }

  return { dueDate: finalDate, dueTime: finalTime }
}

/**
 * Universal recipient cleaner and shared status extractor from text and LLM output
 */
export function extractCleanRecipientAndSharing(
  rawText: string,
  itemRecipientName?: string | null,
  itemIsBothShared?: boolean
): { recipientName: string | null; isBothShared: boolean } {
  let recName = itemRecipientName ? String(itemRecipientName).trim() : null
  const text = rawText || ''

  // Check if rawText contains "нам", "для нас", "общая", "совместная", "мне и", "нам с", "для меня и", "вместе", "обоим"
  const hasUsKeywords = /(?:^|[^а-яёa-z0-9])(?:нам|для\s+нас|вместе|обоим|общая|совместная|совместно|мне\s+и|нам\s+с|для\s+меня\s+и|с\s+нами)(?:[^а-яёa-z0-9]|$)/i.test(text)

  let isShared: boolean
  if (itemIsBothShared !== undefined) {
    isShared = Boolean(itemIsBothShared) || hasUsKeywords
  } else {
    isShared = hasUsKeywords
  }

  // Clean recName from "мне и X" / "нам с X" / "для меня и X"
  if (recName) {
    recName = recName
      .replace(/^(?:мне\s+и|нам\s+с|для\s+меня\s+и|для\s+нас\s+с|я\s+и|с\s+)\s+/i, '')
      .replace(/\s+(?:и\s+мне|и\s+я|со\s+мной|с\s+нами)$/i, '')
      .replace(/^(?:для|кому|другу|коллеге)\s+/i, '')
      .trim()
  }

  // If no recName was extracted by LLM, try regexes on rawText:
  if (!recName && text) {
    const patterns = [
      // "дай мне и вовчику береговому общую задачу поиграть..."
      // "создай нам с лерой задачу приготовить..."
      /(?:дай|поставь|создай|назначь|запиши|добавь|сделай)\s+(?:мне\s+и|нам\s+с|для\s+меня\s+и|для\s+нас\s+с)\s+([а-яёa-z0-9_@\s]+?)\s+(?:общую\s+задачу|совместную\s+задачу|общую|совместную|задачу|цель|дело|напоминание|поиграть|сделать|созвониться|встретиться|пойти)/i,
      // "общая задача мне и вове поиграть..."
      /(?:общая|совместная)\s+(?:задача|цель|дело)\s+(?:для\s+)?(?:меня\s+и\s+|нам\s+с\s+|мне\s+и\s+)?([а-яёa-z0-9_@\s]+?)(?:,|$|\s+по|\s+на|\s+в\s+\d|\s+чтобы|\s+поиграть|\s+сделать)/i,
      // "дай задачу вове позвонить..."
      /(?:дай\s+задачу|поручи\s+задачу|передай\s+задачу|отправь\s+задачу|назначь\s+задачу|скинь\s+задачу|кинь\s+задачу)\s+([а-яёa-z0-9_@\s]+?)(?:,|$|\s+чтобы|\s+на|\s+в\s+\d|\s+по|\s+сделать|\s+поиграть)/i,
      // "дай вове задачу..." / "поручи лере отчет..."
      /(?:дай|поручи|передай|отправь|назначь|скинь|кинь)\s+([а-яёa-z0-9_@\s]+?)\s+(?:задачу|цель|дело|сделать|поиграть|созвониться|купить|написать|проверить|подготовить|встретиться|пойти|отчет)/i,
      // "задача нам с лерой..."
      /задача\s+(?:нам\s+с|мне\s+и)\s+([а-яёa-z0-9_@\s]+?)(?:,|$|\s+по|\s+на|\s+в\s+\d|\s+чтобы)/i,
    ]

    for (const pat of patterns) {
      const m = text.match(pat)
      if (m && m[1]) {
        let candidate = m[1].trim()
        candidate = candidate
          .replace(/^(?:мне\s+и|нам\s+с|для\s+меня\s+и|для\s+нас\s+с)\s+/i, '')
          .replace(/\s+(?:общую|совместную|задачу|цель|дело)$/i, '')
          .trim()
        if (candidate && candidate.length <= 40) {
          recName = candidate
          break
        }
      }
    }
  }

  if (recName && (recName.toLowerCase() === 'мне' || recName.toLowerCase() === 'я' || recName.toLowerCase() === 'себе')) {
    recName = null
    isShared = false
  }

  return { recipientName: recName || null, isBothShared: Boolean(isShared) }
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
  try {
    const result = await callGroqChatCompletion({
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
      model: GROQ_CHAT_MODEL,
      temperature: 0.75,
      max_tokens: 200,
      apiKey,
    })
    return result.content?.trim() || `Напоминание: «${noteTitle}» в ${dueTime}. 🎯`
  } catch {
    return `Напоминание: «${noteTitle}» в ${dueTime}. Удачи! 🚀`
  }
}

/**
 * Generate a personalized morning greeting based strictly on user's active tasks for today and today's birthdays.
 * Returns a ready-to-send Russian Telegram message (with Markdown).
 */
export async function generateMorningGreeting(
  firstName: string,
  pendingTasks: string[],
  todayBirthdays: string[] = [],
  apiKey?: string
): Promise<string> {
  const now = new Date()
  const dayName = now.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    weekday: 'long', day: 'numeric', month: 'long',
  })

  try {
    const contextLines: string[] = []
    if (todayBirthdays.length) contextLines.push(`Праздники и Дни рождения СЕГОДНЯ: ${todayBirthdays.join(', ')}`)
    if (pendingTasks.length) {
      contextLines.push(`Планы и задачи на сегодня (${pendingTasks.length}): ${pendingTasks.slice(0, 6).join(', ')}`)
    } else {
      contextLines.push(`Задач на сегодня нет (день полностью свободен)`)
    }

    const result = await callGroqChatCompletion({
      messages: [
        {
          role: 'system',
          content: `Ты — персональный AI-ассистент пользователя в Telegram (Zerf AI). Каждое утро ты пишешь ему тёплое, вдохновляющее и строго актуальное утреннее сообщение.
Формат ответа — Markdown для Telegram (жирный *текст*, курсив _текст_). Пиши ТОЛЬКО на русском языке.

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Опирайся ИСКЛЮЧИТЕЛЬНО на список «Планы и задачи на сегодня». КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдумывать дела, людей, прошлые выполненные задачи или несуществующие события!
2. Если в строке «Планы и задачи на сегодня» написано «Задач на сегодня нет» — напиши, что день свободен от запланированных дел, пожелай продуктивного дня/отдыха и дай полезные советы по фокусу или планированию.
3. Дни рождения упоминай ТОЛЬКО если есть строка «Праздники и Дни рождения СЕГОДНЯ».

Структура сообщения:
1. Приветствие с именем (1 строка: «Доброе утро, [Имя]!»).
2. День недели и дата («Сегодня — [день], [дата].»).
3. Если есть задачи на сегодня — краткий дружеский комментарий по ним (1-2 предложения). Если задач нет — пожелай продуктивного дня и хорошего настроения.
4. 2 полезных практических совета на день.
5. Короткая мотивирующая фраза.

Максимум 130 слов. Без лишней воды.`,
        },
        {
          role: 'user',
          content: `Имя пользователя: ${firstName}\nДата: ${dayName}\n${contextLines.join('\n')}`,
        },
      ],
      model: GROQ_CHAT_MODEL,
      temperature: 0.5,
      max_tokens: 300,
      apiKey,
    })

    const aiText = result.content?.trim() || ''
    return aiText || buildFallbackGreeting(firstName, dayName, pendingTasks, todayBirthdays)
  } catch {
    return buildFallbackGreeting(firstName, dayName, pendingTasks, todayBirthdays)
  }
}

function buildFallbackGreeting(firstName: string, dayName: string, pendingTasks: string[], todayBirthdays: string[] = []): string {
  const bdayLine = todayBirthdays.length ? `🎂 *Праздники сегодня:*\n${todayBirthdays.map(b => `▪ ${b}`).join('\n')}\n\n` : ''
  return (
    `✦ *Доброе утро, ${firstName}!*\n\n` +
    `Сегодня ${dayName}.\n\n` +
    bdayLine +
    (pendingTasks.length
      ? `📋 *На сегодня (${pendingTasks.length}):*\n${pendingTasks.slice(0, 5).map(t => `▪ ${t}`).join('\n')}\n\n`
      : `✓ На сегодня задач нет — отличная возможность спланировать день!\n\n`) +
    `_Продуктивного дня! ✦_`
  )
}

/**
 * Generate personalized evening review at 21:00 MSK
 */
export async function generateEveningReview(
  firstName: string,
  completedTasks: string[],
  pendingTasks: string[],
  tomorrowTasks: string[] = [],
  apiKey?: string
): Promise<string> {
  try {
    const result = await callGroqChatCompletion({
      messages: [
        {
          role: 'system',
          content: `Ты — тактичный и умный вечерний ассистент Zerf AI. В 21:00 ты подводишь с пользователем итоги прошедшего дня в Telegram.
Пиши ТОЛЬКО на русском языке, в Markdown для Telegram (жирный **текст**, курсив _текст_).
Стиль: спокойный, лаконичный, поддерживающий.

СТРОГИЕ ПРАВИЛА (НЕ НАРУШАЙ НИ ПРИ КАКИХ УСЛОВИЯХ!):
1. ЧЁТКО РАЗДЕЛЯЙ ДНИ: СЕГОДНЯ и ЗАВТРА — это разные дни. Никогда не путай их!
2. НЕЗАКРЫТЫЕ ЗАДАЧИ ЗА СЕГОДНЯ:
   - Если за сегодня есть незакрытые задачи, ты ТОЛЬКО мягко напоминаешь о них или спрашиваешь: возможно пользователь уже выполнил их, но забыл отметить выполненными в приложении Zerf.
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО давать советы по сегодняшним невыполненным задачам!
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО переносить сегодняшние незакрытые задачи на завтра в тексте (например, если сегодня была задача "встреча с врачом", НЕЛЬЗЯ писать "завтра удачи у врача"!).
3. СОВЕТ И ЗАДАЧИ НА ЗАВТРА:
   - Блок «**Совет:**» строится ИСКЛЮЧИТЕЛЬНО на основе списка «ЗАПЛАНИРОВАНО НА ЗАВТРА» (если они есть).
   - Если на завтра есть задачи: дай 1 короткий практичный совет, как подготовиться ко сну и завтрашним делам.
   - Если на завтра задач нет (список пуст): дай нейтральный совет по вечернему отдыху, сну и восстановлению (без упоминания чужих или сегодняшних дел).

СТРУКТУРА СООБЩЕНИЯ:
1. Обращение по имени (например: «**Привет, [Имя]! 🌙**» или «**Добрый вечер, [Имя]! 🌙**»).
2. Итоги за СЕГОДНЯ:
   - Если были закрыты задачи: похвали за конкретно выполненные дела.
   - Если остались незакрытые задачи: мягко упомяни их списком («Остались незакрытыми: ... Возможно, ты уже всё сделал(а), но забыл(а) отметить галочкой в приложении»).
   - Если задач вообще не было: скажи, что день прошёл в спокойном ритме.
3. Блок «**Совет:**» — 1–2 предложения с рекомендацией на вечер/сон (строго с учётом задач на завтра, если они есть).

Максимум 110 слов. Без лишней воды.`,
        },
        {
          role: 'user',
          content: `Имя: ${firstName}\nВыполнено задач СЕГОДНЯ (${completedTasks.length}): ${completedTasks.slice(0, 5).join(', ') || 'нет'}\nОстались незакрытыми СЕГОДНЯ (${pendingTasks.length}): ${pendingTasks.slice(0, 5).join(', ') || 'все закрыты'}\nЗапланировано НА ЗАВТРА (${tomorrowTasks.length}): ${tomorrowTasks.slice(0, 5).join(', ') || 'нет конкретных задач на завтра'}`,
        },
      ],
      model: GROQ_CHAT_MODEL,
      temperature: 0.4,
      max_tokens: 300,
      apiKey,
    })

    const aiText = result.content?.trim() || ''
    return aiText || buildFallbackEveningReview(firstName, completedTasks, pendingTasks, tomorrowTasks)
  } catch {
    return buildFallbackEveningReview(firstName, completedTasks, pendingTasks, tomorrowTasks)
  }
}

function buildFallbackEveningReview(
  firstName: string,
  completedTasks: string[],
  pendingTasks: string[],
  tomorrowTasks: string[] = []
): string {
  let msg = `✦ **Добрый вечер, ${firstName}! 🌙**\n\n`
  if (completedTasks.length > 0) {
    msg += `✓ **Выполнено за сегодня (${completedTasks.length}):**\n` +
      completedTasks.slice(0, 5).map(t => `  ▫ ~${t}~`).join('\n') + `\n\n`
  } else {
    msg += `Сегодня не было отмечено выполненных задач.\n\n`
  }

  if (pendingTasks.length > 0) {
    msg += `⏱ **Остались незакрытыми за сегодня (${pendingTasks.length}):**\n` +
      pendingTasks.slice(0, 5).map(t => `  ▪ ${t}`).join('\n') + `\n` +
      `_Если вы их уже выполнили, не забудьте отметить галочкой в приложении._\n\n`
  } else {
    msg += `✦ **Все задачи за сегодня закрыты! Отличная работа.**\n\n`
  }

  if (tomorrowTasks.length > 0) {
    msg += `📅 **Планы на завтра (${tomorrowTasks.length}):**\n` +
      tomorrowTasks.slice(0, 3).map(t => `  ▫ ${t}`).join('\n') + `\n\n`
    msg += `**Совет:** отдохните вечером и выспитесь, чтобы завтра продуктивно закрыть запланированные дела.`
  } else {
    msg += `**Совет:** отложите телефон перед сном, выпейте тёплого чая или сделайте лёгкую растяжку, чтобы хорошо выспаться.`
  }

  return msg
}

export interface ReschedulePlanItem {
  id: string
  title: string
  oldTime: string | null
  newTime: string
  isTomorrow?: boolean
  reason: string
}

/**
 * Generate AI-powered smart rescheduling for overdue/pending tasks
 */
export async function generateSmartReschedulePlan(
  tasks: Array<{ id: string; title: string; priority: string; dueTime: string | null; dueDate: string | null }>,
  currentMskTime: string,
  apiKey?: string
): Promise<{ plan: ReschedulePlanItem[]; aiAdvice: string }> {
  if (!tasks || tasks.length === 0) {
    return { plan: [], aiAdvice: 'Нет активных задач для перепланирования.' }
  }

  const [curH, curM] = currentMskTime.split(':').map(n => parseInt(n, 10))
  const curTotalMin = (isNaN(curH) ? 14 : curH) * 60 + (isNaN(curM) ? 0 : curM)

  // Fallback heuristic if Groq fails or no key
  const fallbackPlan: ReschedulePlanItem[] = tasks.map((t, idx) => {
    const slotMin = curTotalMin + 30 + idx * 45
    const isTomorrow = slotMin >= 22 * 60 // After 22:00 -> move to tomorrow
    const normalizedMin = isTomorrow ? 10 * 60 + idx * 45 : slotMin
    const h = String(Math.floor(normalizedMin / 60) % 24).padStart(2, '0')
    const m = String(normalizedMin % 60).padStart(2, '0')
    return {
      id: t.id,
      title: t.title,
      oldTime: t.dueTime,
      newTime: `${h}:${m}`,
      isTomorrow,
      reason: isTomorrow ? 'Перенесено на завтра на утро' : 'Оптимальный интервал на сегодня'
    }
  })

  try {
    const result = await callGroqChatCompletion({
      messages: [
        {
          role: 'system',
          content: `Ты — умный AI-тайм-менеджер. Тебе дан список задач и текущее московское время (${currentMskTime}).
Распредели задачи по реалистичным слотам времени.
Правила:
- Срочные задачи (urgent/high) ставь раньше.
- Между задачами оставляй 30–60 минут.
- Если времени в сутках уже не хватает (после 22:00), переноси на завтра ("isTomorrow": true, начиная с 10:00).
- Верни СТРОГИЙ JSON формат:
{
  "aiAdvice": "Короткий совет (1-2 предложения) почему такой график оптимален",
  "plan": [
    {
      "id": "ID задачи",
      "newTime": "HH:MM",
      "isTomorrow": boolean,
      "reason": "краткая причина времени"
    }
  ]
}`
        },
        {
          role: 'user',
          content: JSON.stringify(tasks)
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      apiKey,
    })

    const parsed = JSON.parse(result.content || '{}')

    const plan: ReschedulePlanItem[] = (parsed.plan || []).map((p: any) => {
      const orig = tasks.find(t => t.id === p.id)
      return {
        id: p.id,
        title: orig?.title || 'Задача',
        oldTime: orig?.dueTime || null,
        newTime: p.newTime || '18:00',
        isTomorrow: !!p.isTomorrow,
        reason: p.reason || 'Оптимальное время'
      }
    })

    return {
      plan: plan.length > 0 ? plan : fallbackPlan,
      aiAdvice: parsed.aiAdvice || 'Расписание оптимизировано ИИ.'
    }
  } catch (err) {
    console.error('Smart reschedule error:', err)
    return {
      plan: fallbackPlan,
      aiAdvice: 'Задачи равномерно распределены по свободным интервалам.'
    }
  }
}

/**
 * Ultra-fast, low-latency intent parser tailored for Apple Siri, Action Button, and voice widgets.
 * Uses a concise 100-token prompt to avoid Groq TPM limits and completes in ~200-350ms.
 */
export async function parseSiriFastIntent(
  text: string,
  apiKey?: string,
  model = 'openai/gpt-oss-20b',
  friendsContext?: string,
  extensionsContext?: string
): Promise<ParsedItem[]> {
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

  let systemPrompt = `You are Zerf Note Siri Fast Parser. Output ONLY valid JSON.
Current Moscow Date: ${mskDate}, Time Right Now: ${mskTime} (MSK/UTC+3).

Schema:
{
  "items": [
    {
      "action": "create",
      "type": "task",
      "title": "Clean concise task title in Russian without command words",
      "dueTime": "HH:MM 24-hour format or null",
      "dueDate": "YYYY-MM-DD or null",
      "priority": "urgent" | "high" | "medium" | "low",
      "recipientName": null,
      "isBothShared": false,
      "repeat": "daily" | "weekdays" | "weekly" | "yearly" | null
    }
  ]
}

Rules:
1. Title MUST be in Russian.
2. Relative times ("через 10 минут", "в 18:00", "завтра в 9 утра", "будильник на 7:00") MUST be calculated relative to current Moscow time ${mskTime} on ${mskDate}.
3. If user says "поручи [Имя]..." -> "type": "delegate", "isBothShared": false, "recipientName": "[Имя]".
4. If user says "нам с [Имя] общая задача..." -> "type": "delegate", "isBothShared": true, "recipientName": "[Имя]".`

  if (extensionsContext) {
    systemPrompt += `\nExtensions Instructions:\n${extensionsContext}`
  }

  if (friendsContext) {
    systemPrompt += `\nFriends: ${friendsContext}`
  }

  try {
    const result = await callGroqChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      model,
      temperature: 0.1,
      max_tokens: 250,
      response_format: { type: 'json_object' },
      apiKey,
      fallbackModels: ['openai/gpt-oss-20b', 'qwen/qwen3.6-27b', 'llama-3.1-8b-instant']
    })

    const raw = result.content || '{}'
    let cleanRaw = raw.trim()
    if (cleanRaw.startsWith('```json')) cleanRaw = cleanRaw.replace(/^```json\s*/i, '')
    if (cleanRaw.startsWith('```')) cleanRaw = cleanRaw.replace(/^```\s*/i, '')
    if (cleanRaw.endsWith('```')) cleanRaw = cleanRaw.replace(/```\s*$/i, '')
    cleanRaw = cleanRaw.trim()

    const p = JSON.parse(cleanRaw)
    let rawItems = Array.isArray(p.items) && p.items.length > 0 ? p.items : [p]
    rawItems = rawItems.filter((item: any) => item && (item.title || item.action === 'delete_all'))
    if (rawItems.length === 0) return []

    return rawItems.map((item: any) => {
      const { recipientName: cleanRecName, isBothShared: cleanIsBothShared } = extractCleanRecipientAndSharing(
        text,
        item.recipientName,
        item.isBothShared
      )

      const effectiveType = (cleanRecName || item.type === 'delegate') ? 'delegate' : (item.type || 'task')

      return {
        action: item.action || 'create',
        targetId: item.targetId || null,
        type: effectiveType,
        title: item.title || text.slice(0, 50),
        summary: item.title || text,
        priority: item.priority || 'medium',
        dueDate: item.dueDate || null,
        dueTime: item.dueTime || null,
        daysCount: item.daysCount !== undefined ? Number(item.daysCount) : null,
        recipientName: cleanRecName,
        isBothShared: cleanIsBothShared,
        repeat: item.repeat || ((item.title || text).toLowerCase().match(/день рожд|др|праздник|годовщин/) ? 'yearly' : null),
        targetTitle: item.targetTitle || null,
        projectId: null,
        goalId: null,
        folder: null,
        members: null,
        tags: ['siri', 'быстрый ввод'],
        subtasks: [],
        milestones: [],
        motivation: null,
        rawText: text,
        originalText: text,
      }
    })
  } catch (err) {
    console.error('parseSiriFastIntent error:', err)
    return []
  }
}



