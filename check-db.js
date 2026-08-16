const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const todayTasks = await prisma.task.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  console.log('TASKS CREATED IN LAST 24H (' + todayTasks.length + '):')
  todayTasks.forEach(t => {
    console.log({
      id: t.id,
      title: t.title,
      ownerChatId: String(t.ownerChatId),
      authorChatId: String(t.authorChatId),
      status: t.status,
      isShared: t.isShared,
      source: t.source,
      createdAt: t.createdAt
    })
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())

