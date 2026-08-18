/**
 * GET /api/events — Server-Sent Events (SSE) stream for event-driven real-time updates.
 * Replaces high-frequency client-side polling loops to conserve serverless invocations and DB load.
 */

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  const chatId = authUser?.chatId || req.nextUrl.searchParams.get('chatId')

  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connected event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', chatId, timestamp: Date.now() })}\n\n`)
      )

      // 2. Keep-alive heartbeat every 25 seconds
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`)
          )
        } catch {
          clearInterval(heartbeatInterval)
        }
      }, 25000)

      // 3. Clean up on client disconnect / request abort
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        try {
          controller.close()
        } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
