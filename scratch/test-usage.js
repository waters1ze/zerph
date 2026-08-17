const { getUserUsageAndLimits } = require('./lib/backend/db');

async function main() {
  const usage = await getUserUsageAndLimits('6136950061');
  console.log('Result for 6136950061:', JSON.stringify(usage, null, 2));

  const usageAnon = await getUserUsageAndLimits(null);
  console.log('Result for null:', JSON.stringify(usageAnon, null, 2));
}

main().catch(console.error);
