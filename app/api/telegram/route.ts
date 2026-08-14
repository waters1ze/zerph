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
import { transcribeAudioWithGroq, parseIntentWithGroq, ParsedItem, generateSmartReschedulePlan } from '@/lib/backend/groq'
import {
  saveParsedItemToDb,
  getAllTasks, getAllGoals, getAllNotes,
  registerChatId, getExistingItemsContext,
  getUserUsageAndLimits, incrementUserUsage,
  autoAddFriends, checkGroupOrUserHasPremium, getFriends,
  getPublicItemsByUser, setItemVisibility, linkNoteToTask, setConfig, getConfig,
  getUserProductivityStats, completeTask,
} from '@/lib/backend/db'
import { getUserAuthToken } from '@/lib/backend/auth'
import { runReminderCheck, startFocusSession, stopFocusSession, getFocusSession } from '@/lib/backend/cron-runner'
import { prisma } from '@/lib/backend/prisma'
import { GROQ_API_KEY } from '@/lib/config'
import { sendVoiceResponse, createSpokenSummary } from '@/lib/backend/tts'

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
    const r1 = await tgApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      ...extra,
    })
    if (r1?.ok) return r1
    const r2 = await tgApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...extra,
    })
    if (r2?.ok) return r2
  }
  return await tgApi('sendMessage', {
    chat_id: chatId,
    text,
    ...extra,
  })
}

let commandsRegistered = false
async function ensureBotCommandsRegistered() {
  if (commandsRegistered) return
  commandsRegistered = true
  try {
    await tgApi('setMyCommands', {
      commands: [
        { command: 'today',      description: '📅 Задачи и цели на сегодня' },
        { command: 'matrix',     description: '🎯 Матрица Эйзенхауэра (Фокус дня)' },
        { command: 'cleanup',    description: '🌙 Вечерний перенос задач на завтра' },
        { command: 'inbox',      description: '📥 Входящие и неразобранное' },
        { command: 'shared',     description: '👥 Порученные задачи коллегам' },
        { command: 'p',          description: '📁 Фильтр по проекту или тегу' },
        { command: 'reschedule', description: '🧠 ИИ-перепланирование дня' },
        { command: 'stats',      description: '📊 Аналитика и стрики' },
        { command: 'focus',      description: '🔥 Режим фокуса / Помодоро' },
        { command: 'siri',       description: '🍏 Настройка Siri и кнопок телефона' },
        { command: 'goals',      description: '🎯 Активные цели' },
        { command: 'notes',      description: '📝 Мои заметки' },
        { command: 'report',     description: '📈 Недельный AI-отчет' },
        { command: 'settings',   description: '⚙️ Настройки напоминаний' },
        { command: 'buy',        description: '⭐ Zerf Premium (99 ₽/мес)' },
        { command: 'help',       description: '❓ Полное руководство' },
      ],
      scope: { type: 'all_private_chats' },
    })
  } catch {}
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

async function handleInbox(chatId: number) {
  const cid = BigInt(chatId)
  const tasks = await prisma.task.findMany({
    where: {
      ownerChatId: cid,
      status: { notIn: ['done', 'draft'] }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  if (tasks.length === 0) {
    await send(chatId, `📥 *Входящие пусты!*\n\nВсе задачи разобраны или выполнены 🎉`, {
      reply_markup: miniAppKeyboard(chatId)
    })
    return
  }

  let msg = `📥 *Входящие задачи (${tasks.length}):*\n\n`
  const keyboard: any[] = []

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const pEmoji = P_EMOJI[t.priority] || '⚪'
    const due = t.dueTime ? ` _(до ${t.dueTime})_` : ''
    let authorNote = ''
    if (t.authorChatId && t.authorChatId !== cid) {
      try {
        const author = await prisma.telegramChat.findUnique({ where: { chatId: t.authorChatId } })
        if (author) authorNote = ` · _от ${author.firstName || 'друга'}_`
      } catch {}
    }

    msg += `${i + 1}. ${pEmoji} *${escMd(t.title)}*${due}${authorNote}\n`
    if (t.description) msg += `   └ _${escMd(t.description.slice(0, 60))}_\n`

    if (i < 3) {
      keyboard.push([
        { text: `✓ Выполнить: ${t.title.slice(0, 24)}`, callback_data: `rem_done_${t.id}` }
      ])
    }
  }

  keyboard.push([{ text: '📱 Открыть во Входящих (Zerf App)', web_app: { url: `${MINIAPP_URL}?chatId=${chatId}` } }])

  await send(chatId, msg, {
    reply_markup: { inline_keyboard: keyboard }
  })
}

async function handleShared(chatId: number) {
  const cid = BigInt(chatId)
  const sharedTasks = await prisma.task.findMany({
    where: {
      authorChatId: cid,
      ownerChatId: { not: cid }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  if (sharedTasks.length === 0) {
    await send(chatId,
      `🤝 *Порученные задачи*\n\n` +
      `Вы пока никому не поручали задачи.\n` +
      `Чтобы поручить задачу, напишите или надиктуйте:\n` +
      `_«Поручи Вове сделать презентацию к 18:00»_`,
      { reply_markup: miniAppKeyboard(chatId) }
    )
    return
  }

  let msg = `🤝 *Задачи, порученные другим (${sharedTasks.length}):*\n\n`
  for (let i = 0; i < sharedTasks.length; i++) {
    const t = sharedTasks[i]
    let recipientName = 'Друг'
    if (t.ownerChatId) {
      try {
        const friend = await prisma.telegramChat.findUnique({ where: { chatId: t.ownerChatId } })
        if (friend) recipientName = friend.firstName || friend.username || 'Друг'
      } catch {}
    }

    const statusEmoji = t.status === 'done' ? '✅' : t.status === 'inprogress' ? '🚀' : '⏳'
    const statusText = t.status === 'done' ? 'выполнена' : t.status === 'inprogress' ? 'в процессе' : 'ожидает'
    const due = t.dueDate ? ` · ${t.dueDate}` : ''
    const time = t.dueTime ? ` в ${t.dueTime}` : ''

    msg += `${i + 1}. ${statusEmoji} *${escMd(t.title)}*\n` +
      `   └ 👤 Кому: *${escMd(recipientName)}* (${statusText})${due}${time}\n`
  }

  await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })
}

async function handleProjectFilter(chatId: number, projectName?: string) {
  const cid = BigInt(chatId)
  const allTasks = await getAllTasks(chatId)

  if (!projectName) {
    const tagSet = new Set<string>()
    allTasks.forEach((t: any) => {
      if (Array.isArray(t.tags)) t.tags.forEach((tag: string) => tagSet.add(tag))
    })

    let projectDbList: any[] = []
    try {
      projectDbList = await prisma.projectDB.findMany({
        where: {
          OR: [
            { ownerChatId: cid },
            { memberIds: { has: cid } }
          ]
        }
      })
    } catch {}

    let msg = `📁 *Фильтр по проектам и категориям*\n\n`
    if (projectDbList.length === 0 && tagSet.size === 0) {
      msg += `У вас пока нет проектов. Создайте задачу с тегом или проект через приложение!\n` +
        `Пример команды: \`/p Работа\` или \`/p Дом\``
    } else {
      if (projectDbList.length > 0) {
        msg += `🏢 *Командные проекты:*\n`
        projectDbList.forEach((p: any) => msg += `• \`/p ${p.title}\`\n`)
        msg += `\n`
      }
      if (tagSet.size > 0) {
        msg += `🏷️ *Категории / Теги:*\n`
        Array.from(tagSet).slice(0, 10).forEach(tag => msg += `• \`/p ${tag}\`\n`)
      }
      msg += `\n_Используйте: \`/p НазваниеПроекта\` для просмотра задач._`
    }

    await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })
    return
  }

  const query = projectName.toLowerCase().trim()
  const matchingTasks = allTasks.filter((t: any) => {
    const titleMatch = (t.title || '').toLowerCase().includes(query)
    const tagMatch = Array.isArray(t.tags) && t.tags.some((tag: string) => tag.toLowerCase().includes(query))
    const descMatch = (t.description || '').toLowerCase().includes(query)
    return titleMatch || tagMatch || descMatch
  })

  if (matchingTasks.length === 0) {
    await send(chatId, `📁 По проекту/тегу *«${escMd(projectName)}»* задач не найдено.\nПопробуйте \`/p\` для списка категорий.`)
    return
  }

  let msg = `📁 *Задачи по проекту «${escMd(projectName)}» (${matchingTasks.length}):*\n\n`
  matchingTasks.slice(0, 10).forEach((t: any, i: number) => {
    const statusEmoji = t.status === 'done' ? '✅' : '⏳'
    const due = t.dueTime ? ` _(${t.dueTime})_` : ''
    msg += `${i + 1}. ${statusEmoji} *${escMd(t.title)}*${due}\n`
  })

  await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })
}

async function handleStats(chatId: number) {
  const stats = await getUserProductivityStats(chatId)

  const progressBar = (val: number, max: number = 100, length: number = 8) => {
    const filled = Math.round((val / (max || 1)) * length)
    return '▓'.repeat(Math.min(filled, length)) + '░'.repeat(Math.max(0, length - filled))
  }

  let rating = '🌱 Новичок продуктивности'
  if (stats.completionRate >= 80 && stats.completedCount >= 10) rating = '⚡ Мастер фокуса и дедлайнов'
  else if (stats.completionRate >= 60 || stats.completedCount >= 5) rating = '🚀 Продуктивный деятель'
  else if (stats.completedCount > 0) rating = '🎯 На верном пути'

  let msg = `📊 *Ваша статистика продуктивности в Zerf AI*\n\n`
  msg += `🏆 *Статус:* ${rating}\n`
  msg += `🔥 *Текущий стрик:* ${stats.streak} дн. подряд\n`
  msg += `📈 *Процент выполнения:* ${stats.completionRate}% \`[${progressBar(stats.completionRate)}]\`\n\n`

  msg += `📌 *Всего задач:* ${stats.totalTasks}\n`
  msg += `✅ *Выполнено:* ${stats.completedCount}\n`
  msg += `⏳ *В работе:* ${stats.pendingCount}\n\n`

  msg += `📅 *Активность за неделю:*\n`
  const maxDay = Math.max(...Object.values(stats.weekActivity), 1)
  Object.entries(stats.weekActivity).forEach(([day, count]) => {
    msg += `  ${day}: \`${progressBar(count, maxDay, 6)}\` (${count})\n`
  })

  if (Object.keys(stats.tagCounts).length > 0) {
    msg += `\n🏷️ *По категориям:*\n`
    Object.entries(stats.tagCounts).slice(0, 5).forEach(([tag, count]) => {
      msg += `  • ${tag}: *${count}*\n`
    })
  }

  await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })
}

async function handleReschedule(chatId: number) {
  const cid = BigInt(chatId)
  const limits = await getUserUsageAndLimits(chatId)

  // Free plan limit: max 2 reschedules per day
  if (limits.plan !== 'premium') {
    const todayReschedule = await prisma.task.count({
      where: {
        ownerChatId: cid,
        tags: { has: 'draft_reschedule' },
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    })
    if (todayReschedule >= 2) {
      await send(chatId,
        `🔒 *Дневной лимит бесплатного тарифа исчерпан (2 перепланирования в день).*\n\n` +
        `⭐ Оформите *Zerf Premium* (99 ₽/мес), чтобы использовать умное ИИ-перепланирование, Siri и фокус-сессии без ограничений!`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '⭐ Оформить Premium (99 ₽)', callback_data: 'cmd_subscribe' }]
            ]
          }
        }
      )
      return
    }
  }

  const now = new Date()
  const mskFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit', minute: '2-digit', hour12: false
  })
  const currentMskTime = mskFormatter.format(now)

  const pendingTasks = await prisma.task.findMany({
    where: {
      ownerChatId: cid,
      status: { notIn: ['done', 'draft'] }
    },
    orderBy: { priority: 'asc' },
    take: 8
  })

  if (pendingTasks.length === 0) {
    await send(chatId, `🎉 У вас нет невыполненных задач для перепланирования! Всё закрыто.`, {
      reply_markup: miniAppKeyboard(chatId)
    })
    return
  }

  await send(chatId, `🧠 *ИИ анализирует ваши задачи и рассчитывает идеальное расписание...*`)

  const { plan, aiAdvice } = await generateSmartReschedulePlan(
    pendingTasks.map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueTime: t.dueTime,
      dueDate: t.dueDate
    })),
    currentMskTime
  )

  const draftTask = await prisma.task.create({
    data: {
      title: `[RESCHEDULE_PLAN]`,
      status: 'draft',
      ownerChatId: cid,
      rawText: JSON.stringify(plan),
      tags: ['draft_reschedule']
    }
  })

  let msg = `🧠 *Умное перепланирование от Zerf AI*\n\n`
  msg += `💡 _${escMd(aiAdvice)}_\n\n`
  msg += `📋 *Предлагаемый график:*\n`

  plan.forEach((item, idx) => {
    const when = item.isTomorrow ? 'Завтра' : 'Сегодня'
    const old = item.oldTime ? ` ~${item.oldTime}~ ➔` : ''
    msg += `${idx + 1}. *${escMd(item.title)}*\n` +
      `   ⏰ ${when} в *${item.newTime}*${old} (${escMd(item.reason)})\n`
  })

  msg += `\nНажмите *«⚡ Применить расписание»*, чтобы обновить все дедлайны в один клик:`

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '⚡ Применить расписание', callback_data: `apply_resch_${draftTask.id}` },
        { text: '❌ Отмена', callback_data: `cancel_resch_${draftTask.id}` }
      ]
    ]
  }

  await send(chatId, msg, { reply_markup: replyMarkup })
}

async function handleFocus(chatId: number, minutesStr?: string) {
  const limits = await getUserUsageAndLimits(chatId)
  const mins = parseInt(minutesStr || '25', 10)
  let validMins = isNaN(mins) || mins <= 0 ? 25 : Math.min(mins, 180)

  if (limits.plan !== 'premium' && validMins > 45) {
    validMins = 45
    await send(chatId, `⭐ *На бесплатном тарифе длительность фокуса ограничена 45 минутами.* Запускаем на 45 мин.\n_Для сессий до 180 мин оформите /premium._`)
  }

  startFocusSession(chatId, validMins)

  const endMs = Date.now() + validMins * 60 * 1000
  const endDate = new Date(endMs + 3 * 60 * 60 * 1000)
  const endH = String(endDate.getUTCHours()).padStart(2, '0')
  const endM = String(endDate.getUTCMinutes()).padStart(2, '0')

  let msg = `🔥 *Режим глубокого фокуса запущен!*\n\n` +
    `⏱️ *Длительность:* ${validMins} минут (до *${endH}:${endM} МСК*)\n\n` +
    `🧘 Отключите лишние вкладки, включите беззвучный режим и сосредоточьтесь на одной задаче.\n` +
    `Когда время выйдет, бот пришлет звуковое уведомление с перерывом!`

  const replyMarkup = {
    inline_keyboard: [
      [{ text: '⏹️ Завершить досрочно', callback_data: 'stop_focus' }]
    ]
  }

  await send(chatId, msg, { reply_markup: replyMarkup })
}

async function handleSiriSetup(chatId: number) {
  const appUrl = APP_URL || 'https://zeprh.vercel.app'
  const endpointUrl = `${appUrl}/api/shortcuts`
  const testUrl = `${endpointUrl}?chatId=${chatId}&text=Купить+молоко+в+19:00`

  let msg = `🍏 *Интеграция с Siri, Action Button и виджетами*\n\n` +
    `Превратите Zerf AI в нативного голосового ассистента на вашем телефоне! Задачи создаются за 1 секунду голосом или по нажатию физической кнопки.\n\n` +
    `🔑 *Ваш персональный Chat ID:* \`${chatId}\` _(нажмите, чтобы скопировать)_\n` +
    `🌐 *API Шлюз:* \`${endpointUrl}\`\n\n` +
    `───────────────\n` +
    `📱 *НАСТРОЙКА НА IPHONE (Siri & Кнопка действия):*\n\n` +
    `1️⃣ Откройте стандартное приложение **Команды** (Shortcuts) на iPhone и нажмите **+**.\n` +
    `2️⃣ Назовите команду сверху: *Запиши в Zerf* (или *Новая задача*).\n` +
    `3️⃣ Добавьте 4 простых действия:\n\n` +
    `   🔸 *1. Диктовать текст* (Dictate text) — Язык: _Русский_\n` +
    `   🔸 *2. Получить содержимое URL* (Get contents of URL):\n` +
    `      • URL: \`${endpointUrl}\`\n` +
    `      • Метод: *POST*\n` +
    `      • Заголовки: \`Content-Type\` = \`application/json\`\n` +
    `      • Тело: *JSON* ➔ Добавить 2 поля:\n` +
    `        - \`chatId\` (Число) = \`${chatId}\`\n` +
    `        - \`text\` (Текст) = выберите *[Продиктованный текст]*\n` +
    `   🔸 *3. Получить значение словаря* (Get dictionary value):\n` +
    `      • Ключ: \`spokenResponse\` из *[Содержимое URL]*\n` +
    `   🔸 *4. Произнести текст* (Speak text):\n` +
    `      • Текст: выберите *[Значение словаря]*\n\n` +
    `4️⃣ *Привязка к кнопке или жесту:*\n` +
    `   • **iPhone 15/16 Pro:** _Настройки ➔ Кнопка действия ➔ Быстрая команда ➔ Запиши в Zerf_\n` +
    `   • **Любой iPhone:** _Настройки ➔ Универсальный доступ ➔ Касание ➔ Касание задней панели ➔ Двойное касание ➔ Запиши в Zerf_\n\n` +
    `───────────────\n` +
    `🤖 *НАСТРОЙКА НА ANDROID (Виджет в 1 клик):*\n\n` +
    `1️⃣ Установите бесплатное приложение **HTTP Shortcuts** из Google Play.\n` +
    `2️⃣ Создайте ярлык с методом **POST** на \`${endpointUrl}\` и телом:\n` +
    `   \`{"chatId": ${chatId}, "text": "..."}\`\n` +
    `3️⃣ Разместите виджет на экране блокировки или рабочем столе!\n\n` +
    `🧪 *Проверить работу прямо сейчас:* нажмите кнопку ниже:`

  const replyMarkup = {
    inline_keyboard: [
      [{ text: '🧪 Проверить API шлюз', url: testUrl }],
      [{ text: '📱 Открыть настройки в приложении', web_app: { url: `${MINIAPP_URL}?chatId=${chatId}` } }]
    ]
  }

  await send(chatId, msg, { reply_markup: replyMarkup })
}

async function handleSettings(chatId: number) {
  let interval = 5
  let repeat = 3
  let ttsEnabled = true
  try {
    const userChat = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
    if (userChat) {
      interval = userChat.reminderIntervalMinutes
      repeat = userChat.reminderRepeatCount
      ttsEnabled = userChat.ttsEnabled ?? true
    }
  } catch {}

  await send(chatId,
    `⚙️ *Настройки напоминаний и интеграций*\n\n` +
    `⏱️ *Интервал между напоминаниями:* ${interval} мин\n` +
    `🔁 *Количество повторов:* ${repeat} раза\n` +
    `🎙️ *Голосовые ответы ИИ:* ${ttsEnabled ? 'Включены' : 'Выключены'}\n\n` +
    `_Выберите параметр для изменения или подключите внешний календарь:_`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `⏱️ Интервал: ${interval} м`, callback_data: 'cfg_interval_menu' },
            { text: `🔁 Повторы: ${repeat}x`, callback_data: 'cfg_repeat_menu' },
          ],
          [
            { text: `🎙️ Голосовые ответы: ${ttsEnabled ? 'ВКЛ ✅' : 'ВЫКЛ 🔇'}`, callback_data: 'toggle_tts' },
          ],
          [
            { text: '📅 Apple / Google Календарь', callback_data: 'open_calendar_sync' },
            { text: '🍏 Siri / Телефон', callback_data: 'open_siri_guide' },
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
  project: 'Проект', reminder: 'Напоминание', completion: 'Выполнено', delegate: 'Поручение'
}

async function handleSubscribe(chatId: number) {
  const limits = await getUserUsageAndLimits(chatId)
  const receiver = process.env.YOOMONEY_RECEIVER || '4100119573095433'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'

  const monthParams = new URLSearchParams({
    receiver,
    'quickpay-form': 'shop',
    targets: 'Подписка Zerf Premium (30 дней)',
    paymentType: 'AC',
    sum: '99',
    label: `${chatId}_30`,
    successURL: `${appUrl}/?payment=success`,
  })
  const monthUrl = `https://yoomoney.ru/quickpay/confirm?${monthParams.toString()}`

  const yearParams = new URLSearchParams({
    receiver,
    'quickpay-form': 'shop',
    targets: 'Подписка Zerf Premium на 1 год (со скидкой 15%)',
    paymentType: 'AC',
    sum: '1009',
    label: `${chatId}_365`,
    successURL: `${appUrl}/?payment=success`,
  })
  const yearUrl = `https://yoomoney.ru/quickpay/confirm?${yearParams.toString()}`

  if (limits.plan === 'premium') {
    const exp = limits.subscriptionExpiry
      ? new Date(limits.subscriptionExpiry).toLocaleDateString('ru-RU')
      : '?'
    await send(chatId,
      `✨ *У тебя уже активна подписка Zerf Premium!*\n\n` +
      `📅 Активна до: *${exp}*\n\n` +
      `• 🎙 Голос и Siri: до 10 минут в день\n` +
      `• 🧠 ИИ-перепланирование (/reschedule): безлимитно\n` +
      `• 🔥 Режим фокуса (/focus): до 180 минут\n` +
      `• 📊 Полная статистика продуктивности (/stats)\n` +
      `• 📌 Заметки и ИИ чат: безлимитно\n\n` +
      `_Продлить подписку со скидкой:_`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⭐ Продлить на 1 год (-15%) — 1009 ₽', url: yearUrl }],
            [{ text: '💳 Продлить на 1 месяц — 99 ₽', url: monthUrl }],
            [{ text: '📱 Открыть Zerf App', web_app: { url: `${appUrl}/tg?chatId=${chatId}` } }],
          ]
        }
      }
    )
    return
  }

  await send(chatId,
    `⭐ *Тарифы Zerf Premium*\n\n` +
    `🆓 *Сейчас у тебя бесплатный тариф:*\n` +
    `• 🎙 Голосовые и Siri: 2 в день (осталось: ${Math.max(0, 2 - (limits.voice.used || 0))})\n` +
    `• 🧠 ИИ-перепланирование: 2 в день\n` +
    `• 🔥 Фокус-сессии: до 45 мин\n` +
    `• 📌 Заметки: 2 в день (осталось: ${Math.max(0, 2 - (limits.notes.used || 0))})\n` +
    `• 💬 ИИ чат: 10 в день (осталось: ${Math.max(0, 10 - (limits.chat.used || 0))})\n\n` +
    `✨ *С Zerf Premium:*\n` +
    `• 🎙 Голос и Siri: безлимитно (до 10 мин/день)\n` +
    `• 🧠 ИИ-перепланирование дня: безлимитно\n` +
    `• 🔥 Глубокий фокус: до 180 минут\n` +
    `• 📊 Полная аналитика продуктивности и стрики\n` +
    `• 📌 Заметки и ИИ чат: безлимитно\n\n` +
    `💰 *Выберите удобный период:*`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⭐ 1 год (Скидка 15%) — 1009 ₽', url: yearUrl }],
          [{ text: '💳 1 месяц — 99 ₽', url: monthUrl }],
          [{ text: '📱 Открыть Zerf App', web_app: { url: `${appUrl}/tg?chatId=${chatId}` } }],
        ]
      }
    }
  )
}

async function handleAdminCommand(chatId: number, args: string[]) {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || 'zerph-admin-2024'
  const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || '6136950061,5078516086').split(',').map(s => s.trim()).filter(Boolean)
  const cid = BigInt(chatId)

  let isAuthorized = ADMIN_CHAT_IDS.includes(String(chatId))
  if (!isAuthorized) {
    const u = await prisma.telegramChat.findUnique({ where: { chatId: cid }, select: { isAdmin: true } })
    if (u?.isAdmin) isAuthorized = true
  }

  if (!isAuthorized) {
    await send(chatId, `⛔ *Доступ ограничен.* Раздел администрирования доступен только администраторам системы.`)
    return
  }

  const [subCmd, targetQuery] = args
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'

  if (!subCmd) {
    await send(chatId,
      `👑 *Панель Администратора Zerf AI*\n\n` +
      `💻 *Веб-интерфейс:* Вам доступна полноценная графическая панель админа на сайте!\n\n` +
      `Команды быстрого управления:\n` +
      `• \`/admin grant <chatId> [дни]\` — выдать Premium\n` +
      `• \`/admin revoke <chatId>\` — забрать Premium\n` +
      `• \`/admin role <chatId> <on/off>\` — назначить/снять админа\n` +
      `• \`/admin search <имя/@username/ID>\` — поиск пользователя\n` +
      `• \`/admin reset <chatId>\` — сбросить дневные лимиты\n` +
      `• \`/admin stats\` — общая статистика системы`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👑 Открыть Веб Админ-панель', web_app: { url: `${appUrl}/tg?chatId=${chatId}` } }],
            [{ text: '🌐 Полный сайт', url: `${appUrl}/?chatId=${chatId}` }]
          ]
        }
      }
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
      `🎙 Голос сегодня: ${data.voice?.used || 0}${data.plan === 'premium' ? ` (${Math.round((data.voice?.secondsUsed || 0)/60)} мин)` : '/5 (до 3 мин)'}\n` +
      `📌 Заметки сегодня: ${data.notes?.used || 0}${data.plan !== 'premium' ? '/5' : ''}\n` +
      `💬 Чат сегодня: ${data.chat?.used || 0}${data.plan !== 'premium' ? '/20' : ''}`
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

  if (subCmd === 'price') {
    const priceStr = targetQuery
    const price = parseInt(priceStr || '', 10)
    if (isNaN(price) || price <= 0) {
      const current = await getConfig('subscription_price') || '99'
      await send(chatId, `💰 *Цена подписки*\n\nТекущая цена: *${current} руб/мес*\n\nЧтобы изменить: \`/admin price <число>\``)
      return
    }
    await setConfig('subscription_price', String(price))
    await send(chatId, `✅ *Цена подписки изменена!*\n\nНовая цена: *${price} руб/мес*\n\n_Изменение сохранено в базе данных._`)
    return
  }

  if (subCmd === 'stats') {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/subscription?secret=${ADMIN_SECRET}`)
    const data = await res.json()
    const users: any[] = data.users || []
    const premiums = users.filter((u: { plan: string }) => u.plan === 'premium')
    const price = parseInt(await getConfig('subscription_price') || '99', 10)
    const monthlyRevenue = premiums.length * price
    const today = new Date().toLocaleDateString('ru-RU')

    let msg = `📊 *Статистика Zerf AI (${today})*\n\n`
    msg += `👥 Всего пользователей: *${users.length}*\n`
    msg += `✨ Premium подписчиков: *${premiums.length}*\n`
    msg += `🆓 Бесплатных: *${users.length - premiums.length}*\n\n`
    msg += `💰 *Финансы:*\n`
    msg += `• Цена подписки: ${price} руб/мес\n`
    msg += `• Потенциальный доход/мес: *${monthlyRevenue} руб*\n`
    msg += `• При 10% конверсии: *${Math.round(users.length * 0.1) * price} руб/мес*\n`
    msg += `• При 20% конверсии: *${Math.round(users.length * 0.2) * price} руб/мес*\n\n`
    msg += `📈 _Чем больше пользователей, тем выше потенциал!_`

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
  кирилл: ['кирюха', 'киря', 'кир'],
}

export interface FriendMatch {
  friend: any; // TelegramChat
  isAllowed: boolean;
  reason?: string;
}

async function findFriendMatches(userChatId: number | bigint, recipientName: string): Promise<FriendMatch[]> {
  const cid = BigInt(userChatId)
  
  // 1. Get all friendships
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userChatId: cid }, { friendChatId: cid }] }
  })
  const friendIds = new Set<bigint>()
  friendships.forEach((f: any) => friendIds.add(f.userChatId === cid ? f.friendChatId : f.userChatId))

  // 2. Get all group members (shared groups)
  const userGroups = await prisma.groupMembership.findMany({
    where: { memberChatId: cid }
  })
  const groupChatIds = userGroups.map((g: any) => g.groupChatId)
  const sharedGroupMembers = await prisma.groupMembership.findMany({
    where: { groupChatId: { in: groupChatIds } }
  })
  sharedGroupMembers.forEach((m: any) => {
    if (m.memberChatId !== cid) friendIds.add(m.memberChatId)
  })

  // 3. Get all project members (shared projects)
  try {
    const userProjects = await prisma.projectDB.findMany({
      where: {
        OR: [
          { ownerChatId: cid },
          { memberIds: { has: cid } }
        ]
      }
    })
    userProjects.forEach((p: any) => {
      if (p.ownerChatId !== cid) friendIds.add(p.ownerChatId)
      p.memberIds.forEach((mId: bigint) => {
        if (mId !== cid) friendIds.add(mId)
      })
    })
  } catch (e) {}

  if (friendIds.size === 0) return []

  const friendChats = await prisma.telegramChat.findMany({
    where: { chatId: { in: Array.from(friendIds) } }
  })

  const rawQuery = recipientName.toLowerCase().trim().replace('@', '')
  const queryTokens = rawQuery.split(/\s+/).filter(Boolean)

  const matchedChats = new Set<any>()

  for (const f of friendChats) {
    const fn = (f.firstName || '').toLowerCase()
    const ln = (f.lastName || '').toLowerCase()
    const un = (f.username || '').toLowerCase()
    const fullName = `${fn} ${ln}`.trim()

    let isMatch = false
    if (fullName.includes(rawQuery) || fn.includes(rawQuery) || ln.includes(rawQuery) || (un && un.includes(rawQuery))) {
      isMatch = true
    } else {
      for (const token of queryTokens) {
        if (fn.includes(token) || ln.includes(token) || (un && un.includes(token))) {
          isMatch = true; break
        }
        if ((fn.length >= 3 && (token.includes(fn) || token.startsWith(fn.slice(0, 3)) || fn.startsWith(token.slice(0, 3)))) ||
            (ln.length >= 3 && (token.includes(ln) || token.startsWith(ln.slice(0, 3)) || ln.startsWith(token.slice(0, 3))))) {
          isMatch = true; break
        }

        for (const [canonical, aliases] of Object.entries(NAME_ALIASES)) {
          const tokenMatchesAlias = aliases.some(a => token.includes(a) || (a.length >= 3 && token.startsWith(a.slice(0, 3))))
          const tokenMatchesCanonical = token.includes(canonical) || (canonical.length >= 4 && token.startsWith(canonical.slice(0, 4)))
          
          const fnMatchesCanonical = fn.includes(canonical) || fullName.includes(canonical) || (canonical.length >= 4 && fn.startsWith(canonical.slice(0, 4)))
          const fnMatchesAlias = aliases.some(a => fn.includes(a) || fullName.includes(a) || (a.length >= 3 && fn.startsWith(a.slice(0, 3))))

          if ((tokenMatchesAlias && fnMatchesCanonical) || (tokenMatchesCanonical && fnMatchesAlias)) {
            isMatch = true; break
          }
        }
        if (isMatch) break
      }
    }

    if (!isMatch) {
      for (const [canonical, aliases] of Object.entries(NAME_ALIASES)) {
        if (aliases.some(a => rawQuery.includes(a)) && (fn.includes(canonical) || ln.includes(canonical))) {
          isMatch = true; break
        }
      }
    }

    if (isMatch) matchedChats.add(f)
  }

  const results: FriendMatch[] = []
  for (const friend of Array.from(matchedChats)) {
    const fId = friend.chatId
    let isAllowed = false
    let reason = ''

    try {
      const sharedProj = await prisma.projectDB.findFirst({
        where: {
          OR: [
            { ownerChatId: cid, memberIds: { has: fId } },
            { ownerChatId: fId, memberIds: { has: cid } },
            { AND: [{ memberIds: { has: cid } }, { memberIds: { has: fId } }] }
          ]
        }
      })
      if (sharedProj) { isAllowed = true; reason = 'project' }
    } catch {}

    if (!isAllowed) {
      const sharedGroup = await prisma.groupMembership.findFirst({
        where: { memberChatId: fId, groupChatId: { in: groupChatIds } }
      })
      if (sharedGroup) { isAllowed = true; reason = 'group' }
    }

    if (!isAllowed) {
      const fs = friendships.find((f: any) =>
        (f.userChatId === fId && f.friendChatId === cid) ||
        (f.friendChatId === fId && f.userChatId === cid)
      )
      if (fs && fs.allowTasks) { isAllowed = true; reason = 'friendship' }
    }

    results.push({ friend, isAllowed, reason })
  }

  return results
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
  if (!items || items.length === 0) {
    await send(chatId, `🤔 Я не совсем понял команду. Попробуйте сформулировать иначе.`, { reply_markup: miniAppKeyboard(chatId) })
    return
  }

  let msg = items.length > 1 ? `Обработано элементов: ${items.length}\n\n` : ''

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]

    if (item.action === 'delete_all') {
      await saveParsedItemToDb(item, chatId)
      await send(chatId, `Все задачи успешно удалены.`, { reply_markup: miniAppKeyboard(chatId) })
      return
    }

    // Fallback detection if delegation keywords are used in prompt text or if LLM missed recipientName
    if ((item.type !== 'delegate' || !item.recipientName) && item.rawText) {
      const lower = item.rawText.toLowerCase()
      const match = lower.match(/(?:дай задачу|поручи|отправь задачу|передай задачу|создай задачу для|назначь|кинь|скинь|напиши|передай)\s+([а-яА-Яa-zA-Z0-9_@\s]+?)(?:,|$|\s+чтобы|\s+на|\s+через)/i)
      if (match && match[1]) {
        item.type = 'delegate'
        item.recipientName = match[1].trim()
      }
    }

    if (item.recipientName) {
      const matches = await findFriendMatches(chatId, item.recipientName)

      if (matches.length === 0) {
        await prisma.task.create({
          data: {
            title: item.title,
            description: item.summary || '',
            priority: item.priority || 'medium',
            status: 'todo',
            dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
            dueTime: item.dueTime || null,
            tags: item.tags || [],
            ownerChatId: BigInt(chatId),
            authorChatId: BigInt(chatId),
            isShared: false,
          } as any
        })
        msg += `ℹ️ Пользователь *«${escMd(item.recipientName)}»* не найден в вашей команде. Чтобы задача не потерялась, я сохранил её в вашем *личном списке*!\n\n`
        continue
      }

      const sender = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
      const senderName = sender?.firstName || 'Пользователь'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'

      const allowedMatches = matches.filter(m => m.isAllowed)

      if (allowedMatches.length === 0) {
        await prisma.task.create({
          data: {
            title: item.title,
            description: item.summary || '',
            priority: item.priority || 'medium',
            status: 'todo',
            dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
            dueTime: item.dueTime || null,
            tags: item.tags || [],
            ownerChatId: BigInt(chatId),
            authorChatId: BigInt(chatId),
            isShared: false,
          } as any
        })
        msg += `⚠️ Пользователь *«${escMd(item.recipientName)}»* ограничил приём задач. Задача сохранена в вашем *личном списке*.\n\n`
        continue
      }

      if (allowedMatches.length > 1 && !item.isPluralRecipient) {
        // Disambiguation among allowed recipients
        const draftTask = await prisma.task.create({
          data: {
            title: `[DRAFT] ${item.title}`,
            status: 'draft',
            ownerChatId: BigInt(chatId),
            rawText: JSON.stringify(item),
            tags: ['draft_delegation']
          }
        })

        let amMsg = `🤔 Найдено несколько человек по запросу *«${escMd(item.recipientName)}»*. Уточни фамилию или выбери нужного человека:\n`
        
        const inlineKeyboard = []
        for (const m of allowedMatches) {
          const fn = m.friend.firstName || ''
          const ln = m.friend.lastName || ''
          const un = m.friend.username ? ` (@${m.friend.username})` : ''
          const fullName = `👤 ${fn} ${ln}${un}`.trim()
          inlineKeyboard.push([{ text: fullName, callback_data: `dr_${draftTask.id}:${m.friend.chatId}` }])
        }
        inlineKeyboard.push([{ text: '🔒 Оставить только у себя (Личная задача)', callback_data: `dr_${draftTask.id}:self` }])
        inlineKeyboard.push([{ text: '❌ Отмена', callback_data: `dr_${draftTask.id}:cancel` }])

        await send(chatId, amMsg, {
          reply_markup: { inline_keyboard: inlineKeyboard }
        })
        continue
      }

      const targets = item.isPluralRecipient ? allowedMatches : allowedMatches.slice(0, 1)

      // Execute for target matches
      for (const match of targets) {
        const friend = match.friend
        if (!match.isAllowed) {
          msg += `⚠️ ${friend.firstName || item.recipientName} отключил(а) получение элементов от вас.\n\n`
          continue
        }

        if (item.type === 'delegate' || item.type === 'task') {
          const newTask = await prisma.task.create({
            data: {
              title: item.title,
              description: item.summary || '',
              priority: item.priority || 'medium',
              status: 'todo',
              dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
              dueTime: item.dueTime || null,
              repeat: item.repeat || null,
              tags: item.tags || [],
              ownerChatId: friend.chatId,
              authorChatId: BigInt(chatId),
              assignees: [String(chatId)],
              isShared: true,
            } as any
          })

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
          // Note or Goal
          await saveParsedItemToDb(item, friend.chatId, chatId)
          
          const typeName = item.type === 'note' ? 'заметку' : (item.type === 'goal' ? 'цель' : 'элемент')
          let notifyMsg = `🤝 *${escMd(senderName)}* создал(а) для тебя ${typeName}!\n\n`
          notifyMsg += `📌 *Название:* ${escMd(item.title)}\n`
          if (item.summary) {
            notifyMsg += `📝 *Текст:* ${escMd(item.summary)}\n`
          }
          if (item.dueTime) {
            notifyMsg += `⏰ *Время:* ${item.dueTime}\n`
          }
          notifyMsg += `\n_Сохранено в твоем аккаунте на сайте Zerf AI_`

          await send(Number(friend.chatId), notifyMsg, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📱 Открыть Zerf App', web_app: { url: `${appUrl}/tg?chatId=${friend.chatId}` } }]
              ]
            }
          })
          msg += `🤝 ${typeName.charAt(0).toUpperCase() + typeName.slice(1)} *«${escMd(item.title)}»* успешно отправлена *${escMd(friend.firstName || item.recipientName)}*!\n\n`
        }
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

    if (item.action === 'set_my_birthday') {
      msg += `🎂 ${escMd(item.title)}\n\n`
      continue
    }

    const typeLabel = TYPE_RU[item.type] || item.type
    const actionWord = updatedItem || item.action === 'update' ? 'изменена' : 'создана'
    const prefix = items.length > 1 ? `${idx + 1}. ` : ''
    const pText = PRIORITY_RU[item.priority] || item.priority

    const sender = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
    const senderName = sender?.firstName || 'Пользователь'

    msg += `${prefix}${typeLabel} ${actionWord}: *${escMd(item.title)}*\n`
    msg += `👤 Автор: ${escMd(senderName)}\n`
    
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
    // If task was created with subtasks, send an interactive checklist message
    if (item.type === 'task' && item.subtasks && item.subtasks.length > 0 && item.action !== 'delete' && item.action !== 'completion') {
      try {
        const createdTask = await prisma.task.findFirst({
          where: { ownerChatId: BigInt(chatId), title: item.title },
          orderBy: { createdAt: 'desc' }
        })
        if (createdTask && Array.isArray(createdTask.subtasks) && createdTask.subtasks.length > 0) {
          const subtasks = createdTask.subtasks as any[]
          const inlineKeyboard = subtasks.map((st, i) => ([
            { text: `◻️ ${i + 1}. ${st.title.slice(0, 35)}`, callback_data: `st_${createdTask.id}_${i}` }
          ]))
          inlineKeyboard.push([
            { text: '✅ Завершить задачу целиком', callback_data: `rem_done_${createdTask.id}` }
          ])

          await send(chatId, `📎 *Интерактивный чек-лист к задаче «${escMd(item.title)}»:*\n_Нажимайте на пункты прямо в Telegram по мере выполнения:_`, {
            reply_markup: { inline_keyboard: inlineKeyboard }
          })
        }
      } catch {}
    }

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
      [{ text: '📱 Open Zerf App', web_app: { url: MINIAPP_URL } }],
      [{ text: '🌐 Open Full Web Site', url: `${APP_URL}${query}` }],
    ],
  }
}

async function processPhoto(chatId: number, photoArray: any[]) {
  if (!photoArray || photoArray.length === 0) return
  const largest = photoArray[photoArray.length - 1]
  const fileId = largest.file_id

  try {
    await tgApi('sendChatAction', { chat_id: chatId, action: 'typing' })
    await send(chatId, '📷 Распознаю задачи из фото через Vision AI...')

    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
    const fileData = await fileRes.json()
    const filePath = fileData.result?.file_path
    if (!filePath) throw new Error('Не удалось получить файл изображения')

    const imgRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`)
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    const { extractTasksFromImageWithGroq } = await import('@/lib/backend/vision')
    const extractedTasks = await extractTasksFromImageWithGroq(imgBuffer)

    if (extractedTasks.length === 0) {
      await send(chatId, '🤔 На изображении не обнаружено явных задач или расписания. Попробуйте отправить более четкое фото или скриншот.')
      return
    }

    const { createTask } = await import('@/lib/backend/db')
    const createdList: string[] = []

    for (const t of extractedTasks) {
      const created = await createTask({
        title: t.title,
        description: t.description || 'Распознано из фото через Vision AI',
        priority: t.priority || 'medium',
        dueDate: t.dueDate || new Date().toISOString().slice(0, 10),
        dueTime: t.dueTime || undefined,
        tags: ['фото', 'vision-ai'],
        aiGenerated: true,
        ownerChatId: BigInt(chatId),
        subtasks: (t.subtasks || []).map((st, i) => ({
          id: `st_vis_${i}_${Date.now()}`,
          title: st,
          done: false,
        }))
      })
      if (created) {
        const timePart = t.dueTime ? ` в ${t.dueTime}` : ''
        const datePart = t.dueDate ? ` (${t.dueDate})` : ''
        createdList.push(`• *${escMd(t.title)}*${timePart}${datePart}`)
      }
    }

    const msg =
      `🎉 *Успешно распознано и создано задач:* ${createdList.length}\n\n` +
      createdList.join('\n') +
      `\n\n_Все задачи добавлены в ваш список дел и синхронизированы с сайтом!_`

    await send(chatId, msg, { reply_markup: miniAppKeyboard(chatId) })
  } catch (err) {
    console.error('Vision processing error:', err)
    await send(chatId, `❌ Ошибка при распознавании фото: ${String(err).slice(0, 200)}`)
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
        ? 'Достигнут дневной лимит записи голоса (15 минут). Сброс наступит завтра!'
        : 'Достигнут дневной лимит бесплатных голосовых сообщений (5 в день по 3 мин). Оформите подписку Zerf Premium за 99 руб для безлимита!',
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

    // Send natural voice reply
    const spokenText = createSpokenSummary(items)
    sendVoiceResponse(chatId, spokenText).catch(() => {})
  } catch (err: unknown) {
    await send(chatId, `Ошибка: ${String(err).slice(0, 200)}`)
  }
}

// ── Group & Friend Handlers ──────────────────────────────────────────────────────────

async function handleStart(chatId: number, firstName: string) {
  const regRes = await registerChatId(chatId, firstName)
  const dbUser = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })

  const trialNotice = regRes.isNewUser
    ? `🎁 *Вам начислен 1 день бесплатного пробного периода Zerf Premium!* Протестируйте все возможности без ограничений.\n\n`
    : ``

  const nameNotice = (!dbUser?.lastName || !dbUser?.birthday)
    ? `\n\n👤 *Как тебя зовут и когда твой День рождения?*\nНапиши прямо сейчас в ответ свои *Имя, Фамилию и дату рождения* (например: \`Артём Смирнов 15.04.1995\` или \`Кирилл Перекатнов 03.04\`), чтобы твои задачи были подписаны твоим именем, а друзья автоматически видели твой День рождения в календаре!`
    : ``

  await send(chatId,
    `🎉 *Профиль успешно привязан!*\n\n` +
    trialNotice +
    `Привет, *${escMd(firstName)}*! Теперь твой Telegram-аккаунт на 100% синхронизирован с Zerf AI.\n` +
    `🔒 *Все твои задачи строго конфиденциальны* и сохраняются только в твоем личном списке.` +
    nameNotice +
    `\n\n✨ *Быстрый старт (ИИ-ассистент):*\n` +
    `🎙️ *Голосовой и текстовый ввод* — просто надиктуй или напиши боту:\n` +
    `  • _"Напомни купить молоко в 18:00"_\n` +
    `  • _"Дай задачу Вове подготовить отчет"_\n` +
    `  • _"Добавь цель: Выучить английский до зимы"_\n` +
    `  • _"Запиши идею для стартапа"_\n\n` +
    `⚙️ *Доступные команды:*\n` +
    `/name <Имя Фамилия> — Указать свои имя и фамилию\n` +
    `/today — Твои задачи и цели на сегодня\n` +
    `/inbox — Входящие задачи от других\n` +
    `/shared — Задачи, порученные другим\n` +
    `/p <Название> — Задачи по проекту\n` +
    `/reschedule — Умное ИИ-перепланирование\n` +
    `/stats — Статистика и стрики\n` +
    `/focus [мин] — Таймер Помодоро\n` +
    `/siri — Синхронизация с Siri и Календарем\n` +
    `/settings — Настройки и интервалы\n\n` +
    `Жми кнопки ниже, чтобы открыть приложение или перейти на сайт:`,
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
          ? '❌ Ошибка в группе: Достигнут дневной лимит записи голоса (15 минут). Сброс наступит завтра!'
          : '❌ Ошибка в группе: Достигнут дневной лимит бесплатных голосовых сообщений (5 в день по 3 мин). Оформите подписку Zerf Premium за 99 руб!'
      ).catch(() => {})
      return
    }
  }

  // Send status message — user sees this immediately
  const statusRes = await send(
    groupChatId,
    '⏳ Обрабатываю групповую задачу...',
    { reply_to_message_id: msg.message_id }
  )
  const statusMsgId: number | undefined = statusRes?.result?.message_id

  // ── Phase 2: Processing ─────────────────────────────
  try {
      const key = GROQ_API_KEY || process.env.GROQ_API_KEY || ''
      if (!key) {
        await safeEditOrSend(groupChatId, statusMsgId, '❌ Groq API key не настроен.')
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
          await safeEditOrSend(groupChatId, statusMsgId, `❌ Ошибка в группе: Ошибка при расшифровке голосового: ${String(err).slice(0, 100)}`)
          return
        }
      }

      if (!targetText.trim()) {
        await safeEditOrSend(groupChatId, statusMsgId, '❌ Ошибка в группе: В выбранном сообщении нет текста или речи для создания задачи.')
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
        // In GROUP context: limit to ONE task per /add to prevent duplication
        // (In private chat voice messages, multiple items ARE allowed — see saveAndRespondParsedItems)
        items = [items[0]]
      }

      // 5. Save task ONCE for creator (senderId) with all assignees — NO DUPLICATES!
      let groupMsg = '✅ *Групповая задача создана:*\n\n'
      for (const item of items) {
        item.isShared = true
        item.assignees = allAssignees
        item.type = 'task' // Force task type in group processing (never note!)
        try { 
          await saveParsedItemToDb(item, senderId) 
          const prefix = item.priority === 'urgent' ? '🔴 ' : item.priority === 'high' ? '🟠 ' : item.priority === 'low' ? '🟢 ' : '🟡 '
          groupMsg += `${prefix}*${escMd(item.title)}*\n`
          if (item.dueDate) groupMsg += `📅 Дедлайн: ${item.dueDate}${item.dueTime ? ` ${item.dueTime}` : ''}\n`
          if (item.summary && item.summary !== item.title) groupMsg += `📝 ${escMd(item.summary)}\n`
          groupMsg += `👥 Участников: ${allAssignees.length}\n`
        } catch {}
      }

      await safeEditOrSend(groupChatId, statusMsgId, groupMsg)
    } catch (err: any) {
      console.error('Error in group add processing:', err)
      await safeEditOrSend(groupChatId, statusMsgId, `❌ Ошибка при обработке вашей задачи: ${String(err?.message || err).slice(0, 150)}`)
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

// ── Send Task Command ──────────────────────────────────────────────────────────

async function handleSendCommand(senderChatId: number, senderName: string, targetUsername: string, taskText: string) {
  const cleanUsername = targetUsername.replace('@', '').trim()

  // Find target user
  let targetUser = await prisma.telegramChat.findFirst({
    where: { username: { equals: cleanUsername, mode: 'insensitive' } }
  })
  if (!targetUser && !isNaN(Number(cleanUsername))) {
    targetUser = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(cleanUsername) } })
  }

  if (!targetUser) {
    await send(senderChatId, `🔍 Пользователь *@${cleanUsername}* не найден в Zerf.\nПопроси его запустить бота: @zerph_bot`)
    return
  }

  const targetId = Number(targetUser.chatId)

  // Parse task with AI
  const key = process.env.GROQ_API_KEY || ''
  const items = key ? await parseIntentWithGroq(taskText, key) : []
  const item = items[0] || {
    title: taskText.slice(0, 80),
    summary: taskText,
    priority: 'medium',
    dueDate: new Date().toISOString().slice(0, 10),
    tags: [],
  }

  // Save task to recipient
  const newTask = await prisma.task.create({
    data: {
      title: item.title || taskText.slice(0, 80),
      description: item.summary || taskText,
      priority: item.priority || 'medium',
      status: 'todo',
      dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
      dueTime: item.dueTime || null,
      tags: item.tags || [],
      ownerChatId: BigInt(targetId),
      authorChatId: BigInt(senderChatId),
      assignees: [String(senderChatId)],
      isShared: true,
    } as any
  })

  // Notify recipient
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
  let notifyMsg = `📨 *${escMd(senderName)}* мгновенно передал(а) тебе задачу!\n\n`
  notifyMsg += `📌 *${escMd(item.title || taskText)}*\n`
  if (item.summary && item.summary !== item.title) notifyMsg += `📝 ${escMd(item.summary)}\n`
  if (item.dueDate) notifyMsg += `📅 Срок: ${item.dueDate}${item.dueTime ? ` ${item.dueTime}` : ''}\n`

  await send(targetId, notifyMsg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Принять', callback_data: `delegate_accept_${newTask.id}` },
          { text: '❌ Отклонить', callback_data: `delegate_decline_${newTask.id}` }
        ]
      ]
    }
  })

  await send(senderChatId, `✅ Задача *«${escMd(item.title || taskText)}»* мгновенно отправлена *${escMd(targetUser.firstName || cleanUsername)}*!`)
}

// ── Schedule Command ───────────────────────────────────────────────────────────

async function handleScheduleCommand(chatId: number, targetUsername: string) {
  const cleanUsername = targetUsername.replace('@', '').trim()

  let targetUser = await prisma.telegramChat.findFirst({
    where: { username: { equals: cleanUsername, mode: 'insensitive' } }
  })
  if (!targetUser && !isNaN(Number(cleanUsername))) {
    targetUser = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(cleanUsername) } })
  }

  if (!targetUser) {
    await send(chatId, `🔍 Пользователь *@${cleanUsername}* не найден в Zerf.`)
    return
  }

  const { tasks, goals } = await getPublicItemsByUser(targetUser.chatId)
  const name = escMd(targetUser.firstName || cleanUsername)

  if (tasks.length === 0 && goals.length === 0) {
    await send(chatId, `📅 *Расписание ${name}*\n\nПользователь не поделился ни одной задачей. Попроси его использовать /public!`)
    return
  }

  let msg = `📅 *Публичное расписание ${name}*\n\n`

  if (tasks.length > 0) {
    msg += `📌 *Задачи:*\n`
    tasks.slice(0, 10).forEach((t: any) => {
      const priority = t.priority === 'urgent' ? '🔴' : t.priority === 'high' ? '🟠' : t.priority === 'low' ? '🟢' : '🟡'
      const date = t.dueDate ? ` · ${t.dueDate}` : ''
      const time = t.dueTime ? ` ${t.dueTime}` : ''
      msg += `${priority} ${escMd(t.title)}${date}${time}\n`
    })
  }

  if (goals.length > 0) {
    msg += `\n🎯 *Цели:*\n`
    goals.slice(0, 5).forEach((g: any) => {
      const dl = g.deadline ? ` · ${g.deadline}` : ''
      msg += `• ${escMd(g.title)} — ${g.progress}%${dl}\n`
    })
  }

  msg += `\n_Чтобы договориться о времени — напишите @${cleanUsername} напрямую_`
  await send(chatId, msg)
}

// ── Public/Share Command ───────────────────────────────────────────────────────

async function handlePublicCommand(chatId: number, taskId?: string) {
  if (taskId) {
    // Make specific task public
    const ok = await setItemVisibility(taskId, 'task', 'public')
    if (ok) {
      await send(chatId, `🔓 *Задача открыта!*\n\nТеперь другие могут видеть её через \`/schedule @твой_юзернейм\`\n\nЧтобы скрыть: \`/private ${taskId}\``)
    } else {
      await send(chatId, `❌ Задача не найдена. Укажи корректный ID.`)
    }
  } else {
    // Show last N tasks and ask which to make public
    const tasks = await prisma.task.findMany({
      where: { ownerChatId: BigInt(chatId), status: { not: 'done' } },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
    if (tasks.length === 0) {
      await send(chatId, `📌 У тебя нет активных задач. Создай задачи, затем поделись ими.`)
      return
    }
    let msg = `🔓 *Открыть задачу для всех?*\n\nВыбери задачу, чтобы поделиться ею:\n\n`
    tasks.forEach((t: any, i: number) => msg += `${i + 1}. ${escMd(t.title)} (\`${t.id}\`)\n`)
    msg += `\nИспользуй: \`/public <id>\` чтобы сделать задачу видимой.`
    await send(chatId, msg)
  }
}

// ── Inline Query Handlers ──────────────────────────────────────────────────

async function handleInlineQuery(iq: any) {
  const query = (iq.query || '').trim()
  const fromId = iq.from?.id
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'

  const results: any[] = []

  // 1. If user has active tasks, show them
  if (fromId) {
    try {
      const tasks = await prisma.task.findMany({
        where: {
          ownerChatId: BigInt(fromId),
          status: { not: 'done' },
        },
        orderBy: [{ dueDate: 'asc' }, { dueTime: 'asc' }],
        take: 5,
      })

      if (tasks.length > 0) {
        const taskLines = tasks.map((t) => {
          const time = t.dueTime ? ` ⏰ ${t.dueTime}` : ''
          const p = t.priority === 'urgent' ? '🔴' : t.priority === 'high' ? '🟠' : '▫️'
          return `${p} <b>${escMd(t.title)}</b>${time}`
        }).join('\n')

        results.push({
          type: 'article',
          id: 'user_tasks_today',
          title: `📋 Мои задачи на сегодня (${tasks.length})`,
          description: tasks.map(t => t.title).join(', ').slice(0, 80),
          input_message_content: {
            message_text:
              `✦ <b>МОИ ЗАДАЧИ В ZERF AI:</b>\n\n` +
              `${taskLines}\n\n` +
              `<i>Составлено в <a href="${appUrl}">Zerf AI</a></i>`,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          },
          reply_markup: {
            inline_keyboard: [
              [{ text: '📱 Открыть Zerf App', url: `${appUrl}/tg?chatId=${fromId}` }]
            ]
          }
        })
      }
    } catch {}
  }

  // 2. Share Pomodoro Focus Timer
  results.push({
    type: 'article',
    id: 'focus_pomodoro_share',
    title: '⏳ Таймер фокуса Pomodoro (25 / 5)',
    description: 'Поделиться сессией глубокой концентрации',
    input_message_content: {
      message_text:
        `⏳ <b>ФОКУС-СЕССИЯ ZERF AI (25 МИНУТ)</b>\n\n` +
        `<blockquote>🎯 Режим глубокой концентрации активирован. Время без отвлечений и уведомлений.</blockquote>\n\n` +
        `Присоединяйтесь к совместному фокусу в <a href="${appUrl}">Zerf AI</a>!`,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    },
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Запустить фокус в Zerf App', url: `${appUrl}/tg` }]
      ]
    }
  })

  // 3. If query typed, create a shareable card
  if (query) {
    results.push({
      type: 'article',
      id: `custom_task_${Date.now()}`,
      title: `📌 Создать задачу: «${query.slice(0, 30)}»`,
      description: `Поделиться карточкой «${query}» в этом чате`,
      input_message_content: {
        message_text:
          `📌 <b>ЗАДАЧА:</b> ${query}\n\n` +
          `<i>Создано через быстрый инлайн-режим <a href="${appUrl}">@Zerph_bot</a></i>`,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Добавить себе в Zerf AI', url: `https://t.me/Zerph_bot?start=add_${encodeURIComponent(query.slice(0, 50))}` }]
        ]
      }
    })
  }

  // 4. Share Zerf AI Ecosystem App
  results.push({
    type: 'article',
    id: 'share_zerf_app',
    title: '✦ Zerf AI — Умный ИИ-планировщик',
    description: 'Голосовые задачи, таймеры дедлайнов, Telegram-синхронизация',
    input_message_content: {
      message_text:
        `✦ <b>ZERF AI — ПЕРСОНАЛЬНЫЙ ИИ-АССИСТЕНТ ПРОДУКТИВНОСТИ</b> ✦\n\n` +
        `▪ <b>Голосовые задачи</b> — надиктуйте на бегу, ИИ сам определит дедлайн\n` +
        `▪ <b>Живой обратный отсчет</b> — точные часы до задачи\n` +
        `▪ <b>Дерево проектов</b> — схема связей задач в стиле Google Stitch\n` +
        `▪ <b>Vision AI OCR</b> — распознавание расписания по фото\n\n` +
        `🔗 <b>Попробуйте бесплатно:</b> <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="${appUrl}">${appUrl.replace(/^https?:\/\//, '')}</a>`,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    },
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Запустить Zerf AI Mini App', url: `https://t.me/Zerph_bot/app` }]
      ]
    }
  })

  await tgApi('answerInlineQuery', {
    inline_query_id: iq.id,
    results,
    cache_time: 10,
    is_personal: true,
  }).catch(() => {})
}

async function handleMatrixCommand(chatId: number) {
  const tasks = await prisma.task.findMany({
    where: {
      ownerChatId: BigInt(chatId),
      status: { not: 'done' },
    },
    orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
  })

  const todayStr = new Date().toISOString().slice(0, 10)

  const q1 = tasks.filter(t => t.priority === 'urgent' || (t.priority === 'high' && (!t.dueDate || t.dueDate <= todayStr)))
  const q2 = tasks.filter(t => (t.priority === 'high' && t.dueDate && t.dueDate > todayStr) || (t.priority === 'medium' && (!t.dueDate || t.dueDate > todayStr)))
  const q3 = tasks.filter(t => (t.priority === 'medium' || t.priority === 'low') && t.dueDate && t.dueDate <= todayStr && !q1.includes(t))
  const q4 = tasks.filter(t => !q1.includes(t) && !q2.includes(t) && !q3.includes(t))

  let msg = `✦ *МАТРИЦА ЭЙЗЕНХАУЭРА (ФОКУС ДНЯ)* ✦\n\n`
  
  msg += `🔴 *1. Сделать СЕЙЧАС (Срочно и Важно):* [${q1.length}]\n`
  if (q1.length === 0) msg += `_Нет срочных задач_\n`
  else q1.slice(0, 4).forEach(t => msg += `• *${escMd(t.title)}*${t.dueTime ? ` (${t.dueTime})` : ''}\n`)
  msg += `\n`

  msg += `🟡 *2. Запланировать (Важно, но не срочно):* [${q2.length}]\n`
  if (q2.length === 0) msg += `_Пусто_\n`
  else q2.slice(0, 4).forEach(t => msg += `• ${escMd(t.title)}${t.dueDate ? ` (📅 ${t.dueDate})` : ''}\n`)
  msg += `\n`

  msg += `🔵 *3. Делегировать / Закрыть быстро (Срочно, но не важно):* [${q3.length}]\n`
  if (q3.length === 0) msg += `_Пусто_\n`
  else q3.slice(0, 3).forEach(t => msg += `• ${escMd(t.title)}\n`)
  msg += `\n`

  msg += `⚪️ *4. Убрать лишнее (Не срочно и не важно):* [${q4.length}]\n`
  if (q4.length === 0) msg += `_Пусто_\n`
  else q4.slice(0, 3).forEach(t => msg += `• ${escMd(t.title)}\n`)

  await send(chatId, msg, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📱 Открыть задачи на сайте', web_app: { url: `https://zeprh.vercel.app/tg?chatId=${chatId}` } }]
      ]
    }
  })
}

async function handleCleanupCommand(chatId: number) {
  const cid = BigInt(chatId)
  const openTasks = await prisma.task.findMany({
    where: {
      ownerChatId: cid,
      status: { notIn: ['done', 'draft'] },
    }
  })

  if (openTasks.length === 0) {
    await send(chatId, `🎉 *У вас нет незавершенных задач!* Все дела закрыты. Отличная работа!`)
    return
  }

  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  await send(chatId,
    `🌙 *ВЕЧЕРНИЙ SMART CLEAN-UP*\n\n` +
    `У вас осталось незавершенных задач: *${openTasks.length}*.\n` +
    `Хотите в 1 клик перенести их все на завтра (${tomorrowStr}), чтобы очистить список на сегодня и начать утро со свежим графиком?`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: `🟢 Перенести все ${openTasks.length} задач на завтра`, callback_data: 'postpone_today' }],
          [{ text: '⚡ Умное ИИ-перепланирование', callback_data: 'cmd_reschedule' }]
        ]
      }
    }
  )
}

// ── Main webhook handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()
    ensureBotCommandsRegistered().catch(() => {})

    // Handle Inline Queries (@Zerph_bot ...)
    if (update.inline_query) {
      await handleInlineQuery(update.inline_query)
      return NextResponse.json({ ok: true })
    }

    // Handle Callback Queries (inline buttons)
    if (update.callback_query) {
      const cb = update.callback_query
      const chatId = cb.message.chat.id
      const data = cb.data as string

      if (data === 'cmd_subscribe') {
        await handleSubscribe(chatId)
      } else if (data === 'cmd_matrix') {
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Формирую матрицу...' })
        await handleMatrixCommand(chatId)
      } else if (data === 'cmd_cleanup') {
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Проверяю задачи...' })
        await handleCleanupCommand(chatId)
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
      } else if (data.startsWith('dr_') || data.startsWith('delegate_resolve_')) {
        const raw = data.startsWith('dr_') ? data.slice(3) : data.slice('delegate_resolve_'.length)
        const [draftId, actionOrId] = raw.includes(':') ? raw.split(':') : raw.split('_')

        const draftTask = await prisma.task.findUnique({ where: { id: draftId } })
        if (draftTask && draftTask.rawText) {
          await prisma.task.delete({ where: { id: draftId } }).catch(() => {})
          
          if (actionOrId === 'cancel') {
            await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Отменено' })
            await safeEditOrSend(chatId, cb.message.message_id, `❌ *Отправка отменена.*`)
          } else if (actionOrId === 'self') {
            await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Сохранено у вас' })
            const item = JSON.parse(draftTask.rawText)
            await prisma.task.create({
              data: {
                title: item.title,
                description: item.summary || '',
                priority: item.priority || 'medium',
                status: 'todo',
                dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
                dueTime: item.dueTime || null,
                repeat: item.repeat || null,
                tags: item.tags || [],
                ownerChatId: BigInt(chatId),
                authorChatId: BigInt(chatId),
                isShared: false,
              } as any
            })
            await safeEditOrSend(chatId, cb.message.message_id, `🔒 Задача *«${escMd(item.title)}»* сохранена в твоем личном списке!`)
          } else {
            await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Отправляю...' })
            
            const friendChatId = Number(actionOrId)
            const item = JSON.parse(draftTask.rawText)
            
            const sender = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) } })
            const senderName = sender?.firstName || 'Пользователь'
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
            const friend = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(friendChatId) } })
            
            if (friend) {
              if (item.type === 'delegate' || item.type === 'task') {
                const newTask = await prisma.task.create({
                  data: {
                    title: item.title,
                    description: item.summary || '',
                    priority: item.priority || 'medium',
                    status: 'todo',
                    dueDate: item.dueDate || new Date().toISOString().slice(0, 10),
                    dueTime: item.dueTime || null,
                    repeat: item.repeat || null,
                    tags: item.tags || [],
                    ownerChatId: friend.chatId,
                    authorChatId: BigInt(chatId),
                    assignees: [String(chatId)],
                    isShared: true,
                  } as any
                })
      
                let notifyMsg = `🤝 *${escMd(senderName)}* поручил(а) тебе задачу!\n\n`
                notifyMsg += `📌 *Задача:* ${escMd(item.title)}\n`
                if (item.summary) notifyMsg += `📝 *Описание:* ${escMd(item.summary)}\n`
                if (item.dueTime) notifyMsg += `⏰ *Время:* ${item.dueTime}\n`
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
                await safeEditOrSend(chatId, cb.message.message_id, `🤝 Задача *«${escMd(item.title)}»* успешно отправлена *${escMd(friend.firstName || 'другу')}*!\n\n`)
              } else {
                await saveParsedItemToDb(item, friend.chatId, chatId)
                
                const typeName = item.type === 'note' ? 'заметку' : (item.type === 'goal' ? 'цель' : 'элемент')
                let notifyMsg = `🤝 *${escMd(senderName)}* создал(а) для тебя ${typeName}!\n\n`
                notifyMsg += `📌 *Название:* ${escMd(item.title)}\n`
                if (item.summary) notifyMsg += `📝 *Текст:* ${escMd(item.summary)}\n`
                if (item.dueTime) notifyMsg += `⏰ *Время:* ${item.dueTime}\n`
                notifyMsg += `\n_Сохранено в твоем аккаунте на сайте Zerf AI_`
      
                await send(Number(friend.chatId), notifyMsg, {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '📱 Открыть Zerf App', web_app: { url: `${appUrl}/tg?chatId=${friend.chatId}` } }]
                    ]
                  }
                })
                await safeEditOrSend(chatId, cb.message.message_id, `🤝 ${typeName.charAt(0).toUpperCase() + typeName.slice(1)} *«${escMd(item.title)}»* успешно отправлена *${escMd(friend.firstName || 'другу')}*!\n\n`)
              }
            }
          }
        } else {
          await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Выбор уже сделан или отменён' })
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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
        const icsUrl = `${appUrl}/api/alarm/ics?time=${encodeURIComponent(time)}`
        await send(chatId, `📱 *1-Tap Будильник для iPhone (iOS):*\n\nНажми на кнопку ниже, чтобы мгновенно добавить напоминание с звуковым сигналом в Календарь iPhone на *${time}*!`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: `⏰ Добавить сигнал на iPhone (${time})`, url: icsUrl }]
            ]
          }
        })
      } else if (data.startsWith('rem_done_')) {
        const taskId = data.replace('rem_done_', '')
        const task = await prisma.task.findUnique({ where: { id: taskId } })
        if (task) {
          await prisma.task.update({
            where: { id: taskId },
            data: { status: 'done', completedAt: new Date(), reminderSent: true }
          })
          await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: '✅ Задача выполнена!' })
          await safeEditOrSend(chatId, cb.message.message_id, `✅ *Задача выполнена:* ~${escMd(task.title)}~ 🎉`)
        } else {
          await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Задача не найдена' })
        }
      } else if (data.startsWith('rem_snooze_')) {
        const parts = data.replace('rem_snooze_', '').split('_')
        const taskId = parts[0]
        const mins = parseInt(parts[1] || '15', 10)

        const task = await prisma.task.findUnique({ where: { id: taskId } })
        if (task) {
          const now = new Date()
          const mskTime = new Date(now.getTime() + (3 * 60 + mins) * 60 * 1000)
          const newDueH = String(mskTime.getUTCHours()).padStart(2, '0')
          const newDueM = String(mskTime.getUTCMinutes()).padStart(2, '0')
          const newDueTime = `${newDueH}:${newDueM}`

          await prisma.task.update({
            where: { id: taskId },
            data: {
              dueTime: newDueTime,
              reminderSent: false,
              remindersSentCount: 0
            }
          })
          await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: `⏳ Отложено на ${mins} мин` })
          await safeEditOrSend(chatId, cb.message.message_id, `⏳ *Напоминание отложено на ${mins} мин (до ${newDueTime}):*\n📌 ${escMd(task.title)}`)
        } else {
          await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Задача не найдена' })
        }
      } else if (data.startsWith('st_')) {
        const parts = data.split('_')
        const taskId = parts[1]
        const subIndex = parseInt(parts[2], 10)

        const task = await prisma.task.findUnique({ where: { id: taskId } })
        if (task && Array.isArray(task.subtasks) && task.subtasks[subIndex]) {
          const subtasks = [...(task.subtasks as any[])]
          subtasks[subIndex].done = !subtasks[subIndex].done
          const allDone = subtasks.every(s => s.done)

          await prisma.task.update({
            where: { id: taskId },
            data: {
              subtasks,
              ...(allDone ? { status: 'done', completedAt: new Date(), reminderSent: true } : {})
            }
          })

          if (allDone && task.ownerChatId) {
            const { recordTaskCompletionStreak } = await import('@/lib/backend/db')
            recordTaskCompletionStreak(task.ownerChatId).then(res => {
              if (res.earnedReward) {
                send(chatId, `🏆 *Потрясающе! Ваш стрик продуктивности достиг ${res.streakDays} дней!* 🔥\nВам начислен подарок: *+1 день бесплатного тарифа Premium*!`)
              }
            }).catch(() => {})
          }

          await tgApi('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: subtasks[subIndex].done ? '☑️ Пункт выполнен!' : '◻️ Пункт возвращен'
          })

          // Build updated subtasks keyboard
          const newInlineKeyboard = subtasks.map((st, i) => ([
            {
              text: `${st.done ? '☑️' : '◻️'} ${i + 1}. ${st.title.slice(0, 35)}`,
              callback_data: `st_${taskId}_${i}`
            }
          ]))
          newInlineKeyboard.push([
            { text: allDone ? '🎉 Все пункты выполнены!' : '✅ Завершить задачу целиком', callback_data: `rem_done_${taskId}` }
          ])

          const doneCount = subtasks.filter(s => s.done).length
          const updatedMsgText = `📌 *Задача:* ${escMd(task.title)}\n` +
            `📊 *Прогресс:* ${doneCount} из ${subtasks.length} выполнено\n\n` +
            (allDone ? `🎉 *Все подзадачи закрыты!* Задача выполнена.` : `_Нажмите на пункт, чтобы отметить выполнение:_`)

          await safeEditOrSend(chatId, cb.message.message_id, updatedMsgText, {
            reply_markup: { inline_keyboard: newInlineKeyboard }
          })
        }
      } else if (data === 'toggle_tts') {
        const u = await prisma.telegramChat.findUnique({ where: { chatId: BigInt(chatId) }, select: { ttsEnabled: true } })
        const nextTts = !(u?.ttsEnabled ?? true)
        await prisma.telegramChat.update({
          where: { chatId: BigInt(chatId) },
          data: { ttsEnabled: nextTts }
        })
        await tgApi('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: nextTts ? '🎙️ Голосовые ответы включены' : '🔇 Голосовые ответы отключены'
        })
        await handleSettings(chatId)
      } else if (data === 'open_calendar_sync') {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
        const webcalUrl = `${appUrl.replace(/^https?:\/\//, 'webcal://')}/api/alarm/ics?chatId=${chatId}`
        const httpsUrl = `${appUrl}/api/alarm/ics?chatId=${chatId}`

        await send(chatId,
          `📅 *Синхронизация с Apple и Google Календарём*\n\n` +
          `Все ваши задачи со временем из Zerf AI будут автоматически появляться в системном календаре на телефоне или компьютере!\n\n` +
          `🔗 *Ваша персональная ссылка подписки:*\n\`${httpsUrl}\`\n\n` +
          `📱 *Для iPhone / Mac:* Нажмите кнопку «Подключить Apple Календарь» ниже.\n` +
          `💻 *Для Google Calendar:* Откройте Google Календарь на компьютере ➔ «Другие календари» (+) ➔ «С помощью URL» ➔ вставьте ссылку выше.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🍏 Подключить к Apple Календарю (1-клик)', url: webcalUrl }],
                [{ text: '🌐 Открыть веб-сайт', url: `${appUrl}/?chatId=${chatId}` }]
              ]
            }
          }
        )
      } else if (data === 'postpone_today') {
        const cid = BigInt(chatId)
        const now = new Date()
        const tomorrow = new Date(now.getTime() + (24 + 3) * 60 * 60 * 1000)
        const tomorrowStr = tomorrow.toISOString().slice(0, 10)

        const updated = await prisma.task.updateMany({
          where: {
            ownerChatId: cid,
            status: { notIn: ['done', 'draft'] },
          },
          data: {
            dueDate: tomorrowStr,
            reminderSent: false,
            remindersSentCount: 0
          }
        })
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: `✅ Перенесено на завтра!` })
        await safeEditOrSend(chatId, cb.message.message_id, `📅 *Все незавершенные задачи (${updated.count}) успешно перенесены на завтра (${tomorrowStr})!* Отдыхай 🌙`)
      } else if (data.startsWith('apply_resch_')) {
        const draftId = data.replace('apply_resch_', '')
        const draft = await prisma.task.findUnique({ where: { id: draftId } })
        if (draft && draft.rawText) {
          await prisma.task.delete({ where: { id: draftId } }).catch(() => {})
          const plan: any[] = JSON.parse(draft.rawText)
          const now = new Date()
          const todayStr = now.toISOString().slice(0, 10)
          const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

          for (const item of plan) {
            await prisma.task.update({
              where: { id: item.id },
              data: {
                dueTime: item.newTime,
                dueDate: item.isTomorrow ? tomorrowStr : todayStr,
                reminderSent: false,
                remindersSentCount: 0
              }
            }).catch(() => {})
          }
          await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: '⚡ Расписание обновлено!' })
          await safeEditOrSend(chatId, cb.message.message_id, `⚡ *Расписание успешно применено!* Все задачи (${plan.length}) перенесены на новые временные слоты. Продуктивной работы! 🚀`)
        } else {
          await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'План уже применен или устарел' })
        }
      } else if (data.startsWith('cancel_resch_')) {
        const draftId = data.replace('cancel_resch_', '')
        await prisma.task.delete({ where: { id: draftId } }).catch(() => {})
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Отменено' })
        await safeEditOrSend(chatId, cb.message.message_id, `❌ *Перепланирование отменено.*`)
      } else if (data === 'stop_focus') {
        stopFocusSession(chatId)
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Фокус остановлен' })
        await safeEditOrSend(chatId, cb.message.message_id, `⏹️ *Фокус-сессия завершена досрочно.*`)
      } else if (data === 'start_break_5') {
        startFocusSession(chatId, 5, 'Перерыв на отдых')
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Отдых запущен (5 мин)' })
        await safeEditOrSend(chatId, cb.message.message_id, `☕ *5-минутный перерыв запущен!*\nОтвлекитесь от экрана, выпейте воды или сделайте легкую разминку. Бот уведомит об окончании.`)
      } else if (data === 'start_focus_25') {
        startFocusSession(chatId, 25)
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Фокус запущен (25 мин)' })
        await safeEditOrSend(chatId, cb.message.message_id, `🔥 *Новая 25-минутная фокус-сессия запущена!*\nСосредоточьтесь на главной задаче.`)
      } else if (data === 'open_siri_guide') {
        await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Открываю инструкцию' })
        await handleSiriSetup(chatId)
      }

      await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'Успешно' }).catch(() => {})
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
    const photo = msg.photo

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

      // Save user comment from channel discussion group for AI sentiment & feature analysis
      if (text && !text.startsWith('/')) {
        import('@/lib/backend/comment-analyzer').then(({ recordChannelComment }) => {
          const channelPostId = msg.reply_to_message?.forward_from_message_id || msg.reply_to_message?.message_id
          recordChannelComment({
            channelPostId,
            chatId: senderId,
            userName: [firstName, lastName].filter(Boolean).join(' ') || username || 'Подписчик',
            text,
          }).catch(() => {})
        }).catch(() => {})
      }
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
      } else if (cmd === '/inbox') {
        await handleInbox(chatId)
      } else if (cmd === '/shared' || cmd === '/delegated') {
        await handleShared(chatId)
      } else if (cmd === '/p' || cmd === '/project') {
        await handleProjectFilter(chatId, parts.slice(1).join(' '))
      } else if (cmd === '/stats') {
        await handleStats(chatId)
      } else if (cmd === '/reschedule') {
        await handleReschedule(chatId)
      } else if (cmd === '/focus' || cmd === '/pomodoro') {
        await handleFocus(chatId, parts[1])
      } else if (cmd === '/siri' || cmd === '/phone' || cmd === '/shortcuts') {
        await handleSiriSetup(chatId)
      } else if (cmd === '/goals') {
        await handleGoals(chatId)
      } else if (cmd === '/notes') {
        await handleNotes(chatId)
      } else if (cmd === '/report') {
        await handleWeeklyReport(chatId, senderId)
      } else if (cmd === '/premium' || cmd === '/subscribe' || cmd === '/buy') {
        await handleSubscribe(chatId)
      } else if (cmd === '/matrix' || cmd === '/eisenhower') {
        await handleMatrixCommand(chatId)
      } else if (cmd === '/cleanup') {
        await handleCleanupCommand(chatId)
      } else if (cmd === '/report') {
        await handleWeeklyReport(senderId, chatId)
      } else if (cmd === '/birthday' || cmd === '/bday') {
        const dateArg = parts.slice(1).join(' ').trim()
        if (!dateArg) {
          await send(chatId, `🎂 *Установка Дня рождения*\n\nИспользование: \`/birthday ДД.ММ.ГГГГ\` (или \`/birthday ДД.ММ\`)\n\nПример: \`/birthday 03.04.2010\``)
        } else {
          const { parseBirthday, broadcastMyBirthdayToFriends } = await import('@/lib/backend/db')
          const parsed = parseBirthday(dateArg)
          if (parsed) {
            await prisma.telegramChat.upsert({
              where: { chatId: BigInt(chatId) },
              update: { birthday: parsed.iso },
              create: { chatId: BigInt(chatId), birthday: parsed.iso },
            })
            await broadcastMyBirthdayToFriends(chatId)
            await send(chatId, `🎉 *Твой День рождения (${String(parsed.day).padStart(2, '0')}.${String(parsed.month).padStart(2, '0')}${parsed.year ? `.${parsed.year}` : ''}) успешно сохранен!*\nДрузья увидят напоминание в календаре Zerf AI.`)
          } else {
            await send(chatId, `⚠️ Не удалось распознать дату. Попробуй в формате \`ДД.ММ.ГГГГ\` (например \`03.04.2010\`).`)
          }
        }
      } else if (cmd === '/name' || cmd === '/setname') {
        const rawInput = parts.slice(1).join(' ').trim()
        if (!rawInput) {
          await send(chatId, `👤 *Смена имени и даты рождения*\n\nИспользование: \`/name Ваше Имя Фамилия [ДД.ММ.ГГГГ]\`\n\nПример: \`/name Кирилл Перекатнов 03.04.2010\``)
        } else {
          const { parseBirthday, broadcastMyBirthdayToFriends } = await import('@/lib/backend/db')
          const dateMatch = rawInput.match(/\b(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\b/)
          const parsedBday = dateMatch ? parseBirthday(dateMatch[1]) : null
          const cleanName = rawInput.replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, '').trim()

          const nameParts = cleanName.split(/\s+/).filter(Boolean)
          const first = nameParts[0] || firstName
          const last = nameParts.slice(1).join(' ') || null

          const updateData: any = { firstName: first, lastName: last }
          if (parsedBday) updateData.birthday = parsedBday.iso

          await prisma.telegramChat.upsert({
            where: { chatId: BigInt(chatId) },
            update: updateData,
            create: { chatId: BigInt(chatId), ...updateData },
          })

          if (parsedBday) {
            await broadcastMyBirthdayToFriends(chatId)
          }

          let respText = `✅ *Ваш профиль успешно обновлен!*\n• *Имя:* ${first}${last ? ' ' + last : ''}`
          if (parsedBday) {
            respText += `\n• *День рождения:* ${String(parsedBday.day).padStart(2, '0')}.${String(parsedBday.month).padStart(2, '0')}${parsedBday.year ? `.${parsedBday.year}` : ''} 🎉`
          }
          await send(chatId, respText)
        }
      } else if (cmd === '/admin') {
        await handleAdminCommand(chatId, parts.slice(1))
      } else if (cmd === '/send') {
        // /send @username текст задачи
        const target = parts[1] // @username or chatId
        const taskText = parts.slice(2).join(' ')
        if (!target || !taskText) {
          await send(chatId, `📨 *Мгновенная передача задачи*\n\nИспользование: \`/send @username текст задачи\`\n\nПример: \`/send @vasya купить молоко до 18:00\``)
        } else {
          await handleSendCommand(chatId, firstName, target, taskText)
        }
      } else if (cmd === '/schedule') {
        // /schedule @username — показать публичное расписание
        const target = parts[1]
        if (!target) {
          await send(chatId, `📅 *Просмотр расписания*\n\nИспользование: \`/schedule @username\`\n\nПоказывает задачи, которыми пользователь поделился публично.`)
        } else {
          await handleScheduleCommand(chatId, target)
        }
      } else if (cmd === '/public' || cmd === '/share') {
        // /public — поделиться последней задачей / /public taskId
        const targetId = parts[1]
        await handlePublicCommand(chatId, targetId)
      } else if (cmd === '/private') {
        const targetId = parts[1]
        if (!targetId) {
          await send(chatId, `🔒 Укажи ID задачи: \`/private <taskId>\``)
        } else {
          const ok = await setItemVisibility(targetId, 'task', 'private')
          await send(chatId, ok ? `🔒 Задача скрыта от других пользователей.` : `❌ Задача не найдена.`)
        }
      } else if (cmd === '/link') {
        // /link taskId noteId
        const taskId = parts[1], noteId = parts[2]
        if (!taskId || !noteId) {
          await send(chatId, `📎 *Привязка заметки к задаче*\n\nИспользование: \`/link <taskId> <noteId>\``)
        } else {
          const ok = await linkNoteToTask(taskId, noteId)
          await send(chatId, ok ? `✅ Заметка привязана к задаче! При следующем напоминании она будет показана.` : `❌ Задача или заметка не найдена.`)
        }
      } else if (!isGroup) {
        await send(chatId, 'Попробуй /settings, /today, /invite, /report, /buy или /help')
      }

    } else if (!isGroup) {
      if (photo && photo.length > 0) {
        await processPhoto(chatId, photo)
      } else if (voice) {
        await processVoice(chatId, voice.file_id, voice.duration || 15)
      } else if (text.trim()) {
        const trimmed = text.trim()
        const lowerText = trimmed.toLowerCase()

        // 1. Reply to bot message deletion or smart delete ("удали эту заметку", "удали", "удалить", "удали задачу", "удаляй")
        const isDeleteVerb = /^(?:удали|удалить|удаляй|удали это|удали эту|удали заметку|удали эту заметку|удали задачу|удали эту задачу|стереть|delete|remove)\b/i.test(lowerText)
        const isStrictDeleteAll = /\b(?:все|всё|весь список|полностью все|все задачи|все заметки)\b/i.test(lowerText)

        if (isDeleteVerb && !isStrictDeleteAll) {
          // If replying to a bot message
          if (msg.reply_to_message?.text) {
            const replyText = msg.reply_to_message.text
            const titleMatch = replyText.match(/(?:Заметка|Задача|Цель)\s+(?:создана|изменена|обновлена)?:\s*([^\n]+)/i) ||
                               replyText.match(/(?:📌|📝|🎯|🎂)\s*(?:Задача|Заметка|Цель)?:\s*([^\n]+)/i)
            const extractedTitle = titleMatch ? titleMatch[1].trim() : ''

            if (extractedTitle) {
              const deletedNote = await prisma.note.findFirst({
                where: { ownerChatId: BigInt(chatId), title: { contains: extractedTitle, mode: 'insensitive' } }
              })
              const deletedTask = await prisma.task.findFirst({
                where: { ownerChatId: BigInt(chatId), title: { contains: extractedTitle, mode: 'insensitive' } }
              })

              if (deletedNote) {
                await prisma.note.delete({ where: { id: deletedNote.id } })
                await send(chatId, `🗑 Заметка *«${escMd(deletedNote.title)}»* успешно удалена!`, { reply_markup: miniAppKeyboard(chatId) })
                return NextResponse.json({ ok: true })
              } else if (deletedTask) {
                await prisma.task.delete({ where: { id: deletedTask.id } })
                await send(chatId, `🗑 Задача *«${escMd(deletedTask.title)}»* успешно удалена!`, { reply_markup: miniAppKeyboard(chatId) })
                return NextResponse.json({ ok: true })
              }
            }
          }

          // If no reply or title match: delete the MOST RECENT note or task
          const lastNote = await prisma.note.findFirst({
            where: { ownerChatId: BigInt(chatId) },
            orderBy: { createdAt: 'desc' }
          })
          const lastTask = await prisma.task.findFirst({
            where: { ownerChatId: BigInt(chatId) },
            orderBy: { createdAt: 'desc' }
          })

          if (lowerText.includes('заметк') && lastNote) {
            await prisma.note.delete({ where: { id: lastNote.id } })
            await send(chatId, `🗑 Заметка *«${escMd(lastNote.title)}»* успешно удалена!`, { reply_markup: miniAppKeyboard(chatId) })
            return NextResponse.json({ ok: true })
          } else if (lowerText.includes('задач') && lastTask) {
            await prisma.task.delete({ where: { id: lastTask.id } })
            await send(chatId, `🗑 Задача *«${escMd(lastTask.title)}»* успешно удалена!`, { reply_markup: miniAppKeyboard(chatId) })
            return NextResponse.json({ ok: true })
          } else if (lastNote && (!lastTask || lastNote.createdAt > lastTask.createdAt)) {
            await prisma.note.delete({ where: { id: lastNote.id } })
            await send(chatId, `🗑 Последняя заметка *«${escMd(lastNote.title)}»* успешно удалена!`, { reply_markup: miniAppKeyboard(chatId) })
            return NextResponse.json({ ok: true })
          } else if (lastTask) {
            await prisma.task.delete({ where: { id: lastTask.id } })
            await send(chatId, `🗑 Последняя задача *«${escMd(lastTask.title)}»* успешно удалена!`, { reply_markup: miniAppKeyboard(chatId) })
            return NextResponse.json({ ok: true })
          }
        }

        // 2. Name + Birthday setting detection (e.g. "Артём Смирнов 15.04.1995" or "Меня зовут Кирилл Перекатнов 03.04.2010" or "03.04.2010")
        const { parseBirthday, broadcastMyBirthdayToFriends } = await import('@/lib/backend/db')
        const rawDateMatch = trimmed.match(/\b(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\b/)
        const parsedBday = rawDateMatch ? parseBirthday(rawDateMatch[1]) : null

        const textWithoutDate = trimmed.replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, '').replace(/,/g, '').trim()
        const namePrefixMatch = textWithoutDate.match(/^(?:меня зовут|я|мое имя|моё имя|др|мой др)\s+([А-ЯЁа-яёA-Za-z]+)(?:\s+([А-ЯЁа-яёA-Za-z]+))?$/i)
        const twoCapitalWordsMatch = textWithoutDate.match(/^([А-ЯЁ][а-яё]{1,20})\s+([А-ЯЁ][а-яё]{1,20})$/)
        const isNotTaskVerb = twoCapitalWordsMatch && !/^(Купить|Сделать|Позвонить|Написать|Пойти|Сходить|Напомни|Создай|Удали|Открой|Покажи|Принять|Перенести|Поставить|Записать|Найти|Отправить|Поручить)/i.test(twoCapitalWordsMatch[1])

        if ((namePrefixMatch || isNotTaskVerb) && (textWithoutDate.length > 0 || parsedBday)) {
          const fn = namePrefixMatch ? namePrefixMatch[1] : (twoCapitalWordsMatch ? twoCapitalWordsMatch[1] : firstName)
          const ln = namePrefixMatch ? (namePrefixMatch[2] || null) : (twoCapitalWordsMatch ? twoCapitalWordsMatch[2] : null)

          const updateData: any = { firstName: fn }
          if (ln) updateData.lastName = ln
          if (parsedBday) updateData.birthday = parsedBday.iso

          await prisma.telegramChat.upsert({
            where: { chatId: BigInt(chatId) },
            update: updateData,
            create: { chatId: BigInt(chatId), ...updateData },
          })

          if (parsedBday) {
            await broadcastMyBirthdayToFriends(chatId)
          }

          let resp = `✅ Приятно познакомиться, *${escMd(fn)}${ln ? ' ' + escMd(ln) : ''}*!\n\nТвои данные успешно сохранены в Zerf AI.`
          if (parsedBday) {
            resp += `\n🎂 *День рождения:* ${String(parsedBday.day).padStart(2, '0')}.${String(parsedBday.month).padStart(2, '0')}${parsedBday.year ? `.${parsedBday.year}` : ''} (друзья автоматически увидят напоминание в календаре!).`
          }
          await send(chatId, resp, { reply_markup: miniAppKeyboard(chatId) })
        } else if (parsedBday && textWithoutDate.length === 0) {
          // Just a birthday entered: e.g. "03.04.2010"
          await prisma.telegramChat.upsert({
            where: { chatId: BigInt(chatId) },
            update: { birthday: parsedBday.iso },
            create: { chatId: BigInt(chatId), birthday: parsedBday.iso },
          })
          await broadcastMyBirthdayToFriends(chatId)
          await send(chatId, `🎂 *День рождения (${String(parsedBday.day).padStart(2, '0')}.${String(parsedBday.month).padStart(2, '0')}${parsedBday.year ? `.${parsedBday.year}` : ''}) успешно сохранен!*\nТвои друзья автоматически увидят напоминание в календаре Zerf AI. 🎉`, {
            reply_markup: miniAppKeyboard(chatId)
          })
        } else {
          await processText(chatId, text)
        }
      }
    // In groups: respond to @mention or reply to bot message
    } else if (isGroup) {
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'Zerph_bot'
      const isMentioned = text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)
      const isReplyToBot = msg.reply_to_message?.from?.is_bot === true
      if (isMentioned || isReplyToBot) {
        const cleanText = text.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim()
        if (photo && photo.length > 0) {
          await processPhoto(senderId, photo)
        } else if (voice) {
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
