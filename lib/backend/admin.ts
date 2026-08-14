import { NextRequest } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser, ROOT_ADMIN_IDS } from '@/lib/backend/auth'

export const ADMIN_SECRET = process.env.ADMIN_SECRET || 'zerph-admin-2024'
export { ROOT_ADMIN_IDS }

// Hardcoded explicit blocklist — add IDs here to permanently deny admin rights
const BLOCKED_FROM_ADMIN: string[] = []

export async function isCallerAdmin(req: NextRequest): Promise<{ isAdmin: boolean; callerChatId: string | null; isRoot: boolean }> {
  // 1. Check secret header or query parameter (server-to-server calls only)
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  const querySecret = new URL(req.url).searchParams.get('secret') || ''
  if (token === ADMIN_SECRET || querySecret === ADMIN_SECRET) {
    return { isAdmin: true, callerChatId: 'root_secret', isRoot: true }
  }

  // 2. Authenticate the caller strictly via Telegram HMAC or DB session
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
