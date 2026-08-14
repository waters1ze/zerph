import { NextRequest } from 'next/server'
import { prisma } from '@/lib/backend/prisma'

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

  // 2. Check chatId from headers / query / localStorage forward
  const chatId = req.headers.get('x-chat-id') ||
    new URL(req.url).searchParams.get('chatId') ||
    req.headers.get('x-tg-user-id') ||
    null

  if (!chatId) {
    return { isAdmin: false, callerChatId: null, isRoot: false }
  }

  const strId = String(chatId).trim()
  if (ROOT_ADMIN_IDS.includes(strId)) {
    return { isAdmin: true, callerChatId: strId, isRoot: true }
  }

  // 3. Check Database record for isAdmin flag
  try {
    const user = await prisma.telegramChat.findUnique({
      where: { chatId: BigInt(strId) },
      select: { isAdmin: true },
    })
    if (user?.isAdmin) {
      return { isAdmin: true, callerChatId: strId, isRoot: false }
    }
  } catch {}

  return { isAdmin: false, callerChatId: strId, isRoot: false }
}
