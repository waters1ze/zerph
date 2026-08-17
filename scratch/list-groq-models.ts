import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

async function listModels() {
  const key = process.env.GROQ_API_KEY?.split(/[\s,]+/)[0]
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` }
  })
  const data = await res.json()
  console.log('Available Groq models:', data.data?.map((m: any) => m.id))
}

listModels().catch(console.error)
