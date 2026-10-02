import type { Card } from '../game-engine/types';
export type FloorLayout = Map<number, { slot: number; cards: Map<string, number> }>;
// Uneven resting places, spread across the felt. Empty places are reused without reflow.
export const FLOOR_PLACES = [
  [1, 13],
  [34, 17],
  [66, 12],
  [3, 38],
  [35, 40],
  [67, 37],
  [0, 63],
  [33, 66],
  [66, 62],
  [2, 87],
  [35, 89],
  [67, 86],
  [34, 53],
];
const order = [4, 0, 8, 2, 6, 10, 1, 9, 3, 11, 5, 7, 12];
export function syncFloorLayout(previous: FloorLayout, cards: Card[]): FloorLayout {
  const result: FloorLayout = new Map();
  const months = new Set(cards.map((c) => c.month));
  for (const [month, place] of previous) {
    if (!months.has(month)) continue;
    const present = cards.filter((c) => c.month === month);
    result.set(month, {
      slot: place.slot,
      cards: new Map([...place.cards].filter(([id]) => present.some((c) => c.id === id))),
    });
  }
  for (const card of cards) {
    let place = result.get(card.month);
    if (!place) {
      const occupied = new Set([...result.values()].map((p) => p.slot));
      place = { slot: order.find((slot) => !occupied.has(slot)) ?? 12, cards: new Map() };
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
