/**
 * POST /api/shortcuts & GET /api/shortcuts — Apple Shortcuts & Android Siri/Assistant Integration Endpoint
 * Allows 1-tap voice/text input from iOS Action Button, Siri, Back Tap, and Android widgets.
 */

import { NextRequest, NextResponse } from 'next/server'
import { planAtLeast, incrementDailyCount, incrementLifetimeCount, COUNTERS } from '@/lib/backend/plans'
import crypto from 'crypto'
import { parseIntentWithGroq, parseSiriFastIntent, transcribeAudioWithGroq, extractCleanRecipientAndSharing } from '@/lib/backend/groq'
import { getModelForUserPlan } from '@/lib/backend/groq-pool'
import { saveParsedItemToDb, getExistingItemsContext, registerChatId, getAllTasks, extractNaturalTime, getUserUsageAndLimits, incrementUserUsage, getFriends, findFriendMatches } from '@/lib/backend/db'
import { sendVoiceResponse, createSpokenSummary } from '@/lib/backend/tts'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession, secretsMatch } from '@/lib/backend/auth'
import { tokenMatchesCandidateName } from '@/lib/backend/name-aliases'
import { GROQ_API_KEY } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const NO_CACHE_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

export function cleanShortcutsInput(raw: string): string {
  if (!raw) return ''
  let cleaned = raw.trim()
  
  // Try decoding any lingering URL percent encodings (e.g. %20, %D0...)
  try {
    if (cleaned.includes('%')) {
      cleaned = decodeURIComponent(cleaned)
    }
  } catch {}
  
  cleaned = cleaned.trim()

  // Detect accidental duplicate variable concatenations in Apple Shortcuts:
  // e.g. "купить яблоки купить яблоки" or "купить яблокикупить яблоки"
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2
    const firstHalf = words.slice(0, half).join(' ')
    const secondHalf = words.slice(half).join(' ')
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      cleaned = firstHalf
    }
  } else if (cleaned.length >= 4 && cleaned.length % 2 === 0) {
    const halfLen = cleaned.length / 2
    const firstPart = cleaned.slice(0, halfLen)
    const secondPart = cleaned.slice(halfLen)
    if (firstPart.toLowerCase() === secondPart.toLowerCase()) {
      cleaned = firstPart
    }
  }

  return cleaned.trim()
}

export function getSiriUserKey(chatId: number | string | bigint): string {
  const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.JWT_SECRET || 'zerf_siri_secret_key_salt_2026'
  return crypto.createHmac('sha256', secret).update(String(chatId)).digest('hex').slice(0, 10)
}

async function sendTgNotification(chatId: number, text: string, replyMarkup?: any) {
  if (!BOT_TOKEN) return
  try {
    const payload: any = { chat_id: chatId, text, parse_mode: 'Markdown' }
    if (replyMarkup) payload.reply_markup = replyMarkup
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {}
}

function isTodayQuery(text: string): boolean {
  const t = text.toLowerCase().trim()
  
  // If it has action verbs, colons, time or task creation markers, it is NEVER a query for reading tasks!
  const hasActionVerb = /\b(добавь|создай|напомни|запиши|поставь|купи|купить|сделай|сделать|позвони|позвонить|встреча|тренировка|занятие|урок|сдать|отправить|задача|задачу|план|планы)\b/i.test(t)
  if (hasActionVerb || t.includes(':') || /\b\d{1,2}:\d{2}\b/.test(t) || t.length > 35) {
    return false
  }

  return (
    t === 'что на сегодня' ||
    t === 'какие задачи на сегодня' ||
    t === 'какие планы на сегодня' ||
    t === 'прочитай задачи' ||
    t === 'список на сегодня' ||
    t === 'что у меня на сегодня' ||
    t === 'какие задачи' ||
    t === 'сегодня' ||
    t === 'today'
  )
}

async function handleTodaySpeech(chatId: number): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const allTasks = await getAllTasks(chatId)
  const pending = allTasks.filter(t => t.status !== 'done' && (t.dueDate === today || !t.dueDate))

  if (pending.length === 0) {
    return 'У вас на сегодня нет невыполненных задач. Всё чисто!'
  }

  const countWord = pending.length === 1 ? 'задача' : pending.length < 5 ? 'задачи' : 'задач'
  const itemsList = pending
    .slice(0, 5)
    .map((t, idx) => `${idx + 1}. ${t.title}${t.dueTime ? ' в ' + t.dueTime : ''}`)
    .join('. ')

  return `На сегодня ${pending.length} ${countWord}: ${itemsList}.`
}

async function processShortcutsItems(
  items: any[],
  chatId: number,
  inputText: string,
  friends: any[]
): Promise<{ spokenText: string; tgMsg: string; items: any[] }> {
  const hasActionVerb = /\b(добавь|создай|напомни|запиши|поставь|купи|купить|сделай|сделать|позвони|позвонить|встреча|тренировка|занятие|урок|сдать|отправить|задача|задачу|план|планы)\b/i.test(inputText)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
  const senderRec = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
  const senderName = senderRec?.firstName || 'Друг'

  const spokenParts: string[] = []
  let tgMsg = ''

  for (const item of items) {
    if (item.type === 'answer' && hasActionVerb) {
      item.type = 'task'
      item.action = 'create'
    }

    // Check delegation / recipient match
    const { recipientName: cleanRecName, isBothShared: cleanIsBothShared } = extractCleanRecipientAndSharing(
      inputText,
      item.recipientName,
      item.isBothShared
    )

    let matchedFriend: any = null
    if (cleanRecName) {
      const matches = await findFriendMatches(chatId, cleanRecName)
      const allowedMatch = matches.find(m => m.isAllowed === true)
      if (allowedMatch && allowedMatch.isAllowed) {
        matchedFriend = allowedMatch.friend
      }
    }

    if (matchedFriend) {
      const isBothShared = cleanIsBothShared
      const friendChatId = BigInt(matchedFriend.chatId)

      const newTask = await prisma.task.create({
        data: {
          title: item.title,
          description: item.summary || '',
          priority: item.priority || 'medium',
          status: 'todo',
          dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
          dueTime: item.dueTime || null,
          repeat: item.repeat || null,
          tags: isBothShared ? ['общая', ...(item.tags || [])] : ['поручение', ...(item.tags || [])],
          ownerChatId: friendChatId,
          authorChatId: BigInt(chatId),
          assignees: [String(chatId)],
          isShared: true,
          aiGenerated: true,
          source: inputText,
        } as any
      })

      if (isBothShared) {
        // Also create a synchronized task copy in author's own workspace so both have it
        await prisma.task.create({
          data: {
            title: item.title,
            description: item.summary || '',
            priority: item.priority || 'medium',
            status: 'todo',
            dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
            dueTime: item.dueTime || null,
            repeat: item.repeat || null,
            tags: ['общая', ...(item.tags || [])],
            ownerChatId: BigInt(chatId),
            authorChatId: BigInt(chatId),
            assignees: [String(friendChatId)],
            isShared: true,
            aiGenerated: true,
            source: inputText,
          } as any
        })
      }

      // Send Telegram notification to friend
      let notifyFriendMsg = isBothShared
        ? `🤝 *${senderName}* создал(а) общую задачу для вас двоих!\n\n`
        : `🤝 *${senderName}* поручил(а) тебе задачу через Siri!\n\n`
      notifyFriendMsg += `📌 *Задача:* ${item.title}\n`
      if (item.summary && item.summary !== item.title) {
        notifyFriendMsg += `📝 *Описание:* ${item.summary}\n`
      }
      if (item.dueTime) {
        notifyFriendMsg += `⏰ *Время:* ${item.dueTime}\n`
      }
      notifyFriendMsg += isBothShared
        ? `\n_Общая задача добавлена вам обоим в «Входящие» и календарь в Zerf AI_`
        : `\n_Задача добавлена в ваши «Входящие» и календарь в Zerf AI_`

      let webAppUrl = `${appUrl}/tg?chatId=${friendChatId}`
      try {
        const sessionToken = await createServerSession(friendChatId, 'Telegram Siri Notification')
        if (sessionToken) {
          webAppUrl = `${appUrl}/tg?chat_id=${friendChatId}&auth_token=${sessionToken}`
        }
      } catch (e) {
        console.error('Error creating session for notification:', e)
      }

      await sendTgNotification(Number(friendChatId), notifyFriendMsg, {
        inline_keyboard: [
          [{ text: '📱 Открыть в Zerf App', web_app: { url: webAppUrl } }],
          [
            { text: '✓ Принять', callback_data: `delegate_accept_${newTask.id}` },
            { text: '✗ Отклонить', callback_data: `delegate_decline_${newTask.id}` }
          ]
        ]
      })

      const friendDisplayName = matchedFriend.name?.split(' ')?.[0] || matchedFriend.name || cleanRecName || 'коллеге'
      if (isBothShared) {
        spokenParts.push(`Общая задача «${item.title}» создана для вас двоих и отправлена ${friendDisplayName}`)
        tgMsg += `🤝 Общая задача *«${item.title}»* создана для вас двоих и отправлена *${matchedFriend.name}* (@${matchedFriend.username || ''})!\n`
      } else {
        spokenParts.push(`Задача «${item.title}» отправлена ${friendDisplayName}`)
        tgMsg += `🤝 Задача *«${item.title}»* успешно отправлена *${matchedFriend.name}* (@${matchedFriend.username || ''})!\n`
      }
    } else {
      // Regular save to personal DB
      await saveParsedItemToDb(item, chatId)
      if (cleanRecName && friends.length === 0) {
        spokenParts.push(`Контакт не найден в друзьях. Задача «${item.title}» сохранена в вашем личном списке.`)
      }
    }
  }

  const finalSpokenText = spokenParts.length > 0 ? spokenParts.join('. ') : createSpokenSummary(items)
  return { spokenText: finalSpokenText, tgMsg, items }
}

export async function POST(req: NextRequest) {
  try {
    const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
    if (!key) {
      return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    let chatId: number | null = null
    let inputText = ''
    let bodyObj: Record<string, any> = {}

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      bodyObj = await req.json().catch(() => ({}))
      const rawCid = bodyObj.chatId || bodyObj.chat_id || bodyObj.userId || bodyObj.user_id || req.headers.get('x-chat-id') || searchParams.get('chatId')
      if (rawCid) chatId = Number(rawCid)
      inputText = bodyObj.text || bodyObj.query || bodyObj.task || bodyObj.q || bodyObj.prompt || bodyObj.message || ''
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData().catch(() => null)
      if (formData) {
        const rawCid = formData.get('chatId') || formData.get('chat_id') || req.headers.get('x-chat-id') || searchParams.get('chatId')
        if (rawCid) chatId = Number(rawCid)
        inputText = (formData.get('text') as string) || (formData.get('query') as string) || ''
        const file = (formData.get('audio') || formData.get('file')) as File | null

        if (file && !inputText) {
          const arrayBuf = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuf)
          inputText = await transcribeAudioWithGroq(buffer, file.name || 'voice.m4a', key)
        }
      }
    } else {
      // Plain text or urlencoded
      const rawText = await req.text().catch(() => '')
      const rawCid = req.headers.get('x-chat-id') || searchParams.get('chatId')
      if (rawCid) chatId = Number(rawCid)
      inputText = rawText || searchParams.get('text') || searchParams.get('q') || ''
    }

    inputText = cleanShortcutsInput(inputText)
    const format = searchParams.get('format') || bodyObj.format

    if (!chatId || isNaN(chatId)) {
      return NextResponse.json({
        error: 'chatId is required. Find your Chat ID via /start in @Zerph_bot',
        example: 'POST /api/shortcuts with {"chatId": 123456789, "text": "Купить молоко в 19:00"}'
      }, { status: 400 })
    }

    // Required per-user key verification (HMAC-derived, timing-safe).
    const providedKey = searchParams.get('key') || bodyObj.key
    if (!providedKey) {
      return NextResponse.json({
        error: 'Security key required. Send /siri to @Zerph_bot to get your personal URL with the key.',
        spokenResponse: 'Нужен ключ безопасности. Отправьте команду siri боту, чтобы получить новую ссылку.',
      }, { status: 403, headers: NO_CACHE_HEADERS })
    }
    {
      const expectedKey = getSiriUserKey(chatId)
      if (!secretsMatch(String(providedKey), expectedKey)) {
        return NextResponse.json({ error: 'Invalid security key for this chatId' }, { status: 403, headers: NO_CACHE_HEADERS })
      }
    }

    if (!inputText || !inputText.trim()) {
      return NextResponse.json({
        error: 'No text or audio provided',
        spokenResponse: 'Текст задачи не был получен. Попробуйте еще раз.'
      }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    const isMutationOrComplex = /(удали|стереть|сотри|очисти|вычеркни|отмени|измени|поменяй|перенеси|расписание|график)/i.test(inputText)

    // Parallelize prerequisite DB queries in 1 lightweight batch
    const [limits, friends] = await Promise.all([
      getUserUsageAndLimits(chatId),
      getFriends(chatId),
    ])

    registerChatId(chatId).catch(() => {})

    // Limits check: Siri requests quota + voice seconds quota
    if (!limits.canUseSiri) {
      const limitMsg = `❌ Лимит Siri-запросов исчерпан (${limits.siri.max} запросов за всё время на бесплатном тарифе). Оформите Zerf Plus или Pro в боте — там Siri без ограничений!`
      if (format === 'json') {
        return NextResponse.json({ error: limitMsg, spokenResponse: limitMsg, text: limitMsg }, { status: 403, headers: NO_CACHE_HEADERS })
      }
      return new NextResponse(limitMsg, { headers: NO_CACHE_HEADERS, status: 200 })
    }
    if (!limits.canSendVoice) {
      const limitMsg = `❌ Дневной лимит голосового распознавания исчерпан (${Math.round(limits.voice.maxSeconds / 60)} мин в день). Оформите Zerf Pro — там голосовой ввод безлимитный!`
      if (format === 'json') {
        return NextResponse.json({ error: limitMsg, spokenResponse: limitMsg, text: limitMsg }, { status: 403, headers: NO_CACHE_HEADERS })
      }
      return new NextResponse(limitMsg, { headers: NO_CACHE_HEADERS, status: 200 })
    }

    // 1. Check if user asked Siri "What's on today?"
    if (isTodayQuery(inputText)) {
      const spokenResponse = await handleTodaySpeech(chatId)
      return NextResponse.json({
        success: true,
        type: 'query',
        rawInput: inputText,
        spokenResponse,
        result: spokenResponse,
        text: spokenResponse,
      }, { headers: NO_CACHE_HEADERS })
    }

    // 2. Select ultra-fast optimized neural parser according to user plan and settings
    const siriModel = getModelForUserPlan(limits.plan, undefined, 'siri')
    const friendsContext = friends.length > 0 ? friends.map((f: any) => `Имя: ${f.name} (@${f.username || 'no_username'})`).join('\n') : undefined

    let items: any[]
    if (isMutationOrComplex) {
      const context = await getExistingItemsContext(chatId)
      items = await parseIntentWithGroq(inputText, key, siriModel, context, friendsContext)
    } else {
      items = await parseSiriFastIntent(inputText, key, siriModel, friendsContext)
      if (!items || items.length === 0) {
        items = await parseIntentWithGroq(inputText, key, siriModel, undefined, friendsContext)
      }
    }

    if (!items || items.length === 0) {
      const failText = 'Не удалось распознать задачу. Попробуйте сказать иначе.'
      return NextResponse.json({
        success: false,
        spokenResponse: failText,
        result: failText,
        text: failText,
      }, { headers: NO_CACHE_HEADERS })
    }

    const { spokenText, tgMsg: delegationTgMsg } = await processShortcutsItems(items, chatId, inputText, friends)

    // Execute tracking and messaging in background without delaying Siri response
    ;(async () => {
      const estimatedSec = Math.max(5, Math.round(inputText.length / 15))
      await Promise.allSettled([
        incrementLifetimeCount(COUNTERS.siri, chatId),
        incrementUserUsage(chatId, 'voice', estimatedSec),
        (async () => {
          let tgMsg = delegationTgMsg
          if (!tgMsg) {
            if (items[0]?.type === 'answer' || items[0]?.action === 'reply') {
              tgMsg = `💡 *Ответ ИИ-ассистента:*\n\n${items[0].summary || items[0].title}`
            } else {
              tgMsg = `✦ *Голосовой ввод через Siri / Быстрые команды*\n\n`
              items.forEach((item, idx) => {
                if (item.action === 'delete') {
                  tgMsg += `${idx + 1}. ▪ *Удалено:* ${item.targetTitle || item.title}\n`
                } else if (item.action === 'delete_all') {
                  tgMsg += `▪ *Все задачи очищены*\n`
                } else if (item.action === 'completion' || item.type === 'completion') {
                  tgMsg += `${idx + 1}. ▪ *Выполнено:* ${item.targetTitle || item.title}\n`
                } else {
                  const due = item.dueTime ? ` _(до ${item.dueTime})_` : ''
                  tgMsg += `${idx + 1}. ▪ *${item.title}*${due}\n`
                }
              })
            }
          }
          const userRec = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) }, select: { authProvider: true } }).catch(() => null)
          if (userRec?.authProvider === 'vk') {
            const { sendVkMessage } = await import('@/lib/backend/vk')
            await sendVkMessage(String(chatId), tgMsg.replace(/[*_`]/g, ''))
          } else {
            await sendTgNotification(chatId, tgMsg)
          }
        })(),
      ])
    })().catch(() => {})

    if (format === 'json' || req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({
        success: true,
        rawInput: inputText,
        itemsCount: items.length,
        spokenResponse: spokenText,
        result: spokenText,
        text: spokenText,
        items: items.map(i => ({ title: i.title, dueTime: i.dueTime, priority: i.priority }))
      }, { headers: NO_CACHE_HEADERS })
    }

    return new NextResponse(spokenText, {
      headers: NO_CACHE_HEADERS,
    })
  } catch (err: unknown) {
    console.error('Shortcuts API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawCid = searchParams.get('chatId') || searchParams.get('chat_id')
  let text = searchParams.get('text') || searchParams.get('q') || searchParams.get('query') || ''
  if (!text) {
    const rawQuery = req.url.split('?')[1] || ''
    const match = rawQuery.match(/(?:text|q|query)=([^&]+)/i)
    if (match) {
      try {
        text = decodeURIComponent(match[1])
      } catch {
        text = match[1]
      }
    }
  }
  text = cleanShortcutsInput(text)
  const format = searchParams.get('format')
  const providedKey = searchParams.get('key')

  if (!rawCid) {
    return NextResponse.json({
      status: 'active',
      name: 'Zerf AI Siri & Shortcuts Gateway',
      usage: 'GET /api/shortcuts?chatId=123456789&text=Напомни+позвонить+маме+в+19:00',
      iosShortcutGuide: 'Apple Shortcuts: Use "Get Contents of URL" with POST or GET to this endpoint.'
    }, { headers: NO_CACHE_HEADERS })
  }

  if (!text || !text.trim()) {
    const hintMsg = 'Текст задачи не был получен. Проверьте, что в Командах Apple в самый конец ссылки после text= добавлена переменная [Кодированный в URL текст].'
    if (format === 'json') {
      return NextResponse.json({
        error: 'No text provided',
        spokenResponse: hintMsg,
        result: hintMsg,
        text: hintMsg,
      }, { status: 400, headers: NO_CACHE_HEADERS })
    }
    return new NextResponse(hintMsg, {
      status: 200,
      headers: NO_CACHE_HEADERS,
    })
  }

  const chatId = Number(rawCid)
  if (isNaN(chatId)) {
    return NextResponse.json({ error: 'Invalid chatId' }, { status: 400, headers: NO_CACHE_HEADERS })
  }

  // Required per-user key verification (timing-safe)
  if (!providedKey) {
    return NextResponse.json({
      error: 'Security key required. Send /siri to @Zerph_bot to get your personal URL with the key.',
      spokenResponse: 'Нужен ключ безопасности. Отправьте команду siri боту, чтобы получить новую ссылку.',
    }, { status: 403, headers: NO_CACHE_HEADERS })
  }
  {
    const expectedKey = getSiriUserKey(chatId)
    if (!secretsMatch(String(providedKey), expectedKey)) {
      return NextResponse.json({ error: 'Invalid security key for this chatId' }, { status: 403, headers: NO_CACHE_HEADERS })
    }
  }

  const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''

  const isMutationOrComplex = /(удали|стереть|сотри|очисти|вычеркни|отмени|измени|поменяй|перенеси|расписание|график)/i.test(text)

  // Parallelize prerequisite DB queries in 1 lightweight batch
  const [limits, friends] = await Promise.all([
    getUserUsageAndLimits(chatId),
    getFriends(chatId),
  ])

  registerChatId(chatId).catch(() => {})

  // Limits check
  if (!limits.canUseSiri) {
    const limitMsg = `❌ Лимит Siri-запросов исчерпан (${limits.siri.max} запросов за всё время на бесплатном тарифе). Оформите Zerf Plus или Pro в боте — там Siri без ограничений!`
    if (format === 'json') {
      return NextResponse.json({ error: limitMsg, spokenResponse: limitMsg, text: limitMsg }, { status: 403, headers: NO_CACHE_HEADERS })
    }
    return new NextResponse(limitMsg, { headers: NO_CACHE_HEADERS, status: 200 })
  }
  if (!limits.canSendVoice) {
    const limitMsg = `❌ Дневной лимит голосового распознавания исчерпан (${Math.round(limits.voice.maxSeconds / 60)} мин в день). Оформите Zerf Pro — там голосовой ввод безлимитный!`
    if (format === 'json') {
      return NextResponse.json({ error: limitMsg, spokenResponse: limitMsg, text: limitMsg }, { status: 403, headers: NO_CACHE_HEADERS })
    }
    return new NextResponse(limitMsg, { headers: NO_CACHE_HEADERS, status: 200 })
  }

  // Check today query
  if (isTodayQuery(text)) {
    const spokenResponse = await handleTodaySpeech(chatId)
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        spokenResponse,
        result: spokenResponse,
        text: spokenResponse,
      }, { headers: NO_CACHE_HEADERS })
    }
    return new NextResponse(spokenResponse, { headers: NO_CACHE_HEADERS })
  }

  const siriModel = getModelForUserPlan(limits.plan, undefined, 'siri')
  const friendsContext = friends.length > 0 ? friends.map((f: any) => `Имя: ${f.name} (@${f.username || 'no_username'})`).join('\n') : undefined

  let items: any[]
  if (isMutationOrComplex) {
    const context = await getExistingItemsContext(chatId)
    items = await parseIntentWithGroq(text, key, siriModel, context, friendsContext)
  } else {
    items = await parseSiriFastIntent(text, key, siriModel, friendsContext)
    if (!items || items.length === 0) {
      items = await parseIntentWithGroq(text, key, siriModel, undefined, friendsContext)
    }
  }

  const { spokenText, tgMsg: delegationTgMsg } = await processShortcutsItems(items, chatId, text, friends)

  // Execute tracking and messaging in background without delaying Siri response
  ;(async () => {
    const estimatedSec = Math.max(5, Math.round(text.length / 15))
    await Promise.allSettled([
      incrementLifetimeCount(COUNTERS.siri, chatId),
      incrementUserUsage(chatId, 'voice', estimatedSec),
      (async () => {
        let tgMsg = delegationTgMsg
        if (!tgMsg) {
          if (items[0]?.type === 'answer' || items[0]?.action === 'reply') {
            tgMsg = `💡 *Ответ ИИ-ассистента:*\n\n${items[0].summary || items[0].title}`
          } else {
            tgMsg = `✦ *Голосовой ввод через Siri / Быстрые команды*\n\n`
            items.forEach((item, idx) => {
              if (item.action === 'delete') {
                tgMsg += `${idx + 1}. ▪ *Удалено:* ${item.targetTitle || item.title}\n`
              } else if (item.action === 'delete_all') {
                tgMsg += `▪ *Все задачи очищены*\n`
              } else if (item.action === 'completion' || item.type === 'completion') {
                tgMsg += `${idx + 1}. ▪ *Выполнено:* ${item.targetTitle || item.title}\n`
              } else {
                const due = item.dueTime ? ` _(до ${item.dueTime})_` : ''
                tgMsg += `${idx + 1}. ▪ *${item.title}*${due}\n`
              }
            })
          }
        }
        const userRec = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) }, select: { authProvider: true } }).catch(() => null)
        if (userRec?.authProvider === 'vk') {
          const { sendVkMessage } = await import('@/lib/backend/vk')
          await sendVkMessage(String(chatId), tgMsg.replace(/[*_`]/g, ''))
        } else {
          await sendTgNotification(chatId, tgMsg)
        }
      })(),
    ])
  })().catch(() => {})

  if (format === 'json') {
    return NextResponse.json({
      success: true,
      spokenResponse: spokenText,
      result: spokenText,
      text: spokenText,
      items
    }, { headers: NO_CACHE_HEADERS })
  }

  // Default for Apple Shortcuts is plain text — speak directly without dictionary parsing!
  return new NextResponse(spokenText, {
    headers: NO_CACHE_HEADERS,
  })
}
