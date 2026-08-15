import { prisma } from '../lib/backend/prisma'

async function main() {
  const updated = await prisma.telegramChat.update({
    where: { chatId: BigInt(6136950061) },
    data: { ttsEnabled: false }
  })
  console.log('Updated user ttsEnabled to false:', updated.chatId, updated.ttsEnabled)
}

main().catch(console.error).finally(() => prisma.$disconnect())
