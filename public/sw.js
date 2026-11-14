self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data ? event.data.json() : {}
    } catch {
      return { title: 'Heliotrope', body: event.data ? event.data.text() : '' }
    }
  })()
  const title = data.title || '⏰ Alarm'
  const options = {
    body: data.body || '',
    tag: data.tag || 'heliotrope-alarm',
    renotify: true,
    requireInteraction: true,
    vibrate: [400, 200, 400, 200, 400, 200, 400],
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/', kind: data.kind || 'alarm' },
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options)
      // if the app is open, let it ring out loud too
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      clients.forEach((client) =>
        client.postMessage({ type: 'alarm', title: data.title, body: options.body, kind: options.data.kind, sound: data.sound }),
      )
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (clients.length > 0) return clients[0].focus()
      return self.clients.openWindow('/')
    })(),
  )
})