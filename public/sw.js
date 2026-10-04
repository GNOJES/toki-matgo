const CACHE = 'toki-v10-assets-9e079ca12aa0';
const BUILD = 'e65c8b31b2be2572';
const CURRENT = `${CACHE}-${BUILD}`;
const STATIC = ['/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];
const clientCaches = new Map();
let manifest;
const owned = (name) => name.startsWith('toki-');
async function cardManifest() {
  if (!manifest)
    manifest = await (await (await caches.open(CURRENT)).match('/card-assets.json')).json();
  return manifest;
}
async function prune() {
  const clients = await self.clients.matchAll({ type: 'window' });
  // Existing tabs report their assets on controllerchange. Never discard an unreported tab's build.
  if (clients.some((client) => !clientCaches.has(client.id))) return;
  const names = (await caches.keys()).filter(owned);
  const previous = names.filter((name) => name !== CURRENT).at(-1);
  const keep = new Set([
    CURRENT,
    previous,
    ...clients.flatMap((client) => clientCaches.get(client.id) ?? []),
  ]);
  await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
}
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shellResponse = await fetch('/app-shell.json', { cache: 'reload' });
      const cardResponse = await fetch('/card-assets.json', { cache: 'reload' });
      if (!shellResponse.ok || !cardResponse.ok) throw Error('Offline manifests unavailable');
      const shell = await shellResponse.json();
      if (shell.version !== BUILD) throw Error('Deployment changed during installation');
      const html = await fetch(shell.shell, { cache: 'reload' });
      if (!html.ok) throw Error('Offline shell unavailable');
      const digest = await crypto.subtle.digest('SHA-256', await html.clone().arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
        '',
      );
      if (hash !== shell.htmlHash) throw Error('Deployment shell changed during installation');
      manifest = await cardResponse.clone().json();
      const cache = await caches.open(CURRENT);
      // Activation is allowed only after the exact HTML AND every build asset are cached.
      await cache.addAll(
        [...STATIC, ...shell.assets, ...Object.values(manifest.cards)].map(
          (url) => new Request(url, { cache: 'reload' }),
        ),
      );
      await cache.put('/', html);
      await cache.put('/card-assets.json', cardResponse);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const { cards } = await cardManifest();
      for (const client of await self.clients.matchAll({ type: 'window' }))
        client.postMessage({ type: 'CARD_ASSETS', cards });
      await prune();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    request.headers.has('RSC')
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return (await (await caches.open(CURRENT)).match('/')) ?? Response.error();
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
      const cache = await caches.open(CURRENT);
      const matchOptions = { ignoreSearch: url.pathname.startsWith('/_next/static/') };
      const cached = await cache.match(request, matchOptions);
      if (cached && (!isCard || url.searchParams.has('v'))) return cached;
      if (!isCard)
        for (const name of (await caches.keys()).filter(owned)) {
          const prior = await (await caches.open(name)).match(request, matchOptions);
          if (prior) return prior;
        }
      try {
        const response = await fetch(request, isCard ? { cache: 'reload' } : undefined);
        // Old running pages must not carry their obsolete chunks into the newest generation.
        if (response.ok && (isCard || STATIC.includes(url.pathname)))
          await cache.put(request, response.clone());
        return response;
      } catch {
        if (cached) return cached;
        if (isCard) {
          const { cards } = await cardManifest();
          const path = Object.values(cards).find(
            (path) => new URL(path, self.location.origin).pathname === url.pathname,
          );
          if (path) return (await cache.match(path)) ?? Response.error();
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
  event.waitUntil(
    (async () => {
      const urls = event.data.urls
        .filter((value) => typeof value === 'string' && value.length < 2048)
        .slice(0, 128);
      const pins = [];
      const current = await caches.open(CURRENT);
      for (const name of (await caches.keys()).filter((name) => owned(name) && name !== CURRENT)) {
        const old = await caches.open(name);
        for (const url of urls)
          if (
            !(await current.match(url, { ignoreSearch: true })) &&
            (await old.match(url, { ignoreSearch: true }))
          ) {
            pins.push(name);
            break;
          }
      }
      if (event.source?.id) clientCaches.set(event.source.id, pins);
      await prune();
    })(),
  );
});
