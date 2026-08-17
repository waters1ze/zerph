const crypto = require('crypto')
require('dotenv').config({ path: '.env' })
require('dotenv').config({ path: '.env.local' })

const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.JWT_SECRET || 'zerf_siri_secret_key_salt_2026'

function getSiriUserKey(chatId) {
  return crypto.createHmac('sha256', secret).update(String(chatId)).digest('hex').slice(0, 10)
}

const key = getSiriUserKey('6136950061')
console.log('Key generated for 6136950061:', key)
console.log('Full URL for iPhone Shortcut:')
console.log(`https://zeprh.vercel.app/api/shortcuts?chatId=6136950061&key=${key}&text=`)
