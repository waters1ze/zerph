import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VK_CLIENT_ID = process.env.VK_CLIENT_ID || process.env.VK_APP_ID || '51824701'
const CALLBACK_URL = 'https://zeprh.vercel.app/api/auth/vk/callback'

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get('chatId') || req.cookies.get('zerf_chat_id')?.value || ''
  const state = Buffer.from(JSON.stringify({ chatId, origin: 'https://zeprh.vercel.app' })).toString('base64')
  const url = `https://oauth.vk.com/authorize?client_id=${VK_CLIENT_ID}&display=page&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&scope=email,offline&response_type=code&v=5.131&state=${encodeURIComponent(state)}`
  return NextResponse.redirect(url)
}
