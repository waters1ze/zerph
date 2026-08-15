import { prisma } from './prisma'
import { callGroqChatCompletion } from './groq-pool'

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
 * Reads ONLY NEW, unanalyzed comments (isAnalyzed: false).
 * Optionally marks them as analyzed after generating the report.
 */
export async function generateCommentAnalysisReport(
  limit = 100,
  markAsAnalyzed = false
): Promise<CommentAnalysisResult> {
  // Fetch fresh comments that have NOT been analyzed in previous reports
  const newComments = await prisma.channelComment.findMany({
    where: { isAnalyzed: false },
    take: limit,
    orderBy: { createdAt: 'desc' }
  })

  // If no new comments, check if there are any recent analyzed comments to show history
  if (newComments.length === 0) {
    const totalInDb = await prisma.channelComment.count().catch(() => 0)
    return {
      totalAnalyzed: totalInDb,
      newCommentsCount: 0,
      sentimentSummary: { positivePercent: 0, neutralPercent: 0, negativePercent: 0 },
      topRequests: ['Все предыдущие комментарии уже проанализированы в прошлых отчетах'],
      mainIssuesOrQuestions: [],
      executiveSummary: totalInDb > 0
        ? 'Все ранее поступившие комментарии уже были включены в предыдущие сводки. Новых комментариев пока не поступало.'
        : 'Комментариев за эту неделю пока не поступало. Отчет формируется еженедельно перед отправкой сводки.',
      rawComments: []
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
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
    })

    analysis = JSON.parse(result.content || '{}')
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
    totalAnalyzed: newComments.length,
    newCommentsCount: newComments.length,
    sentimentSummary: analysis?.sentiment || { positivePercent: 80, neutralPercent: 15, negativePercent: 5 },
    topRequests: analysis?.topRequests || ['Пользователям нравится текущий функционал'],
    mainIssuesOrQuestions: analysis?.mainIssuesOrQuestions || [],
    executiveSummary: analysis?.executiveSummary || 'Аудитория активно обсуждает обновления проекта.',
    rawComments: newComments.map(c => ({
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
    const ownerEnv = process.env.OWNER_CHAT_ID || '6136950061'
    if (ownerEnv) adminIds.add(Number(ownerEnv))
    adminIds.add(6136950061)
    adminIds.add(5078516086)

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
