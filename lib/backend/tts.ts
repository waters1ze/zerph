import { Buffer } from 'buffer'
import { prisma } from '@/lib/backend/prisma'

export async function generateTtsAudio(text: string, lang = 'ru'): Promise<Buffer | null> {
  try {
    const cleanText = text
      .replace(/[*_`~#\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 250)

    if (!cleanText) return null

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&client=tw-ob`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    if (!res.ok) return null
    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  } catch (err) {
    console.error('TTS generate error:', err)
    return null
  }
}

export async function sendTelegramVoice(
  chatId: string | number | bigint,
  audioBuffer: Buffer,
  caption?: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false

  try {
    const formData = new FormData()
    formData.append('chat_id', String(chatId))
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    formData.append('voice', blob, 'voice.mp3')
    if (caption) {
      formData.append('caption', caption)
      formData.append('parse_mode', 'Markdown')
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    return data.ok
  } catch (err) {
    console.error('sendTelegramVoice error:', err)
    return false
  }
}

export function createSpokenSummary(items: any[]): string {
  if (!items || items.length === 0) return 'Готово.'
  const first = items[0]

  if (first.type === 'answer' || first.action === 'reply') {
    return first.summary || first.title || 'Вот ответ на ваш вопрос.'
  }

  if (first.action === 'delete_all') {
    return 'Все задачи успешно удалены.'
  }
  if (first.action === 'delete') {
    const target = first.targetTitle || first.title || 'Задача'
    return `Задача «${target}» удалена.`
  }
  if (first.action === 'completion' || first.type === 'completion') {
    const target = first.targetTitle || first.title || 'Задача'
    return `Задача «${target}» выполнена!`
  }
  if (first.action === 'set_my_birthday') {
    return first.title || 'День рождения сохранен.'
  }
  if (first.type === 'note') {
    return `Заметка «${first.title}» сохранена.`
  }
  if (first.type === 'goal') {
    return `Цель «${first.title}» добавлена в ваши цели.`
  }
  if (first.type === 'delegate' || first.recipientName) {
    return `Задача «${first.title}» поручена ${first.recipientName || 'коллеге'}.`
  }
  if (first.dueTime) {
    return `Задача «${first.title}» записана на ${first.dueTime}.`
  }
  return `Задача «${first.title}» добавлена в список дел!`
}

export async function sendVoiceResponse(
  chatId: string | number | bigint,
  text: string,
  forceVoice = false
) {
  try {
    const user = await prisma.telegramChat.findUnique({
      where: { chatId: BigInt(chatId) },
      select: { ttsEnabled: true }
    })
    if (!forceVoice && (!user || user.ttsEnabled !== true)) return

    const audioBuf = await generateTtsAudio(text)
    if (audioBuf) {
      await sendTelegramVoice(chatId, audioBuf)
    }
  } catch (err) {
    console.error('sendVoiceResponse error:', err)
  }
}

export async function generateUserDailyAudioBriefing(
  chatId: string | number | bigint,
  firstName: string
): Promise<{ text: string; audioBuffer: Buffer | null }> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10)
    const userTasks = await prisma.task.findMany({
      where: {
        ownerChatId: BigInt(chatId),
        status: { not: 'done' },
        OR: [
          { dueDate: todayStr },
          { dueDate: null }
        ]
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    })

    const pendingTitles = userTasks.map(t => t.title).join(', ')

    let spokenScript = ''
    if (userTasks.length === 0) {
      spokenScript = `Привет, ${firstName}! На сегодня у тебя нет незавершенных задач. Отличный момент для отдыха или планирования новых целей в Zerf AI!`
    } else {
      spokenScript = `Привет, ${firstName}! Твой краткий голосовой брифинг на сегодня: у тебя запланировано ${userTasks.length} задач. Главные из них: ${pendingTitles.slice(0, 150)}. Продуктивного и успешного дня!`
    }

    const audioBuffer = await generateTtsAudio(spokenScript)
    return { text: spokenScript, audioBuffer }
  } catch (err) {
    console.error('generateUserDailyAudioBriefing error:', err)
    return { text: `Привет, ${firstName}! Успешного и продуктивного дня!`, audioBuffer: null }
  }
}
