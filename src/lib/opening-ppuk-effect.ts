import type { GameEvent, GameView, PlayerId } from '../game-engine/types';

export interface SpecialEffect {
  label: string;
  detail: string;
  player?: PlayerId;
}

export function openingPpukEffect(
  before: GameView,
  next: GameView,
  event: GameEvent,
): SpecialEffect | null {
  if (event.type !== 'PPUK_OCCURRED') return null;
  const previous = before.players[event.player];
  const current = next.players[event.player];
  const payment = current.sidePoints - previous.sidePoints;
  const streak = current.openingPpukStreak;
  if (payment <= 0 || streak <= previous.openingPpukStreak) return null;
  return {
    label: streak === 1 ? '첫뻑!' : `${streak}연뻑!`,
    detail: `상대에게 ${payment}점 ${streak === 1 ? '획득' : '추가'}`,
    player: event.player,
  };
}
