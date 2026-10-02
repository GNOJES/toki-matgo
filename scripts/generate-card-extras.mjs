import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('public/cards', { recursive: true });
const ink = '#191c19',
  green = '#234f36',
  red = '#cb302c',
  blue = '#204a94',
  paper = '#fff9e9';
const path = (d, fill = ink, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const flower = (x, y, r, color = red) =>
  `<g transform="translate(${x} ${y})">${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="0" cy="-${r * 0.65}" rx="${r * 0.48}" ry="${r * 0.65}" fill="${color}" stroke="${ink}" stroke-width=".7" transform="rotate(${a})"/>`).join('')}<circle r="${r * 0.24}" fill="#ead78d"/></g>`;
// Original project artwork: flat red rims, white paper and bold black botanical
// silhouettes match the traditional deck without borrowing its licensed paths.
const blossom = (x, y, r) =>
  `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cy="-${r * 0.52}" rx="${r * 0.44}" ry="${r * 0.6}" fill="#fff" stroke="#111" stroke-width="1.2" transform="rotate(${a})"/>`).join('')}<circle r="${r * 0.2}" fill="#ed1c24"/></g>`;
for (let i = 0; i < 2; i++) {
  const motif =
    i === 0
      ? `<path d="M5 96L17 78L11 58L15 45L20 58L20 72L31 62L41 64L27 72L24 90L38 98Z" fill="#111"/>${blossom(15, 60, 7)}${blossom(28, 78, 6)}${blossom(10, 85, 5)}<path d="M40 13L55 5L59 9L44 20Z" fill="#111"/>${blossom(49, 14, 7)}`
      : `<path d="M8 98L12 61L14 61L12 98ZM20 98L22 74L24 74L24 98ZM48 5L46 31L48 31L52 5Z" fill="#111"/><g fill="#008542" stroke="#111" stroke-width=".7"><path d="M13 68Q2 56 5 51Q14 57 13 68ZM14 75Q30 61 33 64Q27 75 14 75ZM12 86Q2 74 4 70Q12 74 12 86ZM24 88Q37 75 41 78Q34 87 24 88ZM49 13Q33 10 31 5Q43 3 49 13ZM48 22Q58 15 60 9Q62 20 48 22Z"/></g>`;
  writeFileSync(
    `public/cards/bonus-${i}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="417" viewBox="0 0 64 100"><rect width="64" height="100" rx="2" fill="#ed1c24"/><rect x="3" y="3" width="58" height="94" fill="#fff"/>${motif}<path d="M4 29H60M4 74H60" stroke="#111" stroke-width="1.2"/><rect x="12" y="29" width="40" height="45" fill="#fff"/><text x="32" y="51" text-anchor="middle" font-family="serif" font-weight="900" font-size="23" fill="#111">쌍</text><text x="32" y="72" text-anchor="middle" font-family="serif" font-weight="900" font-size="23" fill="#111">피</text><rect x="46" y="80" width="11" height="13" fill="#ed1c24"/><text x="51.5" y="90" text-anchor="middle" font-family="serif" font-weight="bold" font-size="10" fill="#fff">二</text></svg>`,
  );
}
writeFileSync(
  'public/cards/back.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="100" viewBox="0 0 64 100"><defs><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 4L4 0L8 4L4 8Z" fill="none" stroke="#e75140" stroke-width=".8"/></pattern></defs><rect width="64" height="100" rx="4" fill="#2a211c"/><rect x="2" y="2" width="60" height="96" rx="2" fill="#a92324"/><rect x="5" y="5" width="54" height="90" rx="1" fill="url(#p)"/><rect x="9" y="9" width="46" height="82" rx="1" fill="none" stroke="#ec795c"/><path d="M20 50L32 34L44 50L32 66Z" fill="#a92324" stroke="#ec795c"/><path d="M27 50l5 -7l5 7l-5 7Z" fill="#ec795c"/></svg>`,
);
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="42" fill="#254d3e"/><rect x="53" y="28" width="86" height="136" rx="10" fill="#f4eedb" transform="rotate(-12 96 96)"/><circle cx="96" cy="84" r="30" fill="#c83b32"/><path d="M61 143L90 101L105 133L121 113L143 151" fill="#254d3e"/><text x="100" y="99" text-anchor="middle" font-size="42" font-family="serif" fill="#f4eedb">光</text></svg>`,
);
console.log('Original bonus cards, back and app icon generated');
