import type { Card } from '../game-engine/types';
export interface FlightGeometry {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  width: number;
  height: number;
  targetId?: string;
}
/** Positions are relative to the actual board and individual card, never a month group. */
export function cardFlight(
  cards: Card[],
  kind: 'play' | 'flip' | 'capture' | 'transfer' | 'bonus' | 'bonus-capture',
  mine: boolean,
  targetId?: string,
): FlightGeometry {
  const board = document.querySelector('.floor-area')?.getBoundingClientRect();
  if (!board) return { fromX: 0, fromY: 0, toX: 0, toY: 0, width: 48, height: 75 };
  const card = cards[0];
  const floor = (id?: string) =>
    id ? document.querySelector(`[data-floor-card-id="${id}"] .hwatu`) : null;
  const capturing = kind === 'capture' || kind === 'transfer' || kind === 'bonus-capture';
  const group =
    kind === 'transfer' || kind === 'bonus-capture'
      ? 3
      : card?.isGwang
        ? 0
        : card?.isYeol
          ? 1
          : card?.isTti
            ? 2
            : 3;
  const pile = document
    .querySelectorAll('.captured')
    [mine ? 1 : 0]?.querySelectorAll('.captured-group')[group];
  const hand = mine
    ? document.querySelector(`[data-card-id="${card?.id}"] .hwatu`)
    : document.querySelector('[data-testid="opponent-hand"]');
  const deck = document.querySelector('.deck .hwatu');
  const opponentPi = document
    .querySelectorAll('.captured')
    [mine ? 0 : 1]?.querySelectorAll('.captured-group')[3];
  const stolen = opponentPi?.querySelector(`[data-captured-card-id="${card?.id}"] .hwatu`);
  const source =
    kind === 'play' || kind === 'bonus'
      ? hand
      : kind === 'transfer'
        ? (stolen ?? opponentPi)
        : kind === 'flip' || kind === 'bonus-capture'
          ? deck
          : (floor(card?.id) ?? deck);
  const target = capturing ? pile : (floor(targetId) ?? deck);
  const measuredWidth =
    kind === 'flip' && !targetId
      ? (deck?.getBoundingClientRect().width ?? 48)
      : (target?.getBoundingClientRect().width ?? 48);
  const width =
    kind === 'bonus' || kind === 'bonus-capture'
      ? 74
      : capturing
        ? Math.min(48, measuredWidth)
        : measuredWidth;
  const height =
    capturing || kind === 'bonus'
      ? (width * 100) / 64
      : (target?.getBoundingClientRect().height ?? (width * 100) / 64);
  const convert = (el: Element | null | undefined) => {
    const r = el?.getBoundingClientRect();
    return {
      x: r ? r.left + r.width / 2 - board.left - width / 2 : 0,
      y: r ? r.top + r.height / 2 - board.top - height / 2 : 0,
    };
  };
  const from = convert(source),
    to = convert(target);
  return { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, width, height, targetId };
}
