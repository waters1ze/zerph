/**
 * Zerf Backend вЂ” Groq AI Integration Module
 * whisper-large-v3 for speech В· openai/gpt-oss-120b for intelligence
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
  dueTime?: string | null       // HH:MM вЂ” extracted from "at 12:00", "РІ 15:30" etc.
  daysCount?: number | null     // 1 for 1 day, 7 for week, etc.
  recipientName?: string | null // Extracted name if sending a message to a contact or asking schedule e.g. "Р›РµСЂР°", "РђСЂС‚РµРј"
  isPluralRecipient?: boolean   // True if sending to multiple people e.g. "РђСЂС‚РµРјР°Рј"
  isBothShared?: boolean        // True if task is for BOTH ("РЅР°Рј", "РґР»СЏ РЅР°СЃ", "СЃРѕРІРјРµСЃС‚РЅР°СЏ"), False if for single friend only ("РґР°Р№ Р’РѕРІРµ", "РїРѕСЂСѓС‡Рё Р›РµСЂРµ")
  targetTitle?: string          // for 'completion' type вЂ” the task being marked done
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

  let prompt = `You are Zerf AI вЂ” the official intelligent personal productivity assistant for Zerf (zerph).
Language: Russian only if user input contains Russian words. Never switch to English if input is Russian.
Current Moscow Time: ${mskDate} ${mskTime} (24-hour MSK).

CRITICAL TIME RULES:
- Calculate all relative dates/times strictly relative to ${mskDate} ${mskTime}.
- EXACT TIME: If user specifies format with minutes or exact time (e.g. "РІ 10:00", "РІ 11:30", "РІ 09:15"), STRICTLY keep that exact time ("10:00", "11:30", "09:15")!
- FUTURE DAYS: If scheduled for tomorrow or a future date ("Р·Р°РІС‚СЂР° РІ 10:00", "Р·Р°РІС‚СЂР° РІ 10", "РІ РїСЏС‚РЅРёС†Сѓ РІ 9"), keep the morning hour ("10:00", "09:00").
- Time ranges ("СЃ 8 РґРѕ 15", "СЃ 18:00 РґРѕ 20:00", "СЃ 22:00 РґРѕ 02:00", "22:00-02:00"): set "dueTime": "22:00 - 02:00". For overnight ranges crossing midnight (e.g. 22:00 - 02:00), the start time is 22:00 on dueDate; this is an active upcoming task, NEVER mark as completed!
- COMPLETION vs CREATION: ONLY set "action": "completion" / "type": "completion" when the user EXPLICITLY says that a task is already done/completed/finished ("СЏ СЃРґРµР»Р°Р» X", "РІС‹РїРѕР»РЅРёР» Р·Р°РґР°С‡Сѓ X", "РѕС‚РјРµС‚СЊ X РєР°Рє СЃРґРµР»Р°РЅРЅСѓСЋ"). When user plans, schedules, dictates a plan or gives time ranges, ALWAYS use "action": "create", "type": "task"!

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
      "tags": ["СЂР°Р±РѕС‚Р°" | "Р»РёС‡РЅРѕРµ" | "СѓС‡РµР±Р°" | "СЃРїРѕСЂС‚" | "РёРґРµРё" | "СЃСЂРѕС‡РЅРѕ"],
      "subtasks": [] | string[] | [{"title": string, "dueTime"?: string, "dueDate"?: string, "durationDays"?: number}]
    }
  ]
}

FEATURE INSTRUCTIONS & INTENT ROUTING:
1. GREETINGS / QUESTIONS / MATH / ADVICE / CONVERSATION:
   - If input is a greeting ("РїСЂРёРІРµС‚", "РєР°Рє РґРµР»Р°"), question ("СЃРєРѕР»СЊРєРѕ Р±СѓРґРµС‚ 145*18?", "С‡С‚Рѕ С‚Р°РєРѕРµ РёРЅС‚РµРіСЂР°Р»?"), advice request ("РєР°Рє СЃРѕСЃС‚Р°РІРёС‚СЊ РїР»Р°РЅ?"), or explanation:
     Set "type": "answer", "action": "reply", "title": "...", "summary": "Full, polite, helpful and direct answer in Russian". DO NOT create tasks or notes!
2. TASKS & REMINDERS ("type": "task", "action": "create"):
   - Default for actions, todos, voice dictation ("РєСѓРїРёС‚СЊ РјРѕР»РѕРєРѕ", "РЅР°РїРѕРјРЅРё РІ 17:00", "СЃРѕР·РІРѕРЅ РІ 11:00", "РЅР°РїРѕРјРЅРё Р»РµС‡СЊ СЃРїР°С‚СЊ С‡РµСЂРµР· 30 РјРёРЅСѓС‚").
   - CRITICAL TITLE RULE: "title" must contain the action ONLY (e.g. "Р›РµС‡СЊ СЃРїР°С‚СЊ", "РљСѓРїРёС‚СЊ РјРѕР»РѕРєРѕ", "РџРѕР·РІРѕРЅРёС‚СЊ РјР°РјРµ"). NEVER include relative or baked-in time strings in the title such as "(С‡РµСЂРµР· 30 РјРёРЅСѓС‚)", "С‡РµСЂРµР· С‡Р°СЃ", "(РІ 15:00)"! All times belong strictly in "dueTime" and "dueDate"!
   - "subtasks": [] for normal simple tasks. Generate subtasks ONLY for complex projects or if explicitly requested ("СЂР°Р·Р±РµР№ РЅР° С€Р°РіРё", "4 СЌС‚Р°РїР°").
   - If subtasks have individual times/dates, specify array of objects: [{"title": "1 СЌС‚Р°Рї: ...", "dueTime": "10:00", "dueDate": "YYYY-MM-DD"}].
3. NOTES ("type": "note", "action": "create"):
   - ONLY if explicitly requested: "Р·Р°РїРёС€Рё Р·Р°РјРµС‚РєСѓ", "СЃРѕС…СЂР°РЅРё РјС‹СЃР»СЊ", "Р·Р°РїРёС€Рё РєРѕРЅСЃРїРµРєС‚", "СЃРѕС…СЂР°РЅРё РёРґРµСЋ".
   - CRITICAL: If user specifies a time or reminder in a note request (e.g. "РґРѕР±Р°РІСЊ Р·Р°РјРµС‚РєСѓ РІ С‡Р°СЃ РЅРѕС‡Рё РїРѕРёРіСЂР°С‚СЊ РІ РєСЃ2", "Р·Р°РїРёС€Рё Р·Р°РјРµС‚РєСѓ РЅР° 15:00"): generate BOTH:
     1) "type": "note", "action": "create" вЂ” for knowledge base;
     2) "type": "task", "action": "create" with exact "dueTime" and "dueDate" вЂ” to trigger the reminder at that exact hour!
4. DELEGATE & SHARED TASKS ("type": "delegate"):
   - Shared for both ("РЅР°Рј", "РґР»СЏ РЅР°СЃ", "РјРЅРµ Рё Р’РѕРІРµ", "РІРјРµСЃС‚Рµ", "РѕР±С‰Р°СЏ"): "isBothShared": true, "recipientName": "Name".
   - Assigned to one friend ("РґР°Р№ Р’РѕРІРµ Р·Р°РґР°С‡Сѓ", "РїРѕСЂСѓС‡Рё Р›РµСЂРµ", "РїРµСЂРµРґР°Р№ РђСЂС‚РµРјСѓ"): "isBothShared": false, "recipientName": "Name".
5. HABITS & PROJECTS:
   - Habit ("РїСЂРёРІС‹С‡РєР° РїРёС‚СЊ 2Р» РІРѕРґС‹ РєР°Р¶РґРѕРµ СѓС‚СЂРѕ"): "type": "habit", "icon": "рџ’§", "frequency": "daily".
   - Project ("РїСЂРѕРµРєС‚ РЎР°Р№С‚ СЃ Р›РµСЂРѕР№ Рё РђСЂС‚РµРјРѕРј"): "type": "project", "members": ["Р›РµСЂР°", "РђСЂС‚РµРј"].
6. SCHOOL SCHEDULES & ROUTINES:
   - Lessons list: "tags": ["СѓС‡РµР±Р°", "С€РєРѕР»Р°", "СЂР°СЃРїРёСЃР°РЅРёРµ"].
   - Day off / cancel school for day ("Р·Р°РІС‚СЂР° РІС‹С…РѕРґРЅРѕР№", "РѕС‚РјРµРЅРё СѓСЂРѕРєРё РЅР° СЃСЂРµРґСѓ"): "action": "cancel_schedule", "type": "task", "dueDate": "YYYY-MM-DD".
   - Cancel recurring routine ("РѕС‚РјРµРЅРё Р±Р°СЃСЃРµР№РЅ РїРѕ РїСЏС‚РЅРёС†Р°Рј"): "action": "cancel_recurring_schedule", "targetTitle": "Р‘Р°СЃСЃРµР№РЅ".
7. EDIT & DELETE (SINGLE & COMBINED ACTIONS):
   - "СѓРґР°Р»Рё Р·Р°РґР°С‡Сѓ X": "action": "delete", "type": "task", "targetTitle": "X".
   - "СѓРґР°Р»Рё Р·Р°РјРµС‚РєСѓ X": "action": "delete", "type": "note", "targetTitle": "X".
   - "СѓРґР°Р»Рё РІСЃРµ Р·Р°РґР°С‡Рё": "action": "delete_all".
   - "РїРµСЂРµРЅРµСЃРё РЅР° 18:00 / РїРѕРјРµРЅСЏР№ РЅР°Р·РІР°РЅРёРµ": "action": "update", "targetTitle": "X", "dueDate": "...", "dueTime": "...".
   - MULTI-ACTION (e.g. "СѓРґР°Р»Рё СЌС‚Сѓ Р·Р°РјРµС‚РєСѓ, СЃРґРµР»Р°Р№ С‡С‚РѕР±С‹ СЌС‚Рѕ Р±С‹Р»Р° Р·Р°РґР°С‡Р° РІСЃРµ С‚Р°РєРё", "СѓРґР°Р»Рё Р·Р°РґР°С‡Сѓ X Рё СЃРѕР·РґР°Р№ РЅР°РїРѕРјРёРЅР°РЅРёРµ Y"):
     ALWAYS output ALL actions in the "items" array in exact sequence!
     Example for "СѓРґР°Р»Рё СЌС‚Сѓ Р·Р°РјРµС‚РєСѓ, СЃРґРµР»Р°Р№ Р·Р°РґР°С‡Сѓ РЅР° 01:00":
     Item 1: {"action": "delete", "type": "note", "targetTitle": "РќР°Р·РІР°РЅРёРµ Р·Р°РјРµС‚РєРё"}
     Item 2: {"action": "create", "type": "task", "title": "РќР°Р·РІР°РЅРёРµ Р·Р°РґР°С‡Рё", "dueTime": "01:00", "dueDate": "YYYY-MM-DD"}
8. BIRTHDAYS & HOLIDAYS:
   - Holiday / birthday of friend ("РґРµРЅСЊ СЂРѕР¶РґРµРЅРёСЏ РґСЂСѓРіР° 15 РјР°СЏ", "РќРѕРІС‹Р№ РіРѕРґ 31 РґРµРєР°Р±СЂСЏ"): "type": "task", "repeat": "yearly", "dueTime": "00:00", "tags": ["РїСЂР°Р·РґРЅРёРє", "РєР°Р»РµРЅРґР°СЂСЊ"].
   - User's own birthday ("РјРѕР№ РґСЂ 3 Р°РїСЂРµР»СЏ"): "action": "set_my_birthday", "dueDate": "YYYY-MM-DD".
9. MULTI-ITEM INPUT:
   - If multiple tasks/actions/notes are mentioned (e.g. "РєСѓРїРёС‚СЊ С…Р»РµР± Рё РµС‰Рµ С‡РµСЂРµР· 2 С‡Р°СЃР° РїРѕР·РІРѕРЅРёС‚СЊ РјР°РјРµ"), extract ALL items into the "items" array.`

  if (extensionsContext) {
    prompt += `\n\nрџ§© РђРєС‚РёРІРЅС‹Рµ СЂР°СЃС€РёСЂРµРЅРёСЏ:\n${extensionsContext.slice(0, 1500)}`
  }

  if (existingItemsContext) {
    prompt += `\n\nрџ“‹ РЎСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ СЌР»РµРјРµРЅС‚С‹:\n${existingItemsContext.slice(0, 2000)}`
  }

  if (friendsContext) {
    prompt += `\n\nрџ‘Ґ РљРѕРЅС‚Р°РєС‚С‹ Рё РґСЂСѓР·СЊСЏ:\n${friendsContext.slice(0, 1000)}`
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
      return item.title && !t.includes('РЅРµРёР·РІРµСЃС‚РЅРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ') && !t.includes('РЅРµС‡РёС‚Р°РµРјРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ') && !t.includes('РЅРµРёР·РІРµСЃС‚РЅС‹Р№ С‚РµРєСЃС‚')
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
        repeat: item.repeat || ((item.title || text).toLowerCase().match(/РґРµРЅСЊ СЂРѕР¶Рґ|РґСЂ|РїСЂР°Р·РґРЅРёРє|РіРѕРґРѕРІС‰РёРЅ/) ? 'yearly' : null),
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
 * Normalizes ambiguous relative times (e.g. "РІ 6 С‡Р°СЃРѕРІ" -> 18:00 if morning has passed, or tomorrow if evening passed)
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

  // If no dueTime was extracted by LLM, check if rawText mentions a time like "РІ 6", "РІ 6 С‡Р°СЃРѕРІ", "РІ 18:00", "РІ 7:30"
  if (!finalTime && rawText) {
    const timeMatch = rawText.match(/(?:^|\s)РІ\s*(\d{1,2})(?::(\d{2}))?\s*(?:С‡Р°СЃ(?:Р°|РѕРІ|РѕРј)?)?(?:\s*(СѓС‚СЂР°|РІРµС‡РµСЂР°|РґРЅСЏ|РЅРѕС‡Рё))?/i)
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10)
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
      const period = (timeMatch[3] || '').toLowerCase()
      if (period.includes('РІРµС‡РµСЂ') || period.includes('РґРЅСЏ')) {
        if (h < 12) h += 12
      } else if (period.includes('РЅРѕС‡') || period.includes('СѓС‚СЂ')) {
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
    const hasExplicitMorning = textLower.includes('СѓС‚СЂР°') || textLower.includes('СѓС‚СЂРѕРј') || textLower.includes('РЅРѕС‡Рё') || textLower.includes('am')
    const hasExplicitEvening = textLower.includes('РІРµС‡РµСЂР°') || textLower.includes('РІРµС‡РµСЂРѕРј') || textLower.includes('РґРЅСЏ') || textLower.includes('pm')
    const hasTomorrow = textLower.includes('Р·Р°РІС‚СЂР°') || textLower.includes('РїРѕСЃР»РµР·Р°РІС‚СЂР°')

    // If hour <= 12 and no explicit morning indicator, resolve ambiguity ONLY for TODAY
    if (hour <= 12 && !hasExplicitMorning) {
      if (hasExplicitEvening) {
        if (hour < 12) hour += 12
      } else if (!hasTomorrow && (!dueDate || dueDate === todayStr)) {
        // Ambiguous hour on TODAY (e.g. "РІ 6", "РІ 6 С‡Р°СЃРѕРІ", "РІ 7", "РІ 2")
        // Check if morning hour has already passed today
        const morningPassed = curHour > hour || (curHour === hour && curMin >= min)
        const pmHour = hour === 12 ? 12 : hour + 12
        const pmPassed = curHour > pmHour || (curHour === pmHour && curMin >= min)

        if (morningPassed && !pmPassed) {
          // e.g. currently 16:00, user said "РІ 6" -> 18:00 today!
          hour = pmHour
        } else if (morningPassed && pmPassed) {
          // e.g. currently 19:30, user said "РІ 6" -> both passed today -> 18:00 tomorrow!
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

  // Check if rawText contains "РЅР°Рј", "РґР»СЏ РЅР°СЃ", "РѕР±С‰Р°СЏ", "СЃРѕРІРјРµСЃС‚РЅР°СЏ", "РјРЅРµ Рё", "РЅР°Рј СЃ", "РґР»СЏ РјРµРЅСЏ Рё", "РІРјРµСЃС‚Рµ", "РѕР±РѕРёРј"
  const hasUsKeywords = /(?:^|[^Р°-СЏС‘a-z0-9])(?:РЅР°Рј|РґР»СЏ\s+РЅР°СЃ|РІРјРµСЃС‚Рµ|РѕР±РѕРёРј|РѕР±С‰Р°СЏ|СЃРѕРІРјРµСЃС‚РЅР°СЏ|СЃРѕРІРјРµСЃС‚РЅРѕ|РјРЅРµ\s+Рё|РЅР°Рј\s+СЃ|РґР»СЏ\s+РјРµРЅСЏ\s+Рё|СЃ\s+РЅР°РјРё)(?:[^Р°-СЏС‘a-z0-9]|$)/i.test(text)

  let isShared: boolean
  if (itemIsBothShared !== undefined) {
    isShared = Boolean(itemIsBothShared) || hasUsKeywords
  } else {
    isShared = hasUsKeywords
  }

  // Clean recName from "РјРЅРµ Рё X" / "РЅР°Рј СЃ X" / "РґР»СЏ РјРµРЅСЏ Рё X"
  if (recName) {
    recName = recName
      .replace(/^(?:РјРЅРµ\s+Рё|РЅР°Рј\s+СЃ|РґР»СЏ\s+РјРµРЅСЏ\s+Рё|РґР»СЏ\s+РЅР°СЃ\s+СЃ|СЏ\s+Рё|СЃ\s+)\s+/i, '')
      .replace(/\s+(?:Рё\s+РјРЅРµ|Рё\s+СЏ|СЃРѕ\s+РјРЅРѕР№|СЃ\s+РЅР°РјРё)$/i, '')
      .replace(/^(?:РґР»СЏ|РєРѕРјСѓ|РґСЂСѓРіСѓ|РєРѕР»Р»РµРіРµ)\s+/i, '')
      .trim()
  }

  // If no recName was extracted by LLM, try regexes on rawText:
  if (!recName && text) {
    const patterns = [
      // "РґР°Р№ РјРЅРµ Рё РІРѕРІС‡РёРєСѓ Р±РµСЂРµРіРѕРІРѕРјСѓ РѕР±С‰СѓСЋ Р·Р°РґР°С‡Сѓ РїРѕРёРіСЂР°С‚СЊ..."
      // "СЃРѕР·РґР°Р№ РЅР°Рј СЃ Р»РµСЂРѕР№ Р·Р°РґР°С‡Сѓ РїСЂРёРіРѕС‚РѕРІРёС‚СЊ..."
      /(?:РґР°Р№|РїРѕСЃС‚Р°РІСЊ|СЃРѕР·РґР°Р№|РЅР°Р·РЅР°С‡СЊ|Р·Р°РїРёС€Рё|РґРѕР±Р°РІСЊ|СЃРґРµР»Р°Р№)\s+(?:РјРЅРµ\s+Рё|РЅР°Рј\s+СЃ|РґР»СЏ\s+РјРµРЅСЏ\s+Рё|РґР»СЏ\s+РЅР°СЃ\s+СЃ)\s+([Р°-СЏС‘a-z0-9_@\s]+?)\s+(?:РѕР±С‰СѓСЋ\s+Р·Р°РґР°С‡Сѓ|СЃРѕРІРјРµСЃС‚РЅСѓСЋ\s+Р·Р°РґР°С‡Сѓ|РѕР±С‰СѓСЋ|СЃРѕРІРјРµСЃС‚РЅСѓСЋ|Р·Р°РґР°С‡Сѓ|С†РµР»СЊ|РґРµР»Рѕ|РЅР°РїРѕРјРёРЅР°РЅРёРµ|РїРѕРёРіСЂР°С‚СЊ|СЃРґРµР»Р°С‚СЊ|СЃРѕР·РІРѕРЅРёС‚СЊСЃСЏ|РІСЃС‚СЂРµС‚РёС‚СЊСЃСЏ|РїРѕР№С‚Рё)/i,
      // "РѕР±С‰Р°СЏ Р·Р°РґР°С‡Р° РјРЅРµ Рё РІРѕРІРµ РїРѕРёРіСЂР°С‚СЊ..."
      /(?:РѕР±С‰Р°СЏ|СЃРѕРІРјРµСЃС‚РЅР°СЏ)\s+(?:Р·Р°РґР°С‡Р°|С†РµР»СЊ|РґРµР»Рѕ)\s+(?:РґР»СЏ\s+)?(?:РјРµРЅСЏ\s+Рё\s+|РЅР°Рј\s+СЃ\s+|РјРЅРµ\s+Рё\s+)?([Р°-СЏС‘a-z0-9_@\s]+?)(?:,|$|\s+РїРѕ|\s+РЅР°|\s+РІ\s+\d|\s+С‡С‚РѕР±С‹|\s+РїРѕРёРіСЂР°С‚СЊ|\s+СЃРґРµР»Р°С‚СЊ)/i,
      // "РґР°Р№ Р·Р°РґР°С‡Сѓ РІРѕРІРµ РїРѕР·РІРѕРЅРёС‚СЊ..."
      /(?:РґР°Р№\s+Р·Р°РґР°С‡Сѓ|РїРѕСЂСѓС‡Рё\s+Р·Р°РґР°С‡Сѓ|РїРµСЂРµРґР°Р№\s+Р·Р°РґР°С‡Сѓ|РѕС‚РїСЂР°РІСЊ\s+Р·Р°РґР°С‡Сѓ|РЅР°Р·РЅР°С‡СЊ\s+Р·Р°РґР°С‡Сѓ|СЃРєРёРЅСЊ\s+Р·Р°РґР°С‡Сѓ|РєРёРЅСЊ\s+Р·Р°РґР°С‡Сѓ)\s+([Р°-СЏС‘a-z0-9_@\s]+?)(?:,|$|\s+С‡С‚РѕР±С‹|\s+РЅР°|\s+РІ\s+\d|\s+РїРѕ|\s+СЃРґРµР»Р°С‚СЊ|\s+РїРѕРёРіСЂР°С‚СЊ)/i,
      // "РґР°Р№ РІРѕРІРµ Р·Р°РґР°С‡Сѓ..." / "РїРѕСЂСѓС‡Рё Р»РµСЂРµ РѕС‚С‡РµС‚..."
      /(?:РґР°Р№|РїРѕСЂСѓС‡Рё|РїРµСЂРµРґР°Р№|РѕС‚РїСЂР°РІСЊ|РЅР°Р·РЅР°С‡СЊ|СЃРєРёРЅСЊ|РєРёРЅСЊ)\s+([Р°-СЏС‘a-z0-9_@\s]+?)\s+(?:Р·Р°РґР°С‡Сѓ|С†РµР»СЊ|РґРµР»Рѕ|СЃРґРµР»Р°С‚СЊ|РїРѕРёРіСЂР°С‚СЊ|СЃРѕР·РІРѕРЅРёС‚СЊСЃСЏ|РєСѓРїРёС‚СЊ|РЅР°РїРёСЃР°С‚СЊ|РїСЂРѕРІРµСЂРёС‚СЊ|РїРѕРґРіРѕС‚РѕРІРёС‚СЊ|РІСЃС‚СЂРµС‚РёС‚СЊСЃСЏ|РїРѕР№С‚Рё|РѕС‚С‡РµС‚)/i,
      // "Р·Р°РґР°С‡Р° РЅР°Рј СЃ Р»РµСЂРѕР№..."
      /Р·Р°РґР°С‡Р°\s+(?:РЅР°Рј\s+СЃ|РјРЅРµ\s+Рё)\s+([Р°-СЏС‘a-z0-9_@\s]+?)(?:,|$|\s+РїРѕ|\s+РЅР°|\s+РІ\s+\d|\s+С‡С‚РѕР±С‹)/i,
    ]

    for (const pat of patterns) {
      const m = text.match(pat)
      if (m && m[1]) {
        let candidate = m[1].trim()
        candidate = candidate
          .replace(/^(?:РјРЅРµ\s+Рё|РЅР°Рј\s+СЃ|РґР»СЏ\s+РјРµРЅСЏ\s+Рё|РґР»СЏ\s+РЅР°СЃ\s+СЃ)\s+/i, '')
          .replace(/\s+(?:РѕР±С‰СѓСЋ|СЃРѕРІРјРµСЃС‚РЅСѓСЋ|Р·Р°РґР°С‡Сѓ|С†РµР»СЊ|РґРµР»Рѕ)$/i, '')
          .trim()
        if (candidate && candidate.length <= 40) {
          recName = candidate
          break
        }
      }
    }
  }

  if (recName && (recName.toLowerCase() === 'РјРЅРµ' || recName.toLowerCase() === 'СЏ' || recName.toLowerCase() === 'СЃРµР±Рµ')) {
    recName = null
    isShared = false
  }

  return { recipientName: recName || null, isBothShared: Boolean(isShared) }
}

/**
 * Fuzzy similarity score between two strings (0вЂ“1)
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
          content: `РўС‹ вЂ” РґСЂСѓР¶РµР»СЋР±РЅС‹Р№ AI-Р°СЃСЃРёСЃС‚РµРЅС‚. РќР°РїРёС€Рё 2-3 РїСЂРµРґР»РѕР¶РµРЅРёСЏ РЅР° Р РЈРЎРЎРљРћРњ СЏР·С‹РєРµ:
1. РџСЂРёСЏС‚РЅРѕРµ РїРѕР¶РµР»Р°РЅРёРµ РёР»Рё РЅР°РїРѕРјРёРЅР°РЅРёРµ Рѕ РїСЂРµРґСЃС‚РѕСЏС‰РµРј СЃРѕР±С‹С‚РёРё
2. 1 РїСЂР°РєС‚РёС‡РµСЃРєСѓСЋ СЂРµРєРѕРјРµРЅРґР°С†РёСЋ РёР»Рё СЃРѕРІРµС‚
РЎС‚РёР»СЊ: С‚С‘РїР»С‹Р№, РїРѕРґРґРµСЂР¶РёРІР°СЋС‰РёР№, РєРѕРЅРєСЂРµС‚РЅС‹Р№. Р‘РµР· С€Р°Р±Р»РѕРЅРЅС‹С… С„СЂР°Р·. Р‘РµР· СѓРїРѕРјРёРЅР°РЅРёСЏ В«ZerfВ».
РћС‚РІРµС‚СЊ РўРћР›Р¬РљРћ СЌС‚РёРјРё 2-3 РїСЂРµРґР»РѕР¶РµРЅРёСЏРјРё, Р±РµР· Р»РёС€РЅРµРіРѕ С‚РµРєСЃС‚Р°.`,
        },
        {
          role: 'user',
          content: `РЎРѕР±С‹С‚РёРµ/С‚РµРјР°: В«${noteTitle}В»\nР’СЂРµРјСЏ: ${dueTime}\nРљРѕРЅС‚РµРєСЃС‚: ${noteContent.slice(0, 400)}`,
        },
      ],
      model: GROQ_CHAT_MODEL,
      temperature: 0.75,
      max_tokens: 200,
      apiKey,
    })
    return result.content?.trim() || `РќР°РїРѕРјРёРЅР°РЅРёРµ: В«${noteTitle}В» РІ ${dueTime}. рџЋЇ`
  } catch {
    return `РќР°РїРѕРјРёРЅР°РЅРёРµ: В«${noteTitle}В» РІ ${dueTime}. РЈРґР°С‡Рё! рџљЂ`
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
  apiKey?: string,
  memoryHint?: string
): Promise<string> {
  const now = new Date()
  const dayName = now.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    weekday: 'long', day: 'numeric', month: 'long',
  })

  try {
    const contextLines: string[] = []
    if (todayBirthdays.length) contextLines.push(`РџСЂР°Р·РґРЅРёРєРё Рё Р”РЅРё СЂРѕР¶РґРµРЅРёСЏ РЎР•Р“РћР”РќРЇ: ${todayBirthdays.join(', ')}`)
    if (pendingTasks.length) {
      contextLines.push(`РџР»Р°РЅС‹ Рё Р·Р°РґР°С‡Рё РЅР° СЃРµРіРѕРґРЅСЏ (${pendingTasks.length}): ${pendingTasks.slice(0, 6).join(', ')}`)
    } else {
      contextLines.push(`Р—Р°РґР°С‡ РЅР° СЃРµРіРѕРґРЅСЏ РЅРµС‚ (РґРµРЅСЊ РїРѕР»РЅРѕСЃС‚СЊСЋ СЃРІРѕР±РѕРґРµРЅ)`)
    }

    if (memoryHint && memoryHint.trim()) {
      contextLines.push(`Память о пользователе (кратко): ${memoryHint}`)
    }

    const result = await callGroqChatCompletion({
      messages: [
        {
          role: 'system',
          content: `РўС‹ вЂ” РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹Р№ AI-Р°СЃСЃРёСЃС‚РµРЅС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ Telegram (Zerf AI). РљР°Р¶РґРѕРµ СѓС‚СЂРѕ С‚С‹ РїРёС€РµС€СЊ РµРјСѓ С‚С‘РїР»РѕРµ, РІРґРѕС…РЅРѕРІР»СЏСЋС‰РµРµ Рё СЃС‚СЂРѕРіРѕ Р°РєС‚СѓР°Р»СЊРЅРѕРµ СѓС‚СЂРµРЅРЅРµРµ СЃРѕРѕР±С‰РµРЅРёРµ.
Р¤РѕСЂРјР°С‚ РѕС‚РІРµС‚Р° вЂ” Markdown РґР»СЏ Telegram (Р¶РёСЂРЅС‹Р№ *С‚РµРєСЃС‚*, РєСѓСЂСЃРёРІ _С‚РµРєСЃС‚_). РџРёС€Рё РўРћР›Р¬РљРћ РЅР° СЂСѓСЃСЃРєРѕРј СЏР·С‹РєРµ.

РљР РРўРР§Р•РЎРљРР• РџР РђР’РР›Рђ:
1. РћРїРёСЂР°Р№СЃСЏ РРЎРљР›Р®Р§РРўР•Р›Р¬РќРћ РЅР° СЃРїРёСЃРѕРє В«РџР»Р°РЅС‹ Рё Р·Р°РґР°С‡Рё РЅР° СЃРµРіРѕРґРЅСЏВ». РљРђРўР•Р“РћР РР§Р•РЎРљР Р—РђРџР Р•Р©Р•РќРћ РІС‹РґСѓРјС‹РІР°С‚СЊ РґРµР»Р°, Р»СЋРґРµР№, РїСЂРѕС€Р»С‹Рµ РІС‹РїРѕР»РЅРµРЅРЅС‹Рµ Р·Р°РґР°С‡Рё РёР»Рё РЅРµСЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ СЃРѕР±С‹С‚РёСЏ!
2. Р•СЃР»Рё РІ СЃС‚СЂРѕРєРµ В«РџР»Р°РЅС‹ Рё Р·Р°РґР°С‡Рё РЅР° СЃРµРіРѕРґРЅСЏВ» РЅР°РїРёСЃР°РЅРѕ В«Р—Р°РґР°С‡ РЅР° СЃРµРіРѕРґРЅСЏ РЅРµС‚В» вЂ” РЅР°РїРёС€Рё, С‡С‚Рѕ РґРµРЅСЊ СЃРІРѕР±РѕРґРµРЅ РѕС‚ Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅРЅС‹С… РґРµР», РїРѕР¶РµР»Р°Р№ РїСЂРѕРґСѓРєС‚РёРІРЅРѕРіРѕ РґРЅСЏ/РѕС‚РґС‹С…Р° Рё РґР°Р№ РїРѕР»РµР·РЅС‹Рµ СЃРѕРІРµС‚С‹ РїРѕ С„РѕРєСѓСЃСѓ РёР»Рё РїР»Р°РЅРёСЂРѕРІР°РЅРёСЋ.
3. Р”РЅРё СЂРѕР¶РґРµРЅРёСЏ СѓРїРѕРјРёРЅР°Р№ РўРћР›Р¬РљРћ РµСЃР»Рё РµСЃС‚СЊ СЃС‚СЂРѕРєР° В«РџСЂР°Р·РґРЅРёРєРё Рё Р”РЅРё СЂРѕР¶РґРµРЅРёСЏ РЎР•Р“РћР”РќРЇВ».

РЎС‚СЂСѓРєС‚СѓСЂР° СЃРѕРѕР±С‰РµРЅРёСЏ:
1. РџСЂРёРІРµС‚СЃС‚РІРёРµ СЃ РёРјРµРЅРµРј (1 СЃС‚СЂРѕРєР°: В«Р”РѕР±СЂРѕРµ СѓС‚СЂРѕ, [РРјСЏ]!В»).
2. Р”РµРЅСЊ РЅРµРґРµР»Рё Рё РґР°С‚Р° (В«РЎРµРіРѕРґРЅСЏ вЂ” [РґРµРЅСЊ], [РґР°С‚Р°].В»).
3. Р•СЃР»Рё РµСЃС‚СЊ Р·Р°РґР°С‡Рё РЅР° СЃРµРіРѕРґРЅСЏ вЂ” РєСЂР°С‚РєРёР№ РґСЂСѓР¶РµСЃРєРёР№ РєРѕРјРјРµРЅС‚Р°СЂРёР№ РїРѕ РЅРёРј (1-2 РїСЂРµРґР»РѕР¶РµРЅРёСЏ). Р•СЃР»Рё Р·Р°РґР°С‡ РЅРµС‚ вЂ” РїРѕР¶РµР»Р°Р№ РїСЂРѕРґСѓРєС‚РёРІРЅРѕРіРѕ РґРЅСЏ Рё С…РѕСЂРѕС€РµРіРѕ РЅР°СЃС‚СЂРѕРµРЅРёСЏ.
4. 2 РїРѕР»РµР·РЅС‹С… РїСЂР°РєС‚РёС‡РµСЃРєРёС… СЃРѕРІРµС‚Р° РЅР° РґРµРЅСЊ.
5. РљРѕСЂРѕС‚РєР°СЏ РјРѕС‚РёРІРёСЂСѓСЋС‰Р°СЏ С„СЂР°Р·Р°.

РњР°РєСЃРёРјСѓРј 130 СЃР»РѕРІ. Р‘РµР· Р»РёС€РЅРµР№ РІРѕРґС‹.`,
        },
        {
          role: 'user',
          content: `РРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ: ${firstName}\nР”Р°С‚Р°: ${dayName}\n${contextLines.join('\n')}`,
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
  const bdayLine = todayBirthdays.length ? `рџЋ‚ *РџСЂР°Р·РґРЅРёРєРё СЃРµРіРѕРґРЅСЏ:*\n${todayBirthdays.map(b => `в–Є ${b}`).join('\n')}\n\n` : ''
  return (
    `вњ¦ *Р”РѕР±СЂРѕРµ СѓС‚СЂРѕ, ${firstName}!*\n\n` +
    `РЎРµРіРѕРґРЅСЏ ${dayName}.\n\n` +
    bdayLine +
    (pendingTasks.length
      ? `рџ“‹ *РќР° СЃРµРіРѕРґРЅСЏ (${pendingTasks.length}):*\n${pendingTasks.slice(0, 5).map(t => `в–Є ${t}`).join('\n')}\n\n`
      : `вњ“ РќР° СЃРµРіРѕРґРЅСЏ Р·Р°РґР°С‡ РЅРµС‚ вЂ” РѕС‚Р»РёС‡РЅР°СЏ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ СЃРїР»Р°РЅРёСЂРѕРІР°С‚СЊ РґРµРЅСЊ!\n\n`) +
    `_РџСЂРѕРґСѓРєС‚РёРІРЅРѕРіРѕ РґРЅСЏ! вњ¦_`
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
          content: `РўС‹ вЂ” С‚Р°РєС‚РёС‡РЅС‹Р№ Рё СѓРјРЅС‹Р№ РІРµС‡РµСЂРЅРёР№ Р°СЃСЃРёСЃС‚РµРЅС‚ Zerf AI. Р’ 21:00 С‚С‹ РїРѕРґРІРѕРґРёС€СЊ СЃ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј РёС‚РѕРіРё РїСЂРѕС€РµРґС€РµРіРѕ РґРЅСЏ РІ Telegram.
РџРёС€Рё РўРћР›Р¬РљРћ РЅР° СЂСѓСЃСЃРєРѕРј СЏР·С‹РєРµ, РІ Markdown РґР»СЏ Telegram (Р¶РёСЂРЅС‹Р№ **С‚РµРєСЃС‚**, РєСѓСЂСЃРёРІ _С‚РµРєСЃС‚_).
РЎС‚РёР»СЊ: СЃРїРѕРєРѕР№РЅС‹Р№, Р»Р°РєРѕРЅРёС‡РЅС‹Р№, РїРѕРґРґРµСЂР¶РёРІР°СЋС‰РёР№.

РЎРўР РћР“РР• РџР РђР’РР›Рђ (РќР• РќРђР РЈРЁРђР™ РќР РџР Р РљРђРљРРҐ РЈРЎР›РћР’РРЇРҐ!):
1. Р§РЃРўРљРћ Р РђР—Р”Р•Р›РЇР™ Р”РќР: РЎР•Р“РћР”РќРЇ Рё Р—РђР’РўР Рђ вЂ” СЌС‚Рѕ СЂР°Р·РЅС‹Рµ РґРЅРё. РќРёРєРѕРіРґР° РЅРµ РїСѓС‚Р°Р№ РёС…!
2. РќР•Р—РђРљР Р«РўР«Р• Р—РђР”РђР§Р Р—Рђ РЎР•Р“РћР”РќРЇ:
   - Р•СЃР»Рё Р·Р° СЃРµРіРѕРґРЅСЏ РµСЃС‚СЊ РЅРµР·Р°РєСЂС‹С‚С‹Рµ Р·Р°РґР°С‡Рё, С‚С‹ РўРћР›Р¬РљРћ РјСЏРіРєРѕ РЅР°РїРѕРјРёРЅР°РµС€СЊ Рѕ РЅРёС… РёР»Рё СЃРїСЂР°С€РёРІР°РµС€СЊ: РІРѕР·РјРѕР¶РЅРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓР¶Рµ РІС‹РїРѕР»РЅРёР» РёС…, РЅРѕ Р·Р°Р±С‹Р» РѕС‚РјРµС‚РёС‚СЊ РІС‹РїРѕР»РЅРµРЅРЅС‹РјРё РІ РїСЂРёР»РѕР¶РµРЅРёРё Zerf.
   - РљРђРўР•Р“РћР РР§Р•РЎРљР Р—РђРџР Р•Р©Р•РќРћ РґР°РІР°С‚СЊ СЃРѕРІРµС‚С‹ РїРѕ СЃРµРіРѕРґРЅСЏС€РЅРёРј РЅРµРІС‹РїРѕР»РЅРµРЅРЅС‹Рј Р·Р°РґР°С‡Р°Рј!
   - РљРђРўР•Р“РћР РР§Р•РЎРљР Р—РђРџР Р•Р©Р•РќРћ РїРµСЂРµРЅРѕСЃРёС‚СЊ СЃРµРіРѕРґРЅСЏС€РЅРёРµ РЅРµР·Р°РєСЂС‹С‚С‹Рµ Р·Р°РґР°С‡Рё РЅР° Р·Р°РІС‚СЂР° РІ С‚РµРєСЃС‚Рµ (РЅР°РїСЂРёРјРµСЂ, РµСЃР»Рё СЃРµРіРѕРґРЅСЏ Р±С‹Р»Р° Р·Р°РґР°С‡Р° "РІСЃС‚СЂРµС‡Р° СЃ РІСЂР°С‡РѕРј", РќР•Р›Р¬Р—РЇ РїРёСЃР°С‚СЊ "Р·Р°РІС‚СЂР° СѓРґР°С‡Рё Сѓ РІСЂР°С‡Р°"!).
3. РЎРћР’Р•Рў Р Р—РђР”РђР§Р РќРђ Р—РђР’РўР Рђ:
   - Р‘Р»РѕРє В«**РЎРѕРІРµС‚:**В» СЃС‚СЂРѕРёС‚СЃСЏ РРЎРљР›Р®Р§РРўР•Р›Р¬РќРћ РЅР° РѕСЃРЅРѕРІРµ СЃРїРёСЃРєР° В«Р—РђРџР›РђРќРР РћР’РђРќРћ РќРђ Р—РђР’РўР РђВ» (РµСЃР»Рё РѕРЅРё РµСЃС‚СЊ).
   - Р•СЃР»Рё РЅР° Р·Р°РІС‚СЂР° РµСЃС‚СЊ Р·Р°РґР°С‡Рё: РґР°Р№ 1 РєРѕСЂРѕС‚РєРёР№ РїСЂР°РєС‚РёС‡РЅС‹Р№ СЃРѕРІРµС‚, РєР°Рє РїРѕРґРіРѕС‚РѕРІРёС‚СЊСЃСЏ РєРѕ СЃРЅСѓ Рё Р·Р°РІС‚СЂР°С€РЅРёРј РґРµР»Р°Рј.
   - Р•СЃР»Рё РЅР° Р·Р°РІС‚СЂР° Р·Р°РґР°С‡ РЅРµС‚ (СЃРїРёСЃРѕРє РїСѓСЃС‚): РґР°Р№ РЅРµР№С‚СЂР°Р»СЊРЅС‹Р№ СЃРѕРІРµС‚ РїРѕ РІРµС‡РµСЂРЅРµРјСѓ РѕС‚РґС‹С…Сѓ, СЃРЅСѓ Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЋ (Р±РµР· СѓРїРѕРјРёРЅР°РЅРёСЏ С‡СѓР¶РёС… РёР»Рё СЃРµРіРѕРґРЅСЏС€РЅРёС… РґРµР»).

РЎРўР РЈРљРўРЈР Рђ РЎРћРћР‘Р©Р•РќРРЇ:
1. РћР±СЂР°С‰РµРЅРёРµ РїРѕ РёРјРµРЅРё (РЅР°РїСЂРёРјРµСЂ: В«**РџСЂРёРІРµС‚, [РРјСЏ]! рџЊ™**В» РёР»Рё В«**Р”РѕР±СЂС‹Р№ РІРµС‡РµСЂ, [РРјСЏ]! рџЊ™**В»).
2. РС‚РѕРіРё Р·Р° РЎР•Р“РћР”РќРЇ:
   - Р•СЃР»Рё Р±С‹Р»Рё Р·Р°РєСЂС‹С‚С‹ Р·Р°РґР°С‡Рё: РїРѕС…РІР°Р»Рё Р·Р° РєРѕРЅРєСЂРµС‚РЅРѕ РІС‹РїРѕР»РЅРµРЅРЅС‹Рµ РґРµР»Р°.
   - Р•СЃР»Рё РѕСЃС‚Р°Р»РёСЃСЊ РЅРµР·Р°РєСЂС‹С‚С‹Рµ Р·Р°РґР°С‡Рё: РјСЏРіРєРѕ СѓРїРѕРјСЏРЅРё РёС… СЃРїРёСЃРєРѕРј (В«РћСЃС‚Р°Р»РёСЃСЊ РЅРµР·Р°РєСЂС‹С‚С‹РјРё: ... Р’РѕР·РјРѕР¶РЅРѕ, С‚С‹ СѓР¶Рµ РІСЃС‘ СЃРґРµР»Р°Р»(Р°), РЅРѕ Р·Р°Р±С‹Р»(Р°) РѕС‚РјРµС‚РёС‚СЊ РіР°Р»РѕС‡РєРѕР№ РІ РїСЂРёР»РѕР¶РµРЅРёРёВ»).
   - Р•СЃР»Рё Р·Р°РґР°С‡ РІРѕРѕР±С‰Рµ РЅРµ Р±С‹Р»Рѕ: СЃРєР°Р¶Рё, С‡С‚Рѕ РґРµРЅСЊ РїСЂРѕС€С‘Р» РІ СЃРїРѕРєРѕР№РЅРѕРј СЂРёС‚РјРµ.
3. Р‘Р»РѕРє В«**РЎРѕРІРµС‚:**В» вЂ” 1вЂ“2 РїСЂРµРґР»РѕР¶РµРЅРёСЏ СЃ СЂРµРєРѕРјРµРЅРґР°С†РёРµР№ РЅР° РІРµС‡РµСЂ/СЃРѕРЅ (СЃС‚СЂРѕРіРѕ СЃ СѓС‡С‘С‚РѕРј Р·Р°РґР°С‡ РЅР° Р·Р°РІС‚СЂР°, РµСЃР»Рё РѕРЅРё РµСЃС‚СЊ).

РњР°РєСЃРёРјСѓРј 110 СЃР»РѕРІ. Р‘РµР· Р»РёС€РЅРµР№ РІРѕРґС‹.`,
        },
        {
          role: 'user',
          content: `РРјСЏ: ${firstName}\nР’С‹РїРѕР»РЅРµРЅРѕ Р·Р°РґР°С‡ РЎР•Р“РћР”РќРЇ (${completedTasks.length}): ${completedTasks.slice(0, 5).join(', ') || 'РЅРµС‚'}\nРћСЃС‚Р°Р»РёСЃСЊ РЅРµР·Р°РєСЂС‹С‚С‹РјРё РЎР•Р“РћР”РќРЇ (${pendingTasks.length}): ${pendingTasks.slice(0, 5).join(', ') || 'РІСЃРµ Р·Р°РєСЂС‹С‚С‹'}\nР—Р°РїР»Р°РЅРёСЂРѕРІР°РЅРѕ РќРђ Р—РђР’РўР Рђ (${tomorrowTasks.length}): ${tomorrowTasks.slice(0, 5).join(', ') || 'РЅРµС‚ РєРѕРЅРєСЂРµС‚РЅС‹С… Р·Р°РґР°С‡ РЅР° Р·Р°РІС‚СЂР°'}`,
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
  let msg = `вњ¦ **Р”РѕР±СЂС‹Р№ РІРµС‡РµСЂ, ${firstName}! рџЊ™**\n\n`
  if (completedTasks.length > 0) {
    msg += `вњ“ **Р’С‹РїРѕР»РЅРµРЅРѕ Р·Р° СЃРµРіРѕРґРЅСЏ (${completedTasks.length}):**\n` +
      completedTasks.slice(0, 5).map(t => `  в–« ~${t}~`).join('\n') + `\n\n`
  } else {
    msg += `РЎРµРіРѕРґРЅСЏ РЅРµ Р±С‹Р»Рѕ РѕС‚РјРµС‡РµРЅРѕ РІС‹РїРѕР»РЅРµРЅРЅС‹С… Р·Р°РґР°С‡.\n\n`
  }

  if (pendingTasks.length > 0) {
    msg += `вЏ± **РћСЃС‚Р°Р»РёСЃСЊ РЅРµР·Р°РєСЂС‹С‚С‹РјРё Р·Р° СЃРµРіРѕРґРЅСЏ (${pendingTasks.length}):**\n` +
      pendingTasks.slice(0, 5).map(t => `  в–Є ${t}`).join('\n') + `\n` +
      `_Р•СЃР»Рё РІС‹ РёС… СѓР¶Рµ РІС‹РїРѕР»РЅРёР»Рё, РЅРµ Р·Р°Р±СѓРґСЊС‚Рµ РѕС‚РјРµС‚РёС‚СЊ РіР°Р»РѕС‡РєРѕР№ РІ РїСЂРёР»РѕР¶РµРЅРёРё._\n\n`
  } else {
    msg += `вњ¦ **Р’СЃРµ Р·Р°РґР°С‡Рё Р·Р° СЃРµРіРѕРґРЅСЏ Р·Р°РєСЂС‹С‚С‹! РћС‚Р»РёС‡РЅР°СЏ СЂР°Р±РѕС‚Р°.**\n\n`
  }

  if (tomorrowTasks.length > 0) {
    msg += `рџ“… **РџР»Р°РЅС‹ РЅР° Р·Р°РІС‚СЂР° (${tomorrowTasks.length}):**\n` +
      tomorrowTasks.slice(0, 3).map(t => `  в–« ${t}`).join('\n') + `\n\n`
    msg += `**РЎРѕРІРµС‚:** РѕС‚РґРѕС…РЅРёС‚Рµ РІРµС‡РµСЂРѕРј Рё РІС‹СЃРїРёС‚РµСЃСЊ, С‡С‚РѕР±С‹ Р·Р°РІС‚СЂР° РїСЂРѕРґСѓРєС‚РёРІРЅРѕ Р·Р°РєСЂС‹С‚СЊ Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅРЅС‹Рµ РґРµР»Р°.`
  } else {
    msg += `**РЎРѕРІРµС‚:** РѕС‚Р»РѕР¶РёС‚Рµ С‚РµР»РµС„РѕРЅ РїРµСЂРµРґ СЃРЅРѕРј, РІС‹РїРµР№С‚Рµ С‚С‘РїР»РѕРіРѕ С‡Р°СЏ РёР»Рё СЃРґРµР»Р°Р№С‚Рµ Р»С‘РіРєСѓСЋ СЂР°СЃС‚СЏР¶РєСѓ, С‡С‚РѕР±С‹ С…РѕСЂРѕС€Рѕ РІС‹СЃРїР°С‚СЊСЃСЏ.`
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
    return { plan: [], aiAdvice: 'РќРµС‚ Р°РєС‚РёРІРЅС‹С… Р·Р°РґР°С‡ РґР»СЏ РїРµСЂРµРїР»Р°РЅРёСЂРѕРІР°РЅРёСЏ.' }
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
      reason: isTomorrow ? 'РџРµСЂРµРЅРµСЃРµРЅРѕ РЅР° Р·Р°РІС‚СЂР° РЅР° СѓС‚СЂРѕ' : 'РћРїС‚РёРјР°Р»СЊРЅС‹Р№ РёРЅС‚РµСЂРІР°Р» РЅР° СЃРµРіРѕРґРЅСЏ'
    }
  })

  try {
    const result = await callGroqChatCompletion({
      messages: [
        {
          role: 'system',
          content: `РўС‹ вЂ” СѓРјРЅС‹Р№ AI-С‚Р°Р№Рј-РјРµРЅРµРґР¶РµСЂ. РўРµР±Рµ РґР°РЅ СЃРїРёСЃРѕРє Р·Р°РґР°С‡ Рё С‚РµРєСѓС‰РµРµ РјРѕСЃРєРѕРІСЃРєРѕРµ РІСЂРµРјСЏ (${currentMskTime}).
Р Р°СЃРїСЂРµРґРµР»Рё Р·Р°РґР°С‡Рё РїРѕ СЂРµР°Р»РёСЃС‚РёС‡РЅС‹Рј СЃР»РѕС‚Р°Рј РІСЂРµРјРµРЅРё.
РџСЂР°РІРёР»Р°:
- РЎСЂРѕС‡РЅС‹Рµ Р·Р°РґР°С‡Рё (urgent/high) СЃС‚Р°РІСЊ СЂР°РЅСЊС€Рµ.
- РњРµР¶РґСѓ Р·Р°РґР°С‡Р°РјРё РѕСЃС‚Р°РІР»СЏР№ 30вЂ“60 РјРёРЅСѓС‚.
- Р•СЃР»Рё РІСЂРµРјРµРЅРё РІ СЃСѓС‚РєР°С… СѓР¶Рµ РЅРµ С…РІР°С‚Р°РµС‚ (РїРѕСЃР»Рµ 22:00), РїРµСЂРµРЅРѕСЃРё РЅР° Р·Р°РІС‚СЂР° ("isTomorrow": true, РЅР°С‡РёРЅР°СЏ СЃ 10:00).
- Р’РµСЂРЅРё РЎРўР РћР“РР™ JSON С„РѕСЂРјР°С‚:
{
  "aiAdvice": "РљРѕСЂРѕС‚РєРёР№ СЃРѕРІРµС‚ (1-2 РїСЂРµРґР»РѕР¶РµРЅРёСЏ) РїРѕС‡РµРјСѓ С‚Р°РєРѕР№ РіСЂР°С„РёРє РѕРїС‚РёРјР°Р»РµРЅ",
  "plan": [
    {
      "id": "ID Р·Р°РґР°С‡Рё",
      "newTime": "HH:MM",
      "isTomorrow": boolean,
      "reason": "РєСЂР°С‚РєР°СЏ РїСЂРёС‡РёРЅР° РІСЂРµРјРµРЅРё"
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
        title: orig?.title || 'Р—Р°РґР°С‡Р°',
        oldTime: orig?.dueTime || null,
        newTime: p.newTime || '18:00',
        isTomorrow: !!p.isTomorrow,
        reason: p.reason || 'РћРїС‚РёРјР°Р»СЊРЅРѕРµ РІСЂРµРјСЏ'
      }
    })

    return {
      plan: plan.length > 0 ? plan : fallbackPlan,
      aiAdvice: parsed.aiAdvice || 'Р Р°СЃРїРёСЃР°РЅРёРµ РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅРѕ РР.'
    }
  } catch (err) {
    console.error('Smart reschedule error:', err)
    return {
      plan: fallbackPlan,
      aiAdvice: 'Р—Р°РґР°С‡Рё СЂР°РІРЅРѕРјРµСЂРЅРѕ СЂР°СЃРїСЂРµРґРµР»РµРЅС‹ РїРѕ СЃРІРѕР±РѕРґРЅС‹Рј РёРЅС‚РµСЂРІР°Р»Р°Рј.'
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
2. Relative times ("С‡РµСЂРµР· 10 РјРёРЅСѓС‚", "РІ 18:00", "Р·Р°РІС‚СЂР° РІ 9 СѓС‚СЂР°", "Р±СѓРґРёР»СЊРЅРёРє РЅР° 7:00") MUST be calculated relative to current Moscow time ${mskTime} on ${mskDate}.
3. If user says "РїРѕСЂСѓС‡Рё [РРјСЏ]..." -> "type": "delegate", "isBothShared": false, "recipientName": "[РРјСЏ]".
4. If user says "РЅР°Рј СЃ [РРјСЏ] РѕР±С‰Р°СЏ Р·Р°РґР°С‡Р°..." -> "type": "delegate", "isBothShared": true, "recipientName": "[РРјСЏ]".`

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
        repeat: item.repeat || ((item.title || text).toLowerCase().match(/РґРµРЅСЊ СЂРѕР¶Рґ|РґСЂ|РїСЂР°Р·РґРЅРёРє|РіРѕРґРѕРІС‰РёРЅ/) ? 'yearly' : null),
        targetTitle: item.targetTitle || null,
        projectId: null,
        goalId: null,
        folder: null,
        members: null,
        tags: ['siri', 'Р±С‹СЃС‚СЂС‹Р№ РІРІРѕРґ'],
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



