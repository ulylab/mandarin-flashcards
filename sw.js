// Offline support for GitHub Pages. Updating this file causes the cache to refresh.
const CACHE = 'mandarin-flashcards-static-v3';
const CORE = ['./', 'index.html', 'css/styles.css', 'js/app.js',
  'js/storage.js', 'js/scheduler.js', 'data/manifest.json', 'manifest.webmanifest'];

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE);
  try {
    const response = await cache.match('data/manifest.json');
    const manifest = await response.json();
    await cache.addAll(manifest.packs.map(pack => pack.file));
  } catch (err) {
    console.warn('Vocabulary pack pre-cache incomplete; online reload may be needed', err);
  }
  await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('mandarin-flashcards-static-') && key !== CACHE)
    .map(key => caches.delete(key)));
  await self.clients.claim();
})()));

// Network-first prevents stale decks and scripts after a GitHub update, while
// allowing already downloaded cards to keep working without a connection.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const fallback = await cache.match('index.html');
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
