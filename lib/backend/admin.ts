import { NextRequest } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser, getAdminSecret, secretsMatch, ROOT_ADMIN_IDS } from '@/lib/backend/auth'

export { ROOT_ADMIN_IDS }

/** Get the effective admin secret (env value or derived from the bot token). */
export function adminSecret(): string | null {
  return getAdminSecret()
}

// Hardcoded explicit blocklist — add IDs here to permanently deny admin rights
const BLOCKED_FROM_ADMIN: string[] = []

export async function isCallerAdmin(req: NextRequest): Promise<{ isAdmin: boolean; callerChatId: string | null; isRoot: boolean }> {
  // 1. Server-to-server secret via Authorization header or x-admin-secret only.
  //    (Query parameters are refused: secrets must never appear in URLs/logs.)
  const adminSecretValue = getAdminSecret()
  if (adminSecretValue) {
    const authHeader = req.headers.get('authorization') || ''
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    const secretHeader = req.headers.get('x-admin-secret')
    if (secretsMatch(bearerToken, adminSecretValue) || secretsMatch(secretHeader, adminSecretValue)) {
      return { isAdmin: true, callerChatId: 'root_secret', isRoot: true }
    }
  }

  // 2. Authenticate the caller strictly via Telegram HMAC, DB session or VK sign
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return { isAdmin: false, callerChatId: null, isRoot: false }
  }

  const strId = authUser.chatId

  // 3. Check blocklist
  if (BLOCKED_FROM_ADMIN.length > 0 && BLOCKED_FROM_ADMIN.includes(strId)) {
    return { isAdmin: false, callerChatId: strId, isRoot: false }
  }

  // 4. Check if root admin (The Owner)
  if (authUser.isRoot || ROOT_ADMIN_IDS.includes(strId)) {
    return { isAdmin: true, callerChatId: strId, isRoot: true }
  }

  // 5. Check Database record for isAdmin flag (non-root admins)
  try {
    const user = await prisma.telegramChat.findUnique({
      where: { chatId: BigInt(strId) },
      select: { isAdmin: true, plan: true },
    })
    if (user?.isAdmin) {
      return { isAdmin: true, callerChatId: strId, isRoot: false }
    }
  } catch {}

  return { isAdmin: false, callerChatId: strId, isRoot: false }
}
