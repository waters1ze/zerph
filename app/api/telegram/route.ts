/**
 * POST /api/telegram — Telegram Bot Webhook Handler
 *
 * Telegram calls this endpoint for every update.
 * Set webhook via: GET /api/telegram/setup
 *
 * Handles: /start /today /goals /notes, voice messages, text AI intent
 */

import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudioWithGroq, parseIntentWithGroq } from '@/lib/backend/groq'
import {
  saveParsedItemToDb,
  getAllTasks, getAllGoals, getAllNotes,
  registerChatId,
} from '@/lib/backend/db'
import { GROQ_API_KEY } from '@/lib/config'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''
const MINIAPP_URL = `${APP_URL}/tg`

const P_EMOJI: Record<string, string> = {
  urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢',
}
const G_STATUS: Record<string, string> = {
  on_track: '✅', at_risk: '⚠️', delayed: '❌', completed: '🏆',
}

function escMd(s: string) {
  return s.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
}

async function tgApi(method: string, body: object) {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function send(chatId: number, text: string, extra?: object) {
  await tgApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...extra,
  })
}

function miniAppKeyboard() {
  return {
    inline_keyboard: [[
      { text: '📱 Open Zerf App', web_app: { url: MINIAPP_URL } },
    ]],
  }
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleStart(chatId: number, firstName: string) {
  await registerChatId(chatId, firstName)
  await send(chatId,
    `🚀 *Добро пожаловать в Zerf AI, ${escMd(firstName)}!*\n\n` +
    `Я твой персональный AI-ассистент и командный центр продуктивности.\n\n` +
    `✨ *Что я умею:*\n` +
    `1️⃣ *Голосовой ввод* 🎙️ — надиктуй задачу, цель или заметку, и я превращу её в красивый Markdown-документ.\n` +
    `2️⃣ *Умное завершение* ✔️ — скажи «Задача по дизайну выполнена», и я сам найду её и отмечу готовой.\n` +
    `3️⃣ *Уведомления и напоминания* ⏰ — напиши «Встреча в 15:30», и я пришлю напоминание в Telegram точно в срок.\n` +
    `4️⃣ *Синхронизация с сайтом* 🌐 — все данные мгновенно сохраняются в твой личный профиль.\n\n` +
    `📌 *Быстрые команды:*\n` +
    `• /today — задачи на сегодня\n` +
    `• /goals — список активных целей\n` +
    `• /notes — твои последние заметки\n\n` +
    `👇 Жми на кнопку ниже, чтобы открыть веб-приложение:`,
    { reply_markup: miniAppKeyboard() }
  )
}

async function handleToday(chatId: number) {
  const tasks = await getAllTasks()
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const dayName = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  const pending = tasks.filter((t: { status: string; dueDate?: string | null }) =>
    t.status !== 'done' && (t.dueDate === today || !t.dueDate)
  )
  const done = tasks.filter((t: { status: string }) => t.status === 'done').length

  let msg = `📅 *${escMd(dayName)}*\n\n`
  if (pending.length === 0) {
    msg += '✅ Всё выполнено! Отличный день 🎉'
  } else {
    msg += `*${pending.length} задач осталось:*\n`
    pending.slice(0, 12).forEach((t: { priority: string; title: string; dueTime?: string | null }) => {
      const time = t.dueTime ? ` _(${t.dueTime})_` : ''
      msg += `${P_EMOJI[t.priority] || '⚪'} ${escMd(t.title)}${time}\n`
    })
    if (pending.length > 12) msg += `_...и ещё ${pending.length - 12}_\n`
  }
  if (done > 0) msg += `\n✔️ *Выполнено сегодня: ${done}*`

  await send(chatId, msg, { reply_markup: miniAppKeyboard() })
}

async function handleGoals(chatId: number) {
  const goals = await getAllGoals()
  let msg = `🎯 *Твои цели*\n\n`
  if (goals.length === 0) {
    msg += 'Нет целей. Отправь голосовое — создам!'
  } else {
    goals.slice(0, 8).forEach((g: { status: string; title: string; progress: number; deadline?: string | null }) => {
      const dl = g.deadline ? ` · _${g.deadline}_` : ''
      msg += `${G_STATUS[g.status] || '📌'} *${escMd(g.title)}* — ${g.progress}%${dl}\n`
    })
  }
  await send(chatId, msg, { reply_markup: miniAppKeyboard() })
}

async function handleNotes(chatId: number) {
  const notes = await getAllNotes()
  const ICON: Record<string, string> = { note: '📌', journal: '📓', meeting: '🤝' }
  let msg = `📌 *Последние заметки*\n\n`
  if (notes.length === 0) {
    msg += 'Нет заметок.'
  } else {
    notes.slice(0, 6).forEach((n: { type: string; title: string; createdAt: Date | string }) => {
      const date = new Date(n.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
      msg += `${ICON[n.type] || '📌'} *${escMd(n.title)}* _${date}_\n`
    })
  }
  await send(chatId, msg)
}

// ── AI processing ─────────────────────────────────────────────────────────────

const TYPE_RU: Record<string, string> = {
  task: 'Задача', goal: 'Цель', note: 'Заметка',
  project: 'Проект', reminder: 'Напоминание', completion: 'Выполнено',
}

async function processText(chatId: number, text: string) {
  const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
  if (!key) {
    await send(chatId, '❌ Groq API key не настроен. Добавь GROQ\\_API\\_KEY в переменные окружения.')
    return
  }

  try {
    await tgApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    const item = await parseIntentWithGroq(text, key)
    const { completedTask } = await saveParsedItemToDb(item)

    if (item.type === 'completion') {
      if (completedTask) {
        await send(chatId,
          `✅ *Задача выполнена!*\n\n~~${escMd(completedTask.title)}~~\n\n_Синхронизировано с Zerf_`,
          { reply_markup: miniAppKeyboard() }
        )
      } else {
        await send(chatId,
          `🔍 Задача *«${escMd(item.targetTitle || item.title)}»* не найдена.\n\nПроверь список /today`,
          { reply_markup: miniAppKeyboard() }
        )
      }
      return
    }

    const typeLabel = TYPE_RU[item.type] || item.type
    let msg = `${typeLabel} создана ✨\n\n*${escMd(item.title)}*\n`
    if (item.priority) msg += `\n${P_EMOJI[item.priority] || '⚪'} ${item.priority}`
    if (item.dueDate) msg += `\n📅 ${item.dueDate}`
    if (item.dueTime) msg += `\n⏰ *${item.dueTime}* — пришлю напоминание!`
    msg += `\n\n_Сохранено в Zerf_`

    await send(chatId, msg, { reply_markup: miniAppKeyboard() })
  } catch (err: unknown) {
    await send(chatId, `❌ Ошибка: ${String(err).slice(0, 200)}`)
  }
}

async function processVoice(chatId: number, fileId: string) {
  const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
  if (!key) {
    await send(chatId, '❌ Groq API key не настроен.')
    return
  }

  try {
    await tgApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    await send(chatId, '🎙 Обрабатываю голосовое…')

    // Get file path from Telegram
    const fileRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    )
    const fileData = await fileRes.json()
    const filePath: string = fileData.result?.file_path
    if (!filePath) throw new Error('Не удалось получить файл')

    // Download audio
    const audioRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`)
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer())

    // Transcribe
    const transcript = await transcribeAudioWithGroq(audioBuffer, `voice.ogg`, key)
    if (!transcript.trim()) {
      await send(chatId, '🤔 Не удалось распознать речь. Попробуй ещё раз.')
      return
    }

    // Parse & save
    const item = await parseIntentWithGroq(transcript, key)
    const { completedTask } = await saveParsedItemToDb(item)

    if (item.type === 'completion') {
      if (completedTask) {
        await send(chatId,
          `✅ *Выполнено!*\n\n~~${escMd(completedTask.title)}~~\n\n_«${escMd(transcript.slice(0, 60))}»_`,
          { reply_markup: miniAppKeyboard() }
        )
      } else {
        await send(chatId,
          `🔍 Задача не найдена: *«${escMd(item.targetTitle || item.title)}»*\n\n_«${escMd(transcript.slice(0, 60))}»_`,
          { reply_markup: miniAppKeyboard() }
        )
      }
      return
    }

    const typeLabel = TYPE_RU[item.type] || item.type
    let msg = `${typeLabel} создана ✨\n\n*${escMd(item.title)}*\n`
    if (item.priority) msg += `\n${P_EMOJI[item.priority] || '⚪'} ${item.priority}`
    if (item.dueDate) msg += `\n📅 ${item.dueDate}`
    if (item.dueTime) msg += `\n⏰ *${item.dueTime}* — напомню!`
    if (item.type === 'note') msg += `\n📝 _Оригинал сохранён_`
    msg += `\n\n_«${escMd(transcript.slice(0, 60))}${transcript.length > 60 ? '…' : ''}»_`

    await send(chatId, msg, { reply_markup: miniAppKeyboard() })
  } catch (err: unknown) {
    await send(chatId, `❌ Ошибка: ${String(err).slice(0, 200)}`)
  }
}

// ── Main webhook handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()
    const msg = update.message
    if (!msg) return NextResponse.json({ ok: true })

    const chatId: number = msg.chat.id
    const firstName: string = msg.from?.first_name || 'Friend'
    const text: string = msg.text || ''
    const voice = msg.voice || msg.audio

    // Register for reminders
    await registerChatId(chatId, firstName).catch(() => {})

    if (text.startsWith('/')) {
      const cmd = text.split(' ')[0].toLowerCase()
      if (cmd === '/start' || cmd === '/help') await handleStart(chatId, firstName)
      else if (cmd === '/today') await handleToday(chatId)
      else if (cmd === '/goals') await handleGoals(chatId)
      else if (cmd === '/notes') await handleNotes(chatId)
      else await send(chatId, 'Попробуй /help')
    } else if (voice) {
      await processVoice(chatId, voice.file_id)
    } else if (text.trim()) {
      await processText(chatId, text)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ ok: true }) // Always return 200 to Telegram
  }
}

// ── GET /api/telegram — health check ─────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    ok: true,
    bot: 'Zerf AI Bot',
    webhook: `${APP_URL}/api/telegram`,
    hint: 'Call GET /api/setup to register webhook with Telegram',
  })
}
