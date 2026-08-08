import * as dotenv from 'dotenv'

dotenv.config()

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const chatId = process.env.TEST_GROUP_CHAT_ID || 'YOUR_PRIVATE_CHAT_ID_HERE' 

async function tgApi(method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return await res.json()
}

async function main() {
  // Let's test what happens when we try to edit a message with a web app button in a group.
  console.log("To test this, we need a real group ID. But let's just see if tgApi throws on invalid data.")
}
main().catch(console.error)
