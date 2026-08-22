/**
 * Zerf Backend — Telegram Bot Engine
 * Receives voice/text messages from Telegram, downloads audio, calls Groq AI, and saves tasks/goals.
 */

import { transcribeAudioWithGroq, parseIntentWithGroq, ParsedItem } from './groq'
import { saveParsedItemToDb, getExistingItemsContext, getUserUsageAndLimits } from './db'
import { getModelForUserPlan } from './groq-pool'

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: {
      id: number
      first_name?: string
      username?: string
    }
    chat: {
      id: number
    }
    date: number
    text?: string
    voice?: {
      file_id: string
      duration: number
      file_size?: number
    }
    audio?: {
      file_id: string
      duration: number
    }
  }
}

/**
 * Send a Markdown message to a Telegram chat and mirror as Web Push notification
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string | bigint,
  text: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: 'Markdown',
      }),
      // RELIABILITY (audit M-8): unbounded external calls stalled workers
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    console.error('Telegram sendMessage error:', err)
  }

  // Mirror as Web Push Notification to user's web browsers and devices
  try {
    const { sendWebPushNotification } = await import('./web-push')
    const clean = text.replace(/[*_`#]/g, '').trim()
    const firstLine = clean.split('\n')[0] || 'Zerf Note'
    const body = clean.split('\n').slice(1).join('\n').trim() || firstLine
    sendWebPushNotification(chatId, {
      title: firstLine,
      body: body,
      url: '/',
    }).catch(() => {})
  } catch {}
}

/**
 * Download a voice file from Telegram servers
 */
export async function downloadTelegramFile(
  botToken: string,
  fileId: string
): Promise<Buffer> {
  // 1. Get file path
  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  const fileRes = await fetch(getFileUrl, { signal: AbortSignal.timeout(15_000) })
  if (!fileRes.ok) throw new Error('Failed to get Telegram file path')
  const fileData = await fileRes.json()
  const filePath = fileData.result?.file_path
  if (!filePath) throw new Error('Telegram file path not found')

  // 2. Download file content
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
  const audioRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(60_000) })
  if (!audioRes.ok) throw new Error('Failed to download Telegram voice file')

  const arrayBuffer = await audioRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
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

  try {
    let rawText = message.text || ''

    // 1. If voice message is attached, download & transcribe via Groq Whisper
    if (message.voice || message.audio) {
      const fileId = message.voice?.file_id || message.audio?.file_id
      if (!fileId) throw new Error('No voice file ID')

      await sendTelegramMessage(botToken, chatId, '🎙 *Processing voice message...* Transcribing with Groq AI...')

      const audioBuffer = await downloadTelegramFile(botToken, fileId)
      rawText = await transcribeAudioWithGroq(audioBuffer, 'voice.ogg', groqApiKey)
    }

    if (!rawText.trim()) {
      await sendTelegramMessage(botToken, chatId, '⚠️ Could not extract text from message.')
      return { success: false, message: 'Empty text' }
    }

    // 2. Send status update
    await sendTelegramMessage(
      botToken,
      chatId,
      `📝 *Transcript:* "${rawText}"\n\n🧠 *Zerf AI is structuring into your workspace...*`
    )

    // 3. Fetch existing items context for user & parse intent with tiered model
    const [existingItemsContext, limits] = await Promise.all([
      getExistingItemsContext(chatId),
      getUserUsageAndLimits(chatId)
    ])
    const effectiveModel = getModelForUserPlan(limits.plan)

    const parsedItems = await parseIntentWithGroq(rawText, groqApiKey, effectiveModel, existingItemsContext)
    const savedItems = []

    for (const parsedItem of parsedItems) {
      const { item: saved, updatedItem } = await saveParsedItemToDb(parsedItem, chatId)
      savedItems.push(saved)

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
      const statusMsg = updatedItem || parsedItem.action === 'update' ? 'изменена в твоем Zerf!' : 'сохранена в твой Zerf!'
      let replyText = `${label} *${statusMsg}*\n\n`
      replyText += `*Название:* ${parsedItem.title}\n`
      if (parsedItem.summary && parsedItem.summary !== parsedItem.title) {
        replyText += `*Описание:* ${parsedItem.summary.slice(0, 200)}\n`
      }
      replyText += `*Приоритет:* ${priorityLabel[parsedItem.priority] || parsedItem.priority}\n`
      if (parsedItem.dueDate) replyText += `*Срок:* ${parsedItem.dueDate}`
      if (parsedItem.dueTime) replyText += ` в ${parsedItem.dueTime}`
      if (parsedItem.dueDate || parsedItem.dueTime) replyText += '\n'
      if (parsedItem.tags?.length) replyText += `*Теги:* #${parsedItem.tags.join(' #')}\n`

      if (parsedItem.type === 'goal' && parsedItem.milestones?.length) {
        replyText += `\n🚩 *Ключевые этапы:*\n` + parsedItem.milestones.map((m: string) => ` • ${m}`).join('\n') + '\n'
      }
      if (parsedItem.type === 'task' && parsedItem.subtasks?.length) {
        replyText += `\n📋 *Подзадачи:*\n` + parsedItem.subtasks.map((s: any) => {
          const title = typeof s === 'string' ? s : s.title
          const timeParts: string[] = []
          if (typeof s === 'object' && s !== null) {
            if (s.dueTime) timeParts.push(`⏰ ${s.dueTime}`)
            if (s.dueDate) timeParts.push(`📅 ${s.dueDate}`)
            if (s.durationDays) timeParts.push(`(${s.durationDays} дн.)`)
          }
          const timeInfo = timeParts.length ? ` — _${timeParts.join(' ')}_` : ''
          return ` • ${title}${timeInfo}`
        }).join('\n') + '\n'
      }

      replyText += `\n✨ *Синхронизировано с твоим приложением!*`

      await sendTelegramMessage(botToken, chatId, replyText)
    }

    return { success: true, item: savedItems[0] || null }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await sendTelegramMessage(botToken, chatId, `❌ *Zerf Error:* ${errorMessage}`)
    return { success: false, message: errorMessage }
  }
}
