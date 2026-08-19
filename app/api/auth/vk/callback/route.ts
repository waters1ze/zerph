import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'

export const dynamic = 'force-dynamic'

const VK_CLIENT_ID = process.env.VK_CLIENT_ID || process.env.VK_APP_ID || '51824701'
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET || process.env.VK_SECRET_KEY || 'aaQ13axAPQEcczQa'

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'zerph.vercel.app'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error || !code) {
      return NextResponse.redirect(`${origin}/?vk_auth_error=${encodeURIComponent(error || 'no_code')}#settings`)
    }

    let decodedState: any = {}
    if (state) {
      try {
        decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
      } catch {}
    }

    const redirectUri = `${origin.replace(/\/$/, '')}/api/auth/vk/callback`

    // Exchange code for VK access token and user_id
    const tokenUrl = `https://oauth.vk.com/access_token?client_id=${VK_CLIENT_ID}&client_secret=${VK_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()

    const vkUserId = tokenData.user_id ? String(tokenData.user_id) : null

    if (!vkUserId) {
      console.warn('VK OAuth token exchange failed:', tokenData)
      return NextResponse.redirect(`${origin}/?vk_auth_error=token_failed#settings`)
    }

    const targetChatId = decodedState.chatId || req.cookies.get('zerf_chat_id')?.value

    if (targetChatId && /^\d+$/.test(targetChatId)) {
      const cid = BigInt(targetChatId)
      await prisma.telegramChat.update({
        where: { chatId: cid },
        data: { vkId: vkUserId },
      }).catch(() => {})
    }

    return NextResponse.redirect(`${origin}/?vk_auth_success=1&vk_id=${encodeURIComponent(vkUserId)}#settings`)
  } catch (err: any) {
    console.error('VK OAuth callback error:', err)
    return NextResponse.redirect(`${origin}/?vk_auth_error=${encodeURIComponent(err.message || 'unknown')}#settings`)
  }
}
