/**
 * Zerf Backend — Telegram Bot Engine (Full Russian, /start fix, sticker-style buttons)
 */

import { transcribeAudioWithGroq, parseIntentWithGroq, ParsedItem } from './groq'
import { saveParsedItemToDb, registerChatId } from './db'
import { GROQ_API_KEYS } from '@/lib/config'

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
      language_code?: string
    }
    chat: { id: number }
    date: number
    text?: string
    voice?: { file_id: string; duration: number; file_size?: number }
    audio?: { file_id: string; duration: number }
  }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://zerph.up.railway.app'

/**
 * Send a Markdown message to a Telegram chat
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  extra?: object
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...extra,
    }),
  })
}

/**
 * Download a voice file from Telegram servers
 */
export async function downloadTelegramFile(
  botToken: string,
  fileId: string
): Promise<Buffer> {
  const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`)
  if (!fileRes.ok) throw new Error('Не удалось получить путь к файлу Telegram')
  const fileData = await fileRes.json()
  const filePath = fileData.result?.file_path
  if (!filePath) throw new Error('Путь к файлу Telegram не найден')

  const audioRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`)
  if (!audioRes.ok) throw new Error('Не удалось скачать голосовой файл')

  return Buffer.from(await audioRes.arrayBuffer())
}

/**
 * /start handler — register user and send welcome in Russian
 */
async function handleStart(
  botToken: string,
  chatId: number,
  firstName: string
): Promise<void> {
  // Register user in DB
  try {
    await registerChatId(chatId, firstName)
  } catch { /* ignore if already registered */ }

  const welcomeText =
    `🎉 *Профиль успешно привязан!*\n\n` +
    `Привет, *${firstName}*! Теперь твой Telegram-аккаунт на 100% синхронизирован с Zerf AI.\n\n` +
    `✨ *Твои возможности:*\n` +
    `1️⃣ *Голосовой ввод* 🎙 — надиктуй задачу, цель или заметку сюда в чат.\n` +
    `2️⃣ *Умное завершение* ✔️ — напиши «Задача X выполнена».\n` +
    `3️⃣ *Авто-уведомления* ⏰ — напиши «Напомни завтра в 10:00».\n` +
    `4️⃣ *Единый профиль* 🌐 — все данные автоматически видны и в боте, и на веб-сайте!\n\n` +
    `Жми кнопки ниже, чтобы открыть приложение:`

  await sendTelegramMessage(botToken, chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Открыть Zerf Mini App', web_app: { url: `${APP_URL}/tg?chatId=${chatId}` } }],
        [{ text: '🌐 Открыть полный сайт', url: `${APP_URL}?chatId=${chatId}` }],
      ],
    },
  })
}

/**
 * Handle incoming Telegram Update message
 */
export async function handleTelegramUpdate(
  update: TelegramUpdate,
  botToken: string,
  groqApiKey: string
): Promise<{ success: boolean; item?: ParsedItem; message?: string }> {
  const message = update.message
  if (!message) return { success: false, message: 'No message in update' }

  const chatId = message.chat.id
  const firstName = message.from?.first_name || 'Пользователь'
  const text = message.text?.trim() || ''

  // ── /start command — always handle first, never pass to AI ──
  if (text === '/start' || text.startsWith('/start ')) {
    await handleStart(botToken, chatId, firstName)
    return { success: true, message: 'start handled' }
  }

  // ── /help command ──
  if (text === '/help' || text === '/помощь') {
    await sendTelegramMessage(botToken, chatId,
      `📖 *Zerf AI — Справка*\n\n` +
      `Просто напиши или надиктуй что хочешь сделать:\n\n` +
      `🎯 *Задача:* «Позвонить клиенту завтра в 15:00»\n` +
      `📌 *Заметка:* «Идея: сделать мобильное приложение»\n` +
      `🏆 *Цель:* «Хочу за 3 месяца выучить английский»\n` +
      `✔️ *Выполнено:* «Сделал задачу Позвонить клиенту»\n` +
      `⏰ *Напоминание:* «Напомни мне через 30 минут»\n\n` +
      `Всё остальное я пойму сам! 🤖`
    )
    return { success: true, message: 'help sent' }
  }

  // ── /today command ──
  if (text === '/today' || text === '/сегодня') {
    await sendTelegramMessage(botToken, chatId,
      `📅 *Задачи на сегодня*\n\nОткрой приложение, чтобы увидеть полный список:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Открыть Zerf', web_app: { url: `${APP_URL}/tg?chatId=${chatId}` } }],
          ],
        },
      }
    )
    return { success: true, message: 'today sent' }
  }

  try {
    let rawText = text

    // ── Voice/Audio message ──
    if (message.voice || message.audio) {
      const fileId = message.voice?.file_id || message.audio?.file_id
      if (!fileId) throw new Error('Нет ID голосового файла')

      await sendTelegramMessage(botToken, chatId, '🎙 *Обрабатываю голосовое сообщение...* Транскрибирую через Groq AI...')

      const audioBuffer = await downloadTelegramFile(botToken, fileId)
      // Try multi-key pool
      let transcribed = ''
      const keys = [groqApiKey, ...GROQ_API_KEYS].filter(Boolean)
      for (const key of keys) {
        try {
          transcribed = await transcribeAudioWithGroq(audioBuffer, 'voice.ogg', key)
          if (transcribed) break
        } catch { continue }
      }
      rawText = transcribed
    }

    if (!rawText.trim()) {
      await sendTelegramMessage(botToken, chatId, '⚠️ Не удалось извлечь текст из сообщения. Попробуй ещё раз.')
      return { success: false, message: 'Empty text' }
    }

    // ── Show transcript + processing ──
    await sendTelegramMessage(
      botToken,
      chatId,
      `📝 *Распознано:* «${rawText}»\n\n🧠 *Zerf AI структурирует в твоё рабочее пространство...*`
    )

    // ── Parse intent ──
    const parsedItem = await parseIntentWithGroq(rawText, groqApiKey)

    // ── Save to DB ──
    const saved = saveParsedItemToDb(parsedItem)

    // ── Format Russian reply ──
    const typeLabel: Record<string, string> = {
      task:       '✅ Задача',
      goal:       '🎯 Цель',
      note:       '📌 Заметка',
      project:    '📁 Проект',
      reminder:   '⏰ Напоминание',
      completion: '✔️ Выполнено',
    }
    const priorityLabel: Record<string, string> = {
      urgent: '🔴 Срочно',
      high:   '🟠 Высокий',
      medium: '🟢 Средний',
      low:    '🔵 Низкий',
    }

    const label = typeLabel[parsedItem.type] || '⚡ Запись'
    let reply = `${label} *сохранена!*\n\n`
    reply += `*Название:* ${parsedItem.title}\n`
    if (parsedItem.summary && parsedItem.summary !== parsedItem.title) {
      reply += `*Описание:* ${parsedItem.summary.slice(0, 200)}\n`
    }
    reply += `*Приоритет:* ${priorityLabel[parsedItem.priority] || parsedItem.priority}\n`
    if (parsedItem.dueDate) reply += `*Срок:* ${parsedItem.dueDate}`
    if (parsedItem.dueTime) reply += ` в ${parsedItem.dueTime}`
    if (parsedItem.dueDate || parsedItem.dueTime) reply += '\n'
    if (parsedItem.tags?.length) reply += `*Теги:* #${parsedItem.tags.join(' #')}\n`

    if (parsedItem.type === 'goal' && parsedItem.milestones?.length) {
      reply += `\n🚩 *Этапы:*\n` + parsedItem.milestones.map(m => ` • ${m}`).join('\n') + '\n'
    }
    if (parsedItem.type === 'task' && parsedItem.subtasks?.length) {
      reply += `\n📋 *Подзадачи:*\n` + parsedItem.subtasks.map(s => ` • ${s}`).join('\n') + '\n'
    }

    reply += `\n✨ *Добавлено в твой Zerf!*`

    await sendTelegramMessage(botToken, chatId, reply, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 Открыть в приложении', web_app: { url: `${APP_URL}/tg?chatId=${chatId}` } }],
        ],
      },
    })

    return { success: true, item: saved }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await sendTelegramMessage(botToken, chatId, `❌ *Ошибка Zerf:* ${errorMessage.slice(0, 300)}`)
    return { success: false, message: errorMessage }
  }
}
