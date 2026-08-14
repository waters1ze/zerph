import 'dotenv/config'
import { postWelcomeIntroToChannel } from '../lib/backend/channel-poster'

async function main() {
  console.log('Publishing Welcome Intro to @zerph_off...')
  const res = await postWelcomeIntroToChannel('@zerph_off')
  console.log('Result:', res)
}

main().catch(console.error)
