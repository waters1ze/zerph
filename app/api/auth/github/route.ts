import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/backend/prisma'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23li34b9d1469e88aa'

/**
 * GET /api/auth/github
 * 1-Click GitHub OAuth Entry point
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin || 'https://zerph.vercel.app'
  const redirectUri = `${origin.replace(/\/$/, '')}/api/auth/github/callback`
  
  const authUser = await getAuthenticatedUser(req)
  const cookieCid = req.cookies.get('zerf_chat_id')?.value
  const paramCid = req.nextUrl.searchParams.get('chatId')
  const targetChatId = authUser?.chatId ? String(authUser.chatId) : (cookieCid || paramCid || '')

  const clientId = process.env.GITHUB_CLIENT_ID || 'Ov23li34b9d1469e88aa'

  const state = Buffer.from(JSON.stringify({
    chatId: targetChatId,
    origin,
  })).toString('base64url')

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user%20user:email&state=${state}`
  
  return NextResponse.redirect(githubAuthUrl)
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
