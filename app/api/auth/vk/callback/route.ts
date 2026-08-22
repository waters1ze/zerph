import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'

import { createServerSession } from '@/lib/backend/auth'
import { generateEmailChatId } from '@/lib/backend/passwords'

export const dynamic = 'force-dynamic'

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

const VK_CLIENT_ID = process.env.VK_CLIENT_ID || process.env.VK_APP_ID || '51824701'
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET || process.env.VK_SECRET_KEY || 'aaQ13axAPQEcczQa'

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'zeprh.vercel.app'
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
        let raw = state
        try { raw = decodeURIComponent(raw) } catch {}
        try {
          decodedState = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
        } catch {
          try {
            decodedState = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'))
          } catch {
            decodedState = JSON.parse(raw)
          }
        }
      } catch (err) {
        console.warn('Failed to parse VK OAuth state:', err)
      }
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
    let finalChatId: bigint | null = null

    if (targetChatId && /^\d+$/.test(targetChatId) && !targetChatId.startsWith('guest_')) {
      finalChatId = BigInt(targetChatId)
      await prisma.telegramChat.update({
        where: { chatId: finalChatId },
        data: { vkId: vkUserId },
      }).catch(() => {})
    } else {
      // Find user with this vkId or create new
      let user = await prisma.telegramChat.findFirst({
        where: { vkId: vkUserId }
      })

      if (!user) {
        let newChatId = generateEmailChatId()
        for (let i = 0; i < 5; i++) {
          const clash = await prisma.telegramChat.findUnique({ where: { chatId: newChatId } })
          if (!clash) break
          newChatId = generateEmailChatId()
        }

        user = await prisma.telegramChat.create({
          data: {
            chatId: newChatId,
            vkId: vkUserId,
            authProvider: 'vk',
            firstName: `VK ID ${vkUserId}`,
            lastActiveAt: new Date(),
          }
        })
      }
      finalChatId = user.chatId
    }

    // Also persist in config for cross-check
    await prisma.config.upsert({
      where: { key: `user_vk_${finalChatId}` },
      update: { value: vkUserId },
      create: { key: `user_vk_${finalChatId}`, value: vkUserId },
    }).catch(() => {})

    const sessionToken = await createServerSession(
      finalChatId,
      'VK OAuth Session',
      'web',
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    const returnOrigin = decodedState?.origin || origin
    const res = NextResponse.redirect(`${returnOrigin}/?vk_auth_success=1&vk_id=${encodeURIComponent(vkUserId)}#settings`)
    res.cookies.set('zerf_chat_id', String(finalChatId), COOKIE_OPTS)
    res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)
    return res
  } catch (err: any) {
    console.error('VK OAuth callback error:', err)
    return NextResponse.redirect(`${origin}/?vk_auth_error=${encodeURIComponent(err.message || 'unknown')}#settings`)
  }
}
