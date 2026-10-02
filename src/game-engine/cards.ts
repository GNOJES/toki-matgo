import type { Card, Category, RibbonType } from './types';
export const MONTHS = [
  '',
  '송학',
  '매조',
  '벚꽃',
  '흑싸리',
  '난초',
  '모란',
  '홍싸리',
  '공산',
  '국화',
  '단풍',
  '오동',
  '비',
];
const layouts: Category[][] = [
  [],
  ['GWANG', 'TTI', 'PI', 'PI'],
  ['YEOL', 'TTI', 'PI', 'PI'],
  ['GWANG', 'TTI', 'PI', 'PI'],
  ['YEOL', 'TTI', 'PI', 'PI'],
  ['YEOL', 'TTI', 'PI', 'PI'],
  ['YEOL', 'TTI', 'PI', 'PI'],
  ['YEOL', 'TTI', 'PI', 'PI'],
  ['GWANG', 'YEOL', 'PI', 'PI'],
  ['YEOL', 'TTI', 'PI', 'PI'],
  ['YEOL', 'TTI', 'PI', 'PI'],
  ['GWANG', 'PI', 'PI', 'PI'],
  ['GWANG', 'YEOL', 'TTI', 'PI'],
];
const labels = { GWANG: '광', YEOL: '열끗', TTI: '띠', PI: '피', BONUS: '보너스 쌍피' };
export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (let month = 1; month <= 12; month++)
    layouts[month].forEach((category, i) => {
      const specialType =
        month === 9 && i === 0
          ? 'KUKJIN'
          : month === 12 && i === 0
            ? 'RAIN'
            : (month === 11 && i === 1) || (month === 12 && i === 3)
              ? 'DOUBLE_PI'
              : null;
      const ribbonType: RibbonType =
        category !== 'TTI'
          ? 'NONE'
          : [1, 2, 3].includes(month)
            ? 'HONGDAN'
            : [6, 9, 10].includes(month)
              ? 'CHEONGDAN'
              : [4, 5, 7].includes(month)
                ? 'CHODAN'
                : 'NONE';
      cards.push({
        id: `m${month}-${i}`,
        month,
        name: `${month}월 ${MONTHS[month]} ${labels[category]}${specialType === 'DOUBLE_PI' ? ' (쌍피)' : ''}`,
        category,
        isGwang: category === 'GWANG',
        isYeol: category === 'YEOL',
        isTti: category === 'TTI',
        isPi: category === 'PI',
        piValue: category === 'PI' ? (specialType === 'DOUBLE_PI' ? 2 : 1) : 0,
        isBonus: false,
        isGodori: category === 'YEOL' && [2, 4, 8].includes(month),
        ribbonType,
        specialType,
      });
    });
  for (let i = 0; i < 2; i++)
    cards.push({
      id: `bonus-${i}`,
      month: 0,
      name: '보너스 쌍피',
      category: 'BONUS',
      isGwang: false,
      isYeol: false,
      isTti: false,
      isPi: true,
      piValue: 2,
      isBonus: true,
      isGodori: false,
      ribbonType: 'NONE',
      specialType: 'DOUBLE_PI',
    });
  return cards;
}
export const CARDS = createDeck();
export function seededRandom(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x += 0x6d2b79f5;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function piValue(card: Card, kukjinAsPi = false): number {
  return card.specialType === 'KUKJIN' && kukjinAsPi ? 2 : card.piValue;
}
