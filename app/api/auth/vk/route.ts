import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

const VK_CLIENT_ID = process.env.VK_CLIENT_ID || process.env.VK_APP_ID || '51824701'

/**
 * GET /api/auth/vk
 * 1-Click VK OAuth Entry point
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin || 'https://zerph.vercel.app'
  const redirectUri = `${origin.replace(/\/$/, '')}/api/auth/vk/callback`
  
  const authUser = await getAuthenticatedUser(req)
  const cookieCid = req.cookies.get('zerf_chat_id')?.value
  const paramCid = req.nextUrl.searchParams.get('chatId')
  const targetChatId = authUser?.chatId ? String(authUser.chatId) : (cookieCid || paramCid || '')

  const state = Buffer.from(JSON.stringify({
    chatId: targetChatId,
    origin,
  })).toString('base64url')

  const vkAuthUrl = `https://oauth.vk.com/authorize?client_id=${VK_CLIENT_ID}&display=page&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email,offline&response_type=code&v=5.131&state=${state}`
  
  return NextResponse.redirect(vkAuthUrl)
}

/**
 * POST /api/auth/vk
 * Direct manual VK ID linking
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const cid = BigInt(authUser.chatId)

    const body = await req.json()
    const rawVkId = body.vkId || ''
    const cleanVkId = String(rawVkId).trim().replace(/^(?:https?:\/\/)?(?:www\.)?vk\.com\//i, '').replace(/^id/i, '').trim()

    if (!cleanVkId) {
      // Unlink VK
      await prisma.telegramChat.update({
        where: { chatId: cid },
        data: { vkId: null },
      }).catch(() => {})
      return NextResponse.json({ success: true, message: 'VK успешно отвязан', vkId: null })
    }

    await prisma.telegramChat.update({
      where: { chatId: cid },
      data: { vkId: cleanVkId },
    })

    return NextResponse.json({
      success: true,
      message: `ВКонтакте (ID: ${cleanVkId}) успешно привязан!`,
      vkId: cleanVkId,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка сохранения VK' }, { status: 500 })
  }
}
