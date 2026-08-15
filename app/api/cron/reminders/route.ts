import { NextRequest, NextResponse } from 'next/server'
import { runAllCronTasks, runMorningGreeting, runEveningReview, runReminderCheck } from '@/lib/backend/cron-runner'
import { postDailyMorningPostToChannel, postDailyPollToChannel, postDailyEveningPostToChannel, closeDailyPollAndNotifyAdmins } from '@/lib/backend/channel-poster'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    if (action === 'morning_post') {
      const ok = await postDailyMorningPostToChannel()
      return NextResponse.json({ ok, action: 'morning_post' })
    }
    if (action === 'poll') {
      const ok = await postDailyPollToChannel()
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
    if (action === 'evening_review') {
      await runEveningReview()
      return NextResponse.json({ ok: true, action: 'evening_review' })
    }

    await runAllCronTasks()
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
