import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('public/cards', { recursive: true });
// Original rabbit service cards: bold numeral + mascot, inspired by the
// readable bonus-card composition in Hangame's official guide (no copied art).
for (let i = 0; i < 2; i++) {
  const accent = i === 0 ? '#d52b27' : '#204d37';
  const ears =
    i === 0
      ? '<path d="M20 32Q8 4 18 9Q28 13 27 32M33 31Q32 7 41 9Q48 16 40 34" fill="#fff8dc" stroke="#151711" stroke-width="1.8"/>'
      : '<path d="M22 32Q13 5 23 9Q31 16 29 32M36 32Q38 8 47 16Q52 24 42 35" fill="#fff8dc" stroke="#151711" stroke-width="1.8"/>';
  writeFileSync(
    `public/cards/bonus-${i}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="417" viewBox="0 0 64 100"><rect width="64" height="100" rx="2" fill="#ed1c24"/><rect x="3" y="3" width="58" height="94" fill="#fff9e5"/><path d="M4 4H60V19L32 27L4 19Z" fill="${accent}"/><path d="M8 7L15 14L8 21M56 7L49 14L56 21" fill="none" stroke="#e7b956" stroke-width="1.6"/><path d="M4 67Q32 56 60 67V96H4Z" fill="${accent}"/><path d="M5 65Q32 57 59 65" fill="none" stroke="#e7b956" stroke-width="2"/>${ears}<ellipse cx="32" cy="43" rx="20" ry="17" fill="#fff8dc" stroke="#151711" stroke-width="1.8"/><path d="M12 46Q8 40 10 35M52 46Q57 40 54 35" fill="none" stroke="#151711" stroke-width="1.3"/><ellipse cx="24" cy="41" rx="2.1" ry="3" fill="#151711"/><ellipse cx="40" cy="41" rx="2.1" ry="3" fill="#151711"/><path d="M29 45Q32 42 35 45L32 48Z" fill="#d52b27"/><path d="M26 49Q32 57 38 49M32 48V52" fill="none" stroke="#151711" stroke-width="1.4"/><ellipse cx="18" cy="47" rx="4" ry="2.7" fill="#ef8471"/><ellipse cx="46" cy="47" rx="4" ry="2.7" fill="#ef8471"/><path d="M19 57L32 61L45 57L42 66H22Z" fill="#e7b956" stroke="#151711" stroke-width="1"/><text x="32" y="92" text-anchor="middle" font-size="34" font-weight="900" font-family="Georgia,serif" fill="#fff9e5" stroke="#151711" stroke-width=".6">2</text><path d="M9 76L12 80L9 84L6 80ZM55 76L58 80L55 84L52 80Z" fill="#e7b956"/><text x="32" y="7" text-anchor="middle" font-size="6" font-weight="900" font-family="sans-serif" fill="#fff9e5">쌍피</text></svg>`,
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
