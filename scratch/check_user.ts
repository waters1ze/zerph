import { prisma } from '../lib/backend/prisma'

async function main() {
  const user = await prisma.telegramChat.findUnique({
    where: { chatId: BigInt(6136950061) }
  })
  console.log('User TelegramChat:', user)
  const notes = await prisma.note.findMany({
    where: { title: { contains: 'Новая' } }
  })
  console.log('Notes matching Новая:', notes)
}

main().catch(console.error).finally(() => prisma.$disconnect())
