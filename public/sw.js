const CACHE_NAME = 'zerf-pwa-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Let browser handle API and Next.js internal calls directly
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) {
    return
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
