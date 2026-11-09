/* Comeback OS service worker
 * - App shell (index.html) : network-first, falls back to cache → app opens offline / while the server wakes up
 * - /assets/* (hashed)     : cache-first, kept forever (filenames change on every build)
 * - Google Fonts           : stale-while-revalidate
 * - /api/*                 : never cached (personal data, always fresh)
 */
const VERSION = 'cbos-v1';
const SHELL = ['/', '/manifest.webmanifest', '/theme-init.js', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return; // network only

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('/', copy)); return res; })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});

// Lets the page show a system notification via the SW (works better on Android than `new Notification`).
self.addEventListener('message', (e) => {
  if (e.data?.type === 'notify') {
    self.registration.showNotification(e.data.title, { body: e.data.body, tag: e.data.tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: e.data.url || '/' } });
  }
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => {
    const c = cs.find((x) => 'focus' in x);
    if (c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
