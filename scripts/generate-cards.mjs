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
const leaf = (x, y, a = 0, fill = green) =>
  `<g transform="translate(${x} ${y}) rotate(${a})">${path('M0 0 Q-13 -12 0 -28 Q13 -12 0 0', fill)}<path d="M0 0V-25" stroke="${ink}" stroke-width="1"/></g>`;
const bird = (x, y, a = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${a})">${path('M-16 3 Q-26 -14 -5 -9 Q8 -16 15 -9 L25 -5 15 -3 Q10 12 -8 8Z', paper)}${path('M-10 3Q-17 -8 -3 -6L5 3Z', ink)}<circle cx="14" cy="-7" r="1.5" fill="${ink}"/><path d="M-3 8L-8 14M3 8L2 13" stroke="${red}" stroke-width="1.5"/></g>`;
const crane = `<g>${path('M20 62Q29 54 41 56Q48 48 40 39Q33 28 38 17Q43 12 49 17L47 20Q43 18 42 22Q40 27 47 37Q62 53 48 62Q38 72 20 62Z', paper)}${path('M20 62L8 66L16 49L25 54L35 60Z', ink)}<path d="M36 65L30 88M41 65L40 90M43 18L57 19" stroke="${ink}" stroke-width="2"/><circle cx="43" cy="15" r="3" fill="${red}"/></g>`;
function motif(m, v) {
  let x = '';
  if (m === 1) {
    x += path('M-4 102L17 76L14 37L21 32L26 80L47 100Z', '#65432c');
    for (const [a, b, r] of [
      [18, 82, 18],
      [14, 62, 17],
      [26, 39, 17],
      [42, 82, 19],
    ]) {
      x += `<g transform="translate(${a} ${b})">${path(`M-${r} 0Q-${r + 3} -11 -3 -9Q0 -24 9 -13Q${r + 5} -16 ${r} 0Z`, green)}${[-12, -6, 0, 6, 12].map((k) => `<path d="M${k} -2l${k * 0.2} -7" stroke="${ink}"/>`).join('')}</g>`;
    }
  }
  if (m === 2 || m === 3) {
    x += path('M-3 91L16 67L24 42L53 15L56 19L32 50L22 81L10 102Z', ink);
    x += path('M20 62L1 44L4 41L26 53Z', ink);
    for (const [i, j, r] of [
      [10, 48, 10],
      [28, 62, 10],
      [47, 22, 11],
      [17, 86, 10],
      [42, 46, 9],
    ])
      x += flower(i + (v === 3 ? 5 : 0), j, r, m === 2 ? red : '#efb7ba');
    if (m === 3) x += flower(8, 14, 9, '#efb7ba');
  }
  if (m === 4 || m === 7) {
    x += path('M8 0Q26 35 19 100H25Q38 42 16 0Z', ink);
    for (let i = 0; i < 6; i++) {
      x += leaf(21 + (i % 2) * 11, 20 + i * 13, -50 + (i % 2) * 95);
      x += flower(44 - (i % 2) * 12, 20 + i * 13, 6, m === 4 ? '#6954a0' : red);
    }
  }
  if (m === 5) {
    x += path('M0 99Q19 43 24 35L18 96Q33 62 49 37L37 100Z', green);
    x += `<path d="M0 86Q15 77 31 86T65 86M-4 95Q12 87 27 94T69 94" fill="none" stroke="${blue}" stroke-width="2"/>`;
    x += flower(28, 49, 11, '#7460a1');
    x += flower(46, 65, 9, '#7460a1');
  }
  if (m === 6) {
    for (const [i, j, a] of [
      [15, 98, -30],
      [41, 97, 35],
      [28, 87, 0],
      [48, 68, 60],
    ])
      x += leaf(i, j, a);
    x += flower(19, 53, 17);
    x += flower(44, 73, 15);
    x += flower(42, 28, 10);
  }
  if (m === 8) {
    x += path('M0 101V79L13 55L27 76L39 61L64 82V101Z', ink);
    x += path('M0 100V91L15 71L32 100M36 101L48 79L64 98', green);
    x += `<path d="M3 88l6 -18M10 88l1 -10M41 98l-6 -18M49 93l6 -20" stroke="${paper}" stroke-width="1"/>`;
  }
  if (m === 9) {
    x += path('M8 101L19 52M41 101L43 36', green, 'stroke="' + green + '" stroke-width="3"');
    for (const [a, b, r] of [
      [17, 57, 14],
      [43, 39, 13],
      [44, 81, 13],
    ]) {
      x += `<g transform="translate(${a} ${b})">${Array.from({ length: 16 }, (_, i) => `<ellipse cy="-${r * 0.5}" rx="2" ry="${r * 0.7}" transform="rotate(${i * 22.5})" fill="#e5b940" stroke="${ink}" stroke-width=".5"/>`).join('')}<circle r="3" fill="${red}"/></g>`;
    }
    x += leaf(24, 95, 40);
  }
  if (m === 10) {
    x += path('M7 104L20 63L39 29L44 29L30 67L25 103Z', ink);
    for (const [i, j, a] of [
      [14, 70, 0],
      [41, 40, 30],
      [50, 80, -20],
      [9, 35, 15],
    ])
      x += `<g transform="translate(${i} ${j}) rotate(${a})">${path('M0 12L-5 3L-17 1L-10 -5L-13 -15L-4 -11L0 -24L5 -10L16 -15L12 -5L21 1L7 5Z', red)}<path d="M0 12V-18M0 0L-10 -8M0 0L12 -8" stroke="${ink}" stroke-width=".8"/></g>`;
  }
  if (m === 11) {
    x += path('M0 103L12 75L20 25L27 23L29 85L52 103Z', ink);
    for (const [i, j, a] of [
      [18, 47, -25],
      [28, 75, 40],
      [43, 92, 50],
      [7, 93, -35],
    ])
      x += leaf(i, j, a, green);
    x += flower(44, 53, 9, '#735b91');
    x += flower(40, 18, 9, '#735b91');
  }
  if (m === 12) {
    x += path('M0 0H8L34 102H28Z', ink);
    for (let i = 0; i < 5; i++)
      x += `<path d="M${12 + i * 8} 8Q${-3 + i * 8} 38 ${16 + i * 8} 65" fill="none" stroke="${green}" stroke-width="3"/>`;
    x += path('M0 100L19 85L33 96L64 76V100Z', ink);
    x += `<path d="M7 72l-2 8M27 62l-2 8M55 52l-2 8" stroke="${blue}" stroke-width="1.5"/>`;
  }
  return x;
}
const special = [
  'GWANG',
  'YEOL',
  'GWANG',
  'YEOL',
  'YEOL',
  'YEOL',
  'YEOL',
  'GWANG',
  'YEOL',
  'YEOL',
  'GWANG',
  'GWANG',
];
for (let m = 1; m <= 12; m++)
  for (let v = 0; v < 4; v++) {
    let category =
      v === 0
        ? special[m - 1]
        : v === 1
          ? m === 8
            ? 'YEOL'
            : m === 11
              ? 'PI'
              : m === 12
                ? 'YEOL'
                : 'TTI'
          : m === 12 && v === 2
            ? 'TTI'
            : 'PI';
    let detail = '';
    if (category === 'TTI') {
      const color = [6, 9, 10].includes(m) ? blue : red;
      detail += path(
        'M16 3L38 6L47 68L24 74L28 65Z',
        color,
        'stroke="' + ink + '" stroke-width="1"',
      );
      if ([1, 2, 3].includes(m))
        detail += `<text x="30" y="26" fill="${paper}" font-size="10" font-family="serif" writing-mode="vertical-rl">홍단</text>`;
      if ([6, 9, 10].includes(m))
        detail += `<text x="31" y="27" fill="${paper}" font-size="10" font-family="serif" writing-mode="vertical-rl">청단</text>`;
    }
    if (category === 'GWANG') {
      if (m === 1) detail += crane;
      if (m === 3)
        detail +=
          path('M-2 48H66V72H-2Z', red) +
          `<path d="M1 48V71M13 48V71M25 48V71M37 48V71M49 48V71M61 48V71" stroke="${ink}" stroke-width="2"/><path d="M-2 50H66" stroke="#ebd9b0" stroke-width="5"/>`;
      if (m === 8) detail += `<circle cx="36" cy="27" r="20" fill="${red}"/>`;
      if (m === 11)
        detail +=
          path(
            'M5 21Q21 6 31 21Q48 1 61 21L44 28L48 38L34 35L31 57L26 40L13 53L19 31Z',
            '#d2a645',
          ) +
          `<path d="M9 23l17 4L33 20L54 23M31 24V45" fill="none" stroke="${ink}" stroke-width="2"/>`;
      if (m === 12)
        detail +=
          path('M31 46L46 41L53 88H29Z', blue) +
          `<circle cx="40" cy="37" r="7" fill="${paper}"/>` +
          path('M18 29Q34 5 57 29Z', red) +
          `<path d="M38 28v55" stroke="${ink}" stroke-width="2"/>`;
      detail += `<circle cx="52" cy="88" r="10" fill="${paper}" stroke="${red}" stroke-width="1.5"/><text x="52" y="94" text-anchor="middle" font-size="17" font-weight="bold" fill="${red}" font-family="serif">光</text>`;
    }
    if (category === 'YEOL') {
      if ([2, 4].includes(m)) detail += bird(37, 35, m === 4 ? -15 : 0);
      if (m === 8) detail += bird(20, 23, -5) + bird(43, 41, 15) + bird(20, 53, 5);
      if (m === 5)
        detail += path(
          'M-4 65Q30 43 68 65V73Q30 51 -4 74Z',
          '#a47745',
          'stroke="' + ink + '" stroke-width="1"',
        );
      if (m === 6)
        detail +=
          path('M20 28Q6 7 28 13Q37 4 40 16Q53 13 44 28L33 36Z', '#eee1bb') +
          `<path d="M31 17V36" stroke="${ink}" stroke-width="2"/>`;
      if (m === 7)
        detail +=
          path(
            'M11 61Q14 41 43 45L54 40L59 46L52 51L51 60L43 63L40 76L35 76L35 64L21 64L20 78H15L16 63Z',
            '#665038',
          ) + `<circle cx="52" cy="46" r="1.5"/>`;
      if (m === 9)
        detail +=
          path('M11 32H48L43 54Q30 64 18 54Z', red, 'stroke="' + ink + '" stroke-width="1.5"') +
          `<ellipse cx="29" cy="32" rx="18" ry="5" fill="${paper}" stroke="${ink}"/><text x="29" y="50" text-anchor="middle" fill="${paper}" font-family="serif" font-size="14">壽</text>`;
      if (m === 10)
        detail +=
          path(
            'M10 65Q13 49 35 52L43 39L49 38L56 45L48 50L43 66L36 66L34 83H29L28 67H19L18 84H13Z',
            '#be9b61',
          ) + `<path d="M47 41L43 23M45 29L36 26M45 32L52 24" stroke="${ink}" stroke-width="2"/>`;
      if (m === 12) detail += bird(43, 72, -10);
    }
    if (category === 'PI' && ((m === 11 && v === 1) || (m === 12 && v === 3)))
      detail += `<path d="M0 83H64V100H0" fill="${red}"/><text x="32" y="95" text-anchor="middle" fill="${paper}" font-size="10" font-family="serif">쌍 피</text>`;
    // Use variation in botanical framing for distinct pi identities.
    const art = motif(m, v);
    const content = `<g clip-path="url(#edge)">${v === 3 ? `<g transform="translate(64 0) scale(-1 1)">${art}</g>` : art}${detail}</g>`;
    writeFileSync(
      `public/cards/m${m}-${v}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="100" viewBox="0 0 64 100"><defs><clipPath id="edge"><rect x="2" y="2" width="60" height="96" rx="2"/></clipPath></defs><rect width="64" height="100" rx="4" fill="${ink}"/><rect x="2" y="2" width="60" height="96" rx="2" fill="${paper}"/>${content}<rect x="3" y="3" width="13" height="13" rx="2" fill="${paper}" opacity=".92"/><text x="9.5" y="13" text-anchor="middle" font-size="9" font-weight="bold" fill="${ink}" font-family="sans-serif">${m}</text></svg>`,
    );
  }
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
console.log('51 original SVG card assets + icon generated');
