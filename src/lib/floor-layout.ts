import type { Card } from '../game-engine/types';
export type FloorLayout = Map<number, { slot: number; cards: Map<string, number> }>;
// Twelve fixed places around the center deck; groups never reflow after a capture.
export const FLOOR_PLACES = [
  [4, 10, -5],
  [35, 9, 4],
  [66, 10, -4],
  [1, 30, 6],
  [69, 30, -6],
  [0, 50, -3],
  [70, 50, 5],
  [1, 70, 4],
  [69, 70, -5],
  [4, 90, -4],
  [35, 91, 6],
  [66, 90, -3],
];
const order = [1, 6, 10, 5, 2, 9, 4, 7, 0, 11, 3, 8];
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
      place = { slot: order.find((slot) => !occupied.has(slot)) ?? 11, cards: new Map() };
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
