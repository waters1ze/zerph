/**
 * Zerf Backend — Telegram Bot Engine
 * Receives voice/text messages from Telegram, downloads audio, calls Groq AI, and saves tasks/goals.
 */

import { transcribeAudioWithGroq, parseIntentWithGroq, ParsedItem } from './groq'
import { saveParsedItemToDb } from './db'

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
 * Send a Markdown message to a Telegram chat
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
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
  // 1. Get file path
  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  const fileRes = await fetch(getFileUrl)
  if (!fileRes.ok) throw new Error('Failed to get Telegram file path')
  const fileData = await fileRes.json()
  const filePath = fileData.result?.file_path
  if (!filePath) throw new Error('Telegram file path not found')

  // 2. Download file content
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
  const audioRes = await fetch(downloadUrl)
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

    // 3. Parse intent with Groq LLM (Llama-3.3-70b)
    const parsedItem = await parseIntentWithGroq(rawText, groqApiKey)

    // 4. Save parsed item to local database
    const { item: saved } = await saveParsedItemToDb(parsedItem)

    // 5. Send formatted Telegram response card
    const emojiMap: Record<string, string> = {
      task: '✅',
      goal: '🎯',
      note: '📌',
      project: '📁',
      reminder: '⏰',
    }

    const emoji = emojiMap[parsedItem.type] || '⚡'

    let replyText = `${emoji} *Zerf AI Captured New ${parsedItem.type.toUpperCase()}*\n\n`
    replyText += `*Title:* ${parsedItem.title}\n`
    replyText += `*Summary:* ${parsedItem.summary}\n`
    replyText += `*Priority:* ${parsedItem.priority.toUpperCase()}\n`
    if (parsedItem.dueDate) replyText += `*Due Date:* ${parsedItem.dueDate}\n`
    if (parsedItem.tags.length) replyText += `*Tags:* #${parsedItem.tags.join(' #')}\n`

    if (parsedItem.type === 'goal' && parsedItem.milestones?.length) {
      replyText += `\n🚩 *Milestones:* \n` + parsedItem.milestones.map(m => ` • ${m}`).join('\n')
    }

    replyText += `\n\n✨ *Added to your Zerf Command Center!*`

    await sendTelegramMessage(botToken, chatId, replyText)

    return { success: true, item: saved }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await sendTelegramMessage(botToken, chatId, `❌ *Zerf Error:* ${errorMessage}`)
    return { success: false, message: errorMessage }
  }
}
