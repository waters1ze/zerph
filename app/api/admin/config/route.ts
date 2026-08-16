import { NextRequest, NextResponse } from 'next/server'
import { getConfig, setConfig } from '@/lib/backend/db'
import { getAdminSecret, secretsMatch } from '@/lib/backend/auth'

function authorized(req: NextRequest): boolean {
  const secretValue = getAdminSecret()
  if (!secretValue) return false
  const authHeader = req.headers.get('authorization') || ''
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()
  const header = req.headers.get('x-admin-secret') || ''
  // Query param kept for backward compat with internal callers only
  const query = req.nextUrl.searchParams.get('secret') || ''
  return secretsMatch(bearer, secretValue) || secretsMatch(header, secretValue) || secretsMatch(query, secretValue)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const price = await getConfig('subscription_price') || '99'
  const voiceSecondsLimit = await getConfig('voice_seconds_limit') || '600'
  const freeNotesPerDay = await getConfig('free_notes_per_day') || '2'
  const freeVoicePerDay = await getConfig('free_voice_per_day') || '2'
  const freeChatPerDay = await getConfig('free_chat_per_day') || '10'

  return NextResponse.json({
    config: {
      subscription_price: price,
      voice_seconds_limit: voiceSecondsLimit,
      free_notes_per_day: freeNotesPerDay,
      free_voice_per_day: freeVoicePerDay,
      free_chat_per_day: freeChatPerDay,
    }
  })
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { key, value } = body

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
  }

  const ok = await setConfig(String(key), String(value))
  if (ok) {
    return NextResponse.json({ message: `Config '${key}' set to '${value}'` })
  } else {
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
  }
}
