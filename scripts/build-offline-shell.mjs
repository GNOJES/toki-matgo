import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir = process.argv[2] ?? '.next-prod';
// Next 16 adapters (including Vercel) put prerenders in the source-route cache.
const homeSource = createHash('sha256').update('/page').digest('hex');
let html;
try {
  html = await readFile(`${dir}/server/app/index.html`, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  html = await readFile(`${dir}/server/route-cache/APP_PAGE/${homeSource}/$/index.html`, 'utf8');
}
const files = (await readdir(`${dir}/static`, { recursive: true }))
  .filter((p) => /\.(js|css|woff2?)$/.test(p))
  .sort();
// Vercel may snapshot existing public files during Next's adapter build.
// Freeze the worker identity in prebuild and reuse it, never rewrite sw.js here.
const worker = await readFile('public/sw.js', 'utf8');
const version = worker.match(/^const BUILD = '([^']+)';/m)?.[1];
if (!version) throw Error('Run the asset prebuild before generating the offline shell');
await writeFile('public/offline-shell.html', html);
await writeFile(
  'public/app-shell.json',
  JSON.stringify({
    version,
    htmlHash: createHash('sha256').update(html).digest('hex'),
    shell: '/offline-shell.html',
    assets: files.map((p) => `/_next/static/${p}`),
  }),
);
console.log(`Offline shell ${version}: ${files.length} assets`);
