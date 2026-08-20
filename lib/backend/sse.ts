/**
 * Zerf Real-time Server-Sent Events (SSE) Hub
 * Manages active SSE connections and broadcasts data changes immediately to clients.
 */

type ClientEntry = {
  id: string
  chatId: string
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
}

const activeClients = new Map<string, ClientEntry>()

/**
 * Registers an active client SSE stream
 */
export function addSseClient(
  chatId: string,
  controller: ReadableStreamDefaultController,
  signal: AbortSignal
): string {
  const clientId = `sse_${chatId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const encoder = new TextEncoder()

  activeClients.set(clientId, {
    id: clientId,
    chatId: String(chatId),
    controller,
    encoder,
  })

  signal.addEventListener('abort', () => {
    activeClients.delete(clientId)
  })

  return clientId
}

/**
 * Broadcasts an event to all active connections belonging to a specific user
 */
export function broadcastToUser(chatId: string | number | bigint, event: string, data: any = {}) {
  const targetChatId = String(chatId)
  const encoder = new TextEncoder()

  for (const [clientId, client] of activeClients.entries()) {
    if (client.chatId === targetChatId) {
      try {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        client.controller.enqueue(encoder.encode(payload))
      } catch {
        activeClients.delete(clientId)
      }
    }
  }
}

/**
 * Broadcasts a change notification so frontend immediately syncs with zero polling latency
 */
export function notifyDataChanged(
  chatId: string | number | bigint | null | undefined,
  resource: 'tasks' | 'goals' | 'notes' | 'habits' | 'projects' | 'all' = 'all'
) {
  if (!chatId) return
  broadcastToUser(chatId, 'sync', { resource, timestamp: Date.now() })
}

/**
 * Broadcasts an event to all connected SSE clients (all users)
 */
export function broadcastToAll(event: string, data: any = {}) {
  const encoder = new TextEncoder()
  for (const [clientId, client] of activeClients.entries()) {
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      client.controller.enqueue(encoder.encode(payload))
    } catch {
      activeClients.delete(clientId)
    }
  }
}

/**
 * Returns number of currently connected SSE clients
 */
export function getActiveSseCount(): number {
  return activeClients.size
}
