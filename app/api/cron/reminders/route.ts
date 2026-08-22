import { NextRequest, NextResponse } from 'next/server'
import { runAllCronTasks, runMorningGreeting, runForceMorningGreeting, runEveningReview, runReminderCheck } from '@/lib/backend/cron-runner'
import { postDailyMorningPostToChannel, postDailyPollToChannel, postDailyEveningPostToChannel, closeDailyPollAndNotifyAdmins } from '@/lib/backend/channel-poster'
import { getAdminSecret, secretsMatch } from '@/lib/backend/auth'
import { checkInMemoryRateLimit } from '@/lib/backend/rate-limit'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function isAuthorizedCronCall(req: NextRequest, searchParams: URLSearchParams): boolean {
  const adminSecret = getAdminSecret()
  if (!adminSecret) return false
  // Vercel Cron sends: Authorization: Bearer $CRON_SECRET
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const headerSecret = req.headers.get('x-admin-secret') || ''
  const querySecret = searchParams.get('secret') || ''
  return secretsMatch(bearer, adminSecret) ||
    secretsMatch(bearer, process.env.CRON_SECRET || null) ||
    secretsMatch(headerSecret, adminSecret) ||
    secretsMatch(querySecret, adminSecret)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    // Manual action triggers require a valid secret (header or query).
    if (action) {
      if (!isAuthorizedCronCall(req, searchParams)) {
        return NextResponse.json(
          { error: 'Доступ запрещен. Только владелец может запускать ручные тесты.' },
          { status: 403 }
        )
      }

      if (action === 'morning_post') {
        const postRes = await postDailyMorningPostToChannel(undefined, true)
        return NextResponse.json({ action: 'morning_post', ...postRes })
      }
      if (action === 'poll') {
        const ok = await postDailyPollToChannel(undefined, true)
        return NextResponse.json({ ok, action: 'poll' })
      }
      if (action === 'evening_post') {
        const ok = await postDailyEveningPostToChannel(undefined, true)
        return NextResponse.json({ ok, action: 'evening_post' })
      }
      if (action === 'poll_close') {
        const ok = await closeDailyPollAndNotifyAdmins()
        return NextResponse.json({ ok, action: 'poll_close' })
      }
      if (action === 'morning_greeting') {
        await runMorningGreeting()
        return NextResponse.json({ ok: true, action: 'morning_greeting' })
      }
      // Force-send morning greeting regardless of time window or lock state
      if (action === 'force_morning_greeting') {
        await runForceMorningGreeting()
        return NextResponse.json({ ok: true, action: 'force_morning_greeting' })
      }
      if (action === 'evening_review') {
        await runEveningReview()
        return NextResponse.json({ ok: true, action: 'evening_review' })
      }
    }

    // Standard automated cron trigger (Vercel Cron / Internal Scheduler).
    // SECURITY (audit H-7): without CRON_SECRET this endpoint previously ran
    // the full cron suite for ANY anonymous caller (2/min per instance).
    // It is now fail-closed: configure CRON_SECRET, or explicitly opt in to
    // open triggering with ALLOW_ANONYMOUS_CRON=true for legacy setups.
    if (process.env.CRON_SECRET) {
      if (!isAuthorizedCronCall(req, searchParams)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (!isAuthorizedCronCall(req, searchParams)) {
      if (
        process.env.ALLOW_ANONYMOUS_CRON !== 'true' ||
        !checkInMemoryRateLimit('cron:anonymous', 2, 60 * 1000)
      ) {
        console.error('[Cron] CRON_SECRET is not configured — refusing unauthenticated runAllCronTasks()')
        return NextResponse.json(
          { error: 'Forbidden', hint: 'Set CRON_SECRET (recommended) or ALLOW_ANONYMOUS_CRON=true' },
          { status: 403 }
        )
      }
    }

    await runAllCronTasks()
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
