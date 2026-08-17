import { getUserUsageAndLimits } from '../lib/backend/db'

async function main() {
  const usage = await getUserUsageAndLimits('6136950061')
  console.log('Result for 6136950061:', JSON.stringify(usage, null, 2))
}

main().catch(console.error)
