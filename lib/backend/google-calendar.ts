import { prisma } from './prisma'

export interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_at?: number
  token_type?: string
  scope?: string
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '140430721803-o7nopfthipkvknp92lkaegsjsa1l0os2.apps.googleusercontent.com'
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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'

export function getRedirectUri(requestOrigin?: string): string {
  if (requestOrigin) {
    return `${requestOrigin.replace(/\/$/, '')}/api/calendar/token`
  }
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI
  }
  return 'https://zeprh.vercel.app/api/calendar/token'
}

/**
 * Generate Google OAuth 2.0 authorization URL
 * By default requests ONLY standard non-sensitive scopes (openid, email, profile)
 * Sensitive calendar scopes are requested only when includeCalendar=true
 */
export function getGoogleAuthUrl(
  chatId: string | number | bigint,
  redirectUri: string,
  includeCalendar: boolean = false
): string {
  const scopes = includeCalendar
    ? [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ]
    : [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ]

  const state = Buffer.from(JSON.stringify({
    chatId: String(chatId),
    includeCalendar: Boolean(includeCalendar),
  })).toString('base64url')

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: includeCalendar ? 'consent' : 'select_account',
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Google token exchange failed: ${errorText}`)
  }

  const data = await res.json()
  const expiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    token_type: data.token_type,
    scope: data.scope,
  }
}

/**
 * Get valid access token for user, refreshing if expired
 */
export async function getValidAccessToken(chatId: string | number | bigint): Promise<string | null> {
  const userCid = BigInt(chatId)
  const chat = await prisma.telegramChat.findUnique({
    where: { chatId: userCid },
    select: { googleCalendarToken: true, googleCalendarSync: true },
  })

  if (!chat?.googleCalendarToken) return null

  let tokens: GoogleTokens
  try {
    tokens = JSON.parse(chat.googleCalendarToken)
  } catch {
    return null
  }

  if (!tokens.access_token) return null

  // If token has at least 2 minutes of lifetime left, return it
  if (tokens.expires_at && tokens.expires_at > Date.now() + 120_000) {
    return tokens.access_token
  }

  // Token expired, refresh using refresh_token
  if (!tokens.refresh_token) {
    return tokens.access_token
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) {
      console.error('Failed to refresh Google token:', await res.text())
      return tokens.access_token
    }

    const data = await res.json()
    const updatedTokens: GoogleTokens = {
      ...tokens,
      access_token: data.access_token,
      expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    }

    await prisma.telegramChat.update({
      where: { chatId: userCid },
      data: { googleCalendarToken: JSON.stringify(updatedTokens) },
    })

    return updatedTokens.access_token
  } catch (err) {
    console.error('Error refreshing Google token:', err)
    return tokens.access_token
  }
}

/**
 * 2-way sync: Pull events from Google Calendar & Push tasks to Google Calendar
 */
export async function syncGoogleCalendar(chatId: string | number | bigint): Promise<{ pulled: number; pushed: number; success: boolean }> {
  const token = await getValidAccessToken(chatId)
  if (!token) return { pulled: 0, pushed: 0, success: false }

  const userCid = BigInt(chatId)
  let pulled = 0
  let pushed = 0

  try {
    // 1. PULL: Fetch upcoming events from Google Calendar (next 30 days)
    const now = new Date()
    const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() // include today/yesterday
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const listRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (listRes.ok) {
      const listData = await listRes.json()
      const items = Array.isArray(listData.items) ? listData.items : []

      for (const item of items) {
        if (!item.summary) continue

        // Check date
        const startRaw = item.start?.dateTime || item.start?.date
        if (!startRaw) continue

        const startDate = startRaw.slice(0, 10) // YYYY-MM-DD
        let startTime: string | null = null
        if (item.start?.dateTime) {
          const dt = new Date(item.start.dateTime)
          const hh = String(dt.getHours()).padStart(2, '0')
          const mm = String(dt.getMinutes()).padStart(2, '0')
          startTime = `${hh}:${mm}`
        }

        // Avoid duplicate import
        const existing = await prisma.task.findFirst({
          where: {
            ownerChatId: userCid,
            rawText: `gcal_${item.id}`,
          },
        })

        if (!existing) {
          await prisma.task.create({
            data: {
              title: item.summary,
              description: item.description || undefined,
              dueDate: startDate,
              dueTime: startTime,
              priority: 'medium',
              status: 'todo',
              tags: ['#календарь', '#google'],
              rawText: `gcal_${item.id}`,
              ownerChatId: userCid,
            },
          })
          pulled++
        }
      }
    }

    // 2. PUSH: Find local pending tasks with dueDate created without gcal tag, push to Google Calendar
    const localTasks = await prisma.task.findMany({
      where: {
        ownerChatId: userCid,
        dueDate: { not: null },
        status: { in: ['todo', 'in_progress'] },
        rawText: { not: { startsWith: 'gcal_' } },
      },
      take: 20,
    })

    for (const t of localTasks) {
      if (!t.dueDate) continue

      // Create event in Google Calendar
      const eventBody: any = {
        summary: t.title,
        description: t.description || undefined,
      }

      if (t.dueTime) {
        eventBody.start = { dateTime: `${t.dueDate}T${t.dueTime}:00+03:00` }
        eventBody.end = { dateTime: `${t.dueDate}T${t.dueTime}:00+03:00` }
      } else {
        eventBody.start = { date: t.dueDate }
        eventBody.end = { date: t.dueDate }
      }

      const createRes = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventBody),
        }
      )

      if (createRes.ok) {
        const createdEvent = await createRes.json()
        await prisma.task.update({
          where: { id: t.id },
          data: { rawText: `gcal_${createdEvent.id}` },
        })
        pushed++
      }
    }

    return { pulled, pushed, success: true }
  } catch (err) {
    console.error('Error syncing Google Calendar:', err)
    return { pulled, pushed, success: false }
  }
}
