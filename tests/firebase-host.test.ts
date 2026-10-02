import { it, expect } from 'vitest';
import { seededRandom } from '../src/game-engine/cards';
import { chooseAction } from '../src/game-engine/ai';
import { projectState } from '../src/game-engine/engine';
import { createFixture } from '../src/game-engine/fixtures';
import {
  emptyHostState,
  encodeState,
  processRequest,
  roomMessage,
  startGame,
} from '../src/multiplayer/host';
import type { HostState, RoomData, Request } from '../src/multiplayer/types';
function pair() {
  const rng = seededRandom(12345),
    state = startGame(emptyHostState(), rng);
  const room: RoomData = {
    meta: {
      hostUid: 'host',
      guestUid: 'guest',
      status: 'active',
      createdAt: 0,
      updatedAt: 0,
      expiresAt: Date.now() + 100000,
    },
    players: {
      host: {
        name: '방장',
        connections: { h: true },
        ready: { round: 1, version: state.game!.stateVersion },
      },
      guest: {
        name: '친구',
        connections: { g: true },
        ready: { round: 1, version: state.game!.stateVersion },
      },
    },
    state: encodeState(state),
  };
  return { rng, state, room };
}
function request(state: HostState, uid: string): Request {
  const player = uid === 'host' ? 0 : 1;
  return {
    uid,
    sequence: state.processed[player] + 1,
    round: state.round,
    stateVersion: state.game!.stateVersion,
    createdAt: Date.now(),
    action:
      state.game!.currentPlayer === player
        ? chooseAction(projectState(state.game!, player), player)
        : { type: 'PLAY_CARD', player, cardId: state.game!.players[player].hand[0].id },
  };
}
it('host initializes once and publishes the same result for both projections', () => {
  const { rng, state, room } = pair();
  expect(startGame(state, rng)).toBe(state);
  expect(roomMessage(room, 'ABC234', 'host', false).game!.stateVersion).toBe(
    roomMessage(room, 'ABC234', 'guest', false).game!.stateVersion,
  );
  expect(roomMessage(room, 'ABC234', 'host', false).me).toBe(0);
  expect(roomMessage(room, 'ABC234', 'guest', false).me).toBe(1);
});
it('guest request is validated by host; duplicate never runs twice and spoofed player is overwritten', () => {
  const { rng, state, room } = pair();
  state.game!.currentPlayer = 1;
  const req = request(state, 'guest');
  if ('player' in req.action) req.action.player = 0;
  const next = processRequest(state, room, req, rng);
  expect(next.receipts[1].error).toBeUndefined();
  expect(next.game!.stateVersion).toBeGreaterThan(state.game!.stateVersion);
  expect(processRequest(next, room, req, rng)).toBe(next);
});
it('wrong turn, stale version, previous round, outsider and disconnected host are rejected', () => {
  const { rng, state, room } = pair();
  state.game!.currentPlayer = 0;
  const wrong = processRequest(state, room, request(state, 'guest'), rng);
  expect(wrong.game).toEqual(state.game);
  expect(wrong.receipts[1].error).toBeTruthy();
  const req = request(state, 'host');
  expect(processRequest(state, room, { ...req, stateVersion: -1 }, rng).game).toEqual(state.game);
  expect(processRequest(state, room, { ...req, round: 0 }, rng).receipts[0].error).toBeTruthy();
  expect(() => processRequest(state, room, { ...req, uid: 'third' }, rng)).toThrow('참가');
  delete room.players!.host.connections;
  expect(processRequest(state, room, req, rng).receipts[0].error).toContain('연결');
});
it('a missing sequence is not skipped and rejected actions consume their receipt without changing the game', () => {
  const { rng, state, room } = pair();
  const req = request(state, 'host');
  expect(processRequest(state, room, { ...req, sequence: 2 }, rng)).toBe(state);
  const bad = processRequest(state, room, { ...req, stateVersion: -1 }, rng);
  expect(bad.processed[0]).toBe(1);
  expect(processRequest(bad, room, req, rng)).toBe(bad);
});
it('floor choices use the existing engine and wait for both animation acknowledgements', () => {
  const { rng, state, room } = pair();
  state.game = createFixture('바닥 두 장 · 따닥');
  room.players!.host.ready!.version = room.players!.guest.ready!.version = state.game.stateVersion;
  const next = processRequest(
    state,
    room,
    { ...request(state, 'host'), action: { type: 'PLAY_CARD', player: 0, cardId: 'm1-2' } },
    rng,
  );
  expect(next.game!.phase).toBe('SELECT_FLOOR');
  const choice: Request = {
    uid: 'host',
    sequence: 2,
    round: 1,
    stateVersion: next.game!.stateVersion,
    action: { type: 'SELECT_FLOOR', player: 0, cardId: 'm1-1' },
    createdAt: 0,
  };
  expect(processRequest(next, room, choice, rng).receipts[0].error).toContain('패 이동');
  room.players!.host.ready!.version = room.players!.guest.ready!.version = next.game!.stateVersion;
  expect(processRequest(next, room, choice, rng).game!.phase).not.toBe('SELECT_FLOOR');
});
it('complete round, settle exactly once, both next-round votes and host-only shuffle', () => {
  const { rng, state: first, room } = pair();
  let state = first;
  for (let step = 0; state.game!.phase !== 'FINISHED' && step < 100; step++) {
    room.players!.host.ready = room.players!.guest.ready = {
      round: state.round,
      version: state.game!.stateVersion,
    };
    state = processRequest(
      state,
      room,
      request(state, state.game!.currentPlayer === 0 ? 'host' : 'guest'),
      rng,
    );
  }
  expect(state.game!.phase).toBe('FINISHED');
  const old = state.game;
  const vote = (uid: string): Request => ({
    uid,
    sequence: state.processed[uid === 'host' ? 0 : 1] + 1,
    round: state.round,
    stateVersion: state.game!.stateVersion,
    action: { type: 'NEXT_ROUND' },
    createdAt: 0,
  });
  state = processRequest(state, room, vote('host'), rng);
  expect(state.round).toBe(1);
  state = processRequest(state, room, vote('guest'), rng);
  expect(state.round).toBe(2);
  expect(state.game!.dealer).toBe(old!.result!.winner ?? old!.dealer);
  expect(state.nextReady).toEqual([false, false]);
});
