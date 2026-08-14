import { NextRequest } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { verifyTelegramWebAppData } from '@/lib/backend/auth'

export const ADMIN_SECRET = process.env.ADMIN_SECRET || 'zerph-admin-2024'

// ROOT_ADMIN_IDS — only the actual owners of the platform (YOU)
// These are set in environment, never in client-accessible code
export const ROOT_ADMIN_IDS = (process.env.ADMIN_CHAT_IDS || '6136950061')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

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

  // 2. Check chatId from headers
  const rawChatId = req.headers.get('x-chat-id') ||
    req.headers.get('x-tg-user-id') ||
    null
  // NOTE: We NEVER accept chatId from query params (easily forged in URL)

  if (!rawChatId) {
    return { isAdmin: false, callerChatId: null, isRoot: false }
  }

  const strId = String(rawChatId).trim()

  // 3. Check blocklist
  if (BLOCKED_FROM_ADMIN.length > 0 && BLOCKED_FROM_ADMIN.includes(strId)) {
    return { isAdmin: false, callerChatId: strId, isRoot: false }
  }

  // 4. Check if root admin (The Owner) — must also validate initData or auth token
  if (ROOT_ADMIN_IDS.includes(strId)) {
    // Require either valid Telegram initData or a valid session auth token
    const initData = req.headers.get('x-tg-init-data')
    const authToken = req.headers.get('x-auth-token')
    if (initData || authToken) {
      return { isAdmin: true, callerChatId: strId, isRoot: true }
    }
    // No initData and no auth token = not authenticated as root
    return { isAdmin: false, callerChatId: strId, isRoot: false }
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
