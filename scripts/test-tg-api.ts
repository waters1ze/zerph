import * as dotenv from 'dotenv'

dotenv.config()

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const chatId = 6136950061 // Just a guess for user id, or use string '6136950061'

async function tgApi(method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return await res.json()
}

async function main() {
  const msg = `🎂 День рождения сохранен: 2010-04-03\n\n`
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://zerf.vercel.app'
  const MINIAPP_URL = `${APP_URL}/tg`

  const extra = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📱 Open Zerf App', web_app: { url: `${MINIAPP_URL}?chatId=${chatId}` } }],
        [{ text: '🌐 Open Full Web Site', url: APP_URL }]
      ]
    }
  }

  const res = await tgApi('sendMessage', {
    chat_id: chatId,
    text: msg,
    parse_mode: 'Markdown',
    ...extra
  })
  console.log(res)
}
main().catch(console.error)
