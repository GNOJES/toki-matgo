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
const code = '0123';
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
  const room = data();
  await set(ref(db, 'roomOwners/host'), {
    code,
    createdAt: Date.now(),
    expiresAt: room.meta.expiresAt,
  });
  await assertSucceeds(set(ref(db, `rooms/${code}`), room));
  return db;
}
it('unauthenticated users cannot read, create, join or submit actions; room list is private', async () => {
  const db = await create(),
    anonymous = env.unauthenticatedContext().database();
  await assertFails(get(ref(anonymous, `rooms/${code}`)));
  await assertFails(get(ref(anonymous, `rooms/${code}/meta`)));
  await assertFails(set(ref(anonymous, 'rooms/4567'), data()));
  await assertFails(set(ref(anonymous, `rooms/${code}/meta/guestUid`), 'guest'));
  await assertFails(get(ref(db, 'rooms')));
});
it('authenticated host creates with its UID and outsider cannot read state or change metadata', async () => {
  await create();
  const third = env.authenticatedContext('third').database();
  await assertFails(get(ref(third, `rooms/${code}`)));
  await assertFails(get(ref(third, `rooms/${code}/state`)));
  await assertFails(update(ref(third, `rooms/${code}/meta`), { status: 'closed' }));
  await assertFails(set(ref(third, 'rooms/4567'), data()));
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
  await assertSucceeds(set(ref(guest, `rooms/${code}/actions/guest/pending`), action));
  await assertFails(
    set(ref(guest, `rooms/${code}/actions/host/pending`), { ...action, uid: 'host' }),
  );
  await assertFails(
    set(ref(guest, `rooms/${code}/actions/guest/pending`), { ...action, cardId: 'm1-1' }),
  );
  await assertSucceeds(set(ref(host, `rooms/${code}/actions/guest/pending`), null));
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

it('only four digit codes can be created; expired codes can be reclaimed without exposing state', async () => {
  const host = await create();
  await assertFails(set(ref(host, 'rooms/ABC234'), data()));
  await assertFails(set(ref(host, 'rooms/123'), data()));
  const outsider = env.authenticatedContext('third').database();
  await assertFails(set(ref(outsider, `rooms/${code}`), null));
  await env.withSecurityRulesDisabled(async (c) => {
    await set(ref(c.database(), `rooms/${code}/meta/expiresAt`), Date.now() - 1000);
  });
  await assertFails(get(ref(outsider, `rooms/${code}/state`)));
  await assertSucceeds(set(ref(outsider, `rooms/${code}`), null));
  const fresh = data();
  fresh.meta.hostUid = 'third';
  Object.assign(fresh, { players: { third: { name: '방장' } } });
  await set(ref(outsider, 'roomOwners/third'), {
    code,
    createdAt: Date.now(),
    expiresAt: fresh.meta.expiresAt,
  });
  await assertSucceeds(set(ref(outsider, `rooms/${code}`), fresh));
  await assertFails(set(ref(host, `rooms/${code}`), null));
});

it('mailboxes reject fractional sequences, extra data and arbitrary queue keys', async () => {
  const db = await create();
  const value = {
    uid: 'host',
    sequence: 1,
    round: 1,
    stateVersion: 1,
    createdAt: Date.now(),
    action: { type: 'GO', player: 0 },
  };
  for (const bad of [
    { ...value, sequence: 1.5 },
    { ...value, extra: 'x'.repeat(64000) },
    { ...value, action: { ...value.action, extra: true } },
    { ...value, action: { type: 'BOMB', player: 0, month: 13 } },
  ]) {
    await assertFails(set(ref(db, `rooms/${code}/actions/host/pending`), bad));
  }
  await assertFails(set(ref(db, `rooms/${code}/actions/host/arbitrary`), value));
  await assertSucceeds(set(ref(db, `rooms/${code}/actions/host/pending`), value));
  await assertFails(set(ref(db, `rooms/${code}/actions/host/pending`), { ...value, sequence: 3 }));
  await assertSucceeds(
    set(ref(db, `rooms/${code}/actions/host/pending`), { ...value, sequence: 2 }),
  );
});
it('one live room per UID, durable cooldown and reservation ownership', async () => {
  const db = await create();
  const other = data();
  await assertFails(set(ref(db, 'rooms/4567'), other));
  await assertFails(set(ref(db, 'roomOwners/host'), null));
  await assertFails(
    set(ref(db, 'roomOwners/host'), {
      code: '4567',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    }),
  );
  await set(ref(db, `rooms/${code}/meta/status`), 'closed');
  await assertFails(
    set(ref(db, 'roomOwners/host'), {
      code: '4567',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    }),
  );
  await env.withSecurityRulesDisabled(async (c) => {
    await set(ref(c.database(), 'roomOwners/host/createdAt'), Date.now() - 11000);
  });
  const lease = { code: '4567', createdAt: Date.now(), expiresAt: other.meta.expiresAt };
  await assertSucceeds(set(ref(db, 'roomOwners/host'), lease));
  await assertSucceeds(set(ref(db, 'rooms/4567'), other));
});
it('closing a room is terminal so an old room cannot bypass the ownership quota', async () => {
  const db = await create();
  await set(ref(db, `rooms/${code}/meta/status`), 'closed');
  await assertFails(set(ref(db, `rooms/${code}/meta/status`), 'active'));
  await assertFails(set(ref(db, `rooms/${code}/meta/status`), 'waiting'));
});
it('host can remove a malformed legacy action container', async () => {
  const db = await create();
  await env.withSecurityRulesDisabled(async (c) => {
    await set(ref(c.database(), `rooms/${code}/actions/legacy`), 42);
  });
  await assertSucceeds(set(ref(db, `rooms/${code}/actions/legacy`), null));
});
