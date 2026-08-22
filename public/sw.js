const CACHE_NAME = 'zerf-note-v4'

// App shell precached on install so the PWA can boot with no connectivity.
const PRECACHE_URLS = ['/', '/icon-192.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        // addAll fails atomically on a single missing resource — precache
        // individually so one 404 never blocks offline boot.
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Offline app shell & static asset caching ────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Never cache API traffic — it must always hit the network (the offline
  // outbox in the app handles queued mutations).
  if (url.pathname.startsWith('/api/')) return

  // Immutable build chunks & static assets: cache-first.
  if (url.pathname.startsWith('/_next/static/') || PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy))
          }
          return res
        }).catch(() => cached)
      })
    )
    return
  }

  // Navigations (opening the app): network-first with cached shell fallback
  // so the PWA loads offline and the outbox UI stays reachable.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          }
          return res
        })
        .catch(() => caches.match('/'))
    )
  }
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
