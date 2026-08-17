import { runEveningReview } from '../lib/backend/cron-runner'

async function test() {
  console.log('Triggering runEveningReview()...')
  await runEveningReview()
  console.log('Finished runEveningReview()!')
}
test().finally(() => process.exit(0))
