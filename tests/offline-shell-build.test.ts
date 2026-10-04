import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
it.each(['standalone', 'adapter'])('builds the offline shell from %s output', async (layout) => {
  const root = await mkdtemp(`${tmpdir()}/toki-shell-`);
  try {
    const source = createHash('sha256').update('/page').digest('hex');
    const parent = layout === 'standalone' ? 'app' : `route-cache/APP_PAGE/${source}/$`;
    await mkdir(`${root}/.next/server/${parent}`, { recursive: true });
    await mkdir(`${root}/.next/static/chunks`, { recursive: true });
    await mkdir(`${root}/public`);
    await writeFile(`${root}/.next/server/${parent}/index.html`, '<html>home</html>');
    await writeFile(`${root}/.next/static/chunks/app.js`, 'app');
    await writeFile(`${root}/public/sw.js`, "const BUILD = 'development';");
    execFileSync(process.execPath, [resolve('scripts/build-offline-shell.mjs'), '.next'], {
      cwd: root,
    });
    expect(await readFile(`${root}/public/offline-shell.html`, 'utf8')).toBe('<html>home</html>');
    const manifest = JSON.parse(await readFile(`${root}/public/app-shell.json`, 'utf8'));
    expect(manifest.assets).toEqual(['/_next/static/chunks/app.js']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
