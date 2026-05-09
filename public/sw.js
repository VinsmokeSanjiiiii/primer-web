const CACHE_NAME = 'primer-v1';
const urlsToCache = ['/','/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(data.title||'Primer', {
    body: data.message||'', icon: '/logo192.png', badge: '/logo192.png'
  }));
});