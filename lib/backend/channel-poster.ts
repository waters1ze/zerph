import { prisma } from './prisma'
import { getMskDateTime } from './db'
import { fetchMorningNewsContext } from './news-fetcher'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DEFAULT_CHANNEL = process.env.TELEGRAM_CHANNEL_ID || '@zerph_off'
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

import { callGroqChatCompletion } from './groq-pool'

async function callTg(method: string, payload: Record<string, any>) {
  if (!BOT_TOKEN) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      where: { date: mskDate, channelId, isClosed: false }
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

    const newsData = context.news && context.news.length > 0
      ? context.news.map((n, i) => `${i + 1}. Заголовок: "${n.title}"\n   Контекст/Суть: ${n.summary || 'Актуальное технологическое событие'}`).join('\n\n')
      : context.headlines.slice(0, 4).join('\n')

    const prompt =
      `Ты — главный редактор официального Telegram-канала Zerf AI (@zerph_off).\n` +
      `Напиши ПОДРОБНУЮ, глубокую и качественную утреннюю сводку ключевых новостей из мира IT, технологий и искусственного интеллекта за вчера и сегодня (${context.date}).\n\n` +
      `Свежие материалы для анализа:\n${newsData}\n\n` +
      `Курсы валют и активов: ${ratesStr || '$ 84.5 ₽ | € 97.5 ₽ | ¥ 12.5 ₽ | ₿ $62,900 | 💎 $1.33'}\n\n` +
      `ТРЕБОВАНИЯ К СОДЕРЖАНИЮ:\n` +
      `- НЕ пиши одни сухие заголовки! По каждому событию дай емкое раскрытие (1-2 содержательных предложения): что произошло, главные цифры, технологии или практический эффект.\n` +
      `- Строгий минимализм: без разноцветных эмодзи (никаких 🚀🔥⚡️📱). Используй только благородные ч/б символы: ✦, ◈, ▪, <blockquote>, <b>, <code>, <a>.\n\n` +
      `СТРОГАЯ СТРУКТУРА СООБЩЕНИЯ:\n` +
      `✦ <b>ГЛАВНОЕ НА СЕГОДНЯ | ${context.date}</b>\n\n` +
      `◈ <b>Ключевые события:</b>\n` +
      `▪ <b>[Точный заголовок первой новости]</b> — [Подробное объяснение сути новости, факты, почему это важно]\n\n` +
      `▪ <b>[Точный заголовок второй новости]</b> — [Подробное объяснение сути новости, факты, почему это важно]\n\n` +
      `▪ <b>[Точный заголовок третьей новости]</b> — [Подробное объяснение сути новости, факты, почему это важно]\n\n` +
      `<blockquote><b>Фокус дня:</b> [Практичный и глубокий совет по концентрации, тайм-менеджменту или системной работе]</blockquote>\n\n` +
      `▪ <b>Курсы:</b> <code>${ratesStr}</code>\n` +
      `▪ <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>`

    const result = await callGroqChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1200,
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
    return tgRes?.ok ?? false
  } catch (err) {
    console.error('postDailyMorningPostToChannel error:', err)
    return false
  }
}

/** 4. Post 21:00 MSK Evening News Digest & Reflection (Detailed, Minimalist B&W) */
export async function postDailyEveningPostToChannel(channelId = DEFAULT_CHANNEL): Promise<boolean> {
  try {
    const context = await fetchMorningNewsContext()
    const newsData = context.news && context.news.length > 0
      ? context.news.map((n, i) => `${i + 1}. "${n.title}": ${n.summary || ''}`).join('\n')
      : context.headlines.slice(0, 3).join('\n')

    const prompt =
      `Ты — автор официального Telegram-канала Zerf AI (@zerph_off).\n` +
      `Напиши подробный вечерний дайджест итогов дня за сегодня (${context.date}) для подписчиков.\n\n` +
      `Темы дня:\n${newsData}\n\n` +
      `СТРОГИЕ ПРАВИЛА СТИЛЯ:\n` +
      `1. НЕ ИСПОЛЬЗУЙ цветные эмодзи. Только строгие ч/б символы: ✦, ◈, ▪, ▫, <blockquote>, <b>, <i>, <code>.\n` +
      `2. Структура поста:\n` +
      `   • ✦ <b>ИТОГИ ДНЯ | ВЕЧЕРНЯЯ СВОДКА</b>\n\n` +
      `   • ◈ <b>Главные инсайты дня:</b>\n` +
      `     ▪ <b>[Тема 1]</b> — развернутый итог или следствие события.\n` +
      `     ▪ <b>[Тема 2]</b> — развернутый итог или технологический вывод.\n\n` +
      `   • <b>Рефлексия продуктивности:</b> 1-2 предложения о важности фиксации сделанного и очистки ума перед сном в Zerf AI.\n\n` +
      `   • <blockquote>❝ [Вдохновляющая мысль о дисциплине и системности]</blockquote>\n\n` +
      `   • <a href="https://t.me/Zerph_bot">@Zerph_bot</a> | <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>`

    const result = await callGroqChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.65,
      max_tokens: 900,
    })

    const text = result.content?.trim()
    if (!text) return false

    const tgRes = await callTg('sendMessage', {
      chat_id: channelId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })
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

/** 6. Post Welcome Intro Post in Minimalist Monochrome (B&W) HTML */
export async function postWelcomeIntroToChannel(channelId = DEFAULT_CHANNEL): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const prompt =
      `Ты — главный редактор официального Telegram-канала Zerf AI (@zerph_off).\n` +
      `Напиши безупречный, стильный, минималистичный вступительный пост (Welcome Post) для нашего канала.\n\n` +
      `СТРОГИЕ ПРАВИЛА ОФОРМЛЕНИЯ:\n` +
      `1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать цветные эмодзи (ракеты 🚀, огонь 🔥, мишени 🎯, песочные часы ⏳, микрофоны 🎙️, кофе ☕ и прочие яркие стикеры).\n` +
      `2. Используй ТОЛЬКО элегантные черно-белые Unicode-символы и знаки валют (₽, $, €, ¥, ₿, ✦, ✧, ◈, ◆, ◇, ▪, ▫, ●, ○, →, ↳).\n` +
      `3. Используй ТОЛЬКО чистый Telegram HTML: <b>жирный</b>, <i>курсив</i>, <code>моно</code>, <blockquote>цитата</blockquote>, <a href="...">ссылка</a>. Никаких звездочек Markdown!\n\n` +
      `Содержание поста:\n` +
      `- Заголовок: ✦ <b>ДОБРО ПОЖАЛОВАТЬ В ZERF AI</b> ✦\n` +
      `- Миссия в блоке цитаты: <blockquote><b>Миссия проекта:</b> Обсуждение, голосование, розыгрыши. Всё про наш Telegram-бот + сайт. Составьте ваш личный график вместе с нами.</blockquote>\n` +
      `- Раздел <b>◈ Возможности экосистемы:</b>\n` +
      `  ▪ <b>Голосовые задачи</b> — надиктуйте на бегу, ИИ сам определит время и напомнит\n` +
      `  ▪ <b>Живой обратный отсчет</b> — точный таймер до дедлайна\n` +
      `  ▪ <b>Vision AI</b> — мгновенное распознавание задач по фото расписания\n` +
      `  ▪ <b>Фокус-сессии</b> — интервалы глубокой концентрации 25/5\n` +
      `  ▪ <b>Синхронизация</b> — 1-клик подключение к Apple и Google Календарю\n` +
      `  ▪ <b>Стрики</b> — бесплатные дни Premium за непрерывную продуктивность\n` +
      `- Раздел <b>◈ Программа канала:</b>\n` +
      `  1. <b>Утренние опросы в 08:00</b> — голосование за функции в разработке\n` +
      `  2. <b>Утренний дайджест в 09:00</b> — новости, курсы валют (₽/$/€/₿) и приемы тайм-менеджмента\n` +
      `  3. <b>Розыгрыши Premium</b> и подарков среди активных участников\n` +
      `  4. <b>Вечерние инсайты в 21:00</b> — рефлексия и подведение итогов\n` +
      `- В конце блок ссылок:\n` +
      `  ▪ <b>Бот:</b> <a href="https://t.me/Zerph_bot">@Zerph_bot</a>\n` +
      `  ▪ <b>Веб-версия:</b> <a href="https://zeprh.vercel.app">zeprh.vercel.app</a>\n` +
      `- Напиши готовый HTML пост без лишних вступительных фраз.`

    const result = await callGroqChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1100,
    })

    const text = result.content?.trim()
    if (!text) return { ok: false, error: 'Empty AI response' }

    const tgRes = await callTg('sendMessage', {
      chat_id: channelId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })

    if (!tgRes?.ok) {
      const cleanText = text.replace(/<[^>]*>/g, '')
      const retryRes = await callTg('sendMessage', {
        chat_id: channelId,
        text: cleanText,
        disable_web_page_preview: true,
      })
      if (!retryRes?.ok) {
        return { ok: false, error: retryRes?.description || tgRes?.description || 'Failed to post' }
      }
    }

    return { ok: true, text }
  } catch (err: unknown) {
    return { ok: false, error: String(err) }
  }
}
