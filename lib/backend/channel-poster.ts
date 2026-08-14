import { prisma } from './prisma'
import { getMskDateTime } from './db'
import { fetchMorningNewsContext } from './news-fetcher'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const DEFAULT_CHANNEL = process.env.TELEGRAM_CHANNEL_ID || '@zerph_off'
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

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

  try {
    const dbAdmins = await prisma.telegramChat.findMany({
      where: { isAdmin: true },
      select: { chatId: true },
    })
    dbAdmins.forEach(a => adminIds.add(Number(a.chatId)))
  } catch {}

  return Array.from(adminIds)
}

/** 1. Post Daily 08:00 MSK Poll to Channel */
export async function postDailyPollToChannel(channelId = DEFAULT_CHANNEL): Promise<boolean> {
  const { mskDate } = getMskDateTime()

  try {
    const existing = await prisma.channelPoll.findFirst({
      where: { date: mskDate, channelId }
    })
    if (existing) return false

    let question = '💡 Какую функцию добавить в Zerf AI в следующем обновлении?'
    let options = [
      '🎙️ Утренний голосовой аудио-дайджест',
      '📱 Виджет на экран блокировки iPhone/Android',
      '📊 365-дневная тепловая карта стриков',
      '⚡ Авто-импорт задач по фото расписания',
      '🔗 Интеграция с Notion / Obsidian'
    ]

    if (GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: 'Ты — комьюнити-менеджер Telegram-канала Zerf AI (@zerph_off). Создай 1 интересный вопрос для опроса пользователей о новых функциях или продуктивности и 4-5 кратких вариантов ответа (до 40 символов каждый). Верни строго JSON: {"question": "...", "options": ["...", "..."]}'
              },
              {
                role: 'user',
                content: `Дата: ${mskDate}. Сгенерируй свежий актуальный опрос.`
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 300,
          }),
        })
        const groqData = await groqRes.json()
        const parsed = JSON.parse(groqData.choices?.[0]?.message?.content || '{}')
        if (parsed.question && Array.isArray(parsed.options) && parsed.options.length >= 2) {
          question = parsed.question.slice(0, 250)
          options = parsed.options.slice(0, 5).map((o: string) => o.slice(0, 60))
        }
      } catch {}
    }

    const tgRes = await callTg('sendPoll', {
      chat_id: channelId,
      question,
      options: JSON.stringify(options),
      is_anonymous: false,
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
      console.log(`[Zerf Channel] Poll posted to ${channelId}:`, question)
      return true
    }
    return false
  } catch (err) {
    console.error('postDailyPollToChannel error:', err)
    return false
  }
}

/** 2. Close Daily 20:00 MSK Poll & Notify Owner/Admins */
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
        return `${idx === 0 ? '🏆' : '▫️'} <b>${o.text}</b> — ${o.voter_count} гол. (${pct}%)`
      }).join('\n')
    }

    await prisma.channelPoll.update({
      where: { id: pollRecord.id },
      data: { isClosed: true, winningOption: winningText }
    })

    // Send detailed report to Admins & Owner in Telegram HTML format
    const adminIds = await getAdminChatIds()
    const reportMsg =
      `📊 <b>Итоги дневного опроса в канале ${channelId}:</b>\n\n` +
      `❓ <b>Вопрос:</b> ${pollRecord.question}\n` +
      `👥 Всего проголосовало: <b>${totalVotes} чел.</b>\n\n` +
      `📈 <b>Результаты голосования:</b>\n${resultsText || 'Голосов пока нет'}\n\n` +
      `💡 <b>Победитель:</b> <b>«${winningText}»</b>\n` +
      `<i>Рекомендуется рассмотреть эту функцию для следующего релиза!</i>`

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

/** 3. Post 09:00 MSK Morning News Digest with Live Rates & Tech News */
export async function postDailyMorningPostToChannel(channelId = DEFAULT_CHANNEL): Promise<boolean> {
  if (!GROQ_API_KEY) return false

  try {
    const context = await fetchMorningNewsContext()
    const ratesStr = [
      context.rates.usd ? `💵 $ ${context.rates.usd} ₽` : '',
      context.rates.eur ? `💶 € ${context.rates.eur} ₽` : '',
      context.rates.cny ? `💴 ¥ ${context.rates.cny} ₽` : '',
      context.rates.btc ? `🪙 ₿ ${context.rates.btc}` : '',
    ].filter(Boolean).join('  |  ')

    const prompt =
      `Ты — автор официального Telegram-канала Zerf AI (@zerph_off).\n` +
      `Напиши стильный, информативный и лаконичный утренний дайджест новостей и продуктивности для жителей России.\n\n` +
      `Свежие данные на сегодня (${context.date}):\n` +
      `- Курсы валют: ${ratesStr || 'USD 90.5₽ | EUR 98.2₽ | BTC $60,000+'}\n` +
      `- Главные темы и новости: ${context.headlines.slice(0, 3).join('; ')}\n\n` +
      `Требования к оформлению (СТРОГО ДЛЯ ТЕЛЕГРАМА):\n` +
      `1. Используй ТОЛЬКО Telegram HTML теги: <b>жирный</b>, <i>курсив</i>, <code>моно</code>, <blockquote>цитата</blockquote>, <a href="...">ссылка</a>.\n` +
      `2. НЕ ИСПОЛЬЗУЙ Markdown-символы ** или # или ===. Только чистый HTML!\n` +
      `3. Используй символы валют и эстетичные значки (₽, $, €, ¥, ₿, ✦, ✧, ◈, ⚡, ☕, 🎯, ⏳, 📈, 🚀).\n` +
      `4. Структура поста:\n` +
      `   • <b>☕ УТРЕННИЙ ДАЙДЖЕСТ | [Дата]</b>\n` +
      `   • Блок курсов валют: <code>${ratesStr}</code>\n` +
      `   • <b>⚡ Главные события и технологии:</b> 2-3 коротких пункта с пользой\n` +
      `   • <blockquote>💡 <b>Фокус дня:</b> [Одна полезная мысль по тайм-менеджменту]</blockquote>\n` +
      `   • Призыв поставить цели на сегодня в боте <a href="https://t.me/Zerph_bot">@Zerph_bot</a> или на сайте <a href="https://zerph.vercel.app">zerph.vercel.app</a>.`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 700,
      }),
    })

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return false

    const tgRes = await callTg('sendMessage', {
      chat_id: channelId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })
    return tgRes?.ok ?? false
  } catch (err) {
    console.error('postDailyMorningPostToChannel error:', err)
    return false
  }
}

/** 4. Post 21:00 MSK Evening Reflection Post */
export async function postDailyEveningPostToChannel(channelId = DEFAULT_CHANNEL): Promise<boolean> {
  if (!GROQ_API_KEY) return false

  try {
    const prompt =
      `Ты — автор официального Telegram-канала Zerf AI (@zerph_off).\n` +
      `Напиши глубокий, эстетичный и вдохновляющий вечерний пост для подписчиков.\n\n` +
      `Требования к оформлению (СТРОГО ДЛЯ ТЕЛЕГРАМА):\n` +
      `1. Используй ТОЛЬКО Telegram HTML теги: <b>жирный</b>, <i>курсив</i>, <code>моно</code>, <blockquote>цитата</blockquote>, <a href="...">ссылка</a>.\n` +
      `2. НЕ ИСПОЛЬЗУЙ Markdown ** или # или ===. Только чистый HTML!\n` +
      `3. Используй символы: 🌙, 🕯️, 🪐, 🌌, ✦, ✧, ◈, 💎, ⏳, 🧠.\n` +
      `4. Структура поста:\n` +
      `   • <b>🌙 ВЕЧЕРНИЙ ИТОГ & РЕФЛЕКСИЯ</b>\n` +
      `   • 2-3 абзаца о важности подведения итогов дня, качественного отдыха и разгрузки мозга перед сном (выписать задачи в Zerf AI, чтобы отключить тревожность)\n` +
      `   • <blockquote>❝ [Вдохновляющая цитата или мысль вечера] ❞</blockquote>\n` +
      `   • Пожелание доброй ночи и ссылка на <a href="https://t.me/Zerph_bot">@Zerph_bot</a>.`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.75,
        max_tokens: 600,
      }),
    })

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content?.trim()
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

/** 5. Friday 00:00 MSK — AI Autonomous Feature Proposal */
export async function generateAndSendFridayAiProposal(): Promise<boolean> {
  if (!GROQ_API_KEY) return false

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
      `Ты — ведущий AI-Архитектор и CPO экосистемы Zerf AI. Твоя цель — автономно анализировать данные и предлагать самые нужные и прорывные функции для внедрения разработчиком.\n\n` +
      `📊 Агрегированная статистика системы за неделю:\n${JSON.stringify(statsContext, null, 2)}\n\n` +
      `Требования:\n` +
      `Используй Telegram HTML теги (<b>, <i>, <blockquote>, <code>).\n` +
      `1. Выдели 1 главную инновационную функцию для разработки на следующей неделе.\n` +
      `2. Объясни, почему она нужна пользователям.\n` +
      `3. Опиши логику работы и интерфейс.\n` +
      `4. Оцени рост удержания (Retention).`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 900,
      }),
    })

    const groqData = await groqRes.json()
    const proposal = groqData.choices?.[0]?.message?.content?.trim()
    if (!proposal) return false

    const adminIds = await getAdminChatIds()
    const msg =
      `🧠 <b>Еженедельное предложение от ИИ-Архитектора Zerf AI:</b>\n` +
      `📅 <i>Пятничный анализ продуктовой экосистемы</i>\n\n` +
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

/** 6. Post Welcome Intro Post in Native Telegram HTML */
export async function postWelcomeIntroToChannel(channelId = DEFAULT_CHANNEL): Promise<{ ok: boolean; text?: string; error?: string }> {
  if (!GROQ_API_KEY) return { ok: false, error: 'GROQ_API_KEY is not configured' }

  try {
    const prompt =
      `Ты — главный редактор официального Telegram-канала Zerf AI (@zerph_off).\n` +
      `Напиши ВЕЛИКОЛЕПНЫЙ, стильный, нативный Telegram-пост (Welcome Post) для нашего канала.\n\n` +
      `СТРОГИЕ ПРАВИЛА ОФОРМЛЕНИЯ В ТЕЛЕГРАМ:\n` +
      `1. Используй ТОЛЬКО Telegram HTML теги: <b>жирный текст</b>, <i>курсив</i>, <code>моноширинный</code>, <blockquote>красивая цитата/блок</blockquote>, <a href="...">ссылки</a>.\n` +
      `2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать Markdown символы (**звездочки**, #решетки, ===подчеркивания). ТОЛЬКО HTML!\n` +
      `3. Используй красивые символы валют и Unicode из symbl.cc (₽, $, €, ₿, ✦, ✧, ◈, ❖, 💎, 🚀, 🔥, ⚡, 🎯, ⏳, 🎙️, ☕, 🪐).\n\n` +
      `Содержание поста:\n` +
      `- Заголовок: 🚀 <b>ДОБРО ПОЖАЛОВАТЬ В ZERF AI!</b> ✦\n` +
      `- Миссия в блоке цитаты: <blockquote>🔥 <b>Миссия проекта:</b> Обсуждение, голосование, розыгрыши. Всё про наш Telegram-бот + сайт. Составьте ваш личный график вместе с нами.</blockquote>\n` +
      `- Раздел <b>🎯 Возможности экосистемы:</b>\n` +
      `  • 🎙️ <b>Голосовые задачи</b> — надиктуйте на бегу, ИИ сам поймет время и напомнит\n` +
      `  • ⏳ <b>Живой обратный отсчет</b> — точный таймер до дедлайна (как в часах)\n` +
      `  • 📷 <b>Vision AI</b> — мгновенное распознавание задач по фото расписания\n` +
      `  • 🍅 <b>Помодоро-фокус</b> — режим глубокой концентрации 25/5\n` +
      `  • 📅 <b>Синхронизация</b> — 1-клик подключение к Apple и Google Календарю\n` +
      `  • 🔥 <b>Стрики</b> — бесплатные дни Premium за непрерывную продуктивность\n` +
      `- Раздел <b>📣 Что будет в этом канале:</b>\n` +
      `  1. 🗳️ <b>Утренние опросы в 8:00</b> — вы голосуете, какую фичу мы создаем следующей\n` +
      `  2. ☕ <b>Утренний дайджест в 9:00</b> — новости, курсы валют (₽/$/€/₿) и лайфхаки\n` +
      `  3. 🎁 <b>Розыгрыши Premium</b> и подарков среди подписчиков\n` +
      `  4. 🌙 <b>Вечерние инсайты в 21:00</b>\n` +
      `- В конце блок ссылок:\n` +
      `  🤖 <b>Бот:</b> <a href="https://t.me/Zerph_bot">@Zerph_bot</a>\n` +
      `  🌐 <b>Веб-версия:</b> <a href="https://zerph.vercel.app">zerph.vercel.app</a>\n` +
      `- Напиши готовый HTML пост без лишних слов от себя.`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.65,
        max_tokens: 1100,
      }),
    })

    const groqData = await groqRes.json()
    const text = groqData.choices?.[0]?.message?.content?.trim()
    if (!text) return { ok: false, error: 'Empty AI response' }

    const tgRes = await callTg('sendMessage', {
      chat_id: channelId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })

    if (!tgRes?.ok) {
      // Fallback clean text
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
