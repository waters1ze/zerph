import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession, getAuthenticatedUser } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23li5itN8nX8pNVJsy'
// The client secret must come from env only — it was previously hardcoded
// here and leaked into git history (rotate it in the GitHub app settings).
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || null
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
const CALLBACK_URL = `${ORIGIN}/api/auth/github/callback`

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: true,
}

const STATE_TTL_MS = 15 * 60 * 1000

/**
 * SECURITY (audit C-1): verifies the HMAC-protected state issued by
 * /api/auth/github. Returns the trusted payload or null.
 *
 * The old implementation accepted an arbitrary base64 JSON `{chatId}` —
 * anyone could complete OAuth with their own GitHub account and mint a
 * session cookie for a VICTIM's chatId (full account takeover).
 */
function verifySignedState(state: string | null): { mode: string; chatId: string | null; iat: number } | null {
  if (!state) return null
  try {
    let raw = state
    try { raw = decodeURIComponent(state) } catch {}
    const dot = raw.lastIndexOf('.')
    if (dot <= 0) return null
    const payloadB64 = raw.slice(0, dot)
    const sig = raw.slice(dot + 1)

    const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.ADMIN_SECRET || ''
    if (!secret) return null
    const expected = crypto.createHmac('sha256', `gh-oauth-state:${secret}`).update(payloadB64).digest('base64url')

    // timing-safe comparison over equal-length digests
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'))
    if (!parsed || typeof parsed !== 'object' || typeof parsed.iat !== 'number') return null
    if (Date.now() - parsed.iat > STATE_TTL_MS) return null // expired link
    return parsed
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${ORIGIN}/?github_auth_error=${encodeURIComponent(error || 'no_code')}#settings`)
  }

  if (!GITHUB_CLIENT_SECRET) {
    console.error('[GitHub OAuth] GITHUB_CLIENT_SECRET is not configured — refusing token exchange')
    return NextResponse.redirect(`${ORIGIN}/?github_auth_error=server_not_configured#settings`)
  }

  try {
    // ── Identity resolution ──────────────────────────────────────────────
    // LINK MODE requires BOTH a validly signed state AND a verified session
    // whose chatId matches the state. A bare zerf_chat_id cookie is NOT
    // proof of identity and is never used for linking.
    const statePayload = verifySignedState(state)
    let chatId = ''
    let linkMode = false

    if (statePayload?.mode === 'link' && statePayload.chatId && /^-?\d+$/.test(String(statePayload.chatId))) {
      const verified = await getAuthenticatedUser(req).catch(() => null)
      if (verified && verified.chatId === String(statePayload.chatId)) {
        chatId = verified.chatId
        linkMode = true
      }
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri: CALLBACK_URL }),
    })
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('GitHub token exchange failed:', tokenData)
      return NextResponse.redirect(`${ORIGIN}/?github_auth_error=token_failed#settings`)
    }

    // Fetch GitHub user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'Zerf-App' },
    })
    const ghUser = await userRes.json()
    const ghUsername = ghUser.login

    if (!ghUsername) {
      return NextResponse.redirect(`${ORIGIN}/?github_auth_error=no_username#settings`)
    }

    // Find or create user
    let finalChatId: bigint | null = null
    if (chatId && /^-?\d+$/.test(chatId)) {
      finalChatId = BigInt(chatId)
    }

    if (!finalChatId) {
      // 1. Look for existing config link
      const existing = await prisma.config.findFirst({ where: { key: { startsWith: 'user_github_' }, value: ghUsername } })
      if (existing) {
        const id = existing.key.replace('user_github_', '')
        if (/^-?\d+$/.test(id)) finalChatId = BigInt(id)
      }
    }

    if (!finalChatId) {
      // 2. Look for existing user created via GitHub registration
      const existingChat = await prisma.telegramChat.findFirst({
        where: { authProvider: 'github', username: ghUsername }
      })
      if (existingChat) {
        finalChatId = existingChat.chatId
      }
    }

    if (!finalChatId) {
      let newId = BigInt(Math.floor(100000000 + Math.random() * 900000000))
      for (let i = 0; i < 5; i++) {
        const clash = await prisma.telegramChat.findUnique({ where: { chatId: newId } })
        if (!clash) break
        newId = BigInt(Math.floor(100000000 + Math.random() * 900000000))
      }
      await prisma.telegramChat.create({
        data: { chatId: newId, username: ghUsername, firstName: ghUser.name || ghUsername, authProvider: 'github', lastActiveAt: new Date() }
      }).catch(() => {})
      finalChatId = newId
    }

    // Ensure the row exists (upsert for existing Telegram users)
    await prisma.telegramChat.upsert({
      where: { chatId: finalChatId },
      update: {},
      create: { chatId: finalChatId, username: ghUsername, firstName: ghUser.name || ghUsername, authProvider: 'github', lastActiveAt: new Date() },
    }).catch(() => {})

    const cid = finalChatId

    // Save GitHub link in Config table
    await prisma.config.upsert({
      where: { key: `user_github_${cid}` },
      update: { value: ghUsername },
      create: { key: `user_github_${cid}`, value: ghUsername },
    }).catch(async () => {
      try {
        await prisma.config.delete({ where: { key: `user_github_${cid}` } })
        await prisma.config.create({ data: { key: `user_github_${cid}`, value: ghUsername } })
      } catch {}
    })

    // Save GitHub Access Token for private repo access & manifest parsing
    if (accessToken) {
      await prisma.config.upsert({
        where: { key: `user_github_token_${cid}` },
        update: { value: accessToken },
        create: { key: `user_github_token_${cid}`, value: accessToken },
      }).catch(async () => {
        try {
          await prisma.config.delete({ where: { key: `user_github_token_${cid}` } })
          await prisma.config.create({ data: { key: `user_github_token_${cid}`, value: accessToken } })
        } catch {}
      })
    }

    // Create session
    const sessionToken = await createServerSession(cid, 'GitHub OAuth', 'web',
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    const res = NextResponse.redirect(`${ORIGIN}/?github_auth_success=1&username=${encodeURIComponent(ghUsername)}&chatId=${encodeURIComponent(String(cid))}#settings`)
    res.cookies.set('zerf_chat_id', String(cid), COOKIE_OPTS)
    res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)
    return res
  } catch (err: any) {
    console.error('GitHub OAuth callback error:', err)
    return NextResponse.redirect(`${ORIGIN}/?github_auth_error=${encodeURIComponent(err?.message || 'unknown')}#settings`)
  }
}
