import { it, expect } from 'vitest';
import { CARDS } from '../src/game-engine/cards';
import { syncFloorLayout } from '../src/lib/floor-layout';
const card = (id: string) => CARDS.find((c) => c.id === id)!;
it('keeps existing month and individual card positions after captures and reuses an empty place', () => {
  const before = syncFloorLayout(new Map(), ['m1-0', 'm1-1', 'm2-0', 'm3-0'].map(card));
  const after = syncFloorLayout(before, ['m1-1', 'm3-0', 'm4-0'].map(card));
  expect(after.get(1)?.slot).toBe(before.get(1)?.slot);
  expect(after.get(1)?.cards.get('m1-1')).toBe(before.get(1)?.cards.get('m1-1'));
  expect(after.get(3)?.slot).toBe(before.get(3)?.slot);
  expect(after.get(4)?.slot).toBe(before.get(2)?.slot);
});

it('allocates every month once and leaves attached bonuses inside their month group', () => {
  const layout = syncFloorLayout(new Map(), CARDS);
  expect(layout.size).toBe(12);
  expect(new Set([...layout.values()].map((p) => p.slot)).size).toBe(12);
  expect(layout.has(0)).toBe(false);
});
