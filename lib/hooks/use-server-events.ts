'use client'

import { useEffect, useRef } from 'react'

export interface ServerEvent {
  type: string
  payload?: any
  timestamp?: number
}

/**
 * useServerEvents: Connects to /api/events via SSE when user is logged in.
 * Replaces high-frequency polling with event-driven push notifications.
 */
export function useServerEvents(onEvent?: (event: ServerEvent) => void) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (typeof window === 'undefined') return

    const chatId = localStorage.getItem('zerf_chat_id')
    const token = localStorage.getItem('zerf_auth_token')

    if (!chatId && !token) return

    // Do not connect if tab is hidden (visibilitychange optimization)
    let isTabVisible = document.visibilityState === 'visible'

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      if (!isTabVisible) return

      try {
        const url = `/api/events?chatId=${encodeURIComponent(chatId || '')}`
        const es = new EventSource(url)

        es.addEventListener('connected', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            onEventRef.current?.({ type: 'connected', payload: data })
          } catch {}
        })

        es.addEventListener('task_update', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            onEventRef.current?.({ type: 'task_update', payload: data })
            window.dispatchEvent(new CustomEvent('zerf_sync'))
          } catch {}
        })

        es.addEventListener('reminder', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data)
            onEventRef.current?.({ type: 'reminder', payload: data })
          } catch {}
        })

        es.onerror = () => {
          // EventSource automatically retries on error
        }

        eventSourceRef.current = es
      } catch (err) {
        console.warn('SSE connection error:', err)
      }
    }

    connectSSE()

    const handleVisibilityChange = () => {
      isTabVisible = document.visibilityState === 'visible'
      if (isTabVisible) {
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          connectSSE()
        }
      } else {
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])
}
