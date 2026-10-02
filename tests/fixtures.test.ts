import { expect, it } from 'vitest';
import { createFixture, createCustomDeal, FIXTURE_NAMES } from '../src/game-engine/fixtures';
import { applyAction, assertInvariant } from '../src/game-engine/engine';
it.each(FIXTURE_NAMES)('%s fixture has 50 identities and no initial chongtong', (name) => {
  const s = createFixture(name);
  assertInvariant(s);
  expect(s.phase).toBe('PLAY');
  expect(s.currentPlayer).toBe(0);
  expect(createFixture(name)).toEqual(s);
});
it('ppuk fixture produces ppuk with attached bonus', () => {
  const s = createFixture('뻑과 보너스');
  const r = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-2' });
  expect(r.events.some((e) => e.type === 'PPUK_OCCURRED')).toBe(true);
  expect(r.nextState.bonusAttachments['bonus-0']).toBe(1);
});
it('custom deal rejects duplicate and unknown identities', () => {
  expect(() => createCustomDeal({ hand: ['missing'], floor: [], draw: [] })).toThrow();
});
