import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Marcus Richert / Louie Mantia, Jr., CC BY-SA 4.0. See docs/ASSETS.md.
// Keep the original paths, colors and proportions; only crop, flatten white and encode.
const sourcePath = 'assets/hwatu/hwatu-source.svg';
const source = await readFile(sourcePath, 'utf8');
const centersX = [
  51.6, 160.15, 269.35, 377.9, 498.8, 607.35, 716.55, 825.1, 947.3, 1055.85, 1165.05, 1273.6,
];
const centersY = [84.1, 270.4, 457.85, 647.6];
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const width = 103.2;
const height = 168.2;
const mapping = [];
await mkdir('public/cards', { recursive: true });
for (let month = 1; month <= 12; month++) {
  // The master sheet uses Japanese month order: willow before paulownia.
  const sheetMonth = month === 11 ? 12 : month === 12 ? 11 : month;
  const row = Math.floor((sheetMonth - 1) / 3);
  const group = ((sheetMonth - 1) % 3) * 4;
  // Most sheet groups are special/pi/ribbon/pi. August has animal in slot 2.
  // November's red lower panel (Kasu_2) is the double pi; December is unchanged.
  const slots = month === 12 ? [0, 1, 2, 3] : [0, 2, 1, 3];
  const originals =
    month === 11
      ? ['Hikari', 'Kasu_2', 'Kasu_1', 'Kasu_3']
      : month === 12
        ? ['Hikari', 'Tane', 'Tanzaku', 'Kasu']
        : month === 8
          ? ['Hikari', 'Tane', 'Kasu_1', 'Kasu_2']
          : [[1, 3].includes(month) ? 'Hikari' : 'Tane', 'Tanzaku', 'Kasu_1', 'Kasu_2'];
  for (let variant = 0; variant < 4; variant++) {
    const id = `m${month}-${variant}`;
    const x = centersX[group + slots[variant]] - width / 2;
    const y = centersY[row] - height / 2;
    const viewBox = `${x} ${y} ${width} ${height}`;
    const cropped = source.replace(
      /<svg\b[^>]*>/,
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="256" height="417" viewBox="${viewBox}">`,
    );
    await sharp(Buffer.from(cropped))
      .flatten({ background: '#ffffff' })
      .webp({ lossless: true, effort: 6 })
      .toFile(`public/cards/${id}.webp`);
    // Remove superseded artwork so it cannot silently come back in the app.
    await unlink(`public/cards/${id}.svg`).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    mapping.push({
      id,
      original: `Hwatu_${monthNames[month - 1]}_${originals[variant]}.png`,
      sheetMonth,
      viewBox,
    });
  }
}
await writeFile(
  'assets/hwatu/mapping.json',
  JSON.stringify(
    {
      source: 'https://www.marcusrichert.com/images/hwatu/hwatu.svg',
      sourceSha256: createHash('sha256').update(source).digest('hex'),
      authors: ['Marcus Richert', 'Louie Mantia, Jr.'],
      license: 'CC-BY-SA-4.0',
      changes:
        'SVG DOM serialization; per-card crop; opaque white background; lossless 256×417 WebP conversion.',
      cards: mapping,
    },
    null,
    2,
  ) + '\n',
);
await import('./generate-card-extras.mjs');
console.log('48 original Hwatu cards exported as lossless WebP');
