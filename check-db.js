const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.telegramChat.findFirst({ where: { chatId: 6900838154n } })
  console.log('USER for 6900838154:', JSON.stringify(user, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2))
  
  const tasks = await prisma.task.findMany({ where: { ownerChatId: 6900838154n } })
  console.log('TASKS count for 6900838154:', tasks.length)
  console.log('TASKS for 6900838154:', JSON.stringify(tasks, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2))

  const notes = await prisma.note.findMany({ where: { ownerChatId: 6900838154n } })
  console.log('NOTES count for 6900838154:', notes.length)
  console.log('NOTES for 6900838154:', JSON.stringify(notes, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2))

  // Find recent tasks created today
  const recentTasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  console.log('RECENT 10 TASKS IN DB:', JSON.stringify(recentTasks, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
