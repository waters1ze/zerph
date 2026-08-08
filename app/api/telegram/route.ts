/**
 * POST /api/telegram — Telegram Bot Webhook Handler
 *
 * Telegram calls this endpoint for every update.
 * Set webhook via: GET /api/telegram/setup
 *
 * Handles: /start /today /goals /notes, voice messages, text AI intent
 */

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { transcribeAudioWithGroq, parseIntentWithGroq, ParsedItem } from '@/lib/backend/groq'
import {
  saveParsedItemToDb,
  getAllTasks, getAllGoals, getAllNotes,
  registerChatId, getExistingItemsContext,
  getUserUsageAndLimits, incrementUserUsage,
  autoAddFriends, checkGroupOrUserHasPremium, getFriends,
} from '@/lib/backend/db'
import { getUserAuthToken } from '@/lib/backend/auth'
import { runReminderCheck } from '@/lib/backend/cron-runner'
import { prisma } from '@/lib/backend/prisma'
import { GROQ_API_KEY } from '@/lib/config'

// Extend function timeout to 60s (active on Vercel Pro/Enterprise)
export const maxDuration = 60

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''
const MINIAPP_URL = `${APP_URL}/tg`

const P_EMOJI: Record<string, string> = {
  urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢',
}
const G_STATUS: Record<string, string> = {
  on_track: '✅', at_risk: '⚠️', delayed: '❌', completed: '🏆',
}
const PRIORITY_RU: Record<string, string> = {
  urgent: 'Срочный',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}

function escMd(s: string) {
  if (!s) return ''
  return s.replace(/[_*`\[\]]/g, '\\$&')
}

async function tgApi(method: string, body: object) {
  if (!BOT_TOKEN) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await res.json()
  } catch {
    return null
  }
}

async function send(chatId: number, text: string, extra?: object) {
  return await tgApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...extra,
  })
}

async function editMessageText(chatId: number, messageId: number, text: string, extra?: object) {
  return await tgApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    ...extra,
  })
}

/** Edit a bot message in-place; if that fails (e.g. parse error, permission), send a new plain message */
async function safeEditOrSend(
  chatId: number,
  messageId: number | undefined,
  text: string,
  extra?: object
) {
  if (messageId) {
    // Try with Markdown
    const r1 = await tgApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      ...extra,
    })
    if (r1?.ok) return r1
    // Retry without Markdown (special chars in task title may break it)
    const r2 = await tgApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...extra,
    })
    if (r2?.ok) return r2
  }
  // Fallback: send as new message (plain, no parse_mode - guaranteed delivery)
  return await tgApi('sendMessage', {
    chat_id: chatId,
    text,
    ...extra,
  })
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
  const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || '6136950061,5078516086').split(',').map(s => s.trim()).filter(Boolean)

  // Check if caller is authorized admin
  if (!ADMIN_CHAT_IDS.includes(String(chatId))) {
    await send(chatId, `⛔ *Доступ ограничен.* Раздел администрирования доступен только владельцу системы.`)
    return
  }

  const [subCmd, targetQuery] = args

  if (!subCmd) {
    await send(chatId,
      `🛡️ *Панель Администратора Zerf AI*\n\n` +
      `Команды управления:\n` +
      `• \`/admin search <имя/@username/ID>\` — быстрый поиск пользователя\n` +
      `• \`/admin grant <chatId> [дни]\` — выдать Premium\n` +
      `• \`/admin revoke <chatId>\` — забрать Premium\n` +
      `• \`/admin status <chatId>\` — подробно о пользователе\n` +
      `• \`/admin reset <chatId>\` — сбросить дневные лимиты\n` +
      `• \`/admin list\` — список всех зарегистрированных людей`
    )
    return
  }

  if (subCmd === 'search' || subCmd === 'find') {
    const q = args.slice(1).join(' ').trim()
    if (!q) { await send(chatId, '⚠️ Укажи запрос: `/admin search <имя или @username или ID>`'); return }
    
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/subscription?secret=${ADMIN_SECRET}`)
    const data = await res.json()
    const allUsers: any[] = data.users || []
    
    const matched = allUsers.filter(u => {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase()
      const uname = (u.username || '').toLowerCase()
      const cid = String(u.chatId)
      const queryLower = q.toLowerCase().replace('@', '')
      return name.includes(queryLower) || uname.includes(queryLower) || cid === queryLower
    })

    if (matched.length === 0) {
      await send(chatId, `🔍 Пользователь по запросу «${escMd(q)}» не найден.`)
      return
    }

    let msg = `🔍 *Результаты поиска (${matched.length}):*\n\n`
    matched.slice(0, 10).forEach(u => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Без имени'
      const uname = u.username ? `@${u.username}` : 'нет username'
      const isPrem = u.plan === 'premium'
      const exp = u.subscriptionExpiry ? new Date(u.subscriptionExpiry).toLocaleDateString('ru-RU') : '—'
      msg += `👤 *${escMd(name)}* (${uname})\n`
      msg += `  ID: \`${u.chatId}\`\n`
      msg += `  Тариф: ${isPrem ? '✨ Premium' : '🆓 Free'} (до ${exp})\n`
      msg += `  Быстрые команды:\n`
      msg += `  • \`/admin grant ${u.chatId} 30\`\n`
      msg += `  • \`/admin revoke ${u.chatId}\`\n\n`
    })

    await send(chatId, msg)
    return
  }

  if (subCmd === 'grant') {
    const targetChatId = targetQuery
    const daysStr = args[2]
    if (!targetChatId) { await send(chatId, '⚠️ Укажи chatId: `/admin grant <chatId> [дни]`'); return }
    const days = parseInt(daysStr || '30', 10)
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_SECRET}` },
      body: JSON.stringify({ chatId: targetChatId, action: 'grant', days }),
    })
    const data = await res.json()
    await send(chatId, data.message || data.error || '✅ Готово')
    try {
      await send(parseInt(targetChatId),
        `🎉 *Поздравляем! Тебе выдана подписка Zerf Premium на ${days} дней!*\n\n` +
        `✨ Теперь доступны:\n• 🎙 Голос: до 10 мин/день\n• 📌 Заметки: безлимитно\n• 💬 ИИ: безлимитно`
      )
    } catch {}
    return
  }

  if (subCmd === 'revoke') {
    const targetChatId = targetQuery
    if (!targetChatId) { await send(chatId, '⚠️ Укажи chatId: `/admin revoke <chatId>`'); return }
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/subscription`, {
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
    const targetChatId = targetQuery
    if (!targetChatId) { await send(chatId, '⚠️ Укажи chatId: `/admin status <chatId>`'); return }
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/subscription?chatId=${targetChatId}&secret=${ADMIN_SECRET}`)
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
    const targetChatId = targetQuery
    if (!targetChatId) { await send(chatId, '⚠️ Укажи chatId: `/admin reset <chatId>`'); return }
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_SECRET}` },
      body: JSON.stringify({ chatId: targetChatId, action: 'reset_usage' }),
    })
    const data = await res.json()
    await send(chatId, data.message || data.error || '✅ Готово')
    return
  }

  if (subCmd === 'list') {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/subscription?secret=${ADMIN_SECRET}`)
    const data = await res.json()
    const users: any[] = data.users || []
    const premiums = users.filter((u: { plan: string }) => u.plan === 'premium')
    let msg = `👥 *Всего пользователей: ${users.length}*\n✨ Premium: ${premiums.length}\n\n`
    
    users.slice(0, 15).forEach((u: any) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Без имени'
      const uname = u.username ? `@${u.username}` : ''
      const exp = u.subscriptionExpiry ? new Date(u.subscriptionExpiry).toLocaleDateString('ru-RU') : '—'
      const isPrem = u.plan === 'premium'
      msg += `• \`${u.chatId}\` *${escMd(name)}* ${uname} — ${isPrem ? `✨ до ${exp}` : '🆓 Free'}\n`
    })

    if (users.length > 15) {
      msg += `\n💡 Ищи конкретного человека: \`/admin search <имя>\``
    }

    await send(chatId, msg)
    return
  }

  await send(chatId, `❓ Неизвестная команда. Введи /admin для списка всех команд.`)
}

async function handleRefCommand(chatId: number) {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'Zerph_bot'
  const refLink = `https://t.me/${botUsername}?start=ref_${chatId}`

  const user = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
  const count = (user as any)?.referralCount || 0
  const bonusDays = count * 3

  let msg = `🎁 *Реферальная программа Zerf AI*\n\n`
  msg += `Приглашай друзей и получай *+3 дня Zerf Premium* за каждого приведённого друга! Твой друг тоже получит +3 дня Premium!\n\n`
  msg += `🔗 *Твоя реферальная ссылка:*\n\`${refLink}\`\n\n`
  msg += `📊 Приглашено друзей: *${count}*\n`
  msg += `⭐ Заработано Premium: *${bonusDays} дней*`

  await send(chatId, msg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📲 Поделиться ссылкой с другом', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Присоединяйся к Zerf AI! Получи 3 дня Premium по моей ссылке 🚀')}` }
        ]
      ]
    }
  })
}

async function handleWeeklyReport(chatId: number, senderId: number) {
  try {
    const limits = await getUserUsageAndLimits(chatId)
    const isPremium = limits.plan === 'premium'
    
    await send(chatId, 'Генерирую недельный отчет, подождите немного...')
    await tgApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/weekly-report?chatId=${chatId}`)
    const data = await res.json()
    
    if (data.error) {
      await send(chatId, '❌ Ошибка при генерации отчета.')
      return
    }
    
    const { stats, aiAnalysis } = data
    
    let msg = `📊 *Ваш еженедельный отчет:*\n\n`
    msg += `✅ Выполнено задач: *${stats.tasksCompleted}*\n`
    msg += `📝 Создано задач: *${stats.tasksCreated}*\n`
    msg += `📌 Создано заметок: *${stats.notesCreated}*\n`
    msg += `🎯 Обновлено целей: *${stats.goalsUpdated}*\n`
    msg += `🌟 Самый продуктивный день: *${stats.mostProductiveDay}*\n\n`
    
    if (isPremium) {
      msg += `🧠 *Анализ ИИ:*\n${aiAnalysis}`
    } else {
      msg += `🔒 *Анализ ИИ доступен только для Premium-пользователей.*\nОформите подписку, чтобы получать советы от AI!`
    }
    
    const replyMarkup = isPremium ? miniAppKeyboard(chatId) : {
      inline_keyboard: [
        [{ text: '⭐ Оформить Premium (99 ₽)', callback_data: 'cmd_subscribe' }],
        ...miniAppKeyboard(chatId).inline_keyboard
      ]
    }
    
    await send(chatId, msg, { reply_markup: replyMarkup })
  } catch (err) {
    await send(chatId, '❌ Ошибка при получении отчета.')
  }
}

const NAME_ALIASES: Record<string, string[]> = {
  владимир: ['вова', 'володя', 'вовчик', 'влад'],
  дмитрий: ['дима', 'димка', 'димон'],
  александр: ['саша', 'шура', 'саня', 'алекс'],
  алексей: ['лёша', 'леша', 'алёша', 'леха', 'лёха'],
  евгений: ['женя', 'жека'],
  иван: ['ваня', 'ватек'],
  сергей: ['серёжа', 'сережа', 'серый'],
  павел: ['паша', 'пашок'],
  михаил: ['миша', 'мишаня'],
  николай: ['коля', 'колян'],
  андрей: ['ндрюша', 'андрюха'],
  максим: ['макс'],
  артем: ['артём', 'тёма', 'тема'],
  валерия: ['лера'],
  анастасия: ['настя'],
  ольга: ['оля'],
  екатерина: ['катя'],
  мария: ['маша'],
  дарья: ['даша'],
  татьяна: ['таня'],
  анна: ['аня'],
  юлия: ['юля'],
}

async function findFriendByName(userChatId: number | bigint, recipientName: string) {
  const cid = BigInt(userChatId)
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userChatId: cid }, { friendChatId: cid }] }
  })
  const friendIds = friendships.map((f: any) => f.userChatId === cid ? f.friendChatId : f.userChatId)
  if (friendIds.length === 0) return { friend: null, friendship: null }

  const friendChats = await prisma.telegramChat.findMany({
    where: { chatId: { in: friendIds } }
  })

  const rawQuery = recipientName.toLowerCase().trim().replace('@', '')
  const queryTokens = rawQuery.split(/\s+/).filter(Boolean)

  let matchedFriend: any = null

  for (const f of friendChats) {
    const fn = (f.firstName || '').toLowerCase()
    const ln = (f.lastName || '').toLowerCase()
    const un = (f.username || '').toLowerCase()
    const fullName = `${fn} ${ln}`.trim()

    if (fullName.includes(rawQuery) || fn.includes(rawQuery) || ln.includes(rawQuery) || (un && un.includes(rawQuery))) {
      matchedFriend = f
      break
    }

    for (const token of queryTokens) {
      if (fn.includes(token) || ln.includes(token) || (un && un.includes(token))) {
        matchedFriend = f
        break
      }

      for (const [canonical, aliases] of Object.entries(NAME_ALIASES)) {
        if (aliases.includes(token) && (fn.includes(canonical) || fullName.includes(canonical))) {
          matchedFriend = f
          break
        }
        if (canonical === token && aliases.some(a => fn.includes(a) || fullName.includes(a))) {
          matchedFriend = f
          break
        }
      }
      if (matchedFriend) break
    }
    if (matchedFriend) break
  }

  if (!matchedFriend && friendChats.length > 0) {
    for (const f of friendChats) {
      const fn = (f.firstName || '').toLowerCase()
      const ln = (f.lastName || '').toLowerCase()
      for (const [canonical, aliases] of Object.entries(NAME_ALIASES)) {
        if (aliases.some(a => rawQuery.includes(a)) && (fn.includes(canonical) || ln.includes(canonical))) {
          matchedFriend = f
          break
        }
      }
      if (matchedFriend) break
    }
  }

  if (!matchedFriend) return { friend: null, friendship: null }

  const friendship = friendships.find((f: any) =>
    (f.userChatId === matchedFriend.chatId && f.friendChatId === cid) ||
    (f.friendChatId === matchedFriend.chatId && f.userChatId === cid)
  )

  return { friend: matchedFriend, friendship }
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
    const friends = await getFriends(chatId)
    const friendsContext = friends.map((f: any) => `Имя: ${f.name} (@${f.username || 'no_username'})`).join('\n')
    const items = await parseIntentWithGroq(text, key, undefined, context, friendsContext)

    await saveAndRespondParsedItems(chatId, items)
  } catch (err: unknown) {
    await send(chatId, `❌ Ошибка: ${String(err).slice(0, 200)}`)
  }
}

async function saveAndRespondParsedItems(chatId: number, items: ParsedItem[], transcript?: string) {
  if (!items || items.length === 0) return

  let msg = items.length > 1 ? `Обработано элементов: ${items.length}\n\n` : ''

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]

    if (item.action === 'delete_all') {
      await saveParsedItemToDb(item, chatId)
      await send(chatId, `Все задачи успешно удалены.`, { reply_markup: miniAppKeyboard(chatId) })
      return
    }

    // Fallback detection if delegation keywords are used in prompt text
    if (item.type !== 'delegate' && item.rawText) {
      const lower = item.rawText.toLowerCase()
      const match = lower.match(/(?:дай задачу|поручи|отправь задачу|передай задачу|создай задачу для|назначь)\s+([а-яА-Яa-zA-Z0-9_@\s]+?)(?:,|$|\s+чтобы|\s+на|\s+через)/i)
      if (match && match[1]) {
        item.type = 'delegate'
        item.recipientName = match[1].trim()
      }
    }

    if (item.type === 'delegate' && item.recipientName) {
      const { friend, friendship } = await findFriendByName(chatId, item.recipientName)

      if (friend) {
        const isBot = (friend.username || '').toLowerCase().includes('bot') || (friend.firstName || '').toLowerCase().includes('bot')
        const isAllowed = friendship ? (friendship as any).allowTasks !== false : true

        if (!isAllowed) {
          msg += `⚠️ ${friend.firstName || item.recipientName} отключил(а) получение поручений от вас.\n\n`
          continue
        }

        const newTask = await prisma.task.create({
          data: {
            title: item.title,
            description: item.summary || '',
            priority: item.priority || 'medium',
            status: 'todo',
            dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
            dueTime: item.dueTime || null,
            tags: item.tags || [],
            ownerChatId: friend.chatId,
            authorChatId: BigInt(chatId),
            assignees: [String(chatId)],
            isShared: true,
          } as any
        })

        const sender = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
        const senderName = sender?.firstName || 'Пользователь'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zerph.vercel.app'
        
        let notifyMsg = `🤝 *${escMd(senderName)}* поручил(а) тебе задачу!\n\n`
        notifyMsg += `📌 *Задача:* ${escMd(item.title)}\n`
        if (item.summary) {
          notifyMsg += `📝 *Описание:* ${escMd(item.summary)}\n`
        }
        if (item.dueTime) {
          notifyMsg += `⏰ *Время:* ${item.dueTime}\n`
        }
        notifyMsg += `\n_Задача добавлена в ваши «Входящие» на сайте Zerf AI_`

        await send(Number(friend.chatId), notifyMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📱 Открыть во Входящих (Zerf App)', web_app: { url: `${appUrl}/tg?chatId=${friend.chatId}` } }],
              [
                { text: '✓ Принять', callback_data: `delegate_accept_${newTask.id}` },
                { text: '✗ Отклонить', callback_data: `delegate_decline_${newTask.id}` }
              ]
            ]
          }
        })
        msg += `🤝 Задача *«${escMd(item.title)}»* успешно отправлена *${escMd(friend.firstName || item.recipientName)}*!\n\n`
      } else {
        msg += `⚠️ Команда не отправлена: друг '${escMd(item.recipientName)}' не найден в контактах. Добавь её через /invite @username\n\n`
      }
      continue
    }

    const { completedTask, updatedItem } = await saveParsedItemToDb(item, chatId)

    if (item.action === 'delete' || item.type === 'completion') {
      if (completedTask) {
        msg += `Выполнено: ${escMd(completedTask.title)}\n\n`
      } else if (updatedItem) {
        msg += `Элемент удален из Zerf\n\n`
      } else {
        msg += `Задача «${escMd(item.targetTitle || item.title)}» не найдена\n\n`
      }
      continue
    }

    const typeLabel = TYPE_RU[item.type] || item.type
    const actionWord = updatedItem || item.action === 'update' ? 'изменена' : 'создана'
    const prefix = items.length > 1 ? `${idx + 1}. ` : ''
    const pText = PRIORITY_RU[item.priority] || item.priority

    msg += `${prefix}${typeLabel} ${actionWord}: *${escMd(item.title)}*\n`
    if (item.summary && item.summary !== item.title) {
      msg += `Описание: ${escMd(item.summary)}\n`
    }
    if (item.subtasks && item.subtasks.length > 0) {
      msg += `Чек-лист:\n` + item.subtasks.map((s: string) => `  • ${escMd(s)}`).join('\n') + `\n`
    }
    if (item.priority) msg += `Приоритет: ${pText}\n`
    if (item.dueDate) msg += `Дата: ${item.dueDate}\n`
    if (item.dueTime) msg += `Время: ${item.dueTime}\n`
    msg += `\n`
  }

  if (transcript) {
    msg += `Исходный текст: ${escMd(transcript)}`
  }

  await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })

  for (const item of items) {
    if (
      item.type === 'task' &&
      item.dueTime &&
      item.dueTime !== '00:00' &&
      item.action !== 'delete' &&
      item.action !== 'completion'
    ) {
      await send(chatId, `⏰ Поставить будильник на ${item.dueTime}?`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✓ Да (Android)', callback_data: `alarm_android_${item.dueTime}` },
              { text: 'Да (iOS инструкция)', callback_data: `alarm_ios_${item.dueTime}` }
            ]
          ]
        }
      })
    }
  }
}

/** Get bot's own Telegram user ID */
let cachedBotId: number | null = null
async function getBotId(): Promise<number | null> {
  if (cachedBotId) return cachedBotId
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const idStr = process.env.TELEGRAM_BOT_TOKEN.split(':')[0]
    cachedBotId = Number(idStr)
    return cachedBotId
  }
  const res = await tgApi('getMe', {})
  if (res?.ok && res.result?.id) {
    cachedBotId = res.result.id
    return cachedBotId
  }
  return null
}

/** Track that a user was seen in a group. Upserts into GroupMembership. */
async function trackGroupMember(groupChatId: number, memberChatId: number) {
  if (!memberChatId || memberChatId <= 0) return
  const botId = await getBotId()
  if (botId && memberChatId === botId) return

  try {
    await prisma.groupMembership.upsert({
      where: {
        groupChatId_memberChatId: {
          groupChatId: BigInt(groupChatId),
          memberChatId: BigInt(memberChatId),
        },
      },
      update: {},
      create: {
        groupChatId: BigInt(groupChatId),
        memberChatId: BigInt(memberChatId),
      },
    })
  } catch {}
}

/** Get ALL known human members of a group from DB + Telegram admins. */
async function getGroupMembers(groupChatId: number): Promise<number[]> {
  const botId = await getBotId()
  const idSet = new Set<number>()

  // 1. From GroupMembership DB table
  try {
    const memberships = await prisma.groupMembership.findMany({
      where: { groupChatId: BigInt(groupChatId) },
    })
    memberships.forEach(m => {
      const num = Number(m.memberChatId)
      if (num > 0 && num !== botId) idSet.add(num)
    })
  } catch {}

  // 2. From Telegram getChatAdministrators
  try {
    const res = await tgApi('getChatAdministrators', { chat_id: groupChatId })
    if (res?.ok && Array.isArray(res.result)) {
      for (const member of res.result) {
        const u = member.user
        if (!u || u.is_bot || u.id <= 0 || u.id === botId) continue
        await registerChatId(u.id, u.first_name, u.username, u.last_name)
        await trackGroupMember(groupChatId, u.id)
        idSet.add(u.id)
      }
    }
  } catch {}

  return Array.from(idSet)
}

function miniAppKeyboard(chatId?: number) {
  if (!chatId) {
    return {
      inline_keyboard: [
        [{ text: '📱 Open Zerf App', web_app: { url: MINIAPP_URL } }],
        [{ text: '🌐 Open Full Web Site', url: APP_URL }],
      ],
    }
  }
  const token = getUserAuthToken(chatId)
  const query = `?chatId=${chatId}&token=${token}`
  return {
    inline_keyboard: [
      [{ text: '📱 Open Zerf App', web_app: { url: `${MINIAPP_URL}${query}` } }],
      [{ text: '🌐 Open Full Web Site', url: `${APP_URL}${query}` }],
    ],
  }
}

async function processVoice(chatId: number, fileId: string, duration: number = 15) {
  const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
  if (!key) {
    await send(chatId, 'Groq API key не настроен.')
    return
  }

  const limits = await getUserUsageAndLimits(chatId)
  if (!limits.canSendVoice) {
    await send(chatId,
      limits.plan === 'premium'
        ? 'Достигнут дневной лимит записи голоса (10 минут). Сброс наступит завтра!'
        : 'Достигнут лимит голосовых сообщений (2 в день). Оформите подписку Zerf Premium за 99 руб!',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: 'Оформить подписку (99 руб)', web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'}/tg` } }
          ]]
        }
      }
    )
    return
  }

  try {
    await tgApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    await send(chatId, 'Обрабатываю голосовое...')

    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
    const fileData = await fileRes.json()
    const filePath: string = fileData.result?.file_path
    if (!filePath) throw new Error('Не удалось получить файл')

    const audioRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`)
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer())

    const transcript = await transcribeAudioWithGroq(audioBuffer, `voice.ogg`, key)
    if (!transcript.trim()) {
      await send(chatId, 'Не удалось распознать речь. Попробуй ещё раз.')
      return
    }
    await incrementUserUsage(chatId, 'voice', duration)

    const context = await getExistingItemsContext(chatId)
    const items = await parseIntentWithGroq(transcript, key, undefined, context)

    await saveAndRespondParsedItems(chatId, items, transcript)
  } catch (err: unknown) {
    await send(chatId, `Ошибка: ${String(err).slice(0, 200)}`)
  }
}

// ── Group & Friend Handlers ──────────────────────────────────────────────────────────

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

async function handleGroupAddCommand(msg: any) {
  const groupChatId: number = msg.chat.id
  const senderId: number = msg.from.id
  const senderName: string = msg.from.first_name || 'Участник'
  const senderUsername: string | undefined = msg.from.username
  const botId = await getBotId()

  await registerChatId(senderId, senderName, senderUsername, msg.from.last_name)
  await trackGroupMember(groupChatId, senderId)

  const replyMsg = msg.reply_to_message
  if (!replyMsg) {
    await send(groupChatId,
      `Как использовать /add в группе:\n\nОтветьте командой /add на любое голосовое или текстовое сообщение в группе, и Zerf AI создаст задачи для всех участников!`,
      { reply_to_message_id: msg.message_id }
    )
    return
  }

  const replySenderId: number | undefined = replyMsg.from?.id
  const replySenderName: string = replyMsg.from?.first_name || 'Коллега'
  const replySenderUsername: string | undefined = replyMsg.from?.username

  if (replySenderId && !replyMsg.from?.is_bot && replySenderId > 0 && replySenderId !== botId) {
    await registerChatId(replySenderId, replySenderName, replySenderUsername, replyMsg.from?.last_name)
    await trackGroupMember(groupChatId, replySenderId)
    await autoAddFriends(senderId, replySenderId)
  }

  // Premium check
  const { hasPremium } = await checkGroupOrUserHasPremium(
    senderId, groupChatId,
    replySenderId ? [replySenderId] : []
  )

  if (!hasPremium) {
    await send(groupChatId,
      `Для работы Zerf AI в группах требуется Zerf Premium!\n\nХотя бы у одного участника должна быть подписка (99 руб/мес).\nОформить: /buy или через Mini App.`,
      {
        reply_to_message_id: msg.message_id,
        reply_markup: {
          inline_keyboard: [[
            { text: 'Оформить Zerf Premium (99 руб)', url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'}/tg` }
          ]]
        }
      }
    )
    return
  }

  const targetVoice = replyMsg.voice || replyMsg.audio
  const targetTextDirect = replyMsg.text || replyMsg.caption || ''

  if (targetVoice) {
    const limits = await getUserUsageAndLimits(senderId)
    if (!limits.canSendVoice) {
      await send(senderId,
        limits.plan === 'premium'
          ? '❌ Ошибка в группе: Достигнут дневной лимит записи голоса (10 минут). Сброс наступит завтра!'
          : '❌ Ошибка в группе: Достигнут лимит голосовых сообщений (2 в день). Оформите подписку Zerf Premium за 99 руб!'
      ).catch(() => {})
      return
    }
  }

  // Send status message — user sees this immediately
  const statusRes = await send(
    groupChatId,
    '✅ Групповая задача успешно создана!',
    { reply_to_message_id: msg.message_id, reply_markup: miniAppKeyboard(senderId) }
  )
  const statusMsgId: number | undefined = statusRes?.result?.message_id

  // ── Phase 2: Processing ─────────────────────────────
  try {
      const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
      if (!key) {
        // Silently fail if no key, no need to edit message since we promised success.
        // The task just won't appear, or we could send a DM. 
        await send(senderId, 'Groq API key не настроен.').catch(() => {})
        return
      }

      // 1. Collect human members only (filtering botId and negative IDs)
      const groupMembers = await getGroupMembers(groupChatId)
      const assigneeSet = new Set<string>()
      if (senderId > 0 && senderId !== botId) assigneeSet.add(String(senderId))
      if (replySenderId && replySenderId > 0 && replySenderId !== botId && !replyMsg.from?.is_bot) {
        assigneeSet.add(String(replySenderId))
      }
      groupMembers.forEach(m => {
        if (m > 0 && m !== botId) assigneeSet.add(String(m))
      })
      const allAssignees = Array.from(assigneeSet)

      // 2. Auto-friend all members
      for (const mId of allAssignees) {
        const numId = Number(mId)
        if (numId !== senderId) autoAddFriends(senderId, numId).catch(() => {})
        if (replySenderId && numId !== replySenderId) autoAddFriends(replySenderId, numId).catch(() => {})
      }

      // 3. Transcribe audio if needed
      let targetText = targetTextDirect
      if (targetVoice) {
        try {
          const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${targetVoice.file_id}`)
          const fileData = await fileRes.json()
          const filePath = fileData.result?.file_path
          if (filePath) {
            const audioRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`)
            const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
            targetText = await transcribeAudioWithGroq(audioBuffer, 'group_voice.ogg', key)
            const duration = targetVoice.duration || 15
            await incrementUserUsage(senderId, 'voice', duration)
          }
        } catch (err) {
          await send(senderId, `❌ Ошибка в группе: Ошибка при расшифровке голосового: ${String(err).slice(0, 100)}`).catch(() => {})
          return
        }
      }

      if (!targetText.trim()) {
        await send(senderId, '❌ Ошибка в группе: В выбранном сообщении нет текста или речи для создания задачи.').catch(() => {})
        return
      }

      // 4. AI parsing
      const context = await getExistingItemsContext(senderId)
      let items = await parseIntentWithGroq(targetText, key, undefined, context)

      if (!items || items.length === 0) {
        items = [{
          type: 'task',
          action: 'create',
          title: targetText.trim().slice(0, 100),
          summary: targetText.trim(),
          priority: 'medium',
          dueDate: new Date().toISOString().slice(0, 10),
          tags: ['группа'],
          rawText: targetText,
        }]
      } else {
        // Enforce exactly ONE item in groups to prevent duplication
        items = [items[0]]
      }

      // 5. Save task ONCE for creator (senderId) with all assignees — NO DUPLICATES!
      for (const item of items) {
        item.isShared = true
        item.assignees = allAssignees
        item.type = 'task' // Force task type in group processing (never note!)
        try { await saveParsedItemToDb(item, senderId) } catch {}
      }

      // Success: No need to edit the status message since we already sent 'Успешно добавлено!'
    } catch (err: any) {
      console.error('Error in group add processing:', err)
      await send(senderId, `❌ Ошибка при обработке вашей задачи в группе: ${String(err?.message || err).slice(0, 150)}`).catch(() => {})
    }
}

async function handleInviteCommand(chatId: number, senderName: string, param?: string) {
  if (!param) {
    await send(chatId,
      `🤝 *Приглашение друзей в Zerf AI*\n\n` +
      `Чтобы добавить друга по юзернейму, введите:\n` +
      `\`/invite @username\`\n\n` +
      `Или отправьте другу ссылку:\n` +
      `https://t.me/Zerph_bot?start=invite_${chatId}`,
      { reply_markup: miniAppKeyboard(chatId) }
    )
    return
  }

  const cleanUsername = param.replace('@', '').trim()
  const targetUser = await prisma.telegramChat.findFirst({
    where: { username: { equals: cleanUsername, mode: 'insensitive' } }
  })

  if (!targetUser) {
    await send(chatId, `🔍 Пользователь *@${cleanUsername}* не найден в Zerf. Попроси его сначала запустить бота через /start!`)
    return
  }

  const friendId = Number(targetUser.chatId)
  await prisma.friendship.upsert({
    where: { userChatId_friendChatId: { userChatId: BigInt(chatId), friendChatId: BigInt(friendId) } },
    update: { status: 'pending' },
    create: { userChatId: BigInt(chatId), friendChatId: BigInt(friendId), status: 'pending' }
  })

  await send(friendId,
    `🤝 *Новое приглашение в друзья в Zerf AI!*\n\n` +
    `Пользователь *${escMd(senderName)}* хочет добавить вас в друзья!`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Принять', callback_data: `friend_accept_${chatId}` },
            { text: '❌ Отклонить', callback_data: `friend_decline_${chatId}` }
          ]
        ]
      }
    }
  )

  await send(chatId, `✉️ Приглашение отправлено пользователю *@${cleanUsername}*! Ждём подтверждения.`)
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
      } else if (data.startsWith('friend_accept_')) {
        const inviterId = BigInt(data.replace('friend_accept_', ''))
        await autoAddFriends(Number(inviterId), chatId)
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: '✅ Успешно принято!' })
        await safeEditOrSend(chatId, cb.message.message_id, `✅ *Приглашение успешно принято!* Теперь вы друзья и в одной команде Zerf AI.`)
        await send(Number(inviterId), `🎉 *Пользователь принял ваше приглашение!* Теперь вы друзья в Zerf AI.`)
      } else if (data.startsWith('friend_decline_')) {
        const inviterId = BigInt(data.replace('friend_decline_', ''))
        await prisma.friendship.deleteMany({
          where: { userChatId: inviterId, friendChatId: BigInt(chatId) }
        })
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Отклонено' })
        await safeEditOrSend(chatId, cb.message.message_id, `❌ *Приглашение отклонено.*`)
      } else if (data.startsWith('delegate_accept_')) {
        const taskId = data.replace('delegate_accept_', '')
        const task = await prisma.task.update({ where: { id: taskId }, data: { status: 'inprogress' } })
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: '✅ Успешно!' })
        await safeEditOrSend(chatId, cb.message.message_id, `✅ *Успешно! Задача принята:* ${task.title}`)
        const authorId = task.authorChatId ? Number(task.authorChatId) : task.assignees.length > 0 ? Number(task.assignees[0]) : null
        if (authorId) {
          await send(authorId, `✅ *${cb.from.first_name || 'Пользователь'}* принял(а) порученную задачу *«${task.title}»*!`)
        }
      } else if (data.startsWith('delegate_decline_')) {
        const taskId = data.replace('delegate_decline_', '')
        const task = await prisma.task.findUnique({ where: { id: taskId } })
        if (task) {
          await prisma.task.delete({ where: { id: taskId } })
          await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Отклонено' })
          await safeEditOrSend(chatId, cb.message.message_id, `❌ *Вы отклонили задачу:* ${task.title}`)
          const authorId = task.authorChatId ? Number(task.authorChatId) : task.assignees.length > 0 ? Number(task.assignees[0]) : null
          if (authorId) {
            await send(authorId, `❌ *${cb.from.first_name || 'Пользователь'}* отклонил(а) порученную задачу *«${task.title}»*`)
          }
        }
      } else if (data.startsWith('alarm_android_')) {
        const time = data.replace('alarm_android_', '')
        const [h, m] = time.split(':')
        await send(chatId, '⏰ Открыть настройки будильника', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '⏰ Открыть настройки будильника', url: `intent:#Intent;action=android.intent.action.SET_ALARM;extra.android.intent.extra.alarm.HOUR=${h};extra.android.intent.extra.alarm.MINUTES=${m};extra.android.intent.extra.alarm.SKIP_UI=false;end` }]
            ]
          }
        })
      } else if (data.startsWith('alarm_ios_')) {
        const time = data.replace('alarm_ios_', '')
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zerph.vercel.app'
        const icsUrl = `${appUrl}/api/alarm/ics?time=${encodeURIComponent(time)}`
        await send(chatId, `📱 *1-Tap Будильник для iPhone (iOS):*\n\nНажми на кнопку ниже, чтобы мгновенно добавить напоминание с звуковым сигналом в Календарь iPhone на *${time}*!`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: `⏰ Добавить сигнал на iPhone (${time})`, url: icsUrl }]
            ]
          }
        })
      }

      await tgApi('answerCallbackQuery', { callback_query_id: cb.id })
      return NextResponse.json({ ok: true })
    }

    const msg = update.message
    if (!msg) return NextResponse.json({ ok: true })

    const chatId: number = msg.chat.id
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup'
    const senderId: number = msg.from?.id || chatId
    const firstName: string = msg.from?.first_name || 'Friend'
    const username: string = msg.from?.username || ''
    const lastName: string = msg.from?.last_name || ''
    const text: string = msg.text || ''
    const voice = msg.voice || msg.audio

    // Register user details (updates name automatically on every message!)
    await registerChatId(senderId, firstName, username, lastName).catch(() => {})

    // Auto-fetch birthday from user's Telegram profile if they enabled it
    try {
      const dbChat = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(senderId) }, select: { birthday: true } })
      if (dbChat && !dbChat.birthday) {
        const chatInfo = await tgApi('getChat', { chat_id: senderId })
        if (chatInfo?.result?.birthdate) {
          const bd = chatInfo.result.birthdate
          const mm = String(bd.month).padStart(2, '0')
          const dd = String(bd.day).padStart(2, '0')
          const birthdayStr = bd.year ? `${bd.year}-${mm}-${dd}` : `${mm}-${dd}`
          await prisma.telegramChat.update({
            where: { chatId: BigInt(senderId) },
            data: { birthday: birthdayStr }
          })
        }
      }
    } catch (e) {
      // ignore silently to not interrupt message processing
    }

    // Track every group message sender → builds complete member list over time
    if (isGroup && senderId && senderId !== chatId) {
      trackGroupMember(chatId, senderId).catch(() => {})
    }

    if (text.startsWith('/')) {
      const parts = text.split(' ')
      const rawCmd = parts[0].toLowerCase()
      const cmd = rawCmd.split('@')[0] // handle /add@ZerfBot
      const param = parts[1]?.toLowerCase()

      if (cmd === '/add' && isGroup) {
        await handleGroupAddCommand(msg)
      } else if (cmd === '/add' && !isGroup && msg.reply_to_message) {
        await handleGroupAddCommand(msg)
      } else if (cmd === '/invite') {
        await handleInviteCommand(senderId, firstName, parts[1])
      } else if (cmd === '/login' || (cmd === '/start' && param === 'login')) {
        await handleStart(chatId, firstName)
      } else if (cmd === '/start' && param?.startsWith('invite_')) {
        await handleStart(chatId, firstName)
        const inviterId = Number(param.split('_')[1])
        if (!isNaN(inviterId) && inviterId !== chatId) {
          try {
            const inviterUser = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(inviterId) } })
            if (inviterUser) {
              await prisma.friendship.upsert({
                where: { userChatId_friendChatId: { userChatId: BigInt(inviterId), friendChatId: BigInt(chatId) } },
                update: { status: 'pending' },
                create: { userChatId: BigInt(inviterId), friendChatId: BigInt(chatId), status: 'pending' }
              })
              await send(chatId,
                `🤝 *Новое приглашение в команду в Zerf AI!*\n\n` +
                `*${escMd(inviterUser.firstName || 'Пользователь')}* хочет добавить вас в команду!`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: '✅ Принять', callback_data: `friend_accept_${inviterId}` },
                        { text: '❌ Отклонить', callback_data: `friend_decline_${inviterId}` }
                      ]
                    ]
                  }
                }
              )
            }
          } catch (e) {
            console.error('Failed to process deep link invite:', e)
          }
        }
      } else if (cmd === '/start' && param?.startsWith('ref_')) {
        await handleStart(chatId, firstName)
        const referrerId = Number(param.replace('ref_', ''))
        if (!isNaN(referrerId) && referrerId !== chatId) {
          try {
            const existingUser = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
            if (existingUser && !(existingUser as any).referredBy) {
              const now = new Date()
              const currentExp = existingUser.subscriptionExpiry && new Date(existingUser.subscriptionExpiry) > now
                ? new Date(existingUser.subscriptionExpiry)
                : now
              const newExpiry = new Date(currentExp.getTime() + 3 * 24 * 60 * 60 * 1000)

              await (prisma.telegramChat as any).update({
                where: { chatId: BigInt(chatId) },
                data: {
                  referredBy: BigInt(referrerId),
                  plan: 'premium',
                  subscriptionExpiry: newExpiry,
                },
              })

              const referrer = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(referrerId) } })
              if (referrer) {
                const refExp = referrer.subscriptionExpiry && new Date(referrer.subscriptionExpiry) > now
                  ? new Date(referrer.subscriptionExpiry)
                  : now
                const referrerNewExpiry = new Date(refExp.getTime() + 3 * 24 * 60 * 60 * 1000)

                await (prisma.telegramChat as any).update({
                  where: { chatId: BigInt(referrerId) },
                  data: {
                    plan: 'premium',
                    subscriptionExpiry: referrerNewExpiry,
                    referralCount: { increment: 1 },
                  },
                })

                await send(referrerId, `🎉 Твой друг *${escMd(firstName)}* присоединился по твоей реферальной ссылке!\nВам обоим начислено *+3 дня Zerf Premium*! ⭐`)
                await send(chatId, `🎁 Добро пожаловать! Вы получили *+3 дня Zerf Premium* по реферальному приглашению от *${escMd(referrer.firstName || 'друга')}*! 🚀`)
              }
            }
          } catch (e) {
            console.error('Failed to process referral:', e)
          }
        }
      } else if (cmd === '/start' || cmd === '/help') {
        await handleStart(chatId, firstName)
      } else if (cmd === '/ref' || cmd === '/referral') {
        await handleRefCommand(chatId)
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
      } else if (cmd === '/report') {
        await handleWeeklyReport(chatId, senderId)
      } else if (cmd === '/premium' || cmd === '/subscribe' || cmd === '/buy') {
        await handleSubscribe(chatId)
      } else if (cmd === '/report') {
        await handleWeeklyReport(senderId, chatId)
      } else if (cmd === '/admin') {
        await handleAdminCommand(chatId, parts.slice(1))
      } else if (!isGroup) {
        await send(chatId, 'Попробуй /settings, /today, /invite, /report, /buy или /help')
      }
    } else if (!isGroup) {
      if (voice) {
        await processVoice(chatId, voice.file_id, voice.duration || 15)
      } else if (text.trim()) {
        await processText(chatId, text)
      }
    // In groups: respond to @mention or reply to bot message
    } else if (isGroup) {
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'Zerph_bot'
      const isMentioned = text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)
      const isReplyToBot = msg.reply_to_message?.from?.is_bot === true
      if (isMentioned || isReplyToBot) {
        const cleanText = text.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim()
        if (voice) {
          await processVoice(senderId, voice.file_id, voice.duration || 15)
        } else if (cleanText) {
          await processText(senderId, cleanText)
        }
      }
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
