const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.config.findMany({
    where: { key: { contains: 'channel' } }
  });
  console.log('Channel configs in DB:', configs);

  const allConfigs = await prisma.config.findMany();
  console.log('All configs in DB:', allConfigs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
