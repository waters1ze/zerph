/**
 * GET /api/events — Server-Sent Events (SSE) stream for event-driven real-time updates.
 * Replaces high-frequency client-side polling loops to conserve serverless invocations and DB load.
 */

import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/backend/auth'

import { addSseClient } from '@/lib/backend/sse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest) {
  // SECURITY: identity must come from verified auth only.
  // A raw ?chatId= query param is never trusted — it would let anyone
  // subscribe to another user's reminder/task event stream.
  const authUser = await getAuthenticatedUser(req)
  const chatId = authUser?.chatId

  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false
      const safeEnqueue = (chunk: Uint8Array) => {
        if (isClosed) return
        try {
          controller.enqueue(chunk)
        } catch {
          isClosed = true
        }
      }

      // 1. Register with SSE manager
      addSseClient(chatId, controller, req.signal)

      // 2. Send initial connected event with retry header
      safeEnqueue(
        encoder.encode(`retry: 3000\nevent: connected\ndata: ${JSON.stringify({ status: 'connected', chatId, timestamp: Date.now() })}\n\n`)
      )

      // 3. Periodic keep-alive comments every 8 seconds
      const heartbeatInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeatInterval)
          return
        }
        safeEnqueue(encoder.encode(`: keep-alive\n\n`))
      }, 8000)

      // 4. Graceful rotation after 25 seconds to prevent serverless socket aborts
      const rotationTimeout = setTimeout(() => {
        if (!isClosed) {
          isClosed = true
          clearInterval(heartbeatInterval)
          try {
            controller.enqueue(encoder.encode(`: graceful-close\n\n`))
            controller.close()
          } catch {}
        }
      }, 25000)

      // 5. Clean up on client disconnect / request abort
      req.signal.addEventListener('abort', () => {
        isClosed = true
        clearInterval(heartbeatInterval)
        clearTimeout(rotationTimeout)
        try {
          controller.close()
        } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
