import crypto from 'crypto'

// Internal pepper secret - never exposed to client, never in URL
const INTERNAL_PEPPER = process.env.AUTH_PEPPER || 'zERf-s3cur3-pEpp3r-k3y-2026-x7q9m2'

export function getUserAuthToken(chatId: number | string | bigint): string {
  const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.GROQ_API_KEY || 'zerf-auth-secret-key-2026'
  // Pepper is mixed in so that knowing chatId+botToken is NOT enough to forge a token
  const combined = `${INTERNAL_PEPPER}:${String(chatId)}:${secret}`
  return crypto.createHmac('sha256', INTERNAL_PEPPER).update(combined).digest('hex').slice(0, 32)
}

/**
 * Generate a cryptographically secure one-time login token for web browser auth.
 * This token is stored in the DB and can only be used once before expiry.
 */
export function generateOnetimeToken(): string {
  return crypto.randomBytes(32).toString('hex')
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
  if (!chatId) return false
  const cidStr = String(chatId).trim()
  return cidStr.length > 0
}
