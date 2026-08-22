import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23li5itN8nX8pNVJsy'
const CALLBACK_URL = 'https://zeprh.vercel.app/api/auth/github/callback'

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get('chatId') || req.cookies.get('zerf_chat_id')?.value || ''
  const state = Buffer.from(JSON.stringify({ chatId, origin: 'https://zeprh.vercel.app' })).toString('base64')
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=read:user+user:email+repo&state=${encodeURIComponent(state)}`
  return NextResponse.redirect(url)
}
