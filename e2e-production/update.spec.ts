import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';

test('an open game adopts updated card assets without reload and keeps offline play', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    let seed = 12345;
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      value: (array: ArrayBufferView) => {
        if (!(array instanceof Uint32Array)) return original(array);
        for (let i = 0; i < array.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          array[i] = seed;
        }
        return array;
      },
    });
  });
  let deployed = false;
  const original = JSON.parse(await readFile('public/card-assets.json', 'utf8'));
  const cards = Object.fromEntries(
    Object.entries(original.cards).map(([id, value]) => [
      id,
      String(value).replace(/\?v=.*/, '?v=feed12345678'),
    ]),
  );
  const latestWorker = (await readFile('public/sw.js', 'utf8')).replace(
    /const CACHE = .*;/,
    "const CACHE = 'toki-v9-auto-assets-upgrade-test';",
  );
  const legacyWorker = `const CACHE='toki-legacy-test';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/cards/bonus-0.svg']))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(new URL(e.request.url).origin!==self.location.origin||e.request.method!=='GET')return;
e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(e.request);if(hit)return hit;const res=await fetch(e.request);if(res.ok)await c.put(e.request,res.clone());return res;}));});
self.addEventListener('message',e=>{if(e.data?.type==='CACHE_APP')e.waitUntil(caches.open(CACHE).then(c=>c.addAll(e.data.urls)));});`;
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, 'http://localhost').pathname;
      if (path === '/sw.js') {
        res.writeHead(200, {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'no-store',
        });
        res.end(deployed ? latestWorker : legacyWorker);
        return;
      }
      if (deployed && path === '/card-assets.json') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ version: 'upgrade-test', cards }));
        return;
      }
      if (!deployed && path === '/cards/bonus-0.svg') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="100"><text y="30">OLD CARD</text></svg>',
        );
        return;
      }
      const response = await fetch(`http://127.0.0.1:3003${req.url}`);
      const headers = Object.fromEntries(response.headers.entries());
      delete headers['content-encoding'];
      delete headers['content-length'];
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await page.goto(origin);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    expect(await page.evaluate(async () => (await fetch('/cards/bonus-0.svg')).text())).toContain(
      'OLD CARD',
    );
    await page.evaluate(async () => {
      await (await caches.open('another-app')).put('/marker', new Response('keep'));
    });
    await page.getByRole('button', { name: /혼자 치기/ }).click();
    await expect(page.getByRole('dialog', { name: '이번 판의 선' })).toBeVisible();
    const version = await page.getByTestId('game-table').getAttribute('data-version');
    let navigations = 0;
    page.on('framenavigated', () => navigations++);
    deployed = true;
    // Exercise the app's reconnect update check rather than manually activating the worker.
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect
      .poll(() =>
        page.evaluate(async () =>
          (await caches.keys()).includes('toki-v9-auto-assets-upgrade-test'),
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page
          .locator('.hand-card img')
          .evaluateAll(
            (imgs) =>
              imgs.length === 10 &&
              imgs.every(
                (img) =>
                  (img as HTMLImageElement).src.includes('v=feed12345678') &&
                  (img as HTMLImageElement).complete &&
                  (img as HTMLImageElement).naturalWidth > 0,
              ),
          ),
      )
      .toBe(true);
    expect(navigations).toBe(0);
    await expect(page.getByTestId('game-table')).toHaveAttribute('data-version', version!);
    await expect(page.getByRole('dialog', { name: '이번 판의 선' })).toBeVisible();
    const bonus = await page.evaluate(async () => (await fetch('/cards/bonus-0.svg')).text());
    expect(bonus).not.toContain('OLD CARD');
    expect(bonus).not.toContain('쌍피');
    const names = await page.evaluate(() => caches.keys());
    expect(names).toContain('toki-v9-auto-assets-upgrade-test');
    expect(names).toContain('another-app');
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('button', { name: /혼자 치기/ })).toBeVisible();
    await page.getByRole('button', { name: /혼자 치기/ }).click();
    await page.getByRole('button', { name: '게임 시작', exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator('.hand-card img')
          .evaluateAll(
            (imgs) =>
              imgs.length === 10 &&
              imgs.every(
                (img) =>
                  (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
              ),
          ),
      )
      .toBe(true);
  } finally {
    await context.setOffline(false);
    await page.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
