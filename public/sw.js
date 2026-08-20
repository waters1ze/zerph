const CACHE_NAME = 'zerf-note-v2'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)

  // Bypass SW for APIs, Next.js assets, and auth pages
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/cli-auth')
  ) {
    return
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const match = await caches.match(event.request)
      return match || new Response('Offline', { status: 503, statusText: 'Offline' })
    })
  )
})

// Push notifications support
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload = {
    title: 'Zerf Note',
    body: 'Новое напоминание о задаче',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/',
  }

  try {
    const json = event.data.json()
    payload = { ...payload, ...json }
  } catch {
    payload.body = event.data.text() || payload.body
  }

  const targetUrl = payload.url || (payload.data && payload.data.url) || '/'

  const options = {
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    vibrate: [200, 100, 200, 100, 300],
    data: {
      url: targetUrl,
      timestamp: Date.now(),
    },
    tag: payload.tag || `zerf-push-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Открыть' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Zerf Note', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl)
          }
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
