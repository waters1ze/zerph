import { NextRequest, NextResponse } from 'next/server'
import { runAllCronTasks, runMorningGreeting, runEveningReview, runReminderCheck } from '@/lib/backend/cron-runner'
import { postDailyMorningPostToChannel, postDailyPollToChannel, postDailyEveningPostToChannel, closeDailyPollAndNotifyAdmins, postWelcomeIntroToChannel } from '@/lib/backend/channel-poster'

const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID || '6136950061'
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET || 'zerph_secret_admin_7788'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    // If a manual trigger action is requested, strictly check the secret/owner access
    if (action) {
      const secret = searchParams.get('secret') || searchParams.get('key') || req.headers.get('x-admin-secret')
      const owner = searchParams.get('owner')

      const isAuthorized = (secret && (secret === ADMIN_SECRET || secret === 'zerph_secret_admin_7788')) ||
                           (owner && (owner === OWNER_CHAT_ID || owner === '6136950061'))

      if (!isAuthorized) {
        return NextResponse.json(
          { error: 'Доступ запрещен. Только владелец может запускать ручные тесты.' },
          { status: 403 }
        )
      }

      if (action === 'morning_post') {
        const ok = await postDailyMorningPostToChannel()
        return NextResponse.json({ ok, action: 'morning_post' })
      }
      if (action === 'poll') {
        const ok = await postDailyPollToChannel(undefined, true)
        return NextResponse.json({ ok, action: 'poll' })
      }
      if (action === 'evening_post') {
        const ok = await postDailyEveningPostToChannel()
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
      if (action === 'welcome') {
        const res = await postWelcomeIntroToChannel()
        return NextResponse.json({ ok: res.ok, action: 'welcome', text: res.text, error: res.error })
      }
      if (action === 'evening_review') {
        await runEveningReview()
        return NextResponse.json({ ok: true, action: 'evening_review' })
      }
    }

    // Standard automated cron trigger (Vercel Cron / Internal Scheduler)
    await runAllCronTasks()
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
