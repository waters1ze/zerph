/**
 * Text-to-Speech (TTS) Voice Responses for Zerf AI
 * Synthesizes clear audio voice notes and sends via Telegram sendVoice API.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8649326236:AAH0dqSDP4akzWrM-5ncS68wZhlrwZISbxw'

/**
 * Generate audio buffer from Russian text using Google TTS endpoint.
 */
export async function generateTtsAudio(text: string): Promise<Buffer | null> {
  try {
    // Clean text from markdown and limit length for concise voice message
    const cleanText = text
      .replace(/[*_`~[\]()#•\-+>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)

    if (!cleanText) return null

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=ru&client=tw-ob`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!res.ok) return null

    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  } catch (err) {
    console.error('TTS Generation error:', err)
    return null
  }
}

/**
 * Send voice message to Telegram user
 */
export async function sendVoiceResponse(chatId: number, text: string): Promise<boolean> {
  try {
    const audioBuf = await generateTtsAudio(text)
    if (!audioBuf) return false

    const formData = new FormData()
    formData.append('chat_id', String(chatId))
    formData.append('voice', new Blob([audioBuf], { type: 'audio/mpeg' }), 'response.mp3')

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVoice`, {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    return !!data.ok
  } catch (err) {
    console.error('sendVoiceResponse error:', err)
    return false
  }
}

/**
 * Create a natural short spoken phrase from parsed items
 */
export function createSpokenSummary(items: any[]): string {
  if (!items || items.length === 0) return 'Готово!'

  if (items.length === 1) {
    const item = items[0]
    const title = item.title || 'задачу'
    const timeStr = item.dueTime ? ` на ${item.dueTime}` : ''

    if (item.type === 'note') {
      return `Заметка ${title} успешно сохранена!`
    }
    if (item.type === 'goal') {
      return `Цель ${title} добавлена!`
    }
    if (item.action === 'completion' || item.type === 'completion') {
      return `Задача ${title} отмечена как выполненная! Отличная работа!`
    }
    return `Записал задачу: ${title}${timeStr}. Напомню вовремя!`
  }

  return `Готово! Создал ${items.length} новых элементов в Zerf AI.`
}
