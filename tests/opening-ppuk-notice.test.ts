import { expect, it } from 'vitest';
import { applyAction, projectState } from '../src/game-engine/engine';
import { createFixture } from '../src/game-engine/fixtures';
import { openingPpukEffect } from '../src/lib/opening-ppuk-effect';

it.each([
  [0, '첫뻑!', '상대에게 7점 획득'],
  [1, '2연뻑!', '상대에게 14점 추가'],
  [2, '3연뻑!', '상대에게 21점 추가'],
] as const)(
  'shows the actual new matgo payment after %i opening ppuks',
  (streak, label, detail) => {
    const s = createFixture('뻑과 보너스');
    s.players[0].openingPpukStreak = streak;
    s.players[0].ppukCount = streak;
    s.players[0].sidePoints = streak === 2 ? 21 : streak * 7;
    s.deck.push(...s.players[0].hand.splice(10 - streak));
    s.players[0].turnsRemaining = 10 - streak;
    for (const actor of [0, 1] as const) {
      const state = structuredClone(s);
      if (actor === 1) state.players.reverse();
      state.currentPlayer = actor;
      const result = applyAction(state, { type: 'PLAY_CARD', player: actor, cardId: 'm1-2' });
      const event = result.events.find((e) => e.type === 'PPUK_OCCURRED')!;
      for (const viewer of [0, 1] as const) {
        const before = projectState(state, viewer);
        const next = projectState(result.nextState, viewer);
        expect(openingPpukEffect(before, next, event)).toEqual({ label, detail, player: actor });
        expect(openingPpukEffect(next, next, event)).toBeNull();
        expect(openingPpukEffect(before, next, { type: 'TURN_ENDED', player: actor })).toBeNull();
      }
      if (streak === 2) {
        expect(result.nextState.result?.sidePoints[actor]).toBe(42);
        expect(result.nextState.result?.points).toBe(7);
      }
    }
  },
);

it('does not turn a later ordinary ppuk into another opening payment notice', () => {
  const s = createFixture('뻑과 보너스');
  s.players[0].openingPpukStreak = 1;
  s.players[0].sidePoints = 7;
  s.deck.push(...s.players[0].hand.splice(8));
  s.players[0].turnsRemaining = 8;
  const result = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-2' });
  expect(
    openingPpukEffect(
      projectState(s, 0),
      projectState(result.nextState, 0),
      result.events.find((e) => e.type === 'PPUK_OCCURRED')!,
    ),
  ).toBeNull();
});
