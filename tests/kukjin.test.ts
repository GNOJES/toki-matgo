import { expect, it } from 'vitest';
import { createFixture } from '../src/game-engine/fixtures';
import { applyAction, assertInvariant, projectState } from '../src/game-engine/engine';
import { chooseAction } from '../src/game-engine/ai';

const reachChoice = () =>
  applyAction(createFixture('국화 점수 선택'), { type: 'PLAY_CARD', player: 0, cardId: 'm2-0' })
    .nextState;
it('offers conversion when double pi reaches seven, not immediately on acquisition', () => {
  const low = createFixture('국화 선택');
  expect(low.phase).toBe('PLAY');
  const s = reachChoice();
  expect(s.phase).toBe('SELECT_KUKJIN');
  expect(s.players[0].turnsRemaining).toBe(9);
  expect(s.currentPlayer).toBe(0);
  expect(() => applyAction(s, { type: 'PASS', player: 0 })).toThrow();
});
it('conversion leads to go/stop; keeping advances without spending a second turn', () => {
  const s = reachChoice();
  const changed = applyAction(s, { type: 'SET_KUKJIN', player: 0, asPi: true }).nextState;
  expect(changed.players[0].kukjinAsPi).toBe(true);
  expect(changed.phase).toBe('GO_STOP');
  const kept = applyAction(s, { type: 'SET_KUKJIN', player: 0, asPi: false }).nextState;
  expect(kept.currentPlayer).toBe(1);
  expect(kept.players[0].turnsRemaining).toBe(9);
  expect(kept.players[0].kukjinAsPi).toBe(false);
  assertInvariant(kept);
  expect(chooseAction(projectState(s, 0), 0).type).toBe('SET_KUKJIN');
});
it('last-turn conversion settles immediately rather than losing the scoring opportunity', () => {
  const s = reachChoice();
  s.players[0].turnsRemaining = 0;
  s.deck.push(...s.players[0].hand);
  s.players[0].hand = [];
  const n = applyAction(s, { type: 'SET_KUKJIN', player: 0 }).nextState;
  expect(n.phase).toBe('FINISHED');
  expect(n.result?.winner).toBe(0);
});
