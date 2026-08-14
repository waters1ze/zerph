import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/backend/prisma'

// Internal pepper secret - never exposed to client, never in URL
const INTERNAL_PEPPER = process.env.AUTH_PEPPER || 'zERf-s3cur3-pEpp3r-k3y-2026-x7q9m2'
export const ROOT_ADMIN_IDS = (process.env.ADMIN_CHAT_IDS || '6136950061')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

export function getUserAuthToken(chatId: number | string | bigint): string {
  const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.GROQ_API_KEY || 'zerf-auth-secret-key-2026'
  const combined = `${INTERNAL_PEPPER}:${String(chatId)}:${secret}`
  return crypto.createHmac('sha256', INTERNAL_PEPPER).update(combined).digest('hex').slice(0, 32)
}

/**
 * Generate a cryptographically secure one-time login token for web browser auth.
 */
export function generateOnetimeToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Verify cryptographic hash from Telegram WebApp initData
 */
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

/**
 * Parse Telegram user ID from validated initData
 */
export function getTelegramUserIdFromInitData(initDataStr: string): string | null {
  try {
    const urlParams = new URLSearchParams(initDataStr)
    const userStr = urlParams.get('user')
    if (!userStr) return null
    const user = JSON.parse(userStr)
    return user?.id ? String(user.id) : null
  } catch {
    return null
  }
}

/**
 * Core Authentication Verifier.
 * Strictly verifies identity from:
 * 1. Cryptographically verified Telegram WebApp initData
 * 2. Active, unrevoked DB UserSession matched by sessionToken
 * 3. Server-side ADMIN_SECRET for internal crons/bots
 *
 * Rejects unauthenticated guests or forged cookies/headers.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<{ chatId: string; isRoot: boolean } | null> {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || 'zerph-admin-2024'

  // 1. Check server-to-server secret (Cron / Bot internal calls)
  const authHeader = req.headers.get('authorization') || ''
  const bearerToken = authHeader.replace('Bearer ', '').trim()
  const secretHeader = req.headers.get('x-admin-secret')
  if (bearerToken === ADMIN_SECRET || secretHeader === ADMIN_SECRET) {
    const specifiedChatId = req.headers.get('x-chat-id') || new URL(req.url).searchParams.get('chatId')
    if (specifiedChatId) {
      return { chatId: String(specifiedChatId).trim(), isRoot: true }
    }
  }

  // 2. Telegram WebApp: verify HMAC and extract real user ID
  const initData = req.headers.get('x-tg-init-data')
  if (initData && verifyTelegramWebAppData(initData)) {
    const tgUserId = getTelegramUserIdFromInitData(initData)
    if (tgUserId) {
      return {
        chatId: tgUserId,
        isRoot: ROOT_ADMIN_IDS.includes(tgUserId),
      }
    }
  }

  // 3. Web Browser: verify active DB sessionToken
  const sessionToken = req.headers.get('x-auth-token') || bearerToken
  if (sessionToken && sessionToken.length >= 16) {
    try {
      const session = await prisma.userSession.findUnique({
        where: { sessionToken },
      })

      if (session && !session.isRevoked) {
        const sessionChatId = String(session.chatId)
        
        // Touch lastSeenAt asynchronously
        prisma.userSession.update({
          where: { id: session.id },
          data: { lastSeenAt: new Date() },
        }).catch(() => {})

        return {
          chatId: sessionChatId,
          isRoot: ROOT_ADMIN_IDS.includes(sessionChatId),
        }
      }
    } catch {}
  }

  // No valid cryptographic or DB session found -> unauthenticated
  return null
}
