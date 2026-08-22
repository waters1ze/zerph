import { prisma } from './prisma'
import { callGroqChatCompletion } from './groq-pool'
import { GROQ_CHAT_MODEL } from '@/lib/config'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export interface CommentAnalysisResult {
  totalAnalyzed: number
  newCommentsCount: number
  sentimentSummary: {
    positivePercent: number
    neutralPercent: number
    negativePercent: number
  }
  topRequests: string[]
  mainIssuesOrQuestions: string[]
  executiveSummary: string
  rawComments: Array<{
    id: string
    userName: string | null
    text: string
    createdAt: string
  }>
}

/**
 * 1. Passive real-time capture:
 * ONLY saves raw text to database with isAnalyzed: false.
 * Does NOT call any LLM or AI in real-time.
 */
export async function recordChannelComment(data: {
  channelPostId?: number
  chatId?: number | bigint
  userName?: string
  text: string
}) {
  try {
    return await prisma.channelComment.create({
      data: {
        channelPostId: data.channelPostId,
        chatId: data.chatId ? BigInt(data.chatId) : null,
        userName: data.userName || 'Подписчик',
        text: data.text.slice(0, 1000),
        isAnalyzed: false,
      }
    })
  } catch (err) {
    console.error('Error saving channel comment:', err)
    return null
  }
}

/**
 * 2. Scheduled / On-Demand Batch AI Analysis:
 * - When forceRefresh = false: Returns cached report from DB Config + real comment count. Zero LLM calls!
 * - When forceRefresh = true: Runs Groq LLM batch analysis strictly on unanalyzed comments, saves cache to DB.
 */
export async function generateCommentAnalysisReport(
  limit = 100,
  markAsAnalyzed = false,
  forceRefresh = false
): Promise<CommentAnalysisResult> {
  const totalInDb = await prisma.channelComment.count().catch(() => 0)
  const unanalyzedCount = await prisma.channelComment.count({ where: { isAnalyzed: false } }).catch(() => 0)

  const recentComments = await prisma.channelComment.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' }
  })

  // If not force refresh, check if we have a cached report in Config
  if (!forceRefresh) {
    const cachedConfig = await prisma.config.findUnique({
      where: { key: 'last_comment_analysis_json' }
    }).catch(() => null)

    if (cachedConfig?.value) {
      try {
        const cached = JSON.parse(cachedConfig.value)
        return {
          totalAnalyzed: totalInDb,
          newCommentsCount: unanalyzedCount,
          sentimentSummary: cached.sentiment || { positivePercent: 0, neutralPercent: 0, negativePercent: 0 },
          topRequests: cached.topRequests || [],
          mainIssuesOrQuestions: cached.mainIssuesOrQuestions || [],
          executiveSummary: cached.executiveSummary || 'Сводка сформирована на основе предыдущих комментариев.',
          rawComments: recentComments.map(c => ({
            id: c.id,
            userName: c.userName,
            text: c.text,
            createdAt: c.createdAt.toISOString()
          }))
        }
      } catch {}
    }

    // If no cache and no comments at all
    if (totalInDb === 0) {
      return {
        totalAnalyzed: 0,
        newCommentsCount: 0,
        sentimentSummary: { positivePercent: 0, neutralPercent: 0, negativePercent: 0 },
        topRequests: ['Комментариев от подписчиков пока нет'],
        mainIssuesOrQuestions: [],
        executiveSummary: 'Комментариев за эту неделю пока не поступало. Отчет формируется еженедельно по пятницам.',
        rawComments: []
      }
    }

    // Cache miss on a plain read (admin panel open): NEVER kick off an LLM run
    // here — it used to block the panel for 45+ seconds. The user presses
    // "Свежий ИИ-анализ" (forceRefresh) to build a report on demand.
    return {
      totalAnalyzed: totalInDb,
      newCommentsCount: unanalyzedCount,
      sentimentSummary: { positivePercent: 0, neutralPercent: 0, negativePercent: 0 },
      topRequests: [`${unanalyzedCount} новых комментариев ещё не проанализированы ИИ`],
      mainIssuesOrQuestions: [],
      executiveSummary: 'Кэшированный отчет ещё не сформирован. Нажмите «Свежий ИИ-анализ», чтобы запустить анализ.',
      rawComments: recentComments.map(c => ({
        id: c.id,
        userName: c.userName,
        text: c.text,
        createdAt: c.createdAt.toISOString()
      }))
    }
  }

  // If forceRefresh or no cache: fetch fresh comments that have NOT been analyzed
  const newComments = await prisma.channelComment.findMany({
    where: { isAnalyzed: false },
    take: limit,
    orderBy: { createdAt: 'desc' }
  })

  if (newComments.length === 0) {
    return {
      totalAnalyzed: totalInDb,
      newCommentsCount: 0,
      sentimentSummary: { positivePercent: 0, neutralPercent: 0, negativePercent: 0 },
      topRequests: ['Все комментарии уже были включены в предыдущие отчеты'],
      mainIssuesOrQuestions: [],
      executiveSummary: totalInDb > 0
        ? 'Все ранее поступившие комментарии уже были включены в предыдущие сводки. Новых комментариев пока не поступало.'
        : 'Комментариев за эту неделю пока не поступало. Отчет формируется еженедельно перед отправкой сводки.',
      rawComments: recentComments.map(c => ({
        id: c.id,
        userName: c.userName,
        text: c.text,
        createdAt: c.createdAt.toISOString()
      }))
    }
  }

  const commentTexts = newComments.map(c => `${c.userName || 'Подписчик'}: ${c.text}`).join('\n')
  let analysis: any = null

  try {
    const prompt =
      `Ты — ведущий продуктовый аналитик экосистемы Zerf AI. Проанализируй новую порцию свежих комментариев подписчиков под постами Telegram-канала @zerph_off:\n\n` +
      `${commentTexts}\n\n` +
      `Верни строго JSON со следующей структурой:\n` +
      `{\n` +
      `  "sentiment": { "positivePercent": 75, "neutralPercent": 20, "negativePercent": 5 },\n` +
      `  "topRequests": ["Запрос 1", "Запрос 2", "Запрос 3"],\n` +
      `  "mainIssuesOrQuestions": ["Вопрос/проблема 1", "Вопрос 2"],\n` +
      `  "executiveSummary": "Краткая выжимка (2-3 предложения) настроений аудитории и ключевых инсайтов."\n` +
      `}`

    const result = await callGroqChatCompletion({
      model: GROQ_CHAT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
    })

    analysis = JSON.parse(result.content || '{}')

    // Cache the analysis in DB Config
    if (analysis?.sentiment) {
      await prisma.config.upsert({
        where: { key: 'last_comment_analysis_json' },
        update: { value: JSON.stringify(analysis) },
        create: { key: 'last_comment_analysis_json', value: JSON.stringify(analysis) },
      }).catch(() => {})
    }
  } catch (e) {
    console.error('Groq batch comment analysis error:', e)
  }

  // If requested (e.g. before sending weekly telegram digest to admins), mark these comments as analyzed
  if (markAsAnalyzed && newComments.length > 0) {
    const ids = newComments.map(c => c.id)
    await prisma.channelComment.updateMany({
      where: { id: { in: ids } },
      data: {
        isAnalyzed: true,
        analyzedAt: new Date(),
      }
    }).catch(err => console.error('Failed to mark comments as analyzed:', err))
  }

  return {
    totalAnalyzed: totalInDb,
    newCommentsCount: newComments.length,
    sentimentSummary: analysis?.sentiment || { positivePercent: 0, neutralPercent: 0, negativePercent: 0 },
    topRequests: analysis?.topRequests || ['Пользователям нравится текущий функционал'],
    mainIssuesOrQuestions: analysis?.mainIssuesOrQuestions || [],
    executiveSummary: analysis?.executiveSummary || 'Сводка сформирована по комментариям сообщества.',
    rawComments: recentComments.map(c => ({
      id: c.id,
      userName: c.userName,
      text: c.text,
      createdAt: c.createdAt.toISOString()
    }))
  }
}

/**
 * 3. Send digest to admins:
 * Analyzes fresh comments and automatically marks them as analyzed.
 */
export async function sendCommentReportToAdminsTelegram(): Promise<boolean> {
  if (!BOT_TOKEN) return false

  try {
    // Generate analysis strictly for new comments and mark them as analyzed
    const report = await generateCommentAnalysisReport(50, true)

    const adminIds = new Set<number>()
    const ownerEnv = process.env.OWNER_CHAT_ID
    if (ownerEnv && !isNaN(Number(ownerEnv))) adminIds.add(Number(ownerEnv))

    const envAdmins = (process.env.ADMIN_CHAT_IDS || '')
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n) && n > 0)
    envAdmins.forEach(id => adminIds.add(id))

    const dbAdmins = await prisma.telegramChat.findMany({
      where: { isAdmin: true },
      select: { chatId: true },
    })
    dbAdmins.forEach(a => adminIds.add(Number(a.chatId)))

    const msg = report.newCommentsCount > 0
      ? `✦ <b>СВЕЖИЙ ОТЧЕТ ИИ ПО КОММЕНТАРИЯМ ИЗ @zerph_off</b>\n\n` +
        `<b>Новых комментариев за период:</b> ${report.newCommentsCount}\n` +
        `<b>Индекс настроения:</b> ${report.sentimentSummary.positivePercent}% позитив | ${report.sentimentSummary.neutralPercent}% нейтрально | ${report.sentimentSummary.negativePercent}% критика\n\n` +
        `◈ <b>Топ запросов подписчиков:</b>\n` +
        report.topRequests.map(r => `▪ ${r}`).join('\n') +
        `\n\n<blockquote>${report.executiveSummary}</blockquote>\n\n` +
        `<i>Все эти комментарии помечены как обработанные. Панель управления: <a href="https://zeprh.vercel.app">zeprh.vercel.app</a></i>`
      : `✦ <b>ОТЧЕТ ИИ ПО КОММЕНТАРИЯМ ИЗ @zerph_off</b>\n\n` +
        `📊 <b>Статус:</b> Новых необработанных комментариев с момента прошлого отчета не поступало.\n\n` +
        `<i>Панель администратора: <a href="https://zeprh.vercel.app">zeprh.vercel.app</a></i>`

    for (const cid of Array.from(adminIds)) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cid,
          text: msg,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        })
      }).catch(() => {})
    }

    return true
  } catch (err) {
    console.error('sendCommentReportToAdminsTelegram error:', err)
    return false
  }
}
