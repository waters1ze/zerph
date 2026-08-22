import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

const VK_CLIENT_ID = process.env.VK_CLIENT_ID || process.env.VK_APP_ID || '51824701'
// The protected key must come from env only — it was previously hardcoded
// here and leaked into git history (rotate it in the VK app settings).
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET || process.env.VK_SECRET_KEY || null
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
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

  if (!VK_CLIENT_SECRET) {
    console.error('[VK OAuth] VK_CLIENT_SECRET is not configured — refusing token exchange')
    return NextResponse.redirect(`${ORIGIN}/?vk_auth_error=server_not_configured#settings`)
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

    const accessToken = tokenData.access_token
    const vkUserId = tokenData.user_id ? String(tokenData.user_id) : null
    const vkEmail = tokenData.email ? String(tokenData.email) : null

    if (!vkUserId) {
      console.error('VK token exchange failed:', tokenData)
      // Surface VK's own reason (error / error_description, e.g.
      // invalid_grant, invalid_client) so the user sees the real cause
      // instead of a generic "token_failed".
      const vkReason = String(tokenData.error || 'token_failed')
      const vkDesc = String(tokenData.error_description || '').slice(0, 200)
      const detail = vkDesc ? `${vkReason}:${vkDesc}` : vkReason
      return NextResponse.redirect(`${ORIGIN}/?vk_auth_error=${encodeURIComponent(detail)}#settings`)
    }

    // Fetch user details from VK API
    let vkFirstName = `VK ID ${vkUserId}`
    let vkLastName = ''
    let vkScreenName = ''

    if (accessToken && vkUserId) {
      try {
        const profileRes = await fetch(
          `https://api.vk.com/method/users.get?user_ids=${vkUserId}&fields=first_name,last_name,photo_200,screen_name&access_token=${accessToken}&v=5.131`
        )
        const profileData = await profileRes.json()
        const userObj = profileData.response?.[0]
        if (userObj) {
          if (userObj.first_name) vkFirstName = userObj.first_name
          if (userObj.last_name) vkLastName = userObj.last_name
          if (userObj.screen_name) vkScreenName = userObj.screen_name
        }
      } catch (err) {
        console.warn('Failed to fetch VK user profile details:', err)
      }
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
      // Find by vkId in telegramChat
      const existing = await prisma.telegramChat.findFirst({ where: { vkId: vkUserId } })
      if (existing) {
        finalChatId = existing.chatId
      } else {
        // Also check config table
        const existingConf = await prisma.config.findFirst({
          where: { key: { startsWith: 'user_vk_' }, value: vkUserId }
        })
        if (existingConf) {
          const id = existingConf.key.replace('user_vk_', '')
          if (/^-?\d+$/.test(id)) finalChatId = BigInt(id)
        }
      }

      if (!finalChatId) {
        // Create new user with real VK name
        let newId = BigInt(Math.floor(100000000 + Math.random() * 900000000))
        for (let i = 0; i < 5; i++) {
          const clash = await prisma.telegramChat.findUnique({ where: { chatId: newId } })
          if (!clash) break
          newId = BigInt(Math.floor(100000000 + Math.random() * 900000000))
        }
        await prisma.telegramChat.create({
          data: {
            chatId: newId,
            vkId: vkUserId,
            authProvider: 'vk',
            firstName: vkFirstName,
            lastName: vkLastName || null,
            username: vkScreenName || null,
            email: vkEmail || null,
            lastActiveAt: new Date(),
          }
        }).catch(() => {})
        finalChatId = newId
      }
    }

    const cid = finalChatId!

    await prisma.config.upsert({
      where: { key: `user_vk_${cid}` },
      update: { value: vkUserId },
      create: { key: `user_vk_${cid}`, value: vkUserId },
    }).catch(async () => {
      try {
        await prisma.config.delete({ where: { key: `user_vk_${cid}` } })
        await prisma.config.create({ data: { key: `user_vk_${cid}`, value: vkUserId } })
      } catch {}
    })

    const sessionToken = await createServerSession(cid, 'VK OAuth', 'web',
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    const res = NextResponse.redirect(`${ORIGIN}/?vk_auth_success=1&vk_id=${encodeURIComponent(vkUserId)}&name=${encodeURIComponent(vkFirstName)}&chatId=${encodeURIComponent(String(cid))}#settings`)
    res.cookies.set('zerf_chat_id', String(cid), COOKIE_OPTS)
    res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)
    return res
  } catch (err: any) {
    console.error('VK OAuth callback error:', err)
    return NextResponse.redirect(`${ORIGIN}/?vk_auth_error=${encodeURIComponent(err?.message || 'unknown')}#settings`)
  }
}
