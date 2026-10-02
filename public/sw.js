const CACHE = 'toki-v7-ink-rabbit';
const CARDS = Array.from({ length: 12 }, (_, m) =>
  Array.from({ length: 4 }, (_, v) => `/cards/m${m + 1}-${v}.webp`),
).flat();
const STATIC = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/cards/back.svg',
  '/cards/bonus-0.svg',
  '/cards/bonus-1.svg',
  ...CARDS,
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request,
    url = new URL(req.url);
  if (
    req.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/api') ||
    req.headers.has('RSC')
  )
    return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  if (
    url.pathname.startsWith('/cards/') ||
    url.pathname.startsWith('/_next/static/') ||
    STATIC.includes(url.pathname)
  ) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              void caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'CACHE_APP' || !Array.isArray(e.data.urls)) return;
  const urls = [...new Set(e.data.urls)].filter((value) => {
    if (typeof value !== 'string') return false;
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
  });
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(urls)));
});
