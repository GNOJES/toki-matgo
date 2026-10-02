import { piValue } from './cards';
import { calculateScore } from './score';
import type { Card, GameAction, GameView, PlayerId } from './types';
export type Difficulty = 'easy' | 'normal' | 'hard';
function value(c: Card, view: GameView, player: PlayerId) {
  const own = view.players[player].captured;
  let v = piValue(c) * 1.4 + (c.isGwang ? 5 : 0) + (c.isYeol ? 2 : 0) + (c.isTti ? 2 : 0);
  if (c.isGodori) v += own.filter((x) => x.isGodori).length * 3;
  if (c.ribbonType !== 'NONE') v += own.filter((x) => x.ribbonType === c.ribbonType).length * 2;
  if (c.isPi && view.scores[1 - player].piScore > 0 && view.scores[player].piCount <= 7) v += 3;
  if (c.isGwang && view.scores[1 - player].gwangScore > 0 && !own.some((x) => x.isGwang)) v += 4;
  if (c.isYeol && view.scores[player].yeolCount === 6) v += 4;
  return v;
}
// Only a redacted view enters AI. No opponent hand or future deck exists in this type.
export function chooseAction(
  view: GameView,
  player: PlayerId,
  difficulty: Difficulty = 'normal',
  rng: () => number = Math.random,
): GameAction {
  if (view.currentPlayer !== player) throw new Error('AI 차례 아님');
  if (view.phase === 'GO_STOP') {
    const own = view.scores[player],
      other = view.scores[1 - player];
    const go =
      difficulty !== 'easy' &&
      view.players[player].goCount < 2 &&
      view.players[player].turnsRemaining > 2 &&
      other.baseScore < 5 &&
      own.baseScore < 12;
    return { type: go ? 'GO' : 'STOP', player };
  }
  if (view.phase === 'SELECT_FLOOR') {
    const choices = view.floor
      .filter((c) => view.options.includes(c.id))
      .sort((a, b) => value(b, view, player) - value(a, view, player));
    return { type: 'SELECT_FLOOR', player, cardId: choices[0].id };
  }
  const bonus = view.hand.find((c) => c.isBonus);
  if (bonus) return { type: 'PLAY_CARD', player, cardId: bonus.id };
  for (const c of view.hand) {
    if (
      view.hand.filter((x) => x.month === c.month).length === 3 &&
      view.floor.filter((x) => x.month === c.month).length === 1
    )
      return { type: 'BOMB', player, month: c.month };
  }
  if (!view.hand.length) return { type: 'PASS', player };
  const ranked = view.hand
    .map((c) => {
      const matching = view.floor.filter((f) => f.month === c.month);
      const chosen =
        matching.length === 3
          ? matching
          : [...matching]
              .sort((a, b) => value(b, view, player) - value(a, view, player))
              .slice(0, 1);
      const marginal = matching.length
        ? calculateScore({
            ...view.players[player],
            hand: view.hand,
            captured: [...view.players[player].captured, c, ...chosen],
          }).baseScore - view.scores[player].baseScore
        : 0;
      const yieldValue = matching.length
        ? value(c, view, player) +
          Math.max(...matching.map((x) => value(x, view, player))) +
          marginal * 4
        : 0;
      const danger =
        difficulty === 'hard' &&
        view.players[1 - player].captured.some(
          (x) => x.ribbonType !== 'NONE' && x.ribbonType === c.ribbonType,
        )
          ? 3
          : 0;
      return { c, rank: yieldValue - danger + (difficulty === 'easy' ? rng() * 12 : rng()) };
    })
    .sort((a, b) => b.rank - a.rank);
  const c = ranked[0].c;
  const shake =
    view.hand.filter((x) => x.month === c.month).length === 3 &&
    !view.floor.some((x) => x.month === c.month) &&
    !view.players[player].shakes.includes(c.month) &&
    difficulty === 'hard';
  return { type: 'PLAY_CARD', player, cardId: c.id, shake };
}
