import { NextRequest, NextResponse } from 'next/server'
import { generateCommentAnalysisReport, sendCommentReportToAdminsTelegram } from '@/lib/backend/comment-analyzer'
import { prisma } from '@/lib/backend/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '40', 10)
    const forceRefresh = searchParams.get('refresh') === 'true'

    const report = await generateCommentAnalysisReport(limit, false, forceRefresh)
    return NextResponse.json({ ok: true, report })
  } catch (err: unknown) {
    console.error('Comment feedback API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
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
