import { beforeAll, afterAll, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  goOffline,
  goOnline,
  ref,
  runTransaction,
} from 'firebase/database';
import { FirebaseTransport } from '../src/multiplayer/firebase-transport';
import { decodeState, encodeState } from '../src/multiplayer/host';
import { createFixture } from '../src/game-engine/fixtures';
import type { RoomData, RoomMessage } from '../src/multiplayer/types';
let env: RulesTestEnvironment;
const apps: FirebaseApp[] = [],
  transports: FirebaseTransport[] = [];
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-toki-matgo',
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules: await readFile('database.rules.json', 'utf8'),
    },
  });
  await env.clearDatabase();
});
afterAll(async () => {
  transports.forEach((t) => t.dispose());
  await Promise.all(apps.map((app) => deleteApp(app)));
  await env.cleanup();
});
async function user() {
  const app = initializeApp(
    {
      apiKey: 'demo-api-key',
      projectId: 'demo-toki-matgo',
      databaseURL: 'https://demo-toki-matgo-default-rtdb.firebaseio.com',
    },
    crypto.randomUUID(),
  );
  apps.push(app);
  const auth = getAuth(app),
    db = getDatabase(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const uid = (await signInAnonymously(auth)).user.uid;
  return { db, auth, uid };
}
it('real anonymous Auth, rooms, guest choice -> host transaction, invalid/duplicate action, reconnect and leave', async () => {
  const host = await user(),
    guest = await user(),
    third = await user();
  expect(host.auth.currentUser!.isAnonymous).toBe(true);
  expect(guest.uid).not.toBe(host.uid);
  let a: RoomMessage | undefined, b: RoomMessage | undefined;
  const errors: string[] = [];
  const ha = await FirebaseTransport.open(
    {
      state: (m) => {
        a = m;
      },
      connection: () => {},
      error: (m) => errors.push(m),
    },
    undefined,
    '방장',
    false,
    async () => host,
  );
  transports.push(ha);
  const gb = await FirebaseTransport.open(
    {
      state: (m) => {
        b = m;
      },
      connection: () => {},
      error: (m) => errors.push(m),
    },
    ha.code,
    '친구',
    false,
    async () => guest,
  );
  transports.push(gb);
  await expect.poll(() => !!a?.canAct && !!b?.canAct).toBe(true);
  expect(a!.me).toBe(0);
  expect(b!.me).toBe(1);
  await expect(
    FirebaseTransport.open(
      { state: () => {}, connection: () => {}, error: () => {} },
      ha.code,
      '세 번째',
      false,
      async () => third,
    ),
  ).rejects.toThrow('가득');
  const roomRef = ref(host.db, `rooms/${ha.code}`),
    stateRef = ref(host.db, `rooms/${ha.code}/state`);
  // Seed a public development fixture using the authorized host write path.
  await runTransaction(
    stateRef,
    (value) => {
      const state = JSON.parse(value.data);
      state.game = createFixture('바닥 두 장 · 따닥');
      state.revision++;
      state.events = [];
      return encodeState(state);
    },
    { applyLocally: false },
  );
  await expect.poll(() => a?.game?.currentPlayer === 0 && a.canAct && b?.canAct).toBe(true);
  let state = decodeState((await get(roomRef)).val() as RoomData);
  const wrong = {
    sequence: state.processed[1] + 1,
    round: state.round,
    stateVersion: state.game!.stateVersion,
    action: {
      type: 'PLAY_CARD' as const,
      player: 1 as const,
      cardId: state.game!.players[1].hand[0].id,
    },
  };
  await expect(gb.action(wrong)).rejects.toThrow();
  await expect.poll(() => b?.actionSequence).toBe(wrong.sequence);
  const play = {
    sequence: a!.actionSequence + 1,
    round: a!.round,
    stateVersion: a!.game!.stateVersion,
    action: { type: 'PLAY_CARD' as const, player: 0 as const, cardId: 'm1-2' },
  };
  await ha.action(play);
  await expect.poll(() => a?.game?.phase).toBe('SELECT_FLOOR');
  await ha.ready(a!.round, a!.game!.stateVersion);
  await gb.ready(b!.round, b!.game!.stateVersion);
  await expect.poll(() => a?.canAct && b?.canAct).toBe(true);
  await ha.action({
    sequence: a!.actionSequence + 1,
    round: a!.round,
    stateVersion: a!.game!.stateVersion,
    action: { type: 'SELECT_FLOOR', player: 0, cardId: 'm1-1' },
  });
  await expect.poll(() => a?.game?.phase !== 'SELECT_FLOOR').toBe(true);
  const version = a!.game!.stateVersion;
  await ha.action(play); // consumed request: no second execution, even after pruning.
  expect(decodeState((await get(roomRef)).val() as RoomData).game!.stateVersion).toBe(version);
  await expect.poll(() => b?.game?.stateVersion).toBe(version);
  await gb.ready(b!.round, b!.game!.stateVersion);
  await ha.ready(a!.round, a!.game!.stateVersion);
  await expect.poll(() => a?.canAct && b?.canAct).toBe(true);
  if (a!.game!.phase === 'GO_STOP') {
    await ha.action({
      sequence: a!.actionSequence + 1,
      round: a!.round,
      stateVersion: a!.game!.stateVersion,
      action: { type: 'GO', player: 0 },
    });
    await expect.poll(() => b?.game?.stateVersion).toBe(a!.game!.stateVersion);
    await ha.ready(a!.round, a!.game!.stateVersion);
    await gb.ready(b!.round, b!.game!.stateVersion);
  }
  // Guest takes the next turn. Both clients receive precisely the same authoritative game.
  await expect.poll(() => b?.canAct && b.game?.currentPlayer === 1).toBe(true);
  const { chooseAction } = await import('../src/game-engine/ai');
  await gb.action({
    sequence: b!.actionSequence + 1,
    round: b!.round,
    stateVersion: b!.game!.stateVersion,
    action: chooseAction(b!.game!, 1),
  });
  await expect.poll(() => a?.game?.stateVersion === b?.game?.stateVersion).toBe(true);
  const settled = decodeState((await get(roomRef)).val() as RoomData);
  expect(a!.game!.floor).toEqual(b!.game!.floor);
  goOffline(host.db);
  await expect.poll(() => b?.connected[0]).toBe(false);
  goOnline(host.db);
  await expect.poll(() => b?.connected[0]).toBe(true);
  gb.dispose();
  const restored = await FirebaseTransport.open(
    {
      state: (m) => {
        b = m;
      },
      connection: () => {},
      error: (m) => errors.push(m),
    },
    ha.code,
    '친구',
    true,
    async () => guest,
  );
  transports.push(restored);
  await expect.poll(() => b?.game?.stateVersion).toBe(settled.game!.stateVersion);
  await expect.poll(() => b?.connected.every(Boolean)).toBe(true);
  await restored.leave();
  await expect.poll(() => a?.closed).toBe(true);
  expect((await get(ref(host.db, `rooms/${ha.code}/meta`))).exists()).toBe(false);
  expect(errors.filter((m) => !m.includes('종료'))).toEqual([]);
});
