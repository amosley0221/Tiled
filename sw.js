// sw.js — Tiled service worker
// Required for push notifications on installed PWAs (Android Chrome
// and iOS 16.4+ home-screen apps). Keeps no offline cache for now —
// the only job is handling push payloads and click activation.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: (event.data && event.data.text()) || 'Tiled' };
  }
  const title = data.title || 'Tiled';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/favicon-96.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/' },
    vibrate: data.vibrate || [60, 30, 60],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) {
        try { await client.focus(); } catch (_) {}
        if ('navigate' in client) { try { await client.navigate(url); } catch (_) {} }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
