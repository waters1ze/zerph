import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

async function testModel(model: string, text: string) {
  const key = process.env.GROQ_API_KEY?.split(/[\s,]+/)[0]
  const now = new Date()
  const mskDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now)
  const mskTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hour12: false }).format(now)

  const prompt = `You are Zerf Note Siri Fast Parser. Output ONLY valid JSON:
Date: ${mskDate}, Time: ${mskTime}.
Schema:
{"items":[{"title":"string in Russian","dueTime":"HH:MM or null","dueDate":"YYYY-MM-DD or null","priority":"medium","type":"task","recipientName":null,"isBothShared":false}]}`

  const t0 = Date.now()
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: text }],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  })
  const dt = Date.now() - t0
  const data = await res.json()
  console.log(`[${model}] [${dt}ms] Status ${res.status}:`, data.choices?.[0]?.message?.content || data.error?.message)
}

async function run() {
  const models = ['groq/compound-mini', 'groq/compound', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-120b']
  for (const m of models) {
    await testModel(m, 'Напомни завтра в 15:30 купить свежий хлеб и сыр')
  }
}

run().catch(console.error)
