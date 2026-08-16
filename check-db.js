const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Delete mistakenly added tasks from Lera (6900838154)
  const deleted = await prisma.task.deleteMany({
    where: {
      ownerChatId: BigInt('6900838154'),
      title: 'Поесть'
    }
  })
  console.log('Deleted erroneous tasks from Lera:', deleted.count)

  // Create delegated task for Kirill (6136950061) from Lera (6900838154)
  const created = await prisma.task.create({
    data: {
      title: 'Поесть',
      description: 'Поручение от Леры через Siri',
      priority: 'medium',
      status: 'todo',
      dueDate: new Date().toISOString().slice(0, 10),
      tags: ['поручение'],
      ownerChatId: BigInt('6136950061'),
      authorChatId: BigInt('6900838154'),
      assignees: ['6900838154'],
      isShared: true,
      aiGenerated: true,
      source: 'дать задачу кирюхе поесть'
    }
  })
  console.log('Created task for Kirill:', created.id)

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (botToken) {
    const notifyMsg = '🤝 *лерочч* поручил(а) тебе задачу через Siri!\n\n📌 *Задача:* Поесть\n\n_Задача добавлена в ваши «Входящие» и календарь в Zerf AI_'
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: 6136950061,
        text: notifyMsg,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Открыть в Zerf App', web_app: { url: 'https://zeprh.vercel.app/tg?chatId=6136950061' } }],
            [
              { text: '✓ Принять', callback_data: `delegate_accept_${created.id}` },
              { text: '✗ Отклонить', callback_data: `delegate_decline_${created.id}` }
            ]
          ]
        }
      })
    })
    const data = await res.json()
    console.log('Telegram API response:', data)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

