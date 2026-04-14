// Cache version — increment this to force all clients to drop old caches
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `hanzi-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `hanzi-dynamic-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Quiz question endpoints need a fresh answer every time — keep network-first
  // so refetch() after each answer doesn't serve the same question from cache.
  if (url.pathname.startsWith('/api/quiz/')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // All other API calls (settings, progress, characters, words, saved…) use
  // stale-while-revalidate: return the cached response immediately so the UI
  // is instant on slow connections, then update the cache in the background.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    return;
  }

  // HTML navigation — always network-first so the browser gets fresh script references.
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Vite-hashed assets (/assets/*) — cache-first forever (content-addressed filenames).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Manifest, icons, etc.
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// Return cached response immediately; refresh cache in the background.
// Falls back to network-then-503 if there is no cached entry yet.
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Always kick off a background refresh
  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  // No cache yet — wait for the network
  const response = await networkFetch;
  if (response) return response;
  return new Response(JSON.stringify({ error: 'Offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const isApi = new URL(request.url).pathname.startsWith('/api/');
    return new Response(
      isApi ? JSON.stringify({ error: 'Offline' }) : 'Offline',
      {
        status: 503,
        headers: { 'Content-Type': isApi ? 'application/json' : 'text/plain' },
      }
    );
  }
}
