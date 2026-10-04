import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const cards = {};
for (const file of readdirSync('public/cards').sort()) {
  if (!/^(m\d+-\d\.webp|bonus-\d\.svg|back\.svg)$/.test(file)) continue;
  const hash = createHash('sha256')
    .update(readFileSync(`public/cards/${file}`))
    .digest('hex')
    .slice(0, 12);
  cards[file.replace(/\.(svg|webp)$/, '')] = `/cards/${file}?v=${hash}`;
}
const version = createHash('sha256').update(JSON.stringify(cards)).digest('hex').slice(0, 12);
writeFileSync('public/card-assets.json', JSON.stringify({ version, cards }, null, 2) + '\n');
const worker = readFileSync('public/sw.js', 'utf8').replace(
  /^const CACHE = .*;$/m,
  `const CACHE = 'toki-v10-assets-${version}';`,
);
writeFileSync('public/sw.js', worker);
console.log(`Card asset version: ${version}`);
