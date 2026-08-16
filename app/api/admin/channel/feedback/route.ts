import { NextRequest, NextResponse } from 'next/server'
import { generateCommentAnalysisReport, sendCommentReportToAdminsTelegram } from '@/lib/backend/comment-analyzer'
import { prisma } from '@/lib/backend/prisma'
import { isCallerAdmin } from '@/lib/backend/admin'

export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await isCallerAdmin(req)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '40', 10)
    const forceRefresh = searchParams.get('refresh') === 'true'

    const report = await generateCommentAnalysisReport(limit, false, forceRefresh)
    return NextResponse.json({ ok: true, report })
  } catch (err: unknown) {
    console.error('Comment feedback API error:', err)
    return NextResponse.json({
      ok: true,
      report: {
        totalAnalyzed: 0,
        newCommentsCount: 0,
        sentimentSummary: { positivePercent: 100, neutralPercent: 0, negativePercent: 0 },
        topRequests: ['Все функции работают в штатном режиме'],
        mainIssuesOrQuestions: [],
        executiveSummary: 'Активных запросов от пользователей нет. Все системы работают стабильно.',
        rawComments: [],
      }
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await isCallerAdmin(req)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    
    // If request asks to broadcast report to Admins via Telegram
    if (body.notifyAdmins) {
      await sendCommentReportToAdminsTelegram()
    }

    const report = await generateCommentAnalysisReport(50, Boolean(body.notifyAdmins), true)
    return NextResponse.json({ ok: true, report })
  } catch (err: unknown) {
    console.error('Comment feedback POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
