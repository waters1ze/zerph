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
  registerChatId, getExistingItemsContext,
} from '@/lib/backend/db'
import { runReminderCheck } from '@/lib/backend/cron-runner'
import { prisma } from '@/lib/backend/prisma'
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

function miniAppKeyboard(chatId?: number) {
  const query = chatId ? `?chatId=${chatId}` : ''
  return {
    inline_keyboard: [
      [{ text: '📱 Open Zerf App', web_app: { url: `${MINIAPP_URL}${query}` } }],
      [{ text: '🌐 Open Full Web Site', url: `${APP_URL}${query}` }],
    ],
  }
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleStart(chatId: number, firstName: string) {
  await registerChatId(chatId, firstName)
  await send(chatId,
    `🎉 *Профиль успешно привязан!*\n\n` +
    `Привет, *${escMd(firstName)}*! Теперь твой Telegram-аккаунт на 100% синхронизирован с Zerf AI.\n\n` +
    `✨ *Твои возможности:*\n` +
    `1️⃣ *Голосовой ввод* 🎙️ — надиктуй задачу, цель или заметку сюда в чат.\n` +
    `2️⃣ *Умное редактирование* ✏️ — "измени время цели на 12:00".\n` +
    `3️⃣ *Авто-уведомления* ⏰ — настрой интервалы через /settings.\n` +
    `4️⃣ *Единый профиль* 🌐 — данные видны и в боте, и на веб-сайте!\n\n` +
    `Жми кнопки ниже, чтобы открыть Mini App или перейти на полный сайт:`,
    { reply_markup: miniAppKeyboard(chatId) }
  )
}

async function handleToday(chatId: number) {
  const tasks = await getAllTasks(chatId)
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const dayName = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  const pending = tasks.filter((t: { status: string; dueDate?: string | null }) =>
    t.status !== 'done' && (t.dueDate === today || !t.dueDate)
  )
  const doneTasks = tasks.filter((t: { status: string }) => t.status === 'done')

  let msg = `📅 *${escMd(dayName)}*\n\n`
  if (pending.length === 0 && doneTasks.length === 0) {
    msg += '✅ Всё выполнено! Отличный день 🎉'
  } else {
    if (pending.length > 0) {
      msg += `*${pending.length} задач осталось:*\n`
      pending.slice(0, 12).forEach((t: { priority: string; title: string; dueTime?: string | null }) => {
        const time = t.dueTime ? ` _(${t.dueTime})_` : ''
        msg += `${P_EMOJI[t.priority] || '⚪'} ${escMd(t.title)}${time}\n`
      })
      if (pending.length > 12) msg += `_...и ещё ${pending.length - 12}_\n`
    }

    if (doneTasks.length > 0) {
      msg += `\n✔️ *Завершено сегодня (${doneTasks.length}):*\n`
      doneTasks.slice(0, 8).forEach((t: { title: string }) => {
        msg += `  ~${escMd(t.title)}~\n`
      })
    }
  }

  await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })
}

async function handleGoals(chatId: number) {
  const goals = await getAllGoals(chatId)
  let msg = `🎯 *Твои цели*\n\n`
  if (goals.length === 0) {
    msg += 'Нет целей. Отправь голосовое — создам!'
  } else {
    goals.slice(0, 8).forEach((g: { status: string; title: string; progress: number; deadline?: string | null }) => {
      const dl = g.deadline ? ` · _${g.deadline}_` : ''
      msg += `${G_STATUS[g.status] || '📌'} *${escMd(g.title)}* — ${g.progress}%${dl}\n`
    })
  }
  await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })
}

async function handleNotes(chatId: number) {
  const notes = await getAllNotes(chatId)
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

async function handleSettings(chatId: number) {
  let interval = 5
  let repeat = 3
  try {
    const userChat = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
    if (userChat) {
      interval = userChat.reminderIntervalMinutes
      repeat = userChat.reminderRepeatCount
    }
  } catch {}

  await send(chatId,
    `⚙️ *Настройки напоминаний*\n\n` +
    `⏱️ *Интервал между напоминаниями:* ${interval} мин\n` +
    `🔁 *Количество повторов:* ${repeat} раза\n\n` +
    `_Выберите параметр для изменения:_`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `⏱️ Интервал: ${interval} м`, callback_data: 'cfg_interval_menu' },
            { text: `🔁 Повторы: ${repeat}x`, callback_data: 'cfg_repeat_menu' },
          ],
          [{ text: '📱 Открыть сайт / App', web_app: { url: `${MINIAPP_URL}?chatId=${chatId}` } }],
        ],
      },
    }
  )
}

async function handleLanguage(chatId: number) {
  await send(chatId,
    `🌐 *Выбор языка / Language Selection*\n\n` +
    `Твой язык по умолчанию установлен на *Русский (RU)* 🇷🇺.\n\n` +
    `Все голосовые сообщения, задачи и уведомления от Zerf AI приходят на выбранном языке.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🇷🇺 Русский (Выбран)', callback_data: 'lang_ru' }],
          [{ text: '🇬🇧 English', callback_data: 'lang_en' }],
        ],
      },
    }
  )
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
    const context = await getExistingItemsContext(chatId)
    const item = await parseIntentWithGroq(text, key, undefined, context)
    const { completedTask, updatedItem } = await saveParsedItemToDb(item, chatId)

    if (item.action === 'delete' || item.type === 'completion') {
      if (completedTask) {
        await send(chatId,
          `✅ *Задача выполнена!*\n\n~~${escMd(completedTask.title)}~~\n\n_Синхронизировано с Zerf_`,
          { reply_markup: miniAppKeyboard(chatId) }
        )
      } else if (updatedItem) {
        await send(chatId,
          `🗑️ *Элемент удален из твоего Zerf!*`,
          { reply_markup: miniAppKeyboard(chatId) }
        )
      } else {
        await send(chatId,
          `🔍 Задача *«${escMd(item.targetTitle || item.title)}»* не найдена.\n\nПроверь список /today`,
          { reply_markup: miniAppKeyboard(chatId) }
        )
      }
      return
    }

    // Check past time validation
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
    const currentTimeStr = `${getPart('hour')}:${getPart('minute')}`

    if (item.dueTime && (item.dueDate === todayStr || !item.dueDate) && item.dueTime < currentTimeStr) {
      await send(chatId,
        `⚠️ *Время «${item.dueTime}» уже прошло на сегодня!*\n\n` +
        `Текущее время в MSK: *${currentTimeStr}*\n` +
        `Пожалуйста, укажи время в будущем (например, «в ${currentTimeStr}» или позже).`,
        { reply_markup: miniAppKeyboard(chatId) }
      )
      return
    }

    const typeLabel = TYPE_RU[item.type] || item.type
    const actionWord = updatedItem || item.action === 'update' ? 'изменена ✨' : 'создана ✨'
    let msg = `${typeLabel} ${actionWord}\n\n*${escMd(item.title)}*\n`
    if (item.priority) msg += `\n${P_EMOJI[item.priority] || '⚪'} ${item.priority}`
    if (item.dueDate) msg += `\n📅 ${item.dueDate}`
    if (item.dueTime) msg += `\n⏰ *${item.dueTime}* — пришлю напоминание!`
    msg += `\n\n_Сохранено в Zerf_`

    await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })
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

    // Parse & save with context
    const context = await getExistingItemsContext(chatId)
    const item = await parseIntentWithGroq(transcript, key, undefined, context)
    const { completedTask, updatedItem } = await saveParsedItemToDb(item, chatId)

    if (item.type === 'completion') {
      if (completedTask) {
        await send(chatId,
          `✅ *Выполнено!*\n\n~~${escMd(completedTask.title)}~~\n\n_«${escMd(transcript.slice(0, 60))}»_`,
          { reply_markup: miniAppKeyboard(chatId) }
        )
      } else {
        await send(chatId,
          `🔍 Задача не найдена: *«${escMd(item.targetTitle || item.title)}»*\n\n_«${escMd(transcript.slice(0, 60))}»_`,
          { reply_markup: miniAppKeyboard(chatId) }
        )
      }
      return
    }

    const typeLabel = TYPE_RU[item.type] || item.type
    const actionWord = updatedItem || item.action === 'update' ? 'изменена ✨' : 'создана ✨'
    let msg = `${typeLabel} ${actionWord}\n\n*${escMd(item.title)}*\n`
    if (item.priority) msg += `\n${P_EMOJI[item.priority] || '⚪'} ${item.priority}`
    if (item.dueDate) msg += `\n📅 ${item.dueDate}`
    if (item.dueTime) msg += `\n⏰ *${item.dueTime}* — напомню!`
    if (item.type === 'note') msg += `\n📝 _Оригинал сохранён_`
    msg += `\n\n_«${escMd(transcript.slice(0, 60))}${transcript.length > 60 ? '…' : ''}»_`

    await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })
  } catch (err: unknown) {
    await send(chatId, `❌ Ошибка: ${String(err).slice(0, 200)}`)
  }
}

// ── Main webhook handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()

    // Handle Callback Queries (inline buttons)
    if (update.callback_query) {
      const cb = update.callback_query
      const chatId = cb.message.chat.id
      const data = cb.data as string

      if (data === 'cfg_interval_menu') {
        await send(chatId, `⏱️ *Выберите интервал между напоминаниями:*`, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '1 мин', callback_data: 'set_int_1' },
                { text: '3 мин', callback_data: 'set_int_3' },
                { text: '5 мин', callback_data: 'set_int_5' },
              ],
              [
                { text: '10 мин', callback_data: 'set_int_10' },
                { text: '15 мин', callback_data: 'set_int_15' },
                { text: '30 мин', callback_data: 'set_int_30' },
              ],
            ],
          },
        })
      } else if (data.startsWith('set_int_')) {
        const val = parseInt(data.replace('set_int_', ''), 10)
        await prisma.telegramChat.upsert({
          where: { chatId: BigInt(chatId) },
          update: { reminderIntervalMinutes: val },
          create: { chatId: BigInt(chatId), reminderIntervalMinutes: val },
        })
        await send(chatId, `✅ *Интервал обновлен:* ${val} минут!`, { reply_markup: miniAppKeyboard(chatId) })
      } else if (data === 'cfg_repeat_menu') {
        await send(chatId, `🔁 *Выберите количество повторов напоминаний:*`, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '1 раз', callback_data: 'set_rep_1' },
                { text: '2 раза', callback_data: 'set_rep_2' },
                { text: '3 раза', callback_data: 'set_rep_3' },
                { text: '5 раз', callback_data: 'set_rep_5' },
              ],
            ],
          },
        })
      } else if (data.startsWith('set_rep_')) {
        const val = parseInt(data.replace('set_rep_', ''), 10)
        await prisma.telegramChat.upsert({
          where: { chatId: BigInt(chatId) },
          update: { reminderRepeatCount: val },
          create: { chatId: BigInt(chatId), reminderRepeatCount: val },
        })
        await send(chatId, `✅ *Количество повторов обновлено:* ${val} раза!`, { reply_markup: miniAppKeyboard(chatId) })
      }

      await tgApi('answerCallbackQuery', { callback_query_id: cb.id })
      return NextResponse.json({ ok: true })
    }

    const msg = update.message
    if (!msg) return NextResponse.json({ ok: true })

    const chatId: number = msg.chat.id
    const firstName: string = msg.from?.first_name || 'Friend'
    const text: string = msg.text || ''
    const voice = msg.voice || msg.audio

    // Register for reminders
    await registerChatId(chatId, firstName).catch(() => {})

    if (text.startsWith('/')) {
      const parts = text.split(' ')
      const cmd = parts[0].toLowerCase()
      const param = parts[1]?.toLowerCase()

      if (cmd === '/login' || (cmd === '/start' && param === 'login')) {
        await handleStart(chatId, firstName)
      } else if (cmd === '/start' || cmd === '/help') {
        await handleStart(chatId, firstName)
      } else if (cmd === '/settings' || cmd === '/reminders') {
        await handleSettings(chatId)
      } else if (cmd === '/language' || cmd === '/lang') {
        await handleLanguage(chatId)
      } else if (cmd === '/today') {
        await handleToday(chatId)
      } else if (cmd === '/goals') {
        await handleGoals(chatId)
      } else if (cmd === '/notes') {
        await handleNotes(chatId)
      } else {
        await send(chatId, 'Попробуй /settings, /today или /help')
      }
    } else if (voice) {
      await processVoice(chatId, voice.file_id)
    } else if (text.trim()) {
      await processText(chatId, text)
    }

    // Trigger instant check for due reminders
    runReminderCheck().catch(() => {})

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
