import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { parseIntentWithGroq } from '../lib/backend/groq'
import { callGroqChatCompletion } from '../lib/backend/groq-pool'

async function benchmark() {
  const text = 'Купить хлеб и молоко завтра в 15:30'

  // Benchmark 1: Full parseIntentWithGroq with huge default prompt
  const t1 = Date.now()
  const res1 = await parseIntentWithGroq(text, undefined, 'openai/gpt-oss-20b')
  const d1 = Date.now() - t1
  console.log(`Full prompt latency: ${d1}ms`, JSON.stringify(res1[0]))

  // Benchmark 2: Compact Siri fast prompt
  const now = new Date()
  const mskDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now)
  const mskTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hour12: false }).format(now)

  const fastSiriPrompt = `You are Zerf Note Siri Fast Parser. Output ONLY valid JSON for the task:
Current Moscow Date: ${mskDate}, Time: ${mskTime}.
Schema:
{"items":[{"title":"string in Russian","dueTime":"HH:MM or null","dueDate":"YYYY-MM-DD or null","priority":"urgent|high|medium|low","type":"task|note|goal|delegate","recipientName":null,"isBothShared":false}]}
Rules:
- Russian only for title.
- Relative times ("через 15 минут", "завтра в 15:30") relative to ${mskTime} on ${mskDate}.`

  const t2 = Date.now()
  const res2 = await callGroqChatCompletion({
    messages: [
      { role: 'system', content: fastSiriPrompt },
      { role: 'user', content: text }
    ],
    model: 'openai/gpt-oss-20b',
    temperature: 0.1,
    max_tokens: 200,
    response_format: { type: 'json_object' }
  })
  const d2 = Date.now() - t2
  console.log(`Fast Siri prompt latency: ${d2}ms`, res2.content)
}

benchmark().catch(console.error)
