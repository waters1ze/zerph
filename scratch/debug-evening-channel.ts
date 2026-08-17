import 'dotenv/config'
import { fetchEveningNewsContext } from '../lib/backend/news-fetcher'
import { callGroqChatCompletion } from '../lib/backend/groq-pool'
import { GROQ_CHAT_MODEL } from '../lib/config'

async function debug() {
  console.log('Fetching news context...')
  const context = await fetchEveningNewsContext()
  console.log('News context count:', {
    dev: context.devNews?.length,
    sec: context.secNews?.length,
    sci: context.sciNews?.length
  })

  console.log('Calling AI...')
  const prompt = `Напиши вечернюю сводку для Telegram-канала @zerph_off за ${context.date}.`
  const res = await callGroqChatCompletion({
    model: GROQ_CHAT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    max_tokens: 1500,
  })
  console.log('AI result:', res.content?.slice(0, 100))

  const token = process.env.TELEGRAM_BOT_TOKEN
  const channel = process.env.TELEGRAM_CHANNEL_ID || '@zerph_off'
  console.log('Bot token present:', Boolean(token), 'Channel:', channel)

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channel,
      text: res.content,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  })
  const tgData = await tgRes.json()
  console.log('Telegram API response:', tgData)
}

debug().catch(console.error).finally(() => process.exit(0))
