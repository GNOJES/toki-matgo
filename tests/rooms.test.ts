import { it, expect } from 'vitest';
import { RoomService } from '../server/rooms';
import { chooseAction } from '../src/game-engine/ai';
import { projectState } from '../src/game-engine/engine';
function pair() {
  const svc = new RoomService();
  const a = svc.create('가족', 'a');
  const b = svc.join(a.room.code, '친구', 'b');
  svc.ready(a.room, 0, a.room.game!.stateVersion);
  svc.ready(a.room, 1, a.room.game!.stateVersion);
  return { svc, room: a.room, a, b };
}
it('initial, action and reconnect snapshots never contain other hand or deck', () => {
  const { svc, room, b } = pair();
  const check = () => {
    for (const p of [0, 1] as const) {
      const data = JSON.stringify(svc.snapshot(room, p));
      for (const card of room.game!.players[1 - p].hand) expect(data).not.toContain(`"${card.id}"`);
      for (const c of room.game!.deck) expect(data).not.toContain(`"${c.id}"`);
    }
  };
  check();
  if (room.game!.phase !== 'FINISHED') {
    const p = room.game!.currentPlayer;
    const action = chooseAction(projectState(room.game!, p), p);
    svc.action(room, p, {
      round: room.round,
      sequence: 1,
      stateVersion: room.game!.stateVersion,
      action,
    });
    check();
  }
  svc.disconnect(room, 1, 'b');
  svc.join(room.code, '친구', 'new-b', b.token);
  check();
  expect(room.sessions[1]!.socketId).toBe('new-b');
});
it('duplicate action idempotency / stale version / ownership validation', () => {
  const { svc, room } = pair();
  if (room.game!.phase === 'FINISHED') return;
  const p = room.game!.currentPlayer;
  const action = chooseAction(projectState(room.game!, p), p);
  const request = { round: room.round, sequence: 1, stateVersion: room.game!.stateVersion, action };
  svc.action(room, p, request);
  const version = room.game!.stateVersion;
  expect(svc.action(room, p, request)).toEqual([]);
  expect(room.game!.stateVersion).toBe(version);
  expect(() => svc.action(room, p, { ...request, sequence: 2 })).toThrow();
});
it('disconnect pauses without loss, retained session restored, forged token rejected', () => {
  const { svc, room, b } = pair();
  svc.disconnect(room, 1, 'b');
  expect(svc.snapshot(room, 0).canAct).toBe(false);
  expect(svc.snapshot(room, 0).connected).toEqual([true, false]);
  expect(() => svc.join(room.code, 'hack', 'x', 'x'.repeat(64))).toThrow();
  svc.join(room.code, 'ignored', 'b2', b.token);
  expect(room.sessions[1]!.nickname).toBe('친구');
  expect(room.stats.wins).toEqual([0, 0]);
});
it('completed room starts another round only when both consent', () => {
  const { svc, room } = pair();
  let count = 0;
  while (room.game!.phase !== 'FINISHED' && count++ < 100) {
    const p = room.game!.currentPlayer;
    svc.ready(room, 0, room.game!.stateVersion);
    svc.ready(room, 1, room.game!.stateVersion);
    svc.action(room, p, {
      round: room.round,
      sequence: room.sessions[p]!.sequence + 1,
      stateVersion: room.game!.stateVersion,
      action: chooseAction(projectState(room.game!, p), p),
    });
  }
  expect(room.game!.phase).toBe('FINISHED');
  const old = room.game;
  svc.nextRound(room, 0);
  expect(room.game).toBe(old);
  svc.nextRound(room, 1);
  expect(room.round).toBe(2);
  expect(room.game).not.toBe(old);
  expect(room.game!.dealer).toBe(old!.result!.winner ?? old!.dealer);
});
it('room TTL only expires disconnected rooms', () => {
  const { svc, room } = pair();
  svc.cleanup(Date.now() + 3600000);
  expect(svc.store.get(room.code)).toBeDefined();
  svc.disconnect(room, 0, 'a');
  svc.disconnect(room, 1, 'b');
  svc.cleanup(Date.now() + 3600000);
  expect(svc.store.get(room.code)).toBeUndefined();
});
it('old round requests are rejected even when sequence/version repeat', () => {
  const { svc, room } = pair();
  if (room.game!.phase === 'FINISHED') return;
  const p = room.game!.currentPlayer;
  expect(() =>
    svc.action(room, p, {
      round: room.round - 1,
      sequence: 1,
      stateVersion: room.game!.stateVersion,
      action: chooseAction(projectState(room.game!, p), p),
    }),
  ).toThrow('이전 판');
});
it('cannot spoof actor through client payload', () => {
  const { svc, room } = pair();
  if (room.game!.phase === 'FINISHED') return;
  const p = room.game!.currentPlayer;
  const other = (1 - p) as 0 | 1;
  const card = room.game!.players[p].hand[0];
  expect(() =>
    svc.action(room, other, {
      round: room.round,
      sequence: 1,
      stateVersion: room.game!.stateVersion,
      action: { type: 'PLAY_CARD', cardId: card.id, player: p } as any,
    }),
  ).toThrow();
});
