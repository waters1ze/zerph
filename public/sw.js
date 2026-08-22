const CACHE_NAME = 'zerf-note-v3'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim())
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
    vibrate: [150, 80, 150],
    data: {
      url: targetUrl,
      timestamp: Date.now(),
    },
    // Same-tag notifications REPLACE each other (no stacks of duplicates);
    // banners auto-dismiss instead of demanding a click (requireInteraction).
    tag: payload.tag || `zerf-push-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Открыть Zerf' }
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
