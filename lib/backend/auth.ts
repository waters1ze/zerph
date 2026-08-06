import crypto from 'crypto'

export function getUserAuthToken(chatId: number | string | bigint): string {
  const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.GROQ_API_KEY || 'zerf-auth-secret-key-2026'
  return crypto.createHmac('sha256', secret).update(String(chatId)).digest('hex').slice(0, 32)
}

export function verifyUserAuth(chatId?: string | number | null, token?: string | null): boolean {
  if (!chatId) return true // no chatId filter requested
  if (!token) return false // chatId requested but no security token provided!
  const expectedToken = getUserAuthToken(chatId)
  return token === expectedToken
}
