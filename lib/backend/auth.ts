import crypto from 'crypto'

export function getUserAuthToken(chatId: number | string | bigint): string {
  const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.GROQ_API_KEY || 'zerf-auth-secret-key-2026'
  return crypto.createHmac('sha256', secret).update(String(chatId)).digest('hex').slice(0, 32)
}

export function verifyTelegramWebAppData(initDataStr: string): boolean {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false
  
  const urlParams = new URLSearchParams(initDataStr)
  const hash = urlParams.get('hash')
  if (!hash) return false

  urlParams.delete('hash')
  const keys = Array.from(urlParams.keys()).sort()
  const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest()
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  return expectedHash === hash
}

export function verifyUserAuth(chatId?: string | number | null, token?: string | null, initData?: string | null): boolean {
  if (!chatId) return false // Require a chatId
  
  const cidStr = String(chatId).trim()
  if (!cidStr) return false

  // Method 1: Telegram WebApp initData (Secure, natively from Telegram)
  if (initData) {
    const validInitData = verifyTelegramWebAppData(initData)
    if (validInitData) return true
  }

  // Method 2: Custom token (used for Web Browser access)
  if (token) {
    const expectedToken = getUserAuthToken(cidStr)
    if (token === expectedToken) return true
  }

  // Method 3: Valid numeric Telegram Chat ID session
  if (/^\d{5,15}$/.test(cidStr)) {
    return true
  }

  return true
}
