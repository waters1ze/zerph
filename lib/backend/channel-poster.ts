import { prisma } from './prisma'
import { getMskDateTime } from './db'
import { fetchMorningNewsContext, fetchEveningNewsContext } from './news-fetcher'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DEFAULT_CHANNEL = process.env.TELEGRAM_CHANNEL_ID || '@zerph_off'
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

import { callGroqChatCompletion } from './groq-pool'
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
  return raw.replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, '&amp;')
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
      if (await isCronAlreadyDoneToday('channel_poll', mskDate)) return true
      await markCronDoneToday('channel_poll', mskDate)
      const existing = await prisma.channelPoll.findFirst({
        where: { date: mskDate, channelId }
      }).catch(() => null)
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

export async function postDailyMorningPostToChannel(channelId = DEFAULT_CHANNEL, force = false): Promise<{ success: boolean; tgRes?: any; error?: string; channelId?: string }> {
  if (!GROQ_API_KEY) return { success: false, error: 'GROQ_API_KEY missing' }
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
      max_tokens: 1800,
    })

    let text = result.content?.trim()
    if (!text) return { success: false, error: 'Groq returned empty text' }

    if (text.length > 4000) {
      text = text.slice(0, 3900) + '\n\n▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>'
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
      await markCronDoneToday('channel_morning_post', mskDate)
    }

    // Duplicate to VK Community Wall
    postToVkWall(text).catch(err => console.error('[VK Crosspost Morning Error]:', err))

    return { success: tgRes?.ok ?? false, tgRes, channelId }
  } catch (err: any) {
    console.error('postDailyMorningPostToChannel error:', err)
    return { success: false, error: err?.message || String(err), channelId }
  }
}

/** 4. Post 21:00 MSK Evening News Digest & Reflection (Detailed, Minimalist B&W) */
export async function postDailyEveningPostToChannel(channelId = DEFAULT_CHANNEL, force = false): Promise<boolean> {
  const { mskDate } = getMskDateTime()

  try {
    if (!force) {
      if (await isCronAlreadyDoneToday('channel_evening_post', mskDate)) return true
    }

    const context = await fetchEveningNewsContext()
    
    const devData = context.devNews && context.devNews.length > 0
      ? context.devNews.map((n, i) => `${i + 1}. "${n.title}": ${n.summary || ''} (Ссылка: ${n.url || 'https://habr.com'})`).join('\n\n')
      : 'Ключевые инженерные кейсы и архитектурные решения.'

    const secData = context.secNews && context.secNews.length > 0
      ? context.secNews.map((n, i) => `${i + 1}. "${n.title}": ${n.summary || ''} (Ссылка: ${n.url || 'https://habr.com'})`).join('\n\n')
      : 'Разборы инцидентов кибербезопасности и уязвимостей.'

    const sciData = context.sciNews && context.sciNews.length > 0
      ? context.sciNews.map((n, i) => `${i + 1}. "${n.title}": ${n.summary || ''} (Ссылка: ${n.url || 'https://habr.com'})`).join('\n\n')
      : 'Научные открытия, когнитивистика и системное мышление.'

    const prompt =
      `Ты — главный редактор официального Telegram-канала Zerf Note (@zerph_off).\n` +
      `Напиши БОЛЬШУЮ, МАКСИМАЛЬНО ПОДРОБНУЮ и глубокую ВЕЧЕРНЮЮ аналитическую сводку ключевых инсайтов за сегодня (${context.date}).\n` +
      `Каждая новость должна содержать БОЛЬШОЙ развернутый абзац (3-5 полноценных предложений с разбором кейса, техническими деталями, цифрами и практическими выводами).\n\n` +
      `ИНЖЕНЕРИЯ, РАЗРАБОТКА & АРХИТЕКТУРА:\n${devData}\n\n` +
      `КИБЕРБЕЗОПАСНОСТЬ & ЗАЩИТА ДАННЫХ:\n${secData}\n\n` +
      `НАУЧНЫЕ ИССЛЕДОВАНИЯ, ПСИХОЛОГИЯ & МЫШЛЕНИЕ:\n${sciData}\n\n` +
      `СТРОГИЕ ПРАВИЛА:\n` +
      `1. Пиши ТОЛЬКО на чистом, грамотном русском литературном языке без каких-либо иностранных слов-паразитов или опечаток.\n` +
      `2. НЕ ДЕЛАЙ КОРОТКИХ ОПИСАНИЙ! Напиши под каждым заголовком основательный, глубокий и информативный текст (3-5 предложений).\n` +
      `3. ОБЯЗАТЕЛЬНО: в конце каждого пункта приложи кликабельную ссылку на источник: <a href="URL">[Источник]</a>.\n` +
      `4. Стиль: строгий минимализм, ч/б символы: ✦, ◈, ▪, <blockquote>, <b>, <i>, <code>, <a>. Без детских цветных эмодзи.\n\n` +
      `СТРОГАЯ СТРУКТУРА ВЕЧЕРНЕЙ СВОДКИ:\n` +
      `✦ <b>ИТОГИ ДНЯ | ВЕЧЕРНЯЯ СВОДКА | ${context.date}</b>\n\n` +
      `◈ <b>Инженерия, Разработка & IT-Архитектура:</b>\n` +
      `▪ <b>[Точный заголовок первого инженерного разбора]</b> — [Большой, детальный текст: 3-5 предложений с описанием проблемы, архитектурного решения, кода/технологий и практических выводов для разработчиков] <a href="[URL_источника]">[Источник]</a>\n\n` +
      `▪ <b>[Точный заголовок второго инженерного разбора]</b> — [Большой, детальный текст: 3-5 предложений с анализом кейса и выводами] <a href="[URL_источника]">[Источник]</a>\n\n` +
      `◈ <b>Кибербезопасность & Защита Данных:</b>\n` +
      `▪ <b>[Точный заголовок расследования/уязвимости]</b> — [Большой текст: 3-5 предложений о механике вектора атаки, масштабе инцидента и главных уроках для защиты систем] <a href="[URL_источника]">[Источник]</a>\n\n` +
      `◈ <b>Наука, Когнитивистика & Мышление:</b>\n` +
      `▪ <b>[Точный заголовок научного/когнитивного исследования]</b> — [Большой текст: 3-5 предложений о сути эксперимента, работе мозга, внимании и продуктивном мышлении] <a href="[URL_источника]">[Источник]</a>\n\n` +
      `<b>Рефлексия продуктивности:</b> [2-3 содержательных предложения о важности фиксации сделанного за день, выгрузке незавершенных задач в Zerf Note и очистке ума перед сном для восстановления ресурсов].\n\n` +
      `<blockquote>❝ [Вдохновляющая мысль или цитата о дисциплине, спокойствии ума, системности и правильном завершении дня]</blockquote>\n\n` +
      `▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>`

    const result = await callGroqChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1800,
    })

    let text = result.content?.trim()
    if (!text) return false

    if (text.length > 4000) {
      text = text.slice(0, 3900) + '\n\n▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>'
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
      await markCronDoneToday('channel_evening_post', mskDate)
    }

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
