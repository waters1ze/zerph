import { prisma } from '../lib/backend/prisma'

async function check() {
  const users = await prisma.telegramChat.findMany({
    select: { chatId: true, firstName: true, username: true }
  })
  console.log('Total users in DB:', users.length)
  console.log('Users:', users)
}
check().finally(() => process.exit(0))
