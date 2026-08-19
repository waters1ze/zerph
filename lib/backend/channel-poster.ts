import { prisma } from './prisma'
import { getMskDateTime } from './db'
import { fetchMorningNewsContext, fetchEveningNewsContext } from './news-fetcher'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DEFAULT_CHANNEL = process.env.TELEGRAM_CHANNEL_ID || '@zerph_off'
import { GROQ_CHAT_MODEL } from '@/lib/config'

import { callGroqChatCompletion, groqPool, getHuggingFaceTokens } from './groq-pool'
import { isCronAlreadyDoneToday, markCronDoneToday } from './cron-lock'
import { postToVkWall } from './vk'

async function callTg(method: string, payload: Record<string, any>) {
  if (!BOT_TOKEN) {
    console.error(`Telegram API error: BOT_TOKEN is missing`)
    return null
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!data?.ok) {
      console.error(`Telegram API error (${method}):`, data)
    }
    return data
  } catch (err) {
    console.error(`Telegram API error (${method}):`, err)
    return null
  }
}

function sanitizeTgHtml(raw: string): string {
  if (!raw) return ''
  let text = raw.replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, '&amp;')

  // Auto-close unbalanced Telegram HTML tags (b, i, u, s, code, pre, blockquote, a)
  const allowedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'blockquote', 'a']
  for (const tag of allowedTags) {
    const openCount = (text.match(new RegExp(`<${tag}(?:\\s+[^>]*)?>`, 'gi')) || []).length
    const closeCount = (text.match(new RegExp(`</${tag}>`, 'gi')) || []).length
    if (openCount > closeCount) {
      text += `</${tag}>`.repeat(openCount - closeCount)
    }
  }
  return text
}

async function getAdminChatIds(): Promise<number[]> {
  const adminIds = new Set<number>()
  const ownerEnv = process.env.OWNER_CHAT_ID
  if (ownerEnv && !isNaN(Number(ownerEnv))) adminIds.add(Number(ownerEnv))
  
  const envAdmins = (process.env.ADMIN_CHAT_IDS || '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => !isNaN(n) && n > 0)
  envAdmins.forEach(id => adminIds.add(id))

  try {
    const dbAdmins = await prisma.telegramChat.findMany({
      where: { isAdmin: true },
      select: { chatId: true },
    })
    dbAdmins.forEach(a => adminIds.add(Number(a.chatId)))
  } catch {}

  return Array.from(adminIds)
}

const IMPLEMENTED_FEATURES_SUMMARY = `
УЖЕ РЕАЛИЗОВАНО В ZERF (НЕ ПРЕДЛАГАТЬ И НЕ ВКЛЮЧАТЬ В ОПРОСЫ):
1. Голосовой ввод дел через Whisper (голос -> задача/цель/заметка/напоминание)
2. Точечные напоминания с повторами (Telegram, VK, Web Push)
3. Матрица Эйзенхауэра (срочно/важно)
4. Канбан-доски и совместные командные проекты
5. Трекер долгосрочных целей и майлстоунов
6. Трекер привычек со стриками активности
7. Помодоро таймер с фокус-режимом
8. Синхронизация с Google Календарем и iCal
9. Вики-ссылки [[Заметка]] и граф связей
10. Каталог расширений (темы, пресеты, виджеты)
11. Entropy AI глубокий поиск инсайтов
12. Синтез голосовых ответов (TTS)
13. Утренние и вечерние ИИ-дайджесты
14. Real-time Server-Sent Events (SSE)
`

/** 1. Post Weekly Friday 09:00 MSK Poll to Channel (Minimalist B&W) */
export async function postDailyPollToChannel(channelId = DEFAULT_CHANNEL, force = false): Promise<boolean> {
  const { mskDate } = getMskDateTime()

  try {
    if (!force) {
      if (await isCronAlreadyDoneToday('channel_poll', mskDate)) return true
      await markCronDoneToday('channel_poll', mskDate)
      const existing = await prisma.channelPoll.findFirst({
        where: { date: mskDate, channelId }
      }).catch(() => null)
      if (existing) return false
    }

    let question = '✦ Какую новую функцию добавить в Zerf в следующем релизе?'
    let options = [
      '▪ Синхронизация с Notion и Obsidian',
      '▪ Виджеты на рабочий стол смартфона',
      '▪ Импорт задач по фото расписания (OCR)',
      '▪ ИИ-декомпозиция проектов (диаграмма Ганта)',
      '▪ Зашифрованный сейф приватных заметок'
    ]

    try {
      const result = await callGroqChatCompletion({
        model: GROQ_CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: `Ты — продуктовый аналитик Telegram-канала экосистемы Zerf AI (@zerph_off).\nСоздай 1 лаконичный опрос для пользователей с выбором САМОГО ОЖИДАЕМОГО НОВОГО улучшения, которого ещё нет в сервисе.\n\n${IMPLEMENTED_FEATURES_SUMMARY}\n\nНАПРАВЛЕНИЯ ДЛЯ ВАРИАНТОВ (выбери 4-5 неповторяющихся вариантов, строго до 50 символов каждый):\n- Двусторонняя синхронизация с Notion и Obsidian\n- Виджеты на экран блокировки и рабочий стол iOS/Android\n- Сканирование и импорт задач по фото расписания (OCR)\n- Авто-конспект совещаний/лекций из длинных аудио с Action Items\n- Диаграмма Ганта и таймлайн декомпозиции проектов\n- Голосовой ассистент-собеседник в реальном времени (Live Voice)\n- Синхронизация с Яндекс.Календарем и Mail.ru Календарем\n- E2E сквозное шифрование приватных заметок\n- Командные чат-треды внутри задач\n- AI-копилот по биоритмам и авто-балансировка дня\n\nСтиль: строгий минимализм, ч/б символы (✦, ◈, ▪). Верни строго JSON: {"question": "✦ ...", "options": ["▪ ...", "▪ ...", "▪ ...", "▪ ..."]}`
          },
          {
            role: 'user',
            content: `Дата: ${mskDate}. Сгенерируй еженедельный пятничный опрос по выбору следующей крупной фичи Zerf AI.`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 350,
      })
      const parsed = JSON.parse(result.content || '{}')
      if (parsed.question && Array.isArray(parsed.options) && parsed.options.length >= 2) {
        question = parsed.question.slice(0, 250)
        options = parsed.options.slice(0, 5).map((o: string) => o.slice(0, 60))
      }
    } catch {}

    const tgRes = await callTg('sendPoll', {
      chat_id: channelId,
      question,
      options,
      is_anonymous: true,
      allows_multiple_answers: false,
    })

    if (tgRes?.ok && tgRes.result?.poll) {
      const poll = tgRes.result.poll
      const messageId = tgRes.result.message_id
      await prisma.channelPoll.create({
        data: {
          pollId: poll.id,
          messageId,
          channelId,
          question,
          options: options.map(text => ({ text, voter_count: 0 })),
          date: mskDate,
        }
      })
      console.log(`[Zerf Channel] Weekly Poll posted to ${channelId}:`, question)

      // Duplicate poll to VK Community Wall
      const vkPollText = `✦ ВОПРОС ДНЯ | ОПРОС СООБЩЕСТВА\n\n` +
        `❓ ${question}\n\n` +
        options.map((o, idx) => `▫️ ${idx + 1}. ${o}`).join('\n') +
        `\n\n💬 Пишите свой вариант ответа в комментариях!\n` +
        `📱 Открыть Zerf: https://vk.com/app54000000`
      postToVkWall(vkPollText).catch(err => console.error('[VK Poll Crosspost Error]:', err))

      return true
    }
    console.error('Telegram sendPoll response:', tgRes)
    return false
  } catch (err) {
    console.error('postDailyPollToChannel error:', err)
    return false
  }
}

/** 2. Close Weekly Friday 21:00 MSK Poll & Notify ONLY Admins & Owner */
export async function closeDailyPollAndNotifyAdmins(channelId = DEFAULT_CHANNEL): Promise<boolean> {
  const { mskDate } = getMskDateTime()

  try {
    const pollRecord = await prisma.channelPoll.findFirst({
      where: { channelId, isClosed: false },
      orderBy: { createdAt: 'desc' }
    })
    if (!pollRecord) return false

    const stopRes = await callTg('stopPoll', {
      chat_id: channelId,
      message_id: pollRecord.messageId,
    })

    let winningText = 'Нет голосов'
    let totalVotes = 0
    let resultsText = ''

    if (stopRes?.ok && stopRes.result?.options) {
      const opts: Array<{ text: string; voter_count: number }> = stopRes.result.options
      opts.sort((a, b) => b.voter_count - a.voter_count)
      totalVotes = stopRes.result.total_voter_count || 0

      if (opts[0] && opts[0].voter_count > 0) {
        winningText = opts[0].text
      }

      resultsText = opts.map((o, idx) => {
        const pct = totalVotes > 0 ? Math.round((o.voter_count / totalVotes) * 100) : 0
        return `${idx === 0 ? '✦' : '▫'} <b>${o.text}</b> — ${o.voter_count} гол. (${pct}%)`
      }).join('\n')
    }

    await prisma.channelPoll.update({
      where: { id: pollRecord.id },
      data: { isClosed: true, winningOption: winningText }
    })

    // Send detailed report STRICTLY to Admins & Owner in Minimalist B&W HTML
    const adminIds = await getAdminChatIds()
    const reportMsg =
      `✦ <b>ИТОГИ ЕЖЕНЕДЕЛЬНОГО ОПРОСА В КАНАЛЕ ${channelId}</b>\n\n` +
      `<b>Вопрос:</b> ${pollRecord.question}\n` +
      `<b>Участников:</b> ${totalVotes} чел.\n\n` +
      `<b>Результаты голосования:</b>\n${resultsText || 'Голосов пока нет'}\n\n` +
      `<b>Лидер голосования:</b> <b>«${winningText}»</b>\n` +
      `<i>Отчёт отправлен владельцу и администраторам Zerf AI для планирования следующего релиза.</i>`

    for (const adminId of adminIds) {
      await callTg('sendMessage', {
        chat_id: adminId,
        text: reportMsg,
        parse_mode: 'HTML'
      })
    }

    return true
  } catch (err) {
    console.error('closeDailyPollAndNotifyAdmins error:', err)
    return false
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function postDailyMorningPostToChannel(channelId = DEFAULT_CHANNEL, force = false): Promise<{ success: boolean; tgRes?: any; error?: string; channelId?: string; sentCount?: number }> {
  const hasKeys = groqPool.getKeysCount() > 0 || getHuggingFaceTokens().length > 0 || Boolean(process.env.GROQ_API_KEY)
  if (!hasKeys) return { success: false, error: 'AI key pool is empty' }
  const { mskDate } = getMskDateTime()

  try {
    if (!force) {
      if (await isCronAlreadyDoneToday('channel_morning_post', mskDate)) return { success: true, error: 'already_done_today' }
    }

    const context = await fetchMorningNewsContext()
    const ratesStr = [
      context.rates.usd ? `$ ${context.rates.usd} ₽` : '',
      context.rates.eur ? `€ ${context.rates.eur} ₽` : '',
      context.rates.cny ? `¥ ${context.rates.cny} ₽` : '',
      context.rates.btc ? `₿ ${context.rates.btc}` : '',
      context.rates.ton ? `💎 ${context.rates.ton}` : '',
    ].filter(Boolean).join('  |  ')

    const geoData = context.geoNews && context.geoNews.length > 0
      ? context.geoNews.map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary || ''}`).join('\n\n')
      : 'Ключевые геополитические и международные события дня.'

    const techData = context.techNews && context.techNews.length > 0
      ? context.techNews.map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary || ''}`).join('\n\n')
      : 'Свежие технологические релизы, AI-архитектура и разработка.'

    const econData = context.econNews && context.econNews.length > 0
      ? context.econNews.map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary || ''}`).join('\n\n')
      : 'Ключевые макроэкономические показатели, рынки и инвестиции.'

    const eduData = context.eduNews && context.eduNews.length > 0
      ? context.eduNews.map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary || ''}`).join('\n\n')
      : 'Научные исследования, развитие когнитивных навыков и EdTech.'

    // --- 1. Post #1: Geopolitics & World Digest ---
    const prompt1 =
      `Ты — главный редактор официального Telegram-канала Zerf Note (@zerph_off).\n` +
      `Напиши БОЛЬШОЙ, МАКСИМАЛЬНО ПОДРОБНЫЙ аналитический выпуск "МИРОВАЯ ПОВЕСТКА & ГЕОПОЛИТИКА" за ${context.date}.\n\n` +
      `НОВОСТИ ДЛЯ РАЗБОРА:\n${geoData}\n\n` +
      `СТРОГИЕ ПРАВИЛА:\n` +
      `1. Под каждым заголовком напиши БОЛЬШОЙ развернутый абзац (3-5 полноценных предложений с цифрами, контекстом, оценками и последствиями).\n` +
      `2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную ссылку: <a href="ТОЧНЫЙ_URL">[Источник]</a> (используй ТОЛЬКО реальные URL из списка выше).\n` +
      `3. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <b>, <code>, <a>). Без детских цветных эмодзи.\n\n` +
      `СТРОГАЯ СТРУКТУРА ВЫПУСКА:\n` +
      `✦ <b>ГЛАВНОЕ: МИРОВАЯ ПОВЕСТКА & ГЕОПОЛИТИКА | ${context.date}</b>\n\n` +
      `▪ <b>Курсы:</b> <code>${ratesStr || '$ 84.5 ₽ | € 97.5 ₽ | ¥ 12.5 ₽ | ₿ $62,900'}</code>\n\n` +
      `◈ <b>Ключевые мировые события:</b>\n` +
      `[2-3 новости в формате: ▪ <b>[Точный заголовок]</b> — [Большой текст 3-5 предложений] <a href="[URL]">[Источник]</a>]\n\n` +
      `▫️ <i>Выпуск 1 из 4 | Мировая повестка</i>\n` +
      `▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>`

    // --- 2. Post #2: Tech, AI & Engineering ---
    const prompt2 =
      `Ты — главный редактор официального Telegram-канала Zerf Note (@zerph_off).\n` +
      `Напиши БОЛЬШОЙ, МАКСИМАЛЬНО ПОДРОБНЫЙ технический выпуск "ТЕХНОЛОГИИ, ИИ & РАЗРАБОТКА" за ${context.date}.\n\n` +
      `НОВОСТИ ДЛЯ РАЗБОРА:\n${techData}\n\n` +
      `СТРОГИЕ ПРАВИЛА:\n` +
      `1. Под каждым заголовком напиши БОЛЬШОЙ детальный разбор (3-5 полноценных предложений с описанием архитектуры, кода, стека и пользы для разработчиков).\n` +
      `2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную ссылку: <a href="ТОЧНЫЙ_URL">[Источник]</a>.\n` +
      `3. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <b>, <code>, <a>). Без цветных эмодзи.\n\n` +
      `СТРОГАЯ СТРУКТУРА ВЫПУСКА:\n` +
      `◈ <b>ТЕХНОЛОГИИ, ИИ & РАЗРАБОТКА | ${context.date}</b>\n\n` +
      `[2-3 новости в формате: ▪ <b>[Точный заголовок]</b> — [Большой детальный разбор 3-5 предложений] <a href="[URL]">[Источник]</a>]\n\n` +
      `▫️ <i>Выпуск 2 из 4 | Технологии & ИИ</i>\n` +
      `▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>`

    // --- 3. Post #3: Economics, Business & Markets ---
    const prompt3 =
      `Ты — главный редактор официального Telegram-канала Zerf Note (@zerph_off).\n` +
      `Напиши БОЛЬШОЙ, МАКСИМАЛЬНО ПОДРОБНЫЙ аналитический выпуск "ЭКОНОМИКА, БИЗНЕС & РЫНКИ" за ${context.date}.\n\n` +
      `НОВОСТИ ДЛЯ РАЗБОРА:\n${econData}\n\n` +
      `СТРОГИЕ ПРАВИЛА:\n` +
      `1. Под каждым заголовком напиши БОЛЬШОЙ развернутый абзац (3-5 полноценных предложений с цифрами, макропоказателями, анализом рынков и прогнозом).\n` +
      `2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную ссылку: <a href="ТОЧНЫЙ_URL">[Источник]</a>.\n` +
      `3. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <b>, <code>, <a>). Без цветных эмодзи.\n\n` +
      `СТРОГАЯ СТРУКТУРА ВЫПУСКА:\n` +
      `◈ <b>ЭКОНОМИКА, БИЗНЕС & РЫНКИ | ${context.date}</b>\n\n` +
      `[2-3 новости в формате: ▪ <b>[Точный заголовок]</b> — [Большой развернутый текст 3-5 предложений] <a href="[URL]">[Источник]</a>]\n\n` +
      `▫️ <i>Выпуск 3 из 4 | Экономика & Рынки</i>\n` +
      `▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>`

    // --- 4. Post #4: Science, EdTech & Strategic Focus ---
    const prompt4 =
      `Ты — главный редактор официального Telegram-канала Zerf Note (@zerph_off).\n` +
      `Напиши БОЛЬШОЙ аналитический выпуск "НАУКА, ОБРАЗОВАНИЕ & ФОКУС ДНЯ" за ${context.date}.\n\n` +
      `НОВОСТИ ДЛЯ РАЗБОРА:\n${eduData}\n\n` +
      `СТРОГИЕ ПРАВИЛА:\n` +
      `1. Под каждым заголовком напиши БОЛЬШОЙ содержательный текст (3-5 полноценных предложений о сути исследования, пользе для мышления и когнитивных навыков).\n` +
      `2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную ссылку: <a href="ТОЧНЫЙ_URL">[Источник]</a>.\n` +
      `3. В конце добавь стратегический фокус дня в блоке <blockquote>.\n` +
      `4. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <blockquote>, <b>, <code>, <a>). Без цветных эмодзи.\n\n` +
      `СТРОГАЯ СТРУКТУРА ВЫПУСКА:\n` +
      `◈ <b>НАУКА, ОБРАЗОВАНИЕ & ФОКУС ДНЯ | ${context.date}</b>\n\n` +
      `[2 новости в формате: ▪ <b>[Точный заголовок]</b> — [Большой текст 3-5 предложений] <a href="[URL]">[Источник]</a>]\n\n` +
      `<blockquote><b>Фокус & Прогноз дня:</b> [Стратегический совет по распределению внимания, когнитивной продуктивности и системной работе в Zerf Note]</blockquote>\n\n` +
      `▫️ <i>Выпуск 4 из 4 | Наука & Фокус</i>\n` +
      `▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>`

    const prompts = [
      { id: 'geo', prompt: prompt1, topic: 'Мировая повестка' },
      { id: 'tech', prompt: prompt2, topic: 'Технологии & ИИ' },
      { id: 'econ', prompt: prompt3, topic: 'Экономика & Рынки' },
      { id: 'edu', prompt: prompt4, topic: 'Наука & Образование' },
    ]

    let sentCount = 0
    let lastTgRes = null

    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i]
      try {
        const result = await callGroqChatCompletion({
          model: GROQ_CHAT_MODEL,
          messages: [{ role: 'user', content: p.prompt }],
          temperature: 0.5,
          max_tokens: 1200,
        })

        let text = result.content?.trim()
        if (!text) continue

        if (text.length > 4000) {
          text = text.slice(0, 3900) + '\n\n▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>'
        }

        const sanitized = sanitizeTgHtml(text)
        let tgRes = await callTg('sendMessage', {
          chat_id: channelId,
          text: sanitized,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        })

        if (!tgRes?.ok) {
          const cleanText = text.replace(/<[^>]*>/g, '').slice(0, 4000)
          tgRes = await callTg('sendMessage', {
            chat_id: channelId,
            text: cleanText,
            disable_web_page_preview: true,
          })
        }

        if (tgRes?.ok) {
          sentCount++
          lastTgRes = tgRes
        }

        // Duplicate to VK Community Wall
        postToVkWall(text).catch(err => console.error(`[VK Crosspost Morning ${p.id} Error]:`, err))

        // Small pause between posts to avoid Telegram flood limits
        if (i < prompts.length - 1) {
          await sleep(1500)
        }
      } catch (postErr) {
        console.error(`Error generating/sending morning post ${p.id}:`, postErr)
      }
    }

    if (sentCount > 0) {
      await markCronDoneToday('channel_morning_post', mskDate)
    }

    return { success: sentCount > 0, tgRes: lastTgRes, channelId, sentCount }
  } catch (err: any) {
    console.error('postDailyMorningPostToChannel error:', err)
    return { success: false, error: err?.message || String(err), channelId }
  }
}

/** 4. Post 21:00 MSK Evening News Digest & Reflection (Multi-Message, Detailed, Minimalist B&W) */
export async function postDailyEveningPostToChannel(channelId = DEFAULT_CHANNEL, force = false): Promise<boolean> {
  const { mskDate } = getMskDateTime()

  try {
    if (!force) {
      if (await isCronAlreadyDoneToday('channel_evening_post', mskDate)) return true
    }

    const context = await fetchEveningNewsContext()

    const devData = context.devNews && context.devNews.length > 0
      ? context.devNews.map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary || ''}`).join('\n\n')
      : 'Ключевые инженерные кейсы и архитектурные решения.'

    const secData = context.secNews && context.secNews.length > 0
      ? context.secNews.map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary || ''}`).join('\n\n')
      : 'Разборы инцидентов кибербезопасности и уязвимостей.'

    const sciData = context.sciNews && context.sciNews.length > 0
      ? context.sciNews.map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   URL: ${n.url}\n   Суть: ${n.summary || ''}`).join('\n\n')
      : 'Научные открытия, когнитивистика и системное мышление.'

    // --- 1. Post #1: Engineering & Architecture ---
    const prompt1 =
      `Ты — главный редактор официального Telegram-канала Zerf Note (@zerph_off).\n` +
      `Напиши БОЛЬШОЙ, МАКСИМАЛЬНО ПОДРОБНЫЙ технический вечерний выпуск "ИТОГИ ДНЯ: ИНЖЕНЕРИЯ, РАЗРАБОТКА & АРХИТЕКТУРА" за ${context.date}.\n\n` +
      `НОВОСТИ ДЛЯ РАЗБОРА:\n${devData}\n\n` +
      `СТРОГИЕ ПРАВИЛА:\n` +
      `1. Под каждым заголовком напиши БОЛЬШОЙ детальный разбор (3-5 полноценных предложений с описанием архитектуры, кода, стека, цифр и пользы для разработчиков).\n` +
      `2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную кликабельную ссылку на источник: <a href="ТОЧНЫЙ_URL">[Источник]</a> (используй ТОЛЬКО реальные URL из списка выше).\n` +
      `3. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <b>, <code>, <a>). Без цветных эмодзи.\n\n` +
      `СТРОГАЯ СТРУКТУРА ВЫПУСКА:\n` +
      `✦ <b>ИТОГИ ДНЯ | ИНЖЕНЕРИЯ & IT-АРХИТЕКТУРА | ${context.date}</b>\n\n` +
      `◈ <b>Ключевые инженерные решения & релизы:</b>\n` +
      `[2-3 новости в формате: ▪ <b>[Точный заголовок]</b> — [Большой детальный разбор 3-5 предложений] <a href="[URL]">[Источник]</a>]\n\n` +
      `▫️ <i>Вечерний выпуск 1 из 3 | Инженерия & Архитектура</i>\n` +
      `▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>`

    // --- 2. Post #2: Cybersecurity & Data Protection ---
    const prompt2 =
      `Ты — главный редактор официального Telegram-канала Zerf Note (@zerph_off).\n` +
      `Напиши БОЛЬШОЙ аналитический вечерний выпуск "КИБЕРБЕЗОПАСНОСТЬ & ЗАЩИТА ДАННЫХ" за ${context.date}.\n\n` +
      `НОВОСТИ ДЛЯ РАЗБОРА:\n${secData}\n\n` +
      `СТРОГИЕ ПРАВИЛА:\n` +
      `1. Под каждым заголовком напиши БОЛЬШОЙ развернутый абзац (3-5 предложений о векторе атаки, уязвимости, рисках для данных и способах защиты систем).\n` +
      `2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную ссылку: <a href="ТОЧНЫЙ_URL">[Источник]</a>.\n` +
      `3. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <b>, <code>, <a>). Без цветных эмодзи.\n\n` +
      `СТРОГАЯ СТРУКТУРА ВЫПУСКА:\n` +
      `◈ <b>КИБЕРБЕЗОПАСНОСТЬ & ЗАЩИТА ДАННЫХ | ${context.date}</b>\n\n` +
      `[2-3 новости в формате: ▪ <b>[Точный заголовок]</b> — [Большой детальный текст 3-5 предложений] <a href="[URL]">[Источник]</a>]\n\n` +
      `▫️ <i>Вечерний выпуск 2 из 3 | Кибербезопасность</i>\n` +
      `▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>`

    // --- 3. Post #3: Science, Cognitive Thinking & Evening Reflection ---
    const prompt3 =
      `Ты — главный редактор официального Telegram-канала Zerf Note (@zerph_off).\n` +
      `Напиши БОЛЬШОЙ вечерний выпуск "НАУКА, МЫШЛЕНИЕ & ВЕЧЕРНЯЯ РЕФЛЕКСИЯ" за ${context.date}.\n\n` +
      `НОВОСТИ ДЛЯ РАЗБОРА:\n${sciData}\n\n` +
      `СТРОГИЕ ПРАВИЛА:\n` +
      `1. Под каждым заголовком напиши содержательный разбор исследования (3-5 предложений о мозге, мышлении и продуктивности).\n` +
      `2. В конце каждого пункта ОБЯЗАТЕЛЬНО укажи точную ссылку: <a href="ТОЧНЫЙ_URL">[Источник]</a>.\n` +
      `3. В конце добавь блок рефлексии дня и мысль в <blockquote> о правильном завершении рабочего дня и разгрузке ума перед сном.\n` +
      `4. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪, <blockquote>, <b>, <code>, <a>). Без цветных эмодзи.\n\n` +
      `СТРОГАЯ СТРУКТУРА ВЫПУСКА:\n` +
      `◈ <b>НАУКА, МЫШЛЕНИЕ & РЕФЛЕКСИЯ ДНЯ | ${context.date}</b>\n\n` +
      `[2 новости в формате: ▪ <b>[Точный заголовок]</b> — [Большой текст 3-5 предложений] <a href="[URL]">[Источник]</a>]\n\n` +
      `<b>Вечерняя рефлексия:</b> [2-3 предложения о важности выгрузки мыслей и фиксации задач в Zerf Note перед сном для восстановления ресурсов].\n\n` +
      `<blockquote>❝ [Вдохновляющая мысль о дисциплине, спокойствии ума и системности]</blockquote>\n\n` +
      `▫️ <i>Вечерний выпуск 3 из 3 | Наука & Рефлексия</i>\n` +
      `▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>`

    const prompts = [
      { id: 'dev', prompt: prompt1, topic: 'Инженерия' },
      { id: 'sec', prompt: prompt2, topic: 'Кибербезопасность' },
      { id: 'sci', prompt: prompt3, topic: 'Наука & Рефлексия' },
    ]

    let sentCount = 0

    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i]
      try {
        const result = await callGroqChatCompletion({
          model: GROQ_CHAT_MODEL,
          messages: [{ role: 'user', content: p.prompt }],
          temperature: 0.5,
          max_tokens: 1500,
        })

        let text = result.content?.trim()
        if (!text) continue

        if (text.length > 4000) {
          text = text.slice(0, 3900) + '\n\n▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a>'
        }

        const sanitized = sanitizeTgHtml(text)
        let tgRes = await callTg('sendMessage', {
          chat_id: channelId,
          text: sanitized,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        })

        if (!tgRes?.ok) {
          const cleanText = text.replace(/<[^>]*>/g, '').slice(0, 4000)
          tgRes = await callTg('sendMessage', {
            chat_id: channelId,
            text: cleanText,
            disable_web_page_preview: true,
          })
        }

        if (tgRes?.ok) {
          sentCount++
        }

        // Duplicate to VK Community Wall
        postToVkWall(text).catch(err => console.error(`[VK Crosspost Evening ${p.id} Error]:`, err))

        if (i < prompts.length - 1) {
          await sleep(1500)
        }
      } catch (err) {
        console.error(`Error sending evening post ${p.id}:`, err)
      }
    }

    if (sentCount > 0) {
      await markCronDoneToday('channel_evening_post', mskDate)
    }

    return sentCount > 0
  } catch (err) {
    console.error('postDailyEveningPostToChannel error:', err)
    return false
  }
}

/** 5. Friday 00:00 MSK — AI Autonomous Feature Proposal (Minimalist B&W) */
export async function generateAndSendFridayAiProposal(): Promise<boolean> {
  try {
    const totalUsers = await prisma.telegramChat.count()
    const totalTasks = await prisma.task.count()
    const completedTasks = await prisma.task.count({ where: { status: 'done' } })
    const totalNotes = await prisma.note.count()
    const totalGoals = await prisma.goal.count()

    const recentLogs = await prisma.appActionLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' }
    })

    const actionCounts: Record<string, number> = {}
    recentLogs.forEach(l => {
      actionCounts[l.action] = (actionCounts[l.action] || 0) + 1
    })

    const statsContext = {
      totalUsers,
      totalTasks,
      completedTasks,
      completionRate: totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : '0%',
      totalNotes,
      totalGoals,
      recentActionDistribution: actionCounts,
    }

    const prompt =
      `Ты — ведущий AI-Архитектор экосистемы Zerf AI. Проанализируй агрегированные данные использования и предложи 1 новую ключевую фичу для следующего спринта разработки, которой ЕЩЁ НЕТ в Zerf.\n\n` +
      `${IMPLEMENTED_FEATURES_SUMMARY}\n\n` +
      `Статистика активности за неделю:\n${JSON.stringify(statsContext, null, 2)}\n\n` +
      `ПРАВИЛА:\n` +
      `- Предложи совершенно новую, неизбитую фичу (например, OCR распознавание фото расписания, Live WebRTC Voice, синхронизация с Notion/Obsidian, E2E-шифрование, декомпозиция на диаграмму Ганта, AI-биоритмы, командные чат-треды внутри задач).\n` +
      `- Запрещено предлагать то, что уже перечислено в списке "УЖЕ РЕАЛИЗОВАНО".\n` +
      `- Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪), Telegram HTML.\n` +
      `Структура ответа:\n` +
      `1. ✦ <b>Название и суть инновации</b>\n` +
      `2. ◈ <b>Какую боль пользователей решает</b>\n` +
      `3. ▪ <b>Техническая архитектура и UI/UX</b>\n` +
      `4. 📈 <b>Влияние на Retention и вовлеченность</b>`

    const result = await callGroqChatCompletion({
      model: GROQ_CHAT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 950,
    })

    const proposal = result.content?.trim()
    if (!proposal) return false

    const adminIds = await getAdminChatIds()
    const msg =
      `✦ <b>ОТЧЕТ ИИ-АРХИТЕКТОРА ZERF AI</b>\n` +
      `<i>Пятничный продуктовый анализ</i>\n\n` +
      proposal

    for (const adminId of adminIds) {
      await callTg('sendMessage', {
        chat_id: adminId,
        text: msg,
        parse_mode: 'HTML',
      })
    }

    return true
  } catch (err) {
    console.error('generateAndSendFridayAiProposal error:', err)
    return false
  }
}
