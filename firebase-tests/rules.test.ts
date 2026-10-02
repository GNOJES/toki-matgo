import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, set, runTransaction, update } from 'firebase/database';
import { emptyHostState, encodeState } from '../src/multiplayer/host';
let env: RulesTestEnvironment;
const code = 'ABC234';
function data() {
  return {
    meta: {
      hostUid: 'host',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      status: 'waiting',
    },
    players: { host: { name: '방장' } },
    state: encodeState(emptyHostState()),
  };
}
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-toki-matgo',
    database: {
      host: '127.0.0.1',
      port: 9000,
      rules: await readFile('database.rules.json', 'utf8'),
    },
  });
});
beforeEach(async () => {
  await env.clearDatabase();
});
afterAll(async () => {
  await env.cleanup();
});
async function create() {
  const db = env.authenticatedContext('host').database();
  await assertSucceeds(set(ref(db, `rooms/${code}`), data()));
  return db;
}
it('unauthenticated users cannot read, create, join or submit actions; room list is private', async () => {
  const db = await create(),
    anonymous = env.unauthenticatedContext().database();
  await assertFails(get(ref(anonymous, `rooms/${code}`)));
  await assertFails(get(ref(anonymous, `rooms/${code}/meta`)));
  await assertFails(set(ref(anonymous, 'rooms/DEF234'), data()));
  await assertFails(set(ref(anonymous, `rooms/${code}/meta/guestUid`), 'guest'));
  await assertFails(get(ref(db, 'rooms')));
});
it('authenticated host creates with its UID and outsider cannot read state or change metadata', async () => {
  await create();
  const third = env.authenticatedContext('third').database();
  await assertFails(get(ref(third, `rooms/${code}`)));
  await assertFails(get(ref(third, `rooms/${code}/state`)));
  await assertFails(update(ref(third, `rooms/${code}/meta`), { status: 'closed' }));
  await assertFails(set(ref(third, 'rooms/DEF234'), data()));
});
it('guest slot transaction admits only one of two simultaneous joiners', async () => {
  await create();
  const join = (uid: string) =>
    runTransaction(
      ref(env.authenticatedContext(uid).database(), `rooms/${code}/meta/guestUid`),
      (old) => (old ? undefined : uid),
      { applyLocally: false },
    );
  const results = await Promise.all([join('guest'), join('third')]);
  expect(results.filter((r) => r.committed)).toHaveLength(1);
  const uid = results.find((r) => r.committed)!.snapshot.val();
  const guest = env.authenticatedContext(uid).database();
  await assertSucceeds(get(ref(guest, `rooms/${code}`)));
  await assertFails(set(ref(guest, `rooms/${code}/meta/guestUid`), null));
});
it('only host writes final state; guest writes only its own action/presence and action is immutable', async () => {
  const host = await create(),
    guest = env.authenticatedContext('guest').database();
  await assertSucceeds(set(ref(guest, `rooms/${code}/meta/guestUid`), 'guest'));
  await assertSucceeds(
    set(ref(guest, `rooms/${code}/players/guest`), { name: '친구', connections: { one: true } }),
  );
  const state = { ...emptyHostState(), revision: 1 };
  await assertSucceeds(set(ref(host, `rooms/${code}/state`), encodeState(state)));
  await assertFails(set(ref(guest, `rooms/${code}/state`), encodeState({ ...state, revision: 2 })));
  await assertFails(set(ref(guest, `rooms/${code}/players/host/connections/hack`), true));
  const action = {
    uid: 'guest',
    sequence: 1,
    round: 1,
    stateVersion: 1,
    createdAt: Date.now(),
    action: { type: 'PLAY_CARD', player: 0, cardId: 'm1-0' },
  };
  await assertSucceeds(set(ref(guest, `rooms/${code}/actions/guest/0000000001`), action));
  await assertFails(
    set(ref(guest, `rooms/${code}/actions/host/0000000001`), { ...action, uid: 'host' }),
  );
  await assertFails(
    set(ref(guest, `rooms/${code}/actions/guest/0000000001`), { ...action, cardId: 'm1-1' }),
  );
  await assertSucceeds(set(ref(host, `rooms/${code}/actions/guest/0000000001`), null));
});
it('closed or expired rooms cannot be joined and participants may remove closed rooms', async () => {
  const host = await create();
  const guest = env.authenticatedContext('guest').database();
  await set(ref(host, `rooms/${code}/meta/status`), 'closed');
  await assertFails(set(ref(guest, `rooms/${code}/meta/guestUid`), 'guest'));
  await assertSucceeds(set(ref(host, `rooms/${code}`), null));
  await env.withSecurityRulesDisabled(async (c) => {
    await set(ref(c.database(), `rooms/${code}`), {
      ...data(),
      meta: { ...data().meta, expiresAt: Date.now() - 1000 },
    });
  });
  await assertFails(set(ref(guest, `rooms/${code}/meta/guestUid`), 'guest'));
  await assertSucceeds(set(ref(host, `rooms/${code}`), null));
});
