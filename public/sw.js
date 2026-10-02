const CACHE = 'toki-v9-auto-assets-9e079ca12aa0';
const STATIC = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];
let manifest;
async function cardManifest() {
  if (manifest) return manifest;
  const cache = await caches.open(CACHE);
  const response = await cache.match('/card-assets.json');
  manifest = await (response ?? (await fetch('/card-assets.json', { cache: 'reload' }))).json();
  return manifest;
}
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch('/card-assets.json', { cache: 'reload' });
      if (!response.ok) throw new Error('Card manifest unavailable');
      manifest = await response.clone().json();
      const cache = await caches.open(CACHE);
      await cache.addAll(
        [...STATIC, ...Object.values(manifest.cards)].map(
          (url) => new Request(url, { cache: 'reload' }),
        ),
      );
      await cache.put('/card-assets.json', response);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const oldNames = (await caches.keys()).filter(
        (name) => name.startsWith('toki-') && name !== CACHE,
      );
      // Preserve JS/CSS needed by a running game before replacing the worker.
      for (const name of oldNames) {
        const old = await caches.open(name);
        for (const request of await old.keys()) {
          if (!new URL(request.url).pathname.startsWith('/_next/static/')) continue;
          const response = await old.match(request);
          if (response && !(await cache.match(request))) await cache.put(request, response);
        }
        await caches.delete(name);
      }
      await self.clients.claim();
      const { cards } = await cardManifest();
      for (const client of await self.clients.matchAll({ type: 'window' }))
        client.postMessage({ type: 'CARD_ASSETS', cards });
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/api') ||
    request.headers.has('RSC')
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put('/', response.clone());
          return response;
        } catch {
          return (await cache.match('/')) ?? Response.error();
        }
      })(),
    );
    return;
  }
  const isCard = url.pathname.startsWith('/cards/');
  if (!isCard && !url.pathname.startsWith('/_next/static/') && !STATIC.includes(url.pathname))
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Content-versioned card URLs and hashed Next chunks can safely be cache-first.
      const cached = await cache.match(request);
      if (cached && (!isCard || url.searchParams.has('v'))) return cached;
      try {
        const response = await fetch(request, isCard ? { cache: 'reload' } : undefined);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        if (cached) return cached;
        if (isCard) {
          const { cards } = await cardManifest();
          const versioned = Object.values(cards).find(
            (path) => new URL(path, self.location.origin).pathname === url.pathname,
          );
          if (versioned) return (await cache.match(versioned)) ?? Response.error();
        }
        return Response.error();
      }
    })(),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_CARD_ASSETS') {
    event.waitUntil(
      cardManifest().then(({ cards }) => event.source?.postMessage({ type: 'CARD_ASSETS', cards })),
    );
    return;
  }
  if (event.data?.type !== 'CACHE_APP' || !Array.isArray(event.data.urls)) return;
  const urls = [...new Set(event.data.urls)].filter((value) => {
    if (typeof value !== 'string') return false;
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
  });
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(urls)));
});
