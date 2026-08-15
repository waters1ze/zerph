import { prisma } from '../lib/backend/prisma'

async function main() {
  // Delete all comments that were auto-forwards of channel posts, bot messages, or owner messages
  const deleted = await prisma.channelComment.deleteMany({
    where: {
      OR: [
        { chatId: BigInt(6136950061) },
        { userName: { in: ['proj_1', '@proj_1', 'zerph', 'zerph_bot', '@Zerph_bot', 'Channel', 'Group'] } },
        { text: { contains: 'ГЛАВНОЕ НА СЕГОДНЯ' } },
        { text: { contains: 'ИТОГИ ДНЯ' } },
        { text: { contains: 'ДОБРО ПОЖАЛОВАТЬ' } },
        { text: { contains: 'Какое улучшение' } },
      ]
    }
  })
  console.log('Deleted invalid comments from DB:', deleted.count)
}

main().catch(console.error).finally(() => process.exit())
