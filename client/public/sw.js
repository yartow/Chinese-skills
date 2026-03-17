// Cache version — increment this to force all clients to drop old caches
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `hanzi-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `hanzi-dynamic-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete every cache that doesn't match the current version
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

  // API calls — always network-first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // HTML navigation requests (e.g. "/", "/browse", "/test") — always network-first
  // so the browser always gets the latest HTML with up-to-date script/style references.
  // This is the key fix: without this, an old cached HTML will reference old JS bundles.
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Vite-hashed JS/CSS/font assets — safe to cache forever because their
  // filenames change whenever their content changes (content-addressed).
  // Anything matching /assets/* is a Vite-built hashed asset.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else (manifest, icons, sw itself) — network-first
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

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
