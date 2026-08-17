import 'dotenv/config'
import { postDailyEveningPostToChannel } from '../lib/backend/channel-poster'

async function run() {
  console.log('Posting evening digest to channel @zerph_off now...')
  const result = await postDailyEveningPostToChannel(undefined, true)
  console.log('Post result:', result)
}

run()
  .catch(err => console.error('Run error:', err))
  .finally(() => process.exit(0))
