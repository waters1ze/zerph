/**
 * Zerf Telegram Bot — Long-Polling Server
 * Run: npx tsx server/bot.ts
 *
 * Features:
 *  /start  /help  /today  /goals  /notes
 *  Voice/audio → Groq Whisper → task/goal/note/completion
 *  Text messages → AI intent parsing
 *  ⏰ Timed reminders — checks every minute, sends TG notification when dueTime hits
 */

import path from 'path'
// Load .env.local manually (tsx doesn't auto-load it)
import { config } from 'dotenv'
config({ path: path.resolve(process.cwd(), '.env.local') })

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const GROQ_KEY = process.env.GROQ_API_KEY || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const MINIAPP_URL = `${APP_URL}/tg`

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN missing in .env.local')
  process.exit(1)
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function tg(method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error(`❌ tg.${method}:`, await res.text())
  return res
}

function md(text: string) {
  // Escape Markdown v1 special chars
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
}

async function send(chatId: number, text: string, extra?: object) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
}

async function sendAction(chatId: number, action = 'typing') {
  return tg('sendChatAction', { chat_id: chatId, action })
}

import {
  registerChatId as dbRegisterChatId,
  getAllTasks,
  getAllGoals,
  getAllNotes,
} from '@/lib/backend/db'
import { getAdminSecret } from '@/lib/backend/auth'

// ── Commands ──────────────────────────────────────────────────────────────────

const MINIAPP_KB = { inline_keyboard: [[{ text: '📱 Open Zerf App', web_app: { url: MINIAPP_URL } }]] }
const P_EMOJI: Record<string, string> = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }
const G_EMOJI: Record<string, string> = { on_track: '✅', at_risk: '⚠️', delayed: '❌', completed: '🏆' }

async function cmdStart(chatId: number, firstName: string, username?: string, lastName?: string) {
  await dbRegisterChatId(chatId, firstName, username, lastName).catch(() => {})
  await send(chatId,
    `👋 Привет, ${firstName}!\n\n` +
    `Я *Zerf AI* — твой личный помощник по задачам и целям.\n\n` +
    `📩 Отправь мне:\n` +
    `• 🎙 *Голосовое сообщение* — создам задачу, цель или заметку\n` +
    `• ✍️ *Текст* — разберу и сохраню\n` +
    `• «Задача X выполнена» — отмечу как готово ✔️\n\n` +
    `⏰ Можно указать время: _«Задача в 14:00»_ — пришлю напоминание!\n\n` +
    `*Команды:*\n/today — задачи на сегодня\n/goals — цели\n/notes — заметки\n/help — помощь`,
    { reply_markup: MINIAPP_KB }
  )
}

async function cmdToday(chatId: number) {
  const allTasks = await getAllTasks(chatId)
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const now = new Date()
  const parts = formatter.formatToParts(now)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
  const today = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
  const dayName = now.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', weekday: 'long', day: 'numeric', month: 'long' })

  const pending = allTasks.filter((t: { dueDate?: string | null; status: string }) =>
    t.status !== 'done' && (t.dueDate === today || !t.dueDate)
  )
  const done = allTasks.filter((t: { status: string }) => t.status === 'done')

  let msg = `📅 *${dayName}*\n\n`
  if (pending.length === 0) {
    msg += '✅ Всё готово на сегодня! Отличная работа 🎉\n'
  } else {
    msg += `*${pending.length} задач${pending.length === 1 ? 'а' : pending.length < 5 ? 'и' : ''} осталось:*\n`
    pending.slice(0, 12).forEach((t: { priority: string; title: string; dueTime?: string | null }) => {
      const time = t.dueTime ? ` _(${t.dueTime})_` : ''
      msg += `${P_EMOJI[t.priority] || '⚪'} ${t.title}${time}\n`
    })
    if (pending.length > 12) msg += `_...и ещё ${pending.length - 12}_\n`
  }
  if (done.length > 0) msg += `\n✔️ *Выполнено: ${done.length}*`

  await send(chatId, msg, { reply_markup: MINIAPP_KB })
}

async function cmdGoals(chatId: number) {
  const goals = await getAllGoals(chatId)
  let msg = `🎯 *Твои цели*\n\n`
  if (goals.length === 0) {
    msg += 'Нет целей. Отправь голосовое — создам!'
  } else {
    goals.slice(0, 8).forEach((g: { status: string; title: string; progress: number; deadline?: string | null }) => {
      const dl = g.deadline ? ` · ${g.deadline}` : ''
      msg += `${G_EMOJI[g.status] || '📌'} *${g.title}* — ${g.progress}%${dl}\n`
    })
  }
  await send(chatId, msg, { reply_markup: MINIAPP_KB })
}

async function cmdNotes(chatId: number) {
  const notes = await getAllNotes(chatId)
  let msg = `📌 *Последние заметки*\n\n`
  const ICON: Record<string, string> = { note: '📌', journal: '📓', meeting: '🤝' }
  if (notes.length === 0) {
    msg += 'Нет заметок.'
  } else {
    notes.slice(0, 6).forEach((n: { title: string; type: string; createdAt: Date | string }) => {
      const date = new Date(n.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
      msg += `${ICON[n.type] || '📌'} *${n.title}* _${date}_\n`
    })
  }
  await send(chatId, msg)
}

// ── AI processing (voice or text) ────────────────────────────────────────────

async function processWithAI(chatId: number, text?: string, voiceFileId?: string) {
  await sendAction(chatId)

  try {
    let transcript = text || ''
    const adminSecret = getAdminSecret() || process.env.ADMIN_SECRET || ''

    // Download voice from Telegram, send to /api/voice
    if (voiceFileId) {
      await send(chatId, '🎙 Обрабатываю голосовое сообщение…')

      // Get file path from Telegram
      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${voiceFileId}`)
      const fileData = await fileRes.json()
      const filePath = fileData.result?.file_path

      if (!filePath) throw new Error('Не удалось получить голосовой файл')

      // Download audio
      const audioRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`)
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
      const ext = filePath.split('.').pop() || 'ogg'

      // Send to /api/voice
      const fd = new FormData()
      fd.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), `voice.${ext}`)

      const res = await fetch(`${APP_URL}/api/voice`, {
        method: 'POST',
        headers: {
          'x-admin-secret': adminSecret,
          'x-chat-id': String(chatId),
        },
        body: fd,
      })
      const data = await res.json()

      if (!res.ok || data.error) throw new Error(data.error)

      return await sendAIResult(chatId, data)
    }

    if (!transcript.trim()) return

    // Text message → send as text to /api/voice (text-only mode)
    const fd = new FormData()
    fd.append('text', transcript)
    const res = await fetch(`${APP_URL}/api/voice`, {
      method: 'POST',
      headers: {
        'x-admin-secret': adminSecret,
        'x-chat-id': String(chatId),
      },
      body: fd,
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error)
    await sendAIResult(chatId, data)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ AI error:', msg)
    await send(chatId, `❌ Ошибка: ${msg.slice(0, 200)}`)
  }
}

async function sendAIResult(chatId: number, data: {
  item?: { type: string; title: string; summary?: string; priority?: string; dueDate?: string; dueTime?: string; targetTitle?: string } | null
  items?: Array<{ type: string; title: string; summary?: string; priority?: string; dueDate?: string; dueTime?: string; targetTitle?: string }>
  completedTask?: { title: string } | null
  transcript?: string
}) {
  const itemsToRender = Array.isArray(data.items) && data.items.length > 0
    ? data.items
    : data.item
      ? [data.item]
      : []

  if (itemsToRender.length === 0) {
    if (data.transcript) {
      await send(chatId, `📝 Записано: «${data.transcript}»\n\n_Сохранено в Zerf_`, { reply_markup: MINIAPP_KB })
    }
    return
  }

  const TYPE_RU: Record<string, string> = {
    task: 'Задача', goal: 'Цель', note: 'Заметка',
    project: 'Проект', reminder: 'Напоминание', completion: 'Выполнено',
    habit: 'Привычка', delegate: 'Поручение',
  }

  for (const item of itemsToRender) {
    if (!item) continue

    if (item.type === 'completion') {
      if (data.completedTask) {
        await send(chatId,
          `✅ *Задача отмечена как выполненная!*\n\n~~${data.completedTask.title}~~\n\n_Синхронизировано с Zerf_`,
          { reply_markup: MINIAPP_KB }
        )
      } else {
        await send(chatId,
          `🔍 Задача *«${item.targetTitle || item.title}»* не найдена.\n\nПроверь список задач в приложении.`,
          { reply_markup: MINIAPP_KB }
        )
      }
      continue
    }

    const typeLabel = TYPE_RU[item.type] || item.type || 'Запись'
    const pEmoji = P_EMOJI[item.priority || 'medium'] || '⚪'
    let msg = `${typeLabel} создана ✨\n\n`
    msg += `*${item.title}*\n`
    if (item.summary && item.type !== 'note' && item.summary !== item.title) msg += `\n${item.summary.slice(0, 200)}\n`
    if (item.priority) msg += `\n${pEmoji} Приоритет: ${item.priority}`
    if (item.dueDate) msg += `\n📅 Срок: ${item.dueDate}`
    if (item.dueTime) msg += `\n⏰ Время: *${item.dueTime}* — пришлю напоминание!`
    if (data.transcript && item.type === 'note') msg += `\n\n_🎙 Оригинал записан_`
    msg += `\n\n_Сохранено в Zerf_`

    await send(chatId, msg, { reply_markup: MINIAPP_KB })
  }
}

// ── Reminder scheduler — runs every 60 seconds ────────────────────────────────

function startReminderScheduler() {
  console.log('⏰ Centralized Cron & Reminder scheduler started')
  // Run every 20 seconds using the deduplicated cron runner
  setInterval(async () => {
    try {
      const { runAllCronTasks } = await import('@/lib/backend/cron-runner')
      await runAllCronTasks()
    } catch (err) {
      console.error('⚠️ Reminder scheduler error:', err)
    }
  }, 20 * 1000)
}

// ── Main polling loop ─────────────────────────────────────────────────────────

let offset = 0

async function poll() {
  while (true) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30&allowed_updates=["message"]`
      )
      if (!res.ok) { await sleep(3000); continue }

      const { result: updates = [] } = await res.json()

      for (const upd of updates) {
        offset = upd.update_id + 1
        const msg = upd.message
        if (!msg) continue

        const chatId: number = msg.chat.id
        const firstName: string = msg.from?.first_name || 'Friend'
        const text: string = msg.text || ''
        const voice = msg.voice || msg.audio

        console.log(`📨 ${firstName} (${chatId}): ${text || (voice ? '[voice]' : '[other]')}`)

        // Register chat for reminders
        dbRegisterChatId(chatId, firstName, msg.from?.username, msg.from?.last_name).catch(() => {})

        // Commands
        if (text.startsWith('/')) {
          const cmd = text.split(' ')[0].toLowerCase()
          if (cmd === '/start' || cmd === '/help') await cmdStart(chatId, firstName, msg.from?.username, msg.from?.last_name)
          else if (cmd === '/today') await cmdToday(chatId)
          else if (cmd === '/goals') await cmdGoals(chatId)
          else if (cmd === '/notes') await cmdNotes(chatId)
          else await send(chatId, 'Неизвестная команда. Попробуй /help')
          continue
        }

        // Voice/audio
        if (voice) {
          await processWithAI(chatId, undefined, voice.file_id)
          continue
        }

        // Text messages — process with AI
        if (text.trim()) {
          await processWithAI(chatId, text)
        }
      }
    } catch (err) {
      console.error('⚠️ Poll error:', err)
      await sleep(3000)
    }
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

console.log('🚀 Zerf Bot started')
console.log(`🔗 App: ${APP_URL}`)
console.log(`📱 Mini App: ${MINIAPP_URL}`)

startReminderScheduler()
poll()
