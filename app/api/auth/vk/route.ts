import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const VK_CLIENT_ID = process.env.VK_CLIENT_ID || process.env.VK_APP_ID || '54722068'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
const CALLBACK_URL = `${ORIGIN}/api/auth/vk/callback`

const STATE_TTL_MS = 15 * 60 * 1000

/**
 * SECURITY: OAuth state is HMAC-signed AND bound to this browser via an
 * httpOnly nonce cookie (mirrors the hardened GitHub flow). The callback
 * refuses any state that is not backed by a server-issued signature plus a
 * matching cookie — preventing forged link payloads and login-CSRF.
 */
function signStatePayload(payloadB64: string): string {
  const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.ADMIN_SECRET || ''
  if (!secret) return ''
  return crypto.createHmac('sha256', `vk-oauth-state:${secret}`).update(payloadB64).digest('base64url')
}

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get('chatId') || req.cookies.get('zerf_chat_id')?.value || ''

  const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.ADMIN_SECRET || ''
  if (!secret) {
    // Fail closed: without a signing secret every state would be forgeable
    return new NextResponse('[VK OAuth] State signing secret is not configured', { status: 500 })
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  const payloadB64 = Buffer.from(
    JSON.stringify({ chatId, origin: ORIGIN, iat: Date.now(), nonce })
  ).toString('base64url')
  const sig = signStatePayload(payloadB64)
  const state = `${payloadB64}.${sig}`

  const url = `https://oauth.vk.com/authorize?client_id=${VK_CLIENT_ID}&display=page&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=email,offline&response_type=code&v=5.131&state=${encodeURIComponent(state)}`
  const res = NextResponse.redirect(url)
  res.cookies.set('vk_oauth_nonce', nonce, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: Math.floor(STATE_TTL_MS / 1000),
  })
  return res
}
