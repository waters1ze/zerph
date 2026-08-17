const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function resetAndCheck() {
  const deleted = await prisma.config.deleteMany({
    where: {
      key: {
        in: [
          'cron_last_channel_morning_post_date',
          'cron_last_channel_evening_post_date',
          'cron_last_morning_greeting_global_date',
          'cron_morning_greeting_u_6136950061'
        ]
      }
    }
  });
  console.log('Deleted lock records from DB:', deleted);

  const configs = await prisma.config.findMany();
  console.log('Remaining configs in DB:', configs);
}

resetAndCheck().catch(console.error).finally(() => prisma.$disconnect());
