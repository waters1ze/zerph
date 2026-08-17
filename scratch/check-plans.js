const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.telegramChat.findMany({
    select: { chatId: true, firstName: true, username: true, plan: true, subscriptionExpiry: true, isAdmin: true }
  });
  console.log(JSON.stringify(users, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main().finally(() => prisma.$disconnect());
