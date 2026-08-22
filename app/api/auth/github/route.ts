import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23li5itN8nX8pNVJsy'

function getCanonicalOrigin(rawOrigin: string): string {
  if (!rawOrigin || rawOrigin.includes('zeprh') || rawOrigin.includes('zerph') || rawOrigin.includes('zcrph')) {
    return 'https://zeprh.vercel.app'
  }
  if (rawOrigin.includes('localhost')) {
    return rawOrigin
  }
  return rawOrigin.replace(/\/$/, '')
}

/**
 * GET /api/auth/github
 * 1-Click GitHub OAuth Entry point
 */
export async function GET(req: NextRequest) {
  try {
    const rawOrigin = req.nextUrl.origin || 'https://zeprh.vercel.app'
    const origin = getCanonicalOrigin(rawOrigin)
    const redirectUri = `${origin.replace(/\/$/, '')}/api/auth/github/callback`
    
    let targetChatId = ''
    try {
      const authUser = await getAuthenticatedUser(req)
      if (authUser?.chatId) {
        targetChatId = String(authUser.chatId)
      }
    } catch {}

    if (!targetChatId) {
      const cookieCid = req.cookies.get('zerf_chat_id')?.value
      const paramCid = req.nextUrl.searchParams.get('chatId')
      targetChatId = cookieCid || paramCid || ''
    }

    const clientId = process.env.GITHUB_CLIENT_ID || GITHUB_CLIENT_ID

    const state = Buffer.from(JSON.stringify({
      chatId: targetChatId,
      origin,
    })).toString('base64url')

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user%20user:email&state=${state}`
    
    return NextResponse.redirect(githubAuthUrl)
  } catch (err: any) {
    console.error('GitHub OAuth start error:', err)
    return NextResponse.redirect('https://github.com/login/oauth/authorize?client_id=Ov23li5itN8nX8pNVJsy&redirect_uri=https%3A%2F%2Fzeprh.vercel.app%2Fapi%2Fauth%2Fgithub%2Fcallback&scope=read:user%20user:email')
  }
}

/**
 * POST /api/auth/github
 * Direct manual GitHub username linking and validation
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const cid = authUser.chatId

    const body = await req.json()
    const rawUsername = body.username || ''
    const cleanUsername = String(rawUsername).trim().replace(/^@/, '').replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '').trim()

    if (!cleanUsername) {
      // Unlink GitHub
      await prisma.config.delete({ where: { key: `user_github_${cid}` } }).catch(() => {})
      await prisma.config.delete({ where: { key: `user_github_token_${cid}` } }).catch(() => {})
      return NextResponse.json({ success: true, message: 'GitHub успешно отвязан', githubUsername: null })
    }

    // Verify username exists on GitHub
    try {
      const ghRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, {
        headers: { 'User-Agent': 'Zerf-AI-App' },
      })
      if (!ghRes.ok) {
        return NextResponse.json({ error: `GitHub пользователь «${cleanUsername}» не найден` }, { status: 404 })
      }
    } catch {}

    await prisma.config.upsert({
      where: { key: `user_github_${cid}` },
      update: { value: cleanUsername },
      create: { key: `user_github_${cid}`, value: cleanUsername },
    })

    return NextResponse.json({
      success: true,
      message: `GitHub @${cleanUsername} успешно привязан!`,
      githubUsername: cleanUsername,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка сохранения GitHub' }, { status: 500 })
  }
}
