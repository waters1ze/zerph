import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23li5itN8nX8pNVJsy'
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'acb04b9e1b10d79b208603feebce151f203d0e8e'
const ORIGIN = 'https://zeprh.vercel.app'
const CALLBACK_URL = `${ORIGIN}/api/auth/github/callback`

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
    return NextResponse.redirect(`${ORIGIN}/?github_auth_error=${encodeURIComponent(error || 'no_code')}#settings`)
  }

  try {
    // Decode state to get chatId
    let chatId = req.cookies.get('zerf_chat_id')?.value || ''
    if (state) {
      try {
        let raw = state
        try { raw = decodeURIComponent(state) } catch {}
        const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
        if (parsed?.chatId) chatId = parsed.chatId
      } catch {}
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
      const existing = await prisma.config.findFirst({ where: { key: { startsWith: 'user_github_' }, value: ghUsername } })
      if (existing) {
        const id = existing.key.replace('user_github_', '')
        if (/^-?\d+$/.test(id)) finalChatId = BigInt(id)
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

    // Save GitHub link
    await prisma.config.upsert({
      where: { key: `user_github_${cid}` },
      update: { value: ghUsername },
      create: { key: `user_github_${cid}`, value: ghUsername },
    })

    // Create session
    const sessionToken = await createServerSession(cid, 'GitHub OAuth', 'web',
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    const res = NextResponse.redirect(`${ORIGIN}/?github_auth_success=1&username=${encodeURIComponent(ghUsername)}#settings`)
    res.cookies.set('zerf_chat_id', String(cid), COOKIE_OPTS)
    res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)
    return res
  } catch (err: any) {
    console.error('GitHub OAuth callback error:', err)
    return NextResponse.redirect(`${ORIGIN}/?github_auth_error=${encodeURIComponent(err?.message || 'unknown')}#settings`)
  }
}
