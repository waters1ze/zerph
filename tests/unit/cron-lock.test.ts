import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

/**
 * Cron-lock contract tests.
 * Module keeps process-global state (sentKeys) and reads os.tmpdir() at import
 * time, so every test loads a FRESH module instance bound to a fresh tmp dir.
 */

type PrismaMock = {
  config: {
    create: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
  }
}

function resetGlobalCronState() {
  const g = globalThis as any
  g.__cronSentKeys?.clear()
  g.__reminderCooldownMap?.clear()
}

async function loadFresh(prismaMock: PrismaMock) {
  resetGlobalCronState()
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zerf-cron-test-'))
  vi.resetModules()
  vi.doMock('os', () => ({
    ...os,
    default: { ...os, tmpdir: () => tmpDir },
    tmpdir: () => tmpDir,
  }))
  vi.doMock('@/lib/backend/prisma', () => ({ prisma: prismaMock }))
  const mod = await import('@/lib/backend/cron-lock')
  return { mod, cleanup: () => { resetGlobalCronState(); fs.rmSync(tmpDir, { recursive: true, force: true }) } }
}

const makePrisma = (): PrismaMock => ({
  config: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
})

describe('tryAcquireCronLock (atomic global lock)', () => {
  let cleanup: () => void
  beforeEach(() => {})

  afterEach(() => {
    cleanup?.()
  })

  it('acquires on first call, rejects the second same-day caller', async () => {
    const prisma = makePrisma()
    const loaded = await loadFresh(prisma)
    cleanup = loaded.cleanup
    const { tryAcquireCronLock } = loaded.mod

    prisma.config.create.mockResolvedValue({})
    expect(await tryAcquireCronLock('channel_post', '2026-08-22')).toBe(true)
    // in-memory short circuit: DB not even consulted on the same key again
    expect(await tryAcquireCronLock('channel_post', '2026-08-22')).toBe(false)
    expect(prisma.config.create).toHaveBeenCalledTimes(1)
  })

  it('rejects when another instance already holds today lock (P2002 + same date)', async () => {
    const prisma = makePrisma()
    const loaded = await loadFresh(prisma)
    cleanup = loaded.cleanup
    const { tryAcquireCronLock } = loaded.mod

    const conflict: any = Object.assign(new Error('unique constraint'), { code: 'P2002' })
    prisma.config.create.mockRejectedValue(conflict)
    prisma.config.findUnique.mockResolvedValue({ key: 'cron_last_channel_post_date', value: '2026-08-22' })

    expect(await tryAcquireCronLock('channel_post', '2026-08-22')).toBe(false)
    expect(prisma.config.updateMany).not.toHaveBeenCalled()
  })

  it('claims a stale lock from a previous day via conditional updateMany', async () => {
    const prisma = makePrisma()
    const loaded = await loadFresh(prisma)
    cleanup = loaded.cleanup
    const { tryAcquireCronLock } = loaded.mod

    const conflict: any = Object.assign(new Error('unique constraint'), { code: 'P2002' })
    prisma.config.create.mockRejectedValue(conflict)
    prisma.config.findUnique.mockResolvedValue({ key: 'cron_last_channel_post_date', value: '2026-08-21' })
    prisma.config.updateMany.mockResolvedValue({ count: 1 })

    expect(await tryAcquireCronLock('channel_post', '2026-08-22')).toBe(true)
    expect(prisma.config.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'cron_last_channel_post_date', value: { not: '2026-08-22' } },
        data: { value: '2026-08-22' },
      })
    )
  })

  it('loses stale-claim race when another instance claimed first (updateMany count=0)', async () => {
    const prisma = makePrisma()
    const loaded = await loadFresh(prisma)
    cleanup = loaded.cleanup
    const { tryAcquireCronLock } = loaded.mod

    const conflict: any = Object.assign(new Error('unique constraint'), { code: 'P2002' })
    prisma.config.create.mockRejectedValue(conflict)
    prisma.config.findUnique.mockResolvedValue({ key: 'k', value: '2026-08-21' })
    prisma.config.updateMany.mockResolvedValue({ count: 0 })

    expect(await tryAcquireCronLock('channel_post', '2026-08-22')).toBe(false)
  })

  it('TRANSIENT DB ERROR MUST NOT POISON IN-MEMORY LOCK STATE', async () => {
    // Regression test for audit finding C-7:
    // old code marked sentKeys BEFORE attempting the DB insert; a transient
    // failure permanently suppressed the task for this instance while
    // isCronAlreadyDoneToday() reported a false "already done".
    const prisma = makePrisma()
    const loaded = await loadFresh(prisma)
    cleanup = loaded.cleanup
    const { tryAcquireCronLock, isCronAlreadyDoneToday } = loaded.mod

    prisma.config.create.mockRejectedValueOnce(new Error('ETIMEDOUT: transient pool error'))
    expect(await tryAcquireCronLock('morning_greeting', '2026-08-22')).toBe(false)

    // Lock was never acquired anywhere -> task must NOT look "already done"
    prisma.config.findUnique.mockResolvedValue(null)
    expect(await isCronAlreadyDoneToday('morning_greeting', '2026-08-22')).toBe(false)

    // And a retry must be possible within the same process
    prisma.config.create.mockResolvedValueOnce({})
    expect(await tryAcquireCronLock('morning_greeting', '2026-08-22')).toBe(true)
  })
})

describe('isCronAlreadyDoneToday / markCronDoneToday', () => {
  it('reports not-done before marking, done after marking (memory fast path)', async () => {
    const prisma = makePrisma()
    const loaded = await loadFresh(prisma)
    const cleanupLocal = loaded.cleanup
    const { isCronAlreadyDoneToday, markCronDoneToday } = loaded.mod

    prisma.config.findUnique.mockResolvedValue(null)
    expect(await isCronAlreadyDoneToday('weekly_report', '2026-08-22')).toBe(false)

    prisma.config.upsert.mockResolvedValue({})
    await markCronDoneToday('weekly_report', '2026-08-22')

    expect(await isCronAlreadyDoneToday('weekly_report', '2026-08-22')).toBe(true)
    expect(prisma.config.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'cron_last_weekly_report_date' },
        create: { key: 'cron_last_weekly_report_date', value: '2026-08-22' },
      })
    )
    cleanupLocal()
  })

  it('DB lookup failure is not interpreted as "done"', async () => {
    const prisma = makePrisma()
    const loaded = await loadFresh(prisma)
    const cleanupLocal = loaded.cleanup
    const { isCronAlreadyDoneToday } = loaded.mod

    prisma.config.findUnique.mockRejectedValue(new Error('db down'))
    expect(await isCronAlreadyDoneToday('evening_review', '2026-08-22')).toBe(false)
    cleanupLocal()
  })
})

describe('isUserCronDoneToday / markUserCronDoneToday (per-user locks)', () => {
  it('keys are scoped per user and per date', async () => {
    const prisma = makePrisma()
    const loaded = await loadFresh(prisma)
    const cleanupLocal = loaded.cleanup
    const { isUserCronDoneToday, markUserCronDoneToday } = loaded.mod

    prisma.config.upsert.mockResolvedValue({})
    prisma.config.findUnique.mockImplementation(async ({ where }: any) =>
      where.key === 'cron_greeting_u_42' ? { key: where.key, value: '2026-08-22' } : null
    )

    await markUserCronDoneToday('greeting', BigInt(42), '2026-08-22')
    expect(await isUserCronDoneToday('greeting', '42', '2026-08-22')).toBe(true)
    expect(await isUserCronDoneToday('greeting', '43', '2026-08-22')).toBe(false)
    expect(await isUserCronDoneToday('greeting', '42', '2026-08-23')).toBe(false)
    cleanupLocal()
  })
})

describe('reminder cooldown', () => {
  it('blocks within cooldown window and allows after expiry', async () => {
    const prisma = makePrisma()
    const loaded = await loadFresh(prisma)
    const cleanupLocal = loaded.cleanup
    const { isReminderInCooldown, markReminderSent } = loaded.mod

    const taskId = `t-${Math.random()}`
    expect(isReminderInCooldown(taskId, 1, 30)).toBe(false)
    markReminderSent(taskId, 1)
    expect(isReminderInCooldown(taskId, 1, 60_000)).toBe(true)

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(isReminderInCooldown(taskId, 1, 30)).toBe(false)
        resolve()
      }, 40)
    }).finally(cleanupLocal)
  })

  it('cooldown stages are independent', async () => {
    const prisma = makePrisma()
    const loaded = await loadFresh(prisma)
    const cleanupLocal = loaded.cleanup
    const { isReminderInCooldown, markReminderSent } = loaded.mod

    const taskId = `t-${Math.random()}`
    markReminderSent(taskId, 'stage-a')
    expect(isReminderInCooldown(taskId, 'stage-b')).toBe(false)
    cleanupLocal()
  })
})
