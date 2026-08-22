import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { createServerSession } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23li5itN8nX8pNVJsy'
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'acb04b9e1b10d79b208603feebce151f203d0e8e'

function getCanonicalOrigin(rawOrigin: string): string {
  if (!rawOrigin || rawOrigin.includes('zeprh') || rawOrigin.includes('zerph') || rawOrigin.includes('zcrph')) {
    return 'https://zeprh.vercel.app'
  }
  if (rawOrigin.includes('localhost')) {
    return rawOrigin
  }
  return rawOrigin.replace(/\/$/, '')
}

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'zeprh.vercel.app'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const rawOrigin = `${protocol}://${host}`
  const origin = getCanonicalOrigin(rawOrigin)

  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error || !code) {
      return NextResponse.redirect(`${origin}/?github_auth_error=${encodeURIComponent(error || 'no_code')}#settings`)
    }

    let decodedState: any = {}
    if (state) {
      try {
        decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
      } catch {}
    }

    const redirectUri = `${origin.replace(/\/$/, '')}/api/auth/github/callback`

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      // Fallback: If client secret is not configured in environment, parse simulated/dummy login or show clean message
      console.warn('GitHub OAuth token exchange response:', tokenData)
      return NextResponse.redirect(`${origin}/?github_auth_error=token_failed#settings`)
    }

    // Fetch user profile from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Zerf-AI-App',
      },
    })
    const githubUser = await userRes.json()
    const ghUsername = githubUser.login

    if (!ghUsername) {
      throw new Error('Не удалось получить логин пользователя от GitHub')
    }

    const targetChatId = decodedState.chatId || req.cookies.get('zerf_chat_id')?.value
    let finalChatId: bigint | null = null

    if (targetChatId && /^-?\d+$/.test(targetChatId) && !targetChatId.startsWith('guest_')) {
      finalChatId = BigInt(targetChatId)
    } else {
      // Find existing user with this GitHub username
      const existingGhConfig = await prisma.config.findFirst({
        where: {
          key: { startsWith: 'user_github_' },
          value: ghUsername,
        }
      })
      if (existingGhConfig) {
        const parsed = existingGhConfig.key.replace(/^user_github_/, '')
        if (/^-?\d+$/.test(parsed)) {
          finalChatId = BigInt(parsed)
        }
      }
    }

    if (!finalChatId) {
      // Create new user account for GitHub user if none exists
      let newChatId = BigInt(Math.floor(100000000 + Math.random() * 900000000))
      for (let i = 0; i < 5; i++) {
        const clash = await prisma.telegramChat.findUnique({ where: { chatId: newChatId } })
        if (!clash) break
        newChatId = BigInt(Math.floor(100000000 + Math.random() * 900000000))
      }

      const newUser = await prisma.telegramChat.create({
        data: {
          chatId: newChatId,
          username: ghUsername,
          firstName: githubUser.name || ghUsername,
          authProvider: 'github',
          lastActiveAt: new Date(),
        }
      }).catch(err => {
        console.warn('Could not create telegramChat row for GitHub user:', err)
        return null
      })

      finalChatId = newUser ? newUser.chatId : newChatId
    }

    const cid = finalChatId

    // Save linked GitHub username and token in database
    await prisma.config.upsert({
      where: { key: `user_github_${cid}` },
      update: { value: ghUsername },
      create: { key: `user_github_${cid}`, value: ghUsername },
    })
    await prisma.config.upsert({
      where: { key: `user_github_token_${cid}` },
      update: { value: accessToken },
      create: { key: `user_github_token_${cid}`, value: accessToken },
    })

    const sessionToken = await createServerSession(
      cid,
      'GitHub OAuth Session',
      'web',
      req.headers.get('x-forwarded-for') || undefined,
      req.headers.get('user-agent') || undefined
    )

    const returnOrigin = decodedState?.origin || origin
    const res = NextResponse.redirect(`${returnOrigin}/?github_auth_success=1&username=${encodeURIComponent(ghUsername)}#settings`)
    res.cookies.set('zerf_chat_id', String(cid), COOKIE_OPTS)
    res.cookies.set('zerf_auth_token', sessionToken, COOKIE_OPTS)
    return res
  } catch (err: any) {
    console.error('GitHub OAuth error:', err)
    return NextResponse.redirect(`${origin}/?github_auth_error=${encodeURIComponent(err.message || 'unknown')}#settings`)
  }
}
