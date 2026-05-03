// sw.js — Tiled service worker
// Required for push notifications on installed PWAs (Android Chrome
// and iOS 16.4+ home-screen apps). Also intercepts navigation requests
// with a network-first strategy so the PWA always picks up new HTML
// (and therefore the latest CSS/JSX cache-buster versions) after a
// deploy. Without this, iOS aggressively caches the launch HTML and
// home-screen apps get stuck on stale assets.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  let url;
  try { url = new URL(event.request.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;
  const accept = event.request.headers.get('Accept') || '';
  const isNavigation = event.request.mode === 'navigate';
  const isHTML = isNavigation || accept.includes('text/html');
  if (!isHTML) return;
  // Network-first: always try to fetch fresh HTML so PWA picks up new
  // CSS/JSX cache-buster versions immediately after a deploy.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .catch(() => new Response(
        '<!doctype html><meta charset="utf-8"><title>Tiled — offline</title>'
        + '<body style="background:#050506;color:#9aa;font-family:system-ui;'
        + 'display:flex;align-items:center;justify-content:center;height:100vh;'
        + 'margin:0;text-align:center;padding:24px">'
        + 'You\'re offline. Reconnect and reopen Tiled.</body>',
        { status: 503, headers: { 'Content-Type': 'text/html' } }
      ))
  );
});

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
