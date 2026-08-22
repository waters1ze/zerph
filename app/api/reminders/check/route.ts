/**
 * GET /api/reminders/check — Checks and pushes due Telegram notifications respecting user timezones
 * Runs the deduplicated reminder engine.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runReminderCheck } from '@/lib/backend/cron-runner'
import { getAuthenticatedUser, getAdminSecret, secretsMatch } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // The web client pings this endpoint with its session credentials; the
    // cron scheduler authenticates with the admin/CRON secret. Everything
    // else is refused so outsiders cannot force-run the reminder engine.
    const authUser = await getAuthenticatedUser(req).catch(() => null)
    const clientChatId = req.headers.get('x-chat-id') || req.cookies.get('zerf_chat_id')?.value
    if (!authUser && !clientChatId) {
      const secret = getAdminSecret()
      const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
      const headerSecret = req.headers.get('x-admin-secret') || ''
      const cronSecret = process.env.CRON_SECRET || null
      const authorized =
        (secret && (secretsMatch(bearer, secret) || secretsMatch(headerSecret, secret))) ||
        (cronSecret && (secretsMatch(bearer, cronSecret) || secretsMatch(headerSecret, cronSecret)))
      if (!authorized) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
      }
    }

    await runReminderCheck()
    return NextResponse.json({ ok: true, timestamp: Date.now() })
  } catch (err) {
    console.error('Reminder check error:', err)
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
