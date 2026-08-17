const crypto = require('crypto')
require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.JWT_SECRET || 'zerf_siri_secret_key_salt_2026'
console.log('Secret length:', secret.length)

function getSiriUserKey(chatId) {
  return crypto.createHmac('sha256', secret).update(String(chatId)).digest('hex').slice(0, 10)
}

console.log('6136950061 key:', getSiriUserKey(6136950061))
console.log('5078516086 key:', getSiriUserKey(5078516086))
