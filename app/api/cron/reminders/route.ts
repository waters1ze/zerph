/**
 * GET /api/cron/reminders — Scheduled Reminders Endpoint
 * Can be called by Railway Cron or Vercel Cron every minute / few minutes.
 */

import { NextResponse } from 'next/server'
import { runReminderCheck } from '@/lib/backend/cron-runner'

export async function GET() {
  try {
    await runReminderCheck()
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
