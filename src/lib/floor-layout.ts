import type { Card } from '../game-engine/types';
export type FloorLayout = Map<number, { slot: number; cards: Map<string, number> }>;
// Twelve fixed places around the center deck; groups never reflow after a capture.
export const FLOOR_PLACES = [
  [50, 7, -5],
  [89, 13, 6],
  [94, 50, -4],
  [89, 87, 5],
  [50, 93, -4],
  [11, 87, -6],
  [6, 50, 4],
  [11, 13, -5],
  [33, 10, 3],
  [67, 10, -3],
  [67, 90, 4],
  [33, 90, -4],
];
const order = [0, 2, 4, 6, 1, 3, 5, 7, 8, 9, 10, 11];
function footprint(slot: number, indices: number[]) {
  const [x, y] = FLOOR_PLACES[slot];
  const centers = indices.map((i) => x + i * 9.5 * (x > 50 ? -1 : 1));
  return {
    left: Math.min(...centers) - 8.3,
    right: Math.max(...centers) + 8.3,
    top: y - 18,
    bottom: y + 18,
  };
}
export function syncFloorLayout(previous: FloorLayout, cards: Card[]): FloorLayout {
  const result: FloorLayout = new Map();
  const months = new Set(cards.filter((c) => !c.isBonus).map((c) => c.month));
  for (const [month, place] of previous) {
    if (!months.has(month)) continue;
    const present = cards.filter((c) => c.month === month);
    result.set(month, {
      slot: place.slot,
      cards: new Map([...place.cards].filter(([id]) => present.some((c) => c.id === id))),
    });
  }
  for (const card of cards) {
    // A bonus attached to a ppuk rests with that month's group, never on its own.
    if (card.isBonus) continue;
    let place = result.get(card.month);
    if (!place) {
      const occupied = new Set([...result.values()].map((p) => p.slot));
      const free = order.filter((slot) => !occupied.has(slot));
      const count = cards.filter((c) => c.month === card.month && !c.isBonus).length;
      const slot =
        free.find((slot) => {
          const a = footprint(
            slot,
            Array.from({ length: count }, (_, i) => i),
          );
          return [...result.values()].every((other) => {
            const b = footprint(other.slot, [...other.cards.values()]);
            return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          });
        }) ??
        free[0] ??
        11;
      place = { slot, cards: new Map() };
      result.set(card.month, place);
    }
    if (!place.cards.has(card.id)) {
      const used = new Set(place.cards.values());
      let index = 0;
      while (used.has(index)) index++;
      place.cards.set(card.id, index);
    }
  }
  return result;
}
