import type { Card } from '../game-engine/types';
export interface FlightGeometry {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}
/** UI-only geometry: the pure engine never sees DOM positions or animation timing. */
export function cardFlight(
  cards: Card[],
  kind: 'play' | 'flip' | 'capture',
  mine: boolean,
): FlightGeometry {
  const board = document.querySelector('.floor-area')?.getBoundingClientRect();
  if (!board) return { fromX: -25, fromY: 0, toX: -25, toY: 0 };
  const card = cards[0];
  const floor = (id: string) => document.querySelector(`[data-floor-card-id="${id}"]`);
  const match = Array.from(document.querySelectorAll<HTMLElement>('[data-floor-month]')).find(
    (el) => Number(el.dataset.floorMonth) === card?.month,
  );
  const piles = document.querySelectorAll('.captured');
  const group = card?.isGwang ? 0 : card?.isYeol ? 1 : card?.isTti ? 2 : 3;
  const targetPile = piles[mine ? 1 : 0]?.querySelectorAll('.captured-group')[group];
  const hand = mine
    ? document.querySelector(`[data-card-id="${card?.id}"] .hwatu`)
    : document.querySelector('.opponent-hand .hwatu:last-of-type');
  const source =
    kind === 'play'
      ? hand
      : kind === 'flip'
        ? document.querySelector('.deck .hwatu')
        : card
          ? floor(card.id)
          : null;
  const target = kind === 'capture' ? targetPile : match;
  const convert = (el: Element | null | undefined) => {
    const r = el?.getBoundingClientRect();
    return {
      x: r ? r.left + r.width / 2 - board.left - board.width * 0.5 - 25 : -25,
      y: r ? r.top + r.height / 2 - board.top - board.height * 0.45 - 39 : 0,
    };
  };
  const from = convert(source),
    to = convert(target);
  return { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y };
}
