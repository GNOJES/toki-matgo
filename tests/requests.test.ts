import { expect, it } from 'vitest';
import { isRequest, pendingRequests } from '../src/multiplayer/requests';
const valid = {
  uid: 'guest',
  sequence: 1,
  round: 1,
  stateVersion: 1,
  createdAt: 1,
  action: { type: 'PLAY_CARD', player: 1, cardId: 'm1-0' },
};
it('accepts bounded requests and rejects malformed envelopes and actions', () => {
  expect(isRequest(valid)).toBe(true);
  for (const bad of [
    null,
    { ...valid, sequence: 1.5 },
    { ...valid, extra: 'x'.repeat(64000) },
    { ...valid, action: { type: 'GO', player: 1, extra: true } },
    { ...valid, action: { type: 'BOMB', player: 1, month: 13 } },
  ])
    expect(isRequest(bad)).toBe(false);
});
it('isolates malformed and spoofed legacy entries without blocking valid mail', () => {
  const { requests, invalid } = pendingRequests(
    {
      guest: {
        poison: { ...valid, sequence: 1.5 },
        pending: valid,
        spoof: { ...valid, uid: 'host' },
      },
    },
    ['host', 'guest'],
  );
  expect(requests).toEqual([valid]);
  expect(invalid).toEqual(['actions/guest/poison', 'actions/guest/spoof']);
});
