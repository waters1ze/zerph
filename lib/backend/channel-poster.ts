import { prisma } from './prisma'
import { getMskDateTime } from './db'
import { fetchMorningNewsContext, fetchEveningNewsContext } from './news-fetcher'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DEFAULT_CHANNEL = process.env.TELEGRAM_CHANNEL_ID || '@zerph_off'
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

import { callGroqChatCompletion } from './groq-pool'

import { postToVkWall } from './vk'

async function callTg(method: string, payload: Record<string, any>) {
  if (!BOT_TOKEN) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
    return await res.json()
  } catch (err) {
    console.error(`Telegram API error (${method}):`, err)
    return null
  }
}

async function getAdminChatIds(): Promise<number[]> {
  const adminIds = new Set<number>()
  const ownerEnv = process.env.OWNER_CHAT_ID || '6136950061'
  if (ownerEnv) adminIds.add(Number(ownerEnv))
  adminIds.add(6136950061)

  try {
    const dbAdmins = await prisma.telegramChat.findMany({
      where: { isAdmin: true },
      select: { chatId: true },
    })
    dbAdmins.forEach(a => adminIds.add(Number(a.chatId)))
  } catch {}

  return Array.from(adminIds)
}

/** 1. Post Weekly Friday 09:00 MSK Poll to Channel (Minimalist B&W) */
export async function postDailyPollToChannel(channelId = DEFAULT_CHANNEL, force = false): Promise<boolean> {
  const { mskDate } = getMskDateTime()

  try {
    if (!force) {
      const existing = await prisma.channelPoll.findFirst({
        where: { date: mskDate, channelId }
      })
      if (existing) return false
    }

    let question = '✦ Какое улучшение или функцию добавить в Zerf AI?'
    let options = [
      '▪ Утренний аудио-дайджест голосом',
      '▪ Виджет на экран блокировки смартфона',
      '▪ Сетка активности и трекер стриков',
      '▪ Импорт задач по фото расписания',
      '▪ Синхронизация с Notion и Obsidian'
    ]

    try {
      const result = await callGroqChatCompletion({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Ты — комьюнити-менеджер Telegram-канала экосистемы Zerf AI (@zerph_off). Создай 1 лаконичный опрос для пользователей с выбором самого ожидаемого улучшения или функции сервиса. Стиль: строгий минимализм, ч/б символы (✦, ◈, ▪). Верни строго JSON: {"question": "...", "options": ["...", "..."]}'
          },
          {
            role: 'user',
            content: `Дата: ${mskDate}. Сгенерируй еженедельный пятничный опрос по улучшению функционала Zerf AI.`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 300,
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

/** 3. Post Morning News Digest (Detailed, Informative, Minimalist B&W with Live Rates & Tech News) */
export async function postDailyMorningPostToChannel(channelId = DEFAULT_CHANNEL): Promise<boolean> {
  if (!GROQ_API_KEY) return false

  try {
    const context = await fetchMorningNewsContext()
    const ratesStr = [
      context.rates.usd ? `$ ${context.rates.usd} ₽` : '',
      context.rates.eur ? `€ ${context.rates.eur} ₽` : '',
      context.rates.cny ? `¥ ${context.rates.cny} ₽` : '',
      context.rates.btc ? `₿ ${context.rates.btc}` : '',
      context.rates.ton ? `💎 ${context.rates.ton}` : '',
    ].filter(Boolean).join('  |  ')

    const geoData = context.geoNews && context.geoNews.length > 0
      ? context.geoNews.map((n, i) => `${i + 1}. "${n.title}": ${n.summary || ''} (Ссылка: ${n.url || 'https://lenta.ru'})`).join('\n\n')
      : 'Ключевые геополитические и международные события дня.'

    const techData = context.techNews && context.techNews.length > 0
      ? context.techNews.map((n, i) => `${i + 1}. "${n.title}": ${n.summary || ''} (Ссылка: ${n.url || 'https://habr.com'})`).join('\n\n')
      : (context.headlines.slice(0, 3).join('\n') || 'Свежие технологические релизы и разработка.')

    const eduData = context.eduNews && context.eduNews.length > 0
      ? context.eduNews.map((n, i) => `${i + 1}. "${n.title}": ${n.summary || ''} (Ссылка: ${n.url || 'https://habr.com'})`).join('\n\n')
      : 'Актуальные исследования, EdTech и развитие образования.'

    const prompt =
      `Ты — главный редактор официального Telegram-канала Zerf Note (@zerph_off).\n` +
      `Напиши БОЛЬШУЮ, МАКСИМАЛЬНО ПОДРОБНУЮ, глубокую и качественную утреннюю сводку за сегодня (${context.date}).\n` +
      `Каждая новость должна содержать БОЛЬШОЙ развернутый абзац (3-5 полноценных предложений с фактами, цифрами, контекстом, деталями и выводами) — точно в строгом стиле премиального Telegram-канала.\n\n` +
      `ГЕОПОЛИТИЧЕСКИЕ И МИРОВЫЕ СОБЫТИЯ:\n${geoData}\n\n` +
      `ТЕХНОЛОГИИ, ИИ И СТАРТАПЫ:\n${techData}\n\n` +
      `ОБРАЗОВАНИЕ, НАУКА И EDTECH:\n${eduData}\n\n` +
      `Курсы валют и активов: ${ratesStr || '$ 84.5 ₽ | € 97.5 ₽ | ¥ 12.5 ₽ | ₿ $62,900 | 💎 $1.33'}\n\n` +
      `СТРОГИЕ ПРАВИЛА:\n` +
      `1. Пиши ТОЛЬКО на чистом, грамотном русском литературном языке без каких-либо иностранных слов-паразитов или опечаток.\n` +
      `2. НЕ ДЕЛАЙ КОРОТКИХ ОПИСАНИЙ! Напиши под каждым заголовком основательный, глубокий и информативный текст (3-5 предложений).\n` +
      `3. ОБЯЗАТЕЛЬНО: в конце каждого пункта приложи кликабельную ссылку на источник: <a href="URL">[Источник]</a>.\n` +
      `4. Стиль: строгий минимализм, ч/б символы: ✦, ◈, ▪, <blockquote>, <b>, <code>, <a>. Без детских цветных эмодзи.\n\n` +
      `СТРОГАЯ СТРУКТУРА СООБЩЕНИЯ:\n` +
      `✦ <b>ГЛАВНОЕ НА СЕГОДНЯ | ${context.date}</b>\n\n` +
      `◈ <b>Мировая повестка & Геополитика:</b>\n` +
      `▪ <b>[Точный заголовок первого мирового/военно-политического события]</b> — [Большой, развернутый и глубокий текст: 3-5 предложений с предысторией, цифрами, анализом ситуации и четким выводом: чего ожидать дальше и к чему готовиться] <a href="[URL_источника]">[Источник]</a>\n\n` +
      `▪ <b>[Точный заголовок второго мирового события]</b> — [Большой, развернутый и глубокий текст: 3-5 предложений с фактами, оценками экспертов и последствиями] <a href="[URL_источника]">[Источник]</a>\n\n` +
      `◈ <b>Технологии & Искусственный интеллект:</b>\n` +
      `▪ <b>[Точный заголовок первой IT/ИИ новости]</b> — [Большой, детальный разбор: 3-5 предложений с описанием архитектуры, возможностей, бенчмарков и реального эффекта для индустрии] <a href="[URL_источника]">[Источник]</a>\n\n` +
      `▪ <b>[Точный заголовок второй IT/ИИ новости]</b> — [Большой, детальный разбор: 3-5 предложений с техническими подробностями и практической пользой] <a href="[URL_источника]">[Источник]</a>\n\n` +
      `◈ <b>Образование, Наука & EdTech:</b>\n` +
      `▪ <b>[Точный заголовок новости об образовании/науке]</b> — [Большой содержательный текст: 3-5 предложений о сути исследования/методики, пользе для эффективного обучения, прокачки навыков и развития мышления] <a href="[URL_источника]">[Источник]</a>\n\n` +
      `<blockquote><b>Прогноз & Фокус дня:</b> [Развернутый стратегический прогноз на сегодня + глубокий практический совет по концентрации, защите внимания и системной продуктивности в Zerf Note]</blockquote>\n\n` +
      `▪ <b>Курсы:</b> <code>${ratesStr}</code>\n` +
      `▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>`

    const result = await callGroqChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 2200,
    })

    const text = result.content?.trim()
    if (!text) return false

    const tgRes = await callTg('sendMessage', {
      chat_id: channelId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })

    if (!tgRes?.ok) {
      const cleanText = text.replace(/<[^>]*>/g, '')
      await callTg('sendMessage', {
        chat_id: channelId,
        text: cleanText,
        disable_web_page_preview: true,
      })
    }

    // Duplicate to VK Community Wall
    postToVkWall(text).catch(err => console.error('[VK Crosspost Morning Error]:', err))

    return tgRes?.ok ?? false
  } catch (err) {
    console.error('postDailyMorningPostToChannel error:', err)
    return false
  }
}

/** 4. Post 21:00 MSK Evening News Digest & Reflection (Detailed, Minimalist B&W) */
export async function postDailyEveningPostToChannel(channelId = DEFAULT_CHANNEL): Promise<boolean> {
  try {
    const context = await fetchEveningNewsContext()
    const newsData = context.news && context.news.length > 0
      ? context.news.map((n, i) => `${i + 1}. "${n.title}": ${n.summary || ''} (Ссылка: ${n.url || 'https://habr.com'})`).join('\n')
      : context.headlines.slice(0, 3).join('\n')

    const prompt =
      `Ты — автор официального Telegram-канала Zerf Note (@zerph_off).\n` +
      `Напиши глубокую, качественную ВЕЧЕРНЮЮ аналитическую сводку ключевых инсайтов за сегодня (${context.date}).\n\n` +
      `Вечерние аналитические темы и разборы (разработка, инженерия, безопасность):\n${newsData}\n\n` +
      `СТРОГИЕ ПРАВИЛА:\n` +
      `1. НЕ ИСПОЛЬЗУЙ цветные эмодзи. Только строгие ч/б символы: ✦, ◈, ▪, ▫, <blockquote>, <b>, <i>, <code>.\n` +
      `2. Пиши ТОЛЬКО на чистом, грамотном русском литературном языке без каких-либо иностранных слов или опечаток.\n` +
      `3. ОБЯЗАТЕЛЬНО включай кликабельные ссылки на источники в формате <a href="URL">[Источник]</a> в конце каждого инсайта.\n` +
      `4. Структура вечерней сводки:\n` +
      `   ✦ <b>ИТОГИ ДНЯ | ВЕЧЕРНЯЯ СВОДКА</b>\n\n` +
      `   ◈ <b>Главные инсайты и разборы:</b>\n` +
      `   ▪ <b>[Тема 1]</b> — развернутый анализ и выводы <a href="[URL_темы_1]">[Источник]</a>\n\n` +
      `   ▪ <b>[Тема 2]</b> — развернутый анализ и выводы <a href="[URL_темы_2]">[Источник]</a>\n\n` +
      `   ▪ <b>[Тема 3]</b> — развернутый анализ и выводы <a href="[URL_темы_3]">[Источник]</a>\n\n` +
      `   <b>Рефлексия продуктивности:</b> 1-2 предложения о пользе фиксации выполненных дел и разгрузки мыслей перед сном в Zerf Note.\n\n` +
      `   <blockquote>❝ [Вдохновляющая мысль о дисциплине, спокойствии и планировании следующего дня]</blockquote>\n\n` +
      `   ▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>`

    const result = await callGroqChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1000,
    })

    const text = result.content?.trim()
    if (!text) return false

    const tgRes = await callTg('sendMessage', {
      chat_id: channelId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })

    // Duplicate to VK Community Wall
    postToVkWall(text).catch(err => console.error('[VK Crosspost Evening Error]:', err))

    return tgRes?.ok ?? false
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
      `Ты — ведущий AI-Архитектор Zerf AI. Проанализируй данные за неделю и предложи 1 ключевую фичу для разработки.\n\n` +
      `Статистика:\n${JSON.stringify(statsContext, null, 2)}\n\n` +
      `Стиль: минимализм, ч/б символы (✦, ◈, ▪), Telegram HTML.\n` +
      `1. Название и суть фичи.\n` +
      `2. Проблема пользователей.\n` +
      `3. Архитектура и интерфейс.\n` +
      `4. Прогноз удержания (Retention).`

    const result = await callGroqChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 900,
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
