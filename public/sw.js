const CACHE = 'winter-arc-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.svg', '/icons/icon-512.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/') || url.pathname.startsWith('/storage/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) void caches.open(CACHE).then(cache => cache.put('/index.html', response.clone()));
      return response;
    }).catch(async () => (await caches.match('/index.html')) || Response.error()));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) void caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }

  if (APP_SHELL.includes(url.pathname)) event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
