import { prisma } from '../lib/backend/prisma'
import { isCronAlreadyDoneToday, isUserCronDoneToday } from '../lib/backend/cron-lock'
import { runEveningReview } from '../lib/backend/cron-runner'

async function check() {
  const configs = await prisma.config.findMany({
    where: { key: { contains: 'evening' } }
  })
  console.log('Configs with evening:', configs)

  const tasks = await prisma.task.findMany({
    where: { ownerChatId: 6136950061n }
  })
  console.log('User tasks count:', tasks.length)
  console.log('User tasks:', tasks.map(t => ({ id: t.id, title: t.title, status: t.status, dueDate: t.dueDate })))

  const now = new Date()
  const mskFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = mskFormatter.formatToParts(now)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'
  const hour = parseInt(getPart('hour'), 10)
  const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
  console.log('Current MSK Hour:', hour, 'TodayStr:', todayStr)

  const globalDone = await isCronAlreadyDoneToday('evening_review_global', todayStr)
  console.log('Is evening_review_global done today?', globalDone)

  const userDone = await isUserCronDoneToday('evening_review', 6136950061, todayStr)
  console.log('Is user 6136950061 done today?', userDone)
}
check().finally(() => process.exit(0))
