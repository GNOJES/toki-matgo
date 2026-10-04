import { it, expect, vi, afterEach } from 'vitest';
import { emptyHostState, encodeState } from '../src/multiplayer/host';
vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({})),
  runTransaction: vi.fn(() => new Promise(() => {})),
}));
import { FirebaseTransport } from '../src/multiplayer/firebase-transport';
afterEach(() => vi.useRealTimers());
it('times out the whole action even if the write never acknowledges', async () => {
  vi.useFakeTimers();
  const t = new FirebaseTransport({} as never, 'host', '0123', {
    state: () => {},
    connection: () => {},
    error: () => {},
  });
  Object.assign(t, {
    connected: true,
    room: {
      meta: { hostUid: 'host', expiresAt: Date.now() + 100000 },
      state: encodeState(emptyHostState()),
    },
  });
  let outcome = 'pending';
  void t.action({ sequence: 1, round: 1, stateVersion: 1, action: { type: 'GO', player: 0 } }).then(
    () => (outcome = 'success'),
    () => (outcome = 'timeout'),
  );
  await vi.advanceTimersByTimeAsync(20001);
  expect(outcome).toBe('timeout');
});
it('a late failed write cannot reject a newer retry with the same sequence', async () => {
  vi.useFakeTimers();
  const { runTransaction } = await import('firebase/database');
  let fail!: (e: Error) => void;
  vi.mocked(runTransaction).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  const t = new FirebaseTransport({} as never, 'host', '0123', {
    state: () => {},
    connection: () => {},
    error: () => {},
  });
  Object.assign(t, {
    connected: true,
    room: {
      meta: { hostUid: 'host', expiresAt: Date.now() + 100000 },
      state: encodeState(emptyHostState()),
    },
  });
  const request = {
    sequence: 1,
    round: 1,
    stateVersion: 1,
    action: { type: 'GO' as const, player: 0 as const },
  };
  void t.action(request).catch(() => {});
  await vi.advanceTimersByTimeAsync(20001);
  let outcome = 'pending';
  void t.action(request).catch(() => {
    outcome = 'failed';
  });
  fail(new Error('old write failed'));
  await vi.advanceTimersByTimeAsync(1);
  expect(outcome).toBe('pending');
  await vi.advanceTimersByTimeAsync(20001);
  expect(outcome).toBe('failed');
});
