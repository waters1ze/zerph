import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

const VK_CLIENT_ID = process.env.VK_CLIENT_ID || process.env.VK_APP_ID || '51824701'
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET || process.env.VK_SECRET_KEY || 'aaQ13axAPQEcczQa'
const ORIGIN = 'https://zeprh.vercel.app'
const CALLBACK_URL = `${ORIGIN}/api/auth/vk/callback`

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: true,
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${ORIGIN}/?vk_auth_error=${encodeURIComponent(error || 'no_code')}#settings`)
  }

  try {
    // Decode state
    let chatId = req.cookies.get('zerf_chat_id')?.value || ''
    if (state) {
      try {
        let raw = state
        try { raw = decodeURIComponent(state) } catch {}
        const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
        if (parsed?.chatId) chatId = parsed.chatId
      } catch {}
    }

    // Exchange code for VK access token
    const tokenUrl = `https://oauth.vk.com/access_token?client_id=${VK_CLIENT_ID}&client_secret=${VK_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&code=${code}`
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()
    const vkUserId = tokenData.user_id ? String(tokenData.user_id) : null

    if (!vkUserId) {
      console.error('VK token exchange failed:', tokenData)
      return NextResponse.redirect(`${ORIGIN}/?vk_auth_error=token_failed#settings`)
    }

    // Find or create user
    let finalChatId: bigint | null = null

    if (chatId && /^-?\d+$/.test(chatId)) {
      finalChatId = BigInt(chatId)
      // Link VK to existing user
      await prisma.telegramChat.update({
        where: { chatId: finalChatId },
        data: { vkId: vkUserId },
      }).catch(() => {})
    } else {
      // Find by vkId
      const existing = await prisma.telegramChat.findFirst({ where: { vkId: vkUserId } })
      if (existing) {
        finalChatId = existing.chatId
      } else {
        // Create new user
        const newId = BigInt(Math.floor(100000000 + Math.random() * 900000000))
        await prisma.telegramChat.create({
          data: { chatId: newId, vkId: vkUserId, authProvider: 'vk', firstName: `VK ${vkUserId}`, lastActiveAt: new Date() }
        }).catch(() => {})
        finalChatId = newId
      }
    }

    const cid = finalChatId!

    await prisma.config.upsert({
      where: { key: `user_vk_${cid}` },
      update: { value: vkUserId },
      create: { key: `user_vk_${cid}`, value: vkUserId },
    }).catch(() => {})

    const sessionToken = await createServerSession(cid, 'VK OAuth', 'web',
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    const res = NextResponse.redirect(`${ORIGIN}/?vk_auth_success=1&vk_id=${encodeURIComponent(vkUserId)}&chatId=${encodeURIComponent(String(cid))}#settings`)
    res.cookies.set('zerf_chat_id', String(cid), COOKIE_OPTS)
    res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)
    return res
  } catch (err: any) {
    console.error('VK OAuth callback error:', err)
    return NextResponse.redirect(`${ORIGIN}/?vk_auth_error=${encodeURIComponent(err?.message || 'unknown')}#settings`)
  }
}
