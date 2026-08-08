import { parseIntentWithGroq } from '../lib/backend/groq'
import * as dotenv from 'dotenv'

dotenv.config()

async function main() {
  const res = await parseIntentWithGroq('мой др 03.04.2010')
  console.log(JSON.stringify(res, null, 2))
}
main()
