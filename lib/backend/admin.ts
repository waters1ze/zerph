import { NextRequest } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { verifyTelegramWebAppData, getUserAuthToken } from '@/lib/backend/auth'

export const ADMIN_SECRET = process.env.ADMIN_SECRET || 'zerph-admin-2024'
export const ROOT_ADMIN_IDS = (process.env.ADMIN_CHAT_IDS || '6136950061,5078516086')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

export async function isCallerAdmin(req: NextRequest): Promise<{ isAdmin: boolean; callerChatId: string | null; isRoot: boolean }> {
  // 1. Check secret header or query parameter
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  const querySecret = new URL(req.url).searchParams.get('secret') || ''
  if (token === ADMIN_SECRET || querySecret === ADMIN_SECRET) {
    return { isAdmin: true, callerChatId: 'root_secret', isRoot: true }
  }

  // 2. Validate via Telegram WebApp initData (cryptographic proof from Telegram)
  const initData = req.headers.get('x-tg-init-data')
  let verifiedChatId: string | null = null

  if (initData && verifyTelegramWebAppData(initData)) {
    try {
      const urlParams = new URLSearchParams(initData)
      const userStr = urlParams.get('user')
      if (userStr) {
        const userObj = JSON.parse(userStr)
        if (userObj.id) {
          verifiedChatId = String(userObj.id)
        }
      }
    } catch {}
  }

  // 3. If in browser with auth token
  const clientToken = req.headers.get('x-auth-token')
  const rawChatId = req.headers.get('x-chat-id') || new URL(req.url).searchParams.get('chatId')

  if (!verifiedChatId && rawChatId && clientToken) {
    const expected = getUserAuthToken(rawChatId)
    if (clientToken === expected) {
      verifiedChatId = String(rawChatId).trim()
    }
  }

  // If identity could not be verified, DENY admin access
  if (!verifiedChatId) {
    return { isAdmin: false, callerChatId: null, isRoot: false }
  }

  const isRoot = ROOT_ADMIN_IDS.includes(verifiedChatId)
  if (isRoot) {
    return { isAdmin: true, callerChatId: verifiedChatId, isRoot: true }
  }

  // 4. Check Database record for isAdmin flag
  try {
    const user = await prisma.telegramChat.findUnique({
      where: { chatId: BigInt(verifiedChatId) },
      select: { isAdmin: true },
    })
    if (user?.isAdmin) {
      return { isAdmin: true, callerChatId: verifiedChatId, isRoot: false }
    }
  } catch {}

  return { isAdmin: false, callerChatId: verifiedChatId, isRoot: false }
}
