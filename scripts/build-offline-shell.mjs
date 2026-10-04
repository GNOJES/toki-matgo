import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir = process.argv[2] ?? '.next-prod';
const html = await readFile(`${dir}/server/app/index.html`, 'utf8');
const files = (await readdir(`${dir}/static`, { recursive: true }))
  .filter((p) => /\.(js|css|woff2?)$/.test(p))
  .sort();
const version = createHash('sha256')
  .update(html)
  .update(JSON.stringify(files))
  .digest('hex')
  .slice(0, 16);
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
const worker = (await readFile('public/sw.js', 'utf8')).replace(
  /^const BUILD = .*;$/m,
  `const BUILD = '${version}';`,
);
await writeFile('public/sw.js', worker);
console.log(`Offline shell ${version}: ${files.length} assets`);
