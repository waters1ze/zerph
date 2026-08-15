/**
 * Zerf Backend — Groq AI Integration Module
 * whisper-large-v3 for speech · openai/gpt-oss-120b for intelligence
 */

import { GROQ_API_KEY as DEFAULT_KEY, GROQ_WHISPER_MODEL, GROQ_CHAT_MODEL } from '@/lib/config'

export interface ParsedItem {
  type: 'task' | 'goal' | 'note' | 'project' | 'habit' | 'reminder' | 'completion' | 'delegate'
  action?: 'create' | 'update' | 'delete' | 'delete_all' | 'completion' | 'set_my_birthday'
  targetId?: string | null
  title: string
  summary: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  dueDate?: string | null
  dueTime?: string | null       // HH:MM — extracted from "at 12:00", "в 15:30" etc.
  recipientName?: string | null // Extracted name if sending a message to a contact e.g. "Артем", "Мама"
  isPluralRecipient?: boolean   // True if sending to multiple people e.g. "Артемам"
  targetTitle?: string          // for 'completion' type — the task being marked done
  projectId?: string | null
  goalId?: string | null
  folder?: string | null
  members?: string[] | null
  icon?: string | null
  frequency?: string | null
  tags: string[]
  subtasks?: string[]
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

export function getDynamicSystemPrompt(existingItemsContext?: string, friendsContext?: string): string {
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
- All relative time phrases (e.g., "через минуту", "напиши мне через 1 минуту", "через 10 минут", "в 15:00", "завтра в 9 утра", "проснуться в 9 утра", "будильник на 8:00", "разбуди в 7 утра") MUST be calculated STRICTLY relative to CURRENT MOSCOW TIME ${mskTime} on ${mskDate}!
- Example: "проснуться в 9 утра" or "будильник на 9 утра" -> ALWAYS extract "dueTime": "09:00"!
- Example: "в 8 вечера" -> ALWAYS extract "dueTime": "20:00"!
- If current time is past the mentioned time (e.g. at night 02:00 saying "проснуться в 9 утра"), set "dueDate" to the upcoming morning!
- Example: If current Moscow time is "${mskTime}" and user says "через минуту" or "через 1 минуту", dueTime MUST be calculated as current minute + 1 minute (e.g. if current is 22:57, dueTime is 22:58). DO NOT SHIFT TIME OR ADD EXTRA HOURS!
- Always output "dueDate" in YYYY-MM-DD and "dueTime" in 24-hour HH:MM format.`

  if (existingItemsContext) {
    prompt += `\n\n══════════════════════════════════════════
📋 СУЩЕСТВУЮЩИЕ АКТИВНЫЕ ЭЛЕМЕНТЫ ПОЛЬЗОВАТЕЛЯ:
${existingItemsContext}
══════════════════════════════════════════
- Если пользователь ЯВНО говорит "удали все задачи", "очисти все задачи", "удали всё", "очистить тодо" — установи "action": "delete_all".
- ВАЖНО: Если пользователь говорит "удали будильник", "удали задачу проснуться", "удали напоминание", "убери задачу", "сотри это" — найди в списке задачу, связанную с этой темой (например, задачу "Проснуться" или напоминание на это время), и установи "action": "delete", "targetId": "<ID элемента>", "targetTitle": "<название задачи>". НИКОГДА не создавай новую задачу со словом "удалить"!
- Если пользователь просит удалить КОНКРЕТНУЮ задачу/цель/заметку (слова "удали", "убери", "сотри", "отмени", "вычеркни"):
  - Найди её в списке выше и установи "action": "delete", "targetId": "<ID элемента>", "targetTitle": "<название задачи>".
- Если пользователь называет дату своего дня рождения (фразы: "у меня др 3 апреля", "мой день рождения 15.05.2000", "запомни день рождения 20 июля", "др 3 апреля 2010"):
  - Установи "action": "set_my_birthday", "type": "task", "dueDate": "YYYY-MM-DD" (или введенная дата), "title": "День рождения сохранен".
- Если пользователь просит ИЗМЕНИТЬ время, дату или название существующего элемента (например: "давай в 12:00 лучше", "поменяй время"):
  - Установи "action": "update", "targetId": "<ID элемента>" и укажи обновленные поля.`
  }

  if (friendsContext) {
    prompt += `\n\n══════════════════════════════════════════
👥 КОНТАКТЫ И УЧАСТНИКИ КОМАНДЫ ПОЛЬЗОВАТЕЛЯ:
${friendsContext}
══════════════════════════════════════════`
  }

  prompt += `\n\n══════════════════════════════════════════
🤝 ПРАВИЛА ДЕЛЕГИРОВАНИЯ И ПОРУЧЕНИЯ ЗАДАЧ (HIGHEST PRIORITY)
══════════════════════════════════════════
- Личные задачи пользователя (СТРОГО "recipientName": null, "type": "task"):
  Если действие выполняет сам пользователь (например: "позвонить Артему", "купить подарок маме", "встреча с Леной в 15:00", "написать отчет для начальника"), это ЛИЧНАЯ задача пользователя! Установи "recipientName": null.

- Поручение задачи ДРУГОМУ человеку:
  ТОЛЬКО если пользователь ЯВНО просит передать или поручить выполнение другому человеку (слова: "дай задачу Вове", "поручи Вове...", "передай задачу Лере...", "создай задачу для Коли..."):
  1. "type": "delegate"
  2. "recipientName": "имя получателя" (например: "Вова", "Лера")
  3. "title": "Суть поручаемого действия"
  4. "summary": "Подробное описание поручения"
══════════════════════════════════════════`

  prompt += `\n\n══════════════════════════════════════════
📝 ТРЕБОВАНИЯ К ДЕТАЛИЗАЦИИ И ПОДРОБНОСТИ ОПИСАНИЙ (HIGHEST PRIORITY)
══════════════════════════════════════════
1. "title": ПОНЯТНОЕ И КОНКРЕТНОЕ НАЗВАНИЕ (до 80 символов)
   - Из заголовка должно быть МАКСИМАЛЬНО ясно, что именно нужно сделать.
   - ВКЛЮЧАЙ ключевой объект, имя или суть действия (например: "Позвонить автомеханику Олегу по замене масла" вместо сухой фразы "Позвонить").

2. "summary": МАКСИМАЛЬНО ПОДРОБНОЕ И ПОНЯТНОЕ ОПИСАНИЕ (2-5 предложений / списком)
   - ВЫЧЛЕНЯЙ ВСЮ возможную информацию из слова пользователя: имена, темы, контекст, привязки по времени, причины и мелкие детали.
   - Никогда не оставляй summary пустым или из 2 слов.
   - Разворачивай суть задачи: ЗАЧЕМ это делается, ЧТО конкретно нужно проверить/сделать, с какими деталями.

3. "subtasks": ПОДЗАДАЧИ (ОБЯЗАТЕЛЬНО 2-4 ШАГА)
   - Всегда разбивай задачу на логичные практические шаги выполнения (например: ["Связаться и уточнить время", "Подготовить документы", "Зафиксировать результат"]).
══════════════════════════════════════════

## Intent Detection & Actions

IMPORTANT MULTI-ITEM INSTRUCTION:
- If the user input mentions MULTIPLE tasks, goals, notes, or actions (e.g. "купить хлеб и еще через 2 часа позвонить маме" or "создай задачу А и заметку Б"), extract ALL of them into the "items" array in JSON!

CRITICAL INSTRUCTION: DO NOT INCLUDE ANY CONVERSATIONAL TEXT, EXPLANATIONS, OR REASONING (e.g. "Вот ваша заметка", "Я создал").
OUTPUT PURE JSON ONLY. NO MARKDOWN FENCES (DO NOT WRAP IN \`\`\`json).
Always respond with ONLY valid JSON:
{
  "items": [
    {
      "action": "create" | "update" | "delete" | "delete_all" | "completion" | "set_my_birthday",
      "targetId": "ID элемента если action update/delete" | null,
      "type": "task" | "goal" | "note" | "project" | "habit" | "reminder" | "completion" | "delegate",
      "title": "Понятное, информативное название с сутью действия",
      "summary": "Максимально подробное описание (2-5 предложений или Markdown список со всеми деталями)",
      "priority": "urgent" | "high" | "medium" | "low",
      "dueDate": "YYYY-MM-DD" | null,
      "dueTime": "HH:MM" | null,
      "repeat": "yearly" | "monthly" | "weekly" | "weekdays" | "daily" | null,
      "reminderOffsetMinutes": 0 | 5 | 10 | 15 | 30 | 60 | 1440 | null,
      "targetTitle": "для типа completion или delete: название задачи" | null,
      "recipientName": "строка с именем друга, кому отправляется элемент (задача, заметка, цель). Обязательно укажи, если пользователь просит создать что-то для ДРУГОГО человека (например: 'Лера', 'Мама'). Иначе null",
      "isPluralRecipient": "true, если пользователь обращается ко множеству людей (например, 'артемам', 'друзьям'), и false, если к одному ('артему'). По умолчанию false",
      "projectId": null,
      "goalId": null,
      "folder": "Название папки для заметки ('Работа', 'Личное', 'Идеи', 'Учеба', 'Проекты') или 'Общее'" | null,
      "members": ["массив имен или @username участников если создается проект, например ['Лера', 'Артем']"] | null,
      "icon": "эмодзи для привычки (например '🔥', '💧', '📚', '🏃', '🧘') если type: habit" | null,
      "frequency": "daily" | "weekly" | "weekdays" | null,
      "tags": ["тег1", "тег2"],
      "subtasks": ["конкретный шаг 1", "конкретный шаг 2", "конкретный шаг 3"],
      "milestones": ["этап 1", "этап 2"],
      "motivation": "только для целей" | null,
      "tasksToCreate": [{"title": "название", "dueDate": "YYYY-MM-DD" | null, "dueTime": "HH:MM" | null}] // только для type: note, чтобы создать и сразу привязать задачи
    }
  ]
}

HABITS & PROJECTS RULES:
- If input mentions "привычка", "добавь привычку", "создай привычку", "трекать привычку" (e.g., "привычка пить 2л воды каждое утро", "привычка читать 15 минут"), set "type": "habit", "title": "...", "frequency": "daily" (or "weekdays" / "weekly"), "icon": "💧"!
- If input mentions creating a project with team members (e.g., "создай проект 'Сайт' с Лерой и Артемом", "новый проект Диплом с @alex"), set "type": "project", "title": "...", "members": ["Лера", "Артем"] (extract all mentioned friends)!

RECURRENCE & ADVANCE REMINDERS RULES:
- If input mentions "по будням", "каждый рабочий день", "пн-пт", "с понедельника по пятницу", set "repeat": "weekdays"!
- If input mentions "каждый день", "ежедневно", set "repeat": "daily"!
- If input mentions "каждую неделю", "по понедельникам", "раз в неделю", set "repeat": "weekly"!
- If input mentions "каждый месяц", set "repeat": "monthly"!
- If input mentions a birthday, anniversary, holiday, or yearly event ("день рождения", "др", "праздник", "годовщина"), set "repeat": "yearly"!
- If input asks to be reminded in advance ("за 5 минут", "за 15 минут", "за 1 час", "за 1 день до..."), calculate and set "reminderOffsetMinutes" (e.g. 5, 15, 60, 1440)!
- If the user explicitly states THEIR OWN birthday (e.g., "мой др 03.04.2010", "у меня день рождения..."), set "action": "set_my_birthday" and extract the date into "dueDate" (format: YYYY-MM-DD or DD.MM.YYYY translated to YYYY-MM-DD). If year is unknown, use 0020-MM-DD.

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
  friendsContext?: string
): Promise<ParsedItem[]> {
  const dynamicSystemPrompt = getDynamicSystemPrompt(existingItemsContext, friendsContext)

  const result = await callGroqChatCompletion({
    messages: [
      { role: 'system', content: dynamicSystemPrompt },
      { role: 'user', content: text },
    ],
    model: model || GROQ_CHAT_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    apiKey,
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

        return rawItems.map((item: any) => ({
          action: item.action || (item.type === 'completion' ? 'completion' : 'create'),
          targetId: item.targetId || null,
          type: item.type || 'task',
          title: item.title || text.slice(0, 50),
          summary: item.summary || text,
          priority: item.priority || 'medium',
          dueDate: item.dueDate || null,
          dueTime: item.dueTime || null,
          repeat: item.repeat || ((item.title || text).toLowerCase().match(/день рожд|др|праздник|годовщин/) ? 'yearly' : null),
          reminderOffsetMinutes: Number(item.reminderOffsetMinutes) || 0,
          targetTitle: item.targetTitle || null,
          projectId: item.projectId || null,
          goalId: item.goalId || null,
          tags: Array.isArray(item.tags) ? item.tags : [],
          subtasks: Array.isArray(item.subtasks) ? item.subtasks : [],
          milestones: Array.isArray(item.milestones) ? item.milestones : [],
          motivation: item.motivation || null,
          rawText: text,
          originalText: text,
        }))
      } catch {
        return [{
          type: 'task',
          title: text.slice(0, 50),
          summary: text,
          priority: 'medium',
          tags: ['voice-input'],
          rawText: text,
          originalText: text,
        }]
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

/**
 * Generate personalized evening review at 21:00 MSK
 */
export async function generateEveningReview(
  firstName: string,
  completedTasks: string[],
  pendingTasks: string[],
  apiKey?: string
): Promise<string> {
  const key = apiKey || DEFAULT_KEY
  if (!key) return buildFallbackEveningReview(firstName, completedTasks, pendingTasks)

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: `Ты — личный ассистент Zerf AI. В 21:00 ты подводишь с пользователем итоги прошедшего дня.
Пиши ТОЛЬКО на русском языке, в Markdown для Telegram.
Структура:
1. Тёплое вечернее обращение по имени.
2. Похвала за закрытые задачи (если есть) или ободрение.
3. Короткий дружеский совет по отдыху/восстановлению сил на завтра.
Максимум 120 слов. Тон — тёплый, поддерживающий, уютный.`,
          },
          {
            role: 'user',
            content: `Имя: ${firstName}\nВыполнено задач сегодня (${completedTasks.length}): ${completedTasks.slice(0, 5).join(', ') || 'нет'}\nОсталось невыполненных (${pendingTasks.length}): ${pendingTasks.slice(0, 5).join(', ') || 'нет'}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    })

    if (!res.ok) throw new Error('Groq error')
    const data = await res.json()
    const aiText = data.choices?.[0]?.message?.content?.trim() || ''
    return aiText || buildFallbackEveningReview(firstName, completedTasks, pendingTasks)
  } catch {
    return buildFallbackEveningReview(firstName, completedTasks, pendingTasks)
  }
}

function buildFallbackEveningReview(firstName: string, completedTasks: string[], pendingTasks: string[]): string {
  let msg = `🌙 *Добрый вечер, ${firstName}!*\n\n`
  if (completedTasks.length > 0) {
    msg += `🎉 *Выполнено за сегодня (${completedTasks.length}):*\n` +
      completedTasks.slice(0, 5).map(t => `  ~${t}~`).join('\n') + `\n\n`
  } else {
    msg += `Сегодня был спокойный день без закрытых задач.\n\n`
  }

  if (pendingTasks.length > 0) {
    msg += `⏳ *Осталось незавершенных (${pendingTasks.length}):*\n` +
      pendingTasks.slice(0, 5).map(t => `  • ${t}`).join('\n') + `\n\n`
    msg += `_Отдохни и наберись сил! Если нужно, нажми кнопку ниже, чтобы перенести задачи на завтра._`
  } else {
    msg += `✨ *Все задачи закрыты! Идеальный результат! Отличного вечера и отдыха 🛋️*`
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
  const key = apiKey || DEFAULT_KEY
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

  if (!key) {
    return {
      plan: fallbackPlan,
      aiAdvice: 'Задачи равномерно распределены по свободным интервалам с учетом текущего времени.'
    }
  }

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
      response_format: { type: 'json_object' }
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



