import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
it('refuses activation if a deployment changes the shell after manifest download', async () => {
  const source = await readFile('public/sw.js', 'utf8');
  const build = source.match(/const BUILD = '([^']+)'/)![1];
  const shellA = '<script src="/_next/static/a.js"></script>';
  const shellB = '<script src="/_next/static/b.js"></script>';
  const origin = 'https://test.invalid';
  const key = (x: any) => new URL(typeof x === 'string' ? x : x.url, origin).href;
  const store = new Map<string, Response>();
  const fetch = async (x: any) => {
    const path = new URL(key(x)).pathname;
    if (path === '/app-shell.json')
      return Response.json({
        version: build,
        shell: '/offline-shell.html',
        htmlHash: createHash('sha256').update(shellA).digest('hex'),
        assets: ['/_next/static/a.js'],
      });
    if (path === '/card-assets.json') return Response.json({ cards: {} });
    return new Response(path === '/offline-shell.html' ? shellB : 'asset');
  };
  let install: any,
    activated = false;
  const cache = {
    match: async (x: any) => store.get(key(x))?.clone(),
    put: async (x: any, r: Response) => {
      store.set(key(x), r.clone());
    },
    addAll: async (xs: any[]) => {
      for (const x of xs) store.set(key(x), await fetch(x));
    },
  };
  vm.runInNewContext(source, {
    URL,
    Response,
    crypto: webcrypto,
    fetch,
    caches: { open: async () => cache },
    Request: class extends Request {
      constructor(x: any, o: any) {
        super(key(x), o);
      }
    },
    self: {
      location: { origin },
      addEventListener: (name: string, fn: any) => {
        if (name === 'install') install = fn;
      },
      skipWaiting: async () => {
        activated = true;
      },
    },
  });
  let work: Promise<void>;
  install({
    waitUntil: (p: Promise<void>) => {
      work = p;
    },
  });
  await expect(work!).rejects.toThrow(/shell|deployment/i);
  expect(activated).toBe(false);
  expect(store.has(key('/'))).toBe(false);
});
