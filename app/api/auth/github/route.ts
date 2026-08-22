import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export const dynamic = 'force-dynamic'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23li5itN8nX8pNVJsy'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://zeprh.vercel.app'
const CALLBACK_URL = `${ORIGIN}/api/auth/github/callback`

const STATE_TTL_MS = 15 * 60 * 1000

/**
 * SECURITY (audit C-1): OAuth state is now HMAC-signed and short-lived.
 * The callback refuses any chatId that is not bound to a server-issued
 * signature, so an attacker can no longer craft `state={chatId:victim}`
 * and receive a session cookie for somebody else's account.
 */
function signStatePayload(payloadB64: string): string {
  const secret = process.env.TELEGRAM_BOT_TOKEN || process.env.ADMIN_SECRET || ''
  if (!secret) return ''
  return crypto.createHmac('sha256', `gh-oauth-state:${secret}`).update(payloadB64).digest('base64url')
}

export async function GET(req: NextRequest) {
  // Identity for LINK MODE comes ONLY from a verified server session.
  const verified = await getAuthenticatedUser(req).catch(() => null)

  const payload = Buffer.from(
    JSON.stringify({
      mode: verified ? 'link' : 'login',
      chatId: verified?.chatId || null,
      origin: ORIGIN,
      iat: Date.now(),
    })
  ).toString('base64url')

  const sig = signStatePayload(payload)
  const state = `${payload}.${sig}`

  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=read:user+user:email+repo&state=${encodeURIComponent(state)}`
  return NextResponse.redirect(url)
}
