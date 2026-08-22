import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/backend/prisma'

// Secrets are NEVER hardcoded. When an env var is missing we derive one from the
// Telegram bot token (a server-side secret), so the value is unguessable even
// though the derivation is public. Explicit env values always win.
function derivedSecret(purpose: string): string | null {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    return crypto.createHmac('sha256', 'zerf-secret-derivation').update(`${purpose}:${process.env.TELEGRAM_BOT_TOKEN}`).digest('hex')
  }
  return null
}

export function getInternalPepper(): string {
  return process.env.AUTH_PEPPER || derivedSecret('auth-pepper') || ''
}

export function getAdminSecret(): string | null {
  return process.env.ADMIN_SECRET || derivedSecret('admin-secret') || null
}

export function getTelegramWebhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET || derivedSecret('webhook-secret') || null
}

export function getVkAppSecret(): string | null {
  return process.env.VK_APP_SECRET || null
}

/**
 * HMAC signature for capability URLs (e.g. the .ics calendar feed),
 * since calendar clients cannot send auth headers.
 */
export function getFeedSignature(chatId: string | number | bigint): string {
  return crypto.createHmac('sha256', getInternalPepper()).update(`feed:${chatId}`).digest('hex').slice(0, 32)
}

export const ROOT_ADMIN_IDS = (process.env.ADMIN_CHAT_IDS || process.env.OWNER_CHAT_ID || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

/**
 * Checks if a user is an administrator via ROOT_ADMIN_IDS env or DB isAdmin flag
 */
export async function isUserAdmin(chatId: string | number | bigint | null | undefined): Promise<boolean> {
  if (!chatId) return false
  const strId = String(chatId).trim()
  if (!strId) return false
  if (ROOT_ADMIN_IDS.includes(strId)) return true
  try {
    const numId = /^\d+$/.test(strId) ? BigInt(strId) : null
    if (numId) {
      const chat = await prisma.telegramChat.findUnique({
        where: { chatId: numId },
        select: { isAdmin: true },
      })
      if (chat?.isAdmin) return true
    }
  } catch {}
  return false
}

/** Generate deterministic HMAC auth token for user */
export function getUserAuthToken(chatId: number | string | bigint): string {
  const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('TELEGRAM_BOT_TOKEN or ADMIN_SECRET env var is required for auth token generation')
  }
  const pepper = getInternalPepper() || 'zerf-internal-pepper'
  const combined = `${pepper}:${String(chatId)}:${secret}`
  return crypto.createHmac('sha256', pepper).update(combined).digest('hex').slice(0, 32)
}

/** Generate a cryptographically secure one-time login token */
export function generateOnetimeToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/** Constant-time string comparison that does not leak length/content. */
export function secretsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const key = Buffer.alloc(32)
  const ha = crypto.createHmac('sha256', key).update(String(a)).digest()
  const hb = crypto.createHmac('sha256', key).update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

/** Session lifetime: tokens older than this are rejected. */
const SESSION_MAX_AGE_MS = 100 * 24 * 60 * 60 * 1000 // 100 days

/**
 * Verify cryptographic hash from Telegram WebApp initData
 */
export function verifyTelegramWebAppData(initDataStr: string): boolean {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false

  const urlParams = new URLSearchParams(initDataStr)
  const hash = urlParams.get('hash')
  if (!hash) return false

  urlParams.delete('hash')
  const params: string[] = []
  Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, val]) => params.push(`${key}=${val}`))

  const dataCheckString = params.join('\n')
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest()
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  return secretsMatch(calculatedHash, hash)
}

/**
 * Extract Telegram user ID from initData without full verification.
 * Used ONLY after verifyTelegramWebAppData() has already returned true!
 */
export function getTelegramUserIdFromInitData(initDataStr: string): string | null {
  try {
    const urlParams = new URLSearchParams(initDataStr)
    const userJson = urlParams.get('user')
    if (!userJson) return null
    const user = JSON.parse(userJson)
    return user?.id ? String(user.id) : null
  } catch {
    return null
  }
}

/**
 * Verify VK Mini App launch parameters signature (md5 of sorted vk_* params + app secret).
 * launchParams: the raw query string VK appended to the app URL.
 * Returns the verified vk_user_id, or null.
 */
export function verifyVkLaunchParams(launchParams: string): { vkUserId: string; isRoot: boolean } | null {
  const appSecret = getVkAppSecret()
  if (!appSecret) return null

  try {
    const urlParams = new URLSearchParams(launchParams)
    const sign = urlParams.get('sign')
    if (!sign) return null

    const vkParams: Array<[string, string]> = []
    urlParams.forEach((value, key) => {
      if (key.startsWith('vk_')) {
        vkParams.push([key, value])
      }
    })
    if (vkParams.length === 0) return null

    vkParams.sort(([a], [b]) => a.localeCompare(b))

    // 1. Official VK Mini App standard: HMAC-SHA256 on sorted vk_* query string, base64url encoded
    const queryString = vkParams.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    const hashHmac = crypto
      .createHmac('sha256', appSecret)
      .update(queryString)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // 2. Legacy MD5 fallback
    const pairs = vkParams.map(([k, v]) => `${k}=${v}`).join('')
    const hashMd5 = crypto.createHash('md5').update(pairs + appSecret).digest('hex')

    const isMatch = secretsMatch(hashHmac, sign) || secretsMatch(hashMd5, sign)
    if (!isMatch) return null

    const vkUserId = urlParams.get('vk_user_id')
    if (!vkUserId) return null
    return { vkUserId, isRoot: ROOT_ADMIN_IDS.includes(vkUserId) }
  } catch {
    return null
  }
}

/**
 * Robust authentication resolver.
 * Priority:
 * 1. Admin / Cron secret (server-to-server)
 * 2. Telegram WebApp HMAC (cryptographically verified against BOT_TOKEN)
 * 3. Browser session token (from DB `UserSession` table, lifetime-checked)
 * 4. Signed VK Mini App launch parameters (when VK_APP_SECRET is configured)
 *
 * A bare `x-chat-id` header / query param / cookie is NEVER trusted by itself.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<{ chatId: string; isRoot: boolean } | null> {
  // 1. Check server-to-server secret (Cron / Bot internal calls)
  const adminSecret = getAdminSecret()
  if (adminSecret) {
    const authHeader = req.headers.get('authorization') || ''
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    const secretHeader = req.headers.get('x-admin-secret')
    if (secretsMatch(bearerToken, adminSecret) || secretsMatch(secretHeader, adminSecret)) {
      const specifiedChatId = req.headers.get('x-chat-id') || new URL(req.url).searchParams.get('chatId')
      if (specifiedChatId && /^\d+$/.test(specifiedChatId.trim())) {
        return { chatId: specifiedChatId.trim(), isRoot: true }
      }
      if (ROOT_ADMIN_IDS.length > 0) {
        return { chatId: ROOT_ADMIN_IDS[0], isRoot: true }
      }
      return { chatId: '0', isRoot: true }
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

  // 3. Web Browser: verify active DB sessionToken if provided.
  //    Identity comes ONLY from the DB session — never from a client-sent chatId.
  let searchToken: string | null = null
  try {
    searchToken = new URL(req.url).searchParams.get('token')
  } catch {}

  const sessionToken =
    req.headers.get('x-auth-token') ||
    req.cookies.get('zerf_auth_token')?.value ||
    searchToken ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim() || null
  if (sessionToken && sessionToken.length >= 16) {
    try {
      const session = await prisma.userSession.findUnique({
        where: { sessionToken },
      })

      if (
        session &&
        !session.isRevoked &&
        Date.now() - new Date(session.createdAt).getTime() < SESSION_MAX_AGE_MS
      ) {
        const sessionChatId = String(session.chatId)
        prisma.userSession.update({
          where: { id: session.id },
          data: { lastSeenAt: new Date() },
        }).catch(() => {})

        return {
          chatId: sessionChatId,
          isRoot: ROOT_ADMIN_IDS.includes(sessionChatId),
        }
      }
    } catch (dbError) {
      console.warn('[Auth] userSession findUnique failed, falling back to HMAC token check:', dbError)
    }

    // 3.1 Fallback: Verify deterministic HMAC auth token generated by Telegram bot
    const clientChatId =
      req.headers.get('x-chat-id') ||
      new URL(req.url).searchParams.get('chatId') ||
      new URL(req.url).searchParams.get('chat_id') ||
      req.cookies.get('zerf_chat_id')?.value
    if (clientChatId && sessionToken && /^\d+$/.test(clientChatId.trim())) {
      try {
        const expectedHmac = getUserAuthToken(clientChatId.trim())
        if (secretsMatch(sessionToken, expectedHmac)) {
          const strId = clientChatId.trim()
          // Auto-mint DB session for fast subsequent checks
          createServerSession(strId, 'Telegram Web Login', 'web').catch(() => {})
          return {
            chatId: strId,
            isRoot: ROOT_ADMIN_IDS.includes(strId),
          }
        }
      } catch {}
    }
  }

  // 4. VK Mini App signed launch params
  const vkLaunch = req.headers.get('x-vk-launch')
  if (vkLaunch) {
    const verified = verifyVkLaunchParams(vkLaunch)
    if (verified) {
      return { chatId: verified.vkUserId, isRoot: verified.isRoot }
    }
  }

  // 5. Registered Telegram Chat fallback (LEGACY, disabled by default).
  //    A bare `x-chat-id` is NOT a proof of identity: Telegram chat IDs are
  //    semi-public, so trusting them alone lets anyone impersonate any user.
  //    All current clients send a verifiable credential (Telegram initData
  //    HMAC, DB session token, VK sign or the bot-issued HMAC token).
  //    Set ALLOW_UNVERIFIED_CHATID_AUTH=true only if you must support
  //    pre-token legacy browsers that logged in long ago.
  if (process.env.ALLOW_UNVERIFIED_CHATID_AUTH === 'true') {
    const clientChatId =
      req.headers.get('x-chat-id') ||
      new URL(req.url).searchParams.get('chatId') ||
      new URL(req.url).searchParams.get('chat_id') ||
      req.cookies.get('zerf_chat_id')?.value

    if (clientChatId && /^\d+$/.test(clientChatId.trim())) {
      const strId = clientChatId.trim()
      try {
        const user = await prisma.telegramChat.findUnique({
          where: { chatId: BigInt(strId) },
          select: { chatId: true },
        })
        if (user) {
          return {
            chatId: strId,
            isRoot: ROOT_ADMIN_IDS.includes(strId),
          }
        }
      } catch {}
    }
  }

  return null
}

export async function createServerSession(
  chatId: bigint | number | string,
  deviceName = 'Web Browser',
  deviceType = 'web',
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('hex')
  await prisma.userSession.create({
    data: {
      chatId: BigInt(chatId),
      sessionToken,
      deviceName,
      deviceType,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  })
  return sessionToken
}
