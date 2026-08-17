import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { callGroqChatCompletion } from '../lib/backend/groq-pool'

async function parseSiriFastIntent(text: string, model = 'llama-3.3-70b-versatile'): Promise<any> {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00'

  const mskDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
  const mskTime = `${getPart('hour')}:${getPart('minute')}`

  const systemPrompt = `You are Zerf Note Siri Fast Parser. Output ONLY valid JSON with max speed.
Current Moscow Date: ${mskDate}, Time Right Now: ${mskTime} (MSK/UTC+3).

Schema:
{
  "items": [
    {
      "action": "create",
      "type": "task" | "goal" | "note" | "delegate",
      "title": "Clean concise title in Russian without command words",
      "dueTime": "HH:MM 24-hour format or null",
      "dueDate": "YYYY-MM-DD or null",
      "priority": "urgent" | "high" | "medium" | "low",
      "recipientName": "Name of friend if delegating/sharing or null",
      "isBothShared": boolean,
      "repeat": "daily" | "weekdays" | "weekly" | "yearly" | null
    }
  ]
}

Rules:
1. Title MUST be in Russian.
2. Relative times ("через 10 минут", "в 18:00", "завтра в 9 утра", "будильник на 7:00") MUST be calculated relative to current Moscow time ${mskTime} on ${mskDate}.
3. If user says "напомни...", "купить...", "сделать...", "позвонить..." -> "type": "task".
4. If user says "поручи [Имя]..." -> "type": "delegate", "isBothShared": false, "recipientName": "[Имя]".
5. If user says "нам с [Имя] общая задача..." -> "type": "delegate", "isBothShared": true, "recipientName": "[Имя]".`

  const t0 = Date.now()
  const result = await callGroqChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    model,
    temperature: 0.1,
    max_tokens: 200,
    response_format: { type: 'json_object' },
  })
  const dt = Date.now() - t0
  return { content: result.content, dt }
}

async function testAll() {
  const tests = [
    'напомни через 15 минут выключить духовку',
    'поручи Лере отправить отчет завтра к 12:00',
    'купить молоко и хлеб',
    'завтра в 19:30 тренировка по боксу'
  ]

  for (const t of tests) {
    const res = await parseSiriFastIntent(t)
    console.log(`[${res.dt}ms] Input: "${t}" -> Result:`, res.content)
  }
}

testAll().catch(console.error)
