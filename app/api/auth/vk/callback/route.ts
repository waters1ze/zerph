import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession, getAuthenticatedUser } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

const VK_CLIENT_ID = process.env.VK_CLIENT_ID || process.env.VK_APP_ID || '54722068'
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

    // ── Identity resolution ──────────────────────────────────────────────
    // Only a VERIFIED server session (DB sessionToken) proves who is linking.
    // The bare zerf_chat_id cookie is NOT proof of identity: trusting it
    // would let anyone link their own VK to somebody else's account and
    // then log into it via vkId lookup (full account takeover).
    const verified = await getAuthenticatedUser(req).catch(() => null)

    // ── Find or create user ──────────────────────────────────────────────
    let finalChatId: bigint | null = null

    if (verified && /^-?\d+$/.test(verified.chatId)) {
      // LINK MODE: authenticated user attaches this VK profile to their account
      const current = BigInt(verified.chatId)
      const vkOwner = await prisma.telegramChat.findFirst({ where: { vkId: vkUserId } })
      if (vkOwner && vkOwner.chatId !== current) {
        // This VK is already attached to a different account — do not hijack it
        return NextResponse.redirect(`${ORIGIN}/?vk_auth_error=already_linked_to_another_account#settings`)
      }
      await prisma.telegramChat.update({
        where: { chatId: current },
        data: { vkId: vkUserId },
      })
      finalChatId = current
    } else {
      // LOGIN MODE: no verified session — sign in or register
      const existingByVk = await prisma.telegramChat.findFirst({ where: { vkId: vkUserId } })
      if (existingByVk) {
        finalChatId = existingByVk.chatId
      }

      // Legacy mapping stored in Config table
      if (!finalChatId) {
        const existingConf = await prisma.config.findFirst({
          where: { key: { startsWith: 'user_vk_' }, value: vkUserId }
        })
        if (existingConf) {
          const id = existingConf.key.replace('user_vk_', '')
          if (/^-?\d+$/.test(id)) finalChatId = BigInt(id)
        }
      }

      // Match by VK email → attach VK to the existing account instead of duplicating
      if (!finalChatId && vkEmail) {
        const byEmail = await prisma.telegramChat.findUnique({ where: { email: vkEmail } }).catch(() => null)
        if (byEmail && byEmail.vkId !== vkUserId) {
          await prisma.telegramChat.update({
            where: { chatId: byEmail.chatId },
            data: { vkId: vkUserId },
          })
          finalChatId = byEmail.chatId
        }
      }

      if (!finalChatId) {
        // CREATE MODE: no account exists — register a new profile
        let newId = BigInt(Math.floor(100000000 + Math.random() * 900000000))
        for (let i = 0; i < 5; i++) {
          const clash = await prisma.telegramChat.findUnique({ where: { chatId: newId } })
          if (!clash) break
          newId = BigInt(Math.floor(100000000 + Math.random() * 900000000))
        }
        try {
          const created = await prisma.telegramChat.create({
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
          })
          finalChatId = created.chatId
        } catch (createErr: any) {
          // Race: another request created this VK user first — find and reuse it
          console.error('VK OAuth user create failed:', createErr)
          const raced = await prisma.telegramChat.findFirst({ where: { vkId: vkUserId } })
          if (!raced) throw createErr
          finalChatId = raced.chatId
        }
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
