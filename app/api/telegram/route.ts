/**
 * POST /api/telegram — Telegram Bot Webhook Handler
 *
 * Telegram calls this endpoint for every update.
 * Set webhook via: GET /api/telegram/setup
 *
 * Handles: /start /today /goals /notes, voice messages, text AI intent
 */

import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudioWithGroq, parseIntentWithGroq, ParsedItem } from '@/lib/backend/groq'
import {
  saveParsedItemToDb,
  getAllTasks, getAllGoals, getAllNotes,
  registerChatId, getExistingItemsContext,
  getUserUsageAndLimits, incrementUserUsage,
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
  const dayName = now.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', weekday: 'long', day: 'numeric', month: 'long' })

  // Current MSK time in minutes
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const curHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10)
  const curMin = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10)
  const nowTotalMinutes = curHour * 60 + curMin

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
        const priorityEmoji = P_EMOJI[t.priority] || '⚪'
        const timeLabel = t.dueTime ? ` _(${t.dueTime})_` : ''
        msg += `${priorityEmoji} *${escMd(t.title)}*${timeLabel}\n`

        if (t.dueTime) {
          const [hStr, mStr] = t.dueTime.split(':')
          const taskMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10)
          const diff = taskMinutes - nowTotalMinutes

          if (diff > 0) {
            msg += `   └ ⏳ _Осталось: *${diff} мин* (до ${t.dueTime})_\n`
          } else if (diff === 0) {
            msg += `   └ 🔔 _Напоминание сработает прямо сейчас!_\n`
          } else {
            msg += `   └ ⚠️ _Время прошло (${Math.abs(diff)} мин назад)_\n`
          }
        }
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

async function handleSubscribe(chatId: number) {
  const limits = await getUserUsageAndLimits(chatId)
  const receiver = process.env.YOOMONEY_RECEIVER || '4100119573095433'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'

  const params = new URLSearchParams({
    receiver,
    'quickpay-form': 'shop',
    targets: 'Подписка Zerf Premium (30 дней)',
    paymentType: 'AC',
    sum: '99',
    label: String(chatId),
    successURL: `${appUrl}/?payment=success`,
  })
  const paymentUrl = `https://yoomoney.ru/quickpay/confirm?${params.toString()}`

  if (limits.plan === 'premium') {
    const exp = limits.subscriptionExpiry
      ? new Date(limits.subscriptionExpiry).toLocaleDateString('ru-RU')
      : '?'
    await send(chatId,
      `✨ *У тебя уже активна подписка Zerf Premium!*\n\n` +
      `📅 Активна до: *${exp}*\n\n` +
      `• 🎙 Голос: до 10 минут в день\n` +
      `• 📌 Заметки: безлимитно\n` +
      `• 💬 ИИ чат: безлимитно`,
      { reply_markup: miniAppKeyboard(chatId) }
    )
    return
  }

  await send(chatId,
    `⭐ *Zerf Premium — 99 ₽/месяц*\n\n` +
    `🆓 *Сейчас у тебя бесплатный тариф:*\n` +
    `• 🎙 Голосовые: 2 в день (осталось: ${Math.max(0, 2 - (limits.voice.used || 0))})
• 📌 Заметки: 2 в день (осталось: ${Math.max(0, 2 - (limits.notes.used || 0))})
• 💬 ИИ чат: 10 в день (осталось: ${Math.max(0, 10 - (limits.chat.used || 0))})
\n✨ *С Premium:*\n` +
    `• 🎙 Голос: неограниченно (до 10 мин/день)
• 📌 Заметки: безлимитно\n` +
    `• 💬 ИИ чат: безлимитно\n\n` +
    `💳 Нажми кнопку ниже, чтобы оплатить через ЮMoney:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оплатить 99 ₽ через ЮMoney', url: paymentUrl }],
          [{ text: '📱 Открыть Zerf App', web_app: { url: `${appUrl}/tg?chatId=${chatId}` } }],
        ]
      }
    }
  )
}

async function handleAdminCommand(chatId: number, args: string[]) {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || 'zerph-admin-2024'
  const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || '6136950061').split(',').map(s => s.trim()).filter(Boolean)

  // Check if caller is admin
  if (!ADMIN_CHAT_IDS.includes(String(chatId))) {
    await send(chatId, '❌ У тебя нет прав администратора.')
    return
  }

  const [subCmd, targetChatId, daysStr] = args

  if (!subCmd) {
    await send(chatId,
      `🔧 *Admin Panel Zerf*\n\n` +
      `Доступные команды:\n` +
      `• \`/admin grant <chatId> [дни]\` — выдать Premium\n` +
      `• \`/admin revoke <chatId>\` — забрать Premium\n` +
      `• \`/admin status <chatId>\` — статус пользователя\n` +
      `• \`/admin reset <chatId>\` — сбросить дневные лимиты\n` +
      `• \`/admin list\` — список всех пользователей`
    )
    return
  }

  if (subCmd === 'grant') {
    if (!targetChatId) { await send(chatId, '⚠️ Укажи chatId: /admin grant <chatId> [дни]'); return }
    const days = parseInt(daysStr || '30', 10)
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_SECRET}` },
      body: JSON.stringify({ chatId: targetChatId, action: 'grant', days }),
    })
    const data = await res.json()
    await send(chatId, data.message || data.error || '✅ Готово')
    // Notify the target user
    try {
      await send(parseInt(targetChatId),
        `🎉 *Поздравляем! Тебе выдана подписка Zerf Premium на ${days} дней!*\n\n` +
        `✨ Теперь доступны:\n• 🎙 Голос: до 10 мин/день\n• 📌 Заметки: безлимитно\n• 💬 ИИ: безлимитно`
      )
    } catch {}
    return
  }

  if (subCmd === 'revoke') {
    if (!targetChatId) { await send(chatId, '⚠️ Укажи chatId: /admin revoke <chatId>'); return }
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_SECRET}` },
      body: JSON.stringify({ chatId: targetChatId, action: 'revoke' }),
    })
    const data = await res.json()
    await send(chatId, data.message || data.error || '✅ Готово')
    try {
      await send(parseInt(targetChatId), `ℹ️ Ваша подписка Zerf Premium была деактивирована.`)
    } catch {}
    return
  }

  if (subCmd === 'status') {
    if (!targetChatId) { await send(chatId, '⚠️ Укажи chatId: /admin status <chatId>'); return }
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/subscription?chatId=${targetChatId}&secret=${ADMIN_SECRET}`)
    const data = await res.json()
    const exp = data.subscriptionExpiry ? new Date(data.subscriptionExpiry).toLocaleDateString('ru-RU') : 'нет'
    await send(chatId,
      `👤 *Пользователь ${targetChatId}*\n\n` +
      `📋 Тариф: *${data.plan === 'premium' ? '✨ Premium' : '🆓 Free'}*\n` +
      `📅 Истекает: ${exp}\n\n` +
      `🎙 Голос сегодня: ${data.voice?.used || 0}${data.plan === 'premium' ? ` (${Math.round((data.voice?.secondsUsed || 0)/60)} мин)` : '/2'}\n` +
      `📌 Заметки сегодня: ${data.notes?.used || 0}${data.plan !== 'premium' ? '/2' : ''}\n` +
      `💬 Чат сегодня: ${data.chat?.used || 0}${data.plan !== 'premium' ? '/10' : ''}`
    )
    return
  }

  if (subCmd === 'reset') {
    if (!targetChatId) { await send(chatId, '⚠️ Укажи chatId: /admin reset <chatId>'); return }
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_SECRET}` },
      body: JSON.stringify({ chatId: targetChatId, action: 'reset_usage' }),
    })
    const data = await res.json()
    await send(chatId, data.message || data.error || '✅ Готово')
    return
  }

  if (subCmd === 'list') {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/subscription?secret=${ADMIN_SECRET}`)
    const data = await res.json()
    const users = data.users || []
    const premiums = users.filter((u: { plan: string }) => u.plan === 'premium')
    let msg = `👥 *Всего пользователей: ${users.length}*\n✨ Premium: ${premiums.length}\n\n`
    premiums.slice(0, 15).forEach((u: { chatId: string; firstName?: string; subscriptionExpiry?: string }) => {
      const exp = u.subscriptionExpiry ? new Date(u.subscriptionExpiry).toLocaleDateString('ru-RU') : '?'
      msg += `• \`${u.chatId}\` ${u.firstName || ''} — до ${exp}\n`
    })
    if (users.length > premiums.length) {
      msg += `\n🆓 Free: ${users.length - premiums.length} чел.`
    }
    await send(chatId, msg)
    return
  }

  await send(chatId, `❓ Неизвестная команда. /admin — список команд`)
}

async function processText(chatId: number, text: string) {
  const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
  if (!key) {
    await send(chatId, '❌ Groq API key не настроен. Добавь GROQ\\_API\\_KEY в переменные окружения.')
    return
  }

  // Check chat message limits
  const limits = await getUserUsageAndLimits(chatId)
  if (!limits.canSendChatMessage) {
    await send(chatId,
      `❌ *Дневной лимит AI-сообщений исчерпан!*\n\n` +
      `🆓 На бесплатном тарифе: *10 сообщений в день*.\n` +
      `Сброс лимитов произойдёт завтра в 00:00.\n\n` +
      `✨ Оформи *Zerf Premium* за 99 ₽/мес и пиши сколько угодно!`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⭐ Оформить Premium (99 ₽)', callback_data: 'cmd_subscribe' }],
          ]
        }
      }
    )
    return
  }

  try {
    await tgApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    const context = await getExistingItemsContext(chatId)
    const items = await parseIntentWithGroq(text, key, undefined, context)

    await saveAndRespondParsedItems(chatId, items)
  } catch (err: unknown) {
    await send(chatId, `❌ Ошибка: ${String(err).slice(0, 200)}`)
  }
}

async function saveAndRespondParsedItems(chatId: number, items: ParsedItem[], transcript?: string) {
  if (!items || items.length === 0) return

  let msg = items.length > 1 ? `✨ *Обработано элементов: ${items.length}*\n\n` : ''

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]

    if (item.action === 'delete_all') {
      await saveParsedItemToDb(item, chatId)
      await send(chatId, `🗑️ *Все задачи успешно удалены!*`, { reply_markup: miniAppKeyboard(chatId) })
      return
    }

    const { completedTask, updatedItem } = await saveParsedItemToDb(item, chatId)

    if (item.action === 'delete' || item.type === 'completion') {
      if (completedTask) {
        msg += `✅ *Выполнено:* ~~${escMd(completedTask.title)}~~\n\n`
      } else if (updatedItem) {
        msg += `🗑️ *Элемент удален из Zerf*\n\n`
      } else {
        msg += `🔍 Задача *«${escMd(item.targetTitle || item.title)}»* не найдена\n\n`
      }
      continue
    }

    const typeLabel = TYPE_RU[item.type] || item.type
    const actionWord = updatedItem || item.action === 'update' ? 'изменена ✨' : 'создана ✨'
    const prefix = items.length > 1 ? `${idx + 1}. ` : ''

    msg += `${prefix}${typeLabel} ${actionWord}\n*${escMd(item.title)}*\n`
    if (item.priority) msg += `${P_EMOJI[item.priority] || '⚪'} ${item.priority}\n`
    if (item.dueDate) msg += `📅 ${item.dueDate}\n`
    if (item.dueTime) msg += `⏰ *${item.dueTime}* — напомню!\n`
    msg += `\n`
  }

  if (transcript) {
    msg += `_«${escMd(transcript.slice(0, 60))}${transcript.length > 60 ? '…' : ''}»_`
  } else {
    msg += `_Сохранено в Zerf_`
  }

  await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })
}

async function processVoice(chatId: number, fileId: string) {
  const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
  if (!key) {
    await send(chatId, '❌ Groq API key не настроен.')
    return
  }

  // Check limits
  const limits = await getUserUsageAndLimits(chatId)
  if (!limits.canSendVoice) {
    await send(chatId,
      limits.plan === 'premium'
        ? `❌ *Достигнут дневной лимит записи голоса (10 минут).* Сброс наступит завтра!`
        : `❌ *Достигнут лимит голосовых сообщений (2 в день).* Оформите подписку *Zerf Premium* за 99 ₽!`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '💳 Оформить подписку (99 ₽)', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'}/tg` } }
          ]]
        }
      }
    )
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

    // Increment voice usage (~15s)
    await incrementUserUsage(chatId, 'voice', 15)

    // Parse & save with context (multi-item support)
    const context = await getExistingItemsContext(chatId)
    const items = await parseIntentWithGroq(transcript, key, undefined, context)

    await saveAndRespondParsedItems(chatId, items, transcript)
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

      if (data === 'cmd_subscribe') {
        await handleSubscribe(chatId)
      } else if (data === 'cfg_interval_menu') {
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
      } else if (cmd === '/premium' || cmd === '/subscribe' || cmd === '/buy') {
        await handleSubscribe(chatId)
      } else if (cmd === '/admin') {
        await handleAdminCommand(chatId, parts.slice(1))
      } else {
        await send(chatId, 'Попробуй /settings, /today, /buy или /help')
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
