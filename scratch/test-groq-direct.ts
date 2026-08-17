import 'dotenv/config'
import { callGroqChatCompletion, groqPool } from '../lib/backend/groq-pool'

async function test() {
  const keys = groqPool.getOrderedHealthyKeys()
  console.log('Available keys:', keys.length)
  const key = keys[0]

  const models = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b']
  for (const m of models) {
    console.log(`Testing model: ${m}...`)
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Привет! Напиши краткий вечерний пост.' }],
          max_tokens: 300,
        }),
      })
      console.log(`Status for ${m}:`, res.status)
      const data = await res.json()
      console.log(`Choices for ${m}:`, data.choices?.[0]?.message)
    } catch (e: any) {
      console.error(`Error for ${m}:`, e.message)
    }
  }
}

test().finally(() => process.exit(0))
