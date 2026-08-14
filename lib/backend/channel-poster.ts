import { prisma } from './prisma'
import { getMskDateTime } from './db'

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
    // Check if already posted today
    const existing = await prisma.channelPoll.findFirst({
      where: { date: mskDate, channelId }
    })
    if (existing) return false

    // Generate smart poll using Groq
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

    // Stop poll in Telegram and fetch results
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
        return `${idx === 0 ? '🏆' : '▫️'} *${o.text}* — ${o.voter_count} гол. (${pct}%)`
      }).join('\n')
    }

    await prisma.channelPoll.update({
      where: { id: pollRecord.id },
      data: { isClosed: true, winningOption: winningText }
    })

    // Send detailed report to Admins & Owner
    const adminIds = await getAdminChatIds()
    const reportMsg =
      `📊 *Итоги дневного опроса в канале ${channelId}:*\n\n` +
      `❓ *Вопрос:* ${pollRecord.question}\n` +
      `👥 Всего проголосовало: *${totalVotes} чел.*\n\n` +
      `📈 *Результаты голосования:*\n${resultsText || 'Голосов пока нет'}\n\n` +
      `💡 *Победитель:* *«${winningText}»*\n` +
      `_Рекомендуется рассмотреть эту функцию для следующего релиза!_`

    for (const adminId of adminIds) {
      await callTg('sendMessage', {
        chat_id: adminId,
        text: reportMsg,
        parse_mode: 'Markdown'
      })
    }

    console.log(`[Zerf Channel] Poll closed and admins notified for ${channelId}`)
    return true
  } catch (err) {
    console.error('closeDailyPollAndNotifyAdmins error:', err)
    return false
  }
}

/** 3. Post 09:00 MSK Morning Post */
export async function postDailyMorningPostToChannel(channelId = DEFAULT_CHANNEL): Promise<boolean> {
  if (!GROQ_API_KEY) return false

  try {
    const prompt =
      'Ты — эксперт по личной эффективности и автор официального Telegram-канала Zerf AI (@zerph_off). Напиши яркий, полезный и вовлекающий утренний пост (150-250 слов) на русском языке для активных людей и жителей России. ' +
      'Темы на выбор: лайфхак по планированию дня, правильный старт утра, победа над прокрастинацией или как использовать голосовые напоминания и таймеры Zerf AI. ' +
      'Используй форматирование: жирный шрифт, списки, эмодзи. В конце добавь ссылку на бота @Zerph_bot и сайт zerph.vercel.app.'

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 600,
      }),
    })
    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return false

    const tgRes = await callTg('sendMessage', {
      chat_id: channelId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    })
    return tgRes?.ok ?? false
  } catch (err) {
    console.error('postDailyMorningPostToChannel error:', err)
    return false
  }
}

/** 4. Post 21:00 MSK Evening Post */
export async function postDailyEveningPostToChannel(channelId = DEFAULT_CHANNEL): Promise<boolean> {
  if (!GROQ_API_KEY) return false

  try {
    const prompt =
      'Ты — автор Telegram-канала Zerf AI (@zerph_off). Напиши вдохновляющий и полезный вечерний пост (150-200 слов) на русском языке. ' +
      'Тема: вечерняя рефлексия, подведение итогов дня, качественный сон и разгрузка головы перед сном (например, записать все мысли в заметки Zerf AI, чтобы спокойно спать). ' +
      'Используй эмодзи и Markdown. В конце ссылка на @Zerph_bot.'

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 500,
      }),
    })
    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return false

    const tgRes = await callTg('sendMessage', {
      chat_id: channelId,
      text,
      parse_mode: 'Markdown',
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
    // 1. Gather aggregate platform metrics
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
      `На основе этих данных и трендов продуктивности:\n` +
      `1. Выдели 1 главную инновационную функцию, которую необходимо разработать на следующей неделе.\n` +
      `2. Объясни, почему она нужна пользователям (какую боль решает).\n` +
      `3. Опиши логику работы и интерфейс.\n` +
      `4. Оцени потенциальный рост удержания (Retention).\n\n` +
      `Форматируй ответ в красивый структурированный Markdown с заголовками и эмодзи.`

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
      `🧠 *Еженедельное предложение от ИИ-Архитектора Zerf AI:*\n` +
      `📅 Пятничный анализ продуктовой экосистемы\n\n` +
      proposal

    for (const adminId of adminIds) {
      await callTg('sendMessage', {
        chat_id: adminId,
        text: msg,
        parse_mode: 'Markdown',
      })
    }

    console.log('[Zerf AI Architect] Friday proposal sent to admins.')
    return true
  } catch (err) {
    console.error('generateAndSendFridayAiProposal error:', err)
    return false
  }
}
