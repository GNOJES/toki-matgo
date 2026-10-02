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
for (let i = 0; i < 2; i++)
  writeFileSync(
    `public/cards/bonus-${i}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="100" viewBox="0 0 64 100"><rect width="64" height="100" rx="4" fill="${ink}"/><rect x="3" y="3" width="58" height="94" fill="${paper}" rx="2"/><circle cx="32" cy="44" r="23" fill="${i === 0 ? red : green}"/>${flower(32, 44, 14, '#e5d8ac')}<text x="32" y="85" text-anchor="middle" font-size="16" font-weight="bold" font-family="serif" fill="${red}">쌍피</text></svg>`,
  );
writeFileSync(
  'public/cards/back.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="100" viewBox="0 0 64 100"><defs><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 4L4 0L8 4L4 8Z" fill="none" stroke="#e75140" stroke-width=".8"/></pattern></defs><rect width="64" height="100" rx="4" fill="#2a211c"/><rect x="2" y="2" width="60" height="96" rx="2" fill="#a92324"/><rect x="5" y="5" width="54" height="90" rx="1" fill="url(#p)"/><rect x="9" y="9" width="46" height="82" rx="1" fill="none" stroke="#ec795c"/><path d="M20 50L32 34L44 50L32 66Z" fill="#a92324" stroke="#ec795c"/><path d="M27 50l5 -7l5 7l-5 7Z" fill="#ec795c"/></svg>`,
);
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="42" fill="#254d3e"/><rect x="53" y="28" width="86" height="136" rx="10" fill="#f4eedb" transform="rotate(-12 96 96)"/><circle cx="96" cy="84" r="30" fill="#c83b32"/><path d="M61 143L90 101L105 133L121 113L143 151" fill="#254d3e"/><text x="100" y="99" text-anchor="middle" font-size="42" font-family="serif" fill="#f4eedb">光</text></svg>`,
);
console.log('Original bonus cards, back and app icon generated');
