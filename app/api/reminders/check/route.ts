/**
 * GET /api/reminders/check — Checks and pushes due Telegram notifications respecting user timezones
 * Runs the deduplicated reminder engine.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runReminderCheck } from '@/lib/backend/cron-runner'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    await runReminderCheck()
    return NextResponse.json({ ok: true, timestamp: Date.now() })
  } catch (err) {
    console.error('Reminder check error:', err)
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
