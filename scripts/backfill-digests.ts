/**
 * Backfill historical digests for existing users.
 *
 * Usage:
 *   npm run backfill-digests -- --chatId=424242 --from=2026-01-01
 *   npm run backfill-digests -- --from=2025-06-01            (all active users)
 */
import dotenv from 'dotenv'
dotenv.config()

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2)
      .filter(a => a.startsWith('--'))
      .map(a => {
        const [k, ...rest] = a.slice(2).split('=')
        return [k, rest.join('=') || 'true']
      })
  ) as { chatId?: string; from?: string; to?: string }

  const { prisma } = await import('../lib/backend/prisma')
  const { ensureDigestsDue, generateDayDigest, generateWeekDigest, generateMonthDigest, generateYearDigest } = await import('../lib/backend/digests')
  const { getUserTzSafe } = await import('../lib/backend/digests')

  if (!args.chatId && !args.from) {
    console.log('Nothing to do: pass --chatId=<id> and/or --from=YYYY-MM-DD')
    await prisma.$disconnect()
    return
  }

  const chatIds = args.chatId
    ? [BigInt(args.chatId)]
    : (await prisma.telegramChat.findMany({
        where: { lastActiveAt: { gte: new Date(Date.now() - 365 * 24 * 3600 * 1000) } },
        select: { chatId: true },
        take: 2000,
      })).map(u => u.chatId)

  console.log(`Backfilling digests for ${chatIds.length} user(s)...`)

  for (const chatId of chatIds) {
    const tz = await getUserTzSafe(chatId)
    const from = args.from || '1970-01-01' // engine skips periods with zero raw data via empty-markers only when scanned; we bound by `from` to save scans

    // Walk day-by-day from `from` to yesterday building day digests.
    const todayLocal = (() => {
      const y = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(new Date()))
      const m = String(new Intl.DateTimeFormat('en-US', { timeZone: tz, month: '2-digit' }).format(new Date()))
      const d = String(new Intl.DateTimeFormat('en-US', { timeZone: tz, day: '2-digit' }).format(new Date()))
      return `${y}-${m}-${d}`
    })()

    let cur = from
    let guard = 0
    while (cur < todayLocal && guard++ < 1500) {
      try {
        await generateDayDigest(chatId, cur)
      } catch (err: any) {
        console.warn(`  day ${cur} failed: ${err?.message}`)
      }
      const next = new Date(Date.UTC(...(cur.split('-').map(Number) as [number, number, number])))
      cur = new Date(next.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10)
    }

    // Roll up weeks/months/year for the covered span.
    for (let i = 0; i < 8; i++) {
      const monday = new Date(Date.now() - (i + 7) * 24 * 3600 * 1000)
      const mondayStr = new Date(monday.getTime() - ((monday.getUTCDay() + 6) % 7) * 24 * 3600 * 1000).toISOString().slice(0, 10)
      try { await generateWeekDigest(chatId, mondayStr) } catch {}
    }
    const nowYear = Number(todayLocal.slice(0, 4))
    for (let y = nowYear - 1; y <= nowYear; y++) {
      for (let m = 1; m <= 12; m++) {
        try { await generateMonthDigest(chatId, y, m) } catch {}
      }
      try { await generateYearDigest(chatId, y) } catch {}
    }

    console.log(`  ✓ chatId=${chatId}`)
  }

  // Final planned sweep fills any remaining gaps within rate limits.
  const res = await ensureDigestsDue({ chatIds })
  console.log('Sweep:', res)

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
