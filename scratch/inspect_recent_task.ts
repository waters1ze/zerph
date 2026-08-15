import 'dotenv/config'
import { prisma } from '../lib/backend/prisma'

async function main() {
  const tasks = await prisma.task.findMany({
    where: { ownerChatId: BigInt(6136950061) },
    orderBy: { createdAt: 'desc' },
    take: 5
  })
  console.log('Recent tasks for 6136950061:', JSON.stringify(tasks, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
