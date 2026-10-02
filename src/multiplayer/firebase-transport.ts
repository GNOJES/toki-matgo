import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Database,
  type Unsubscribe,
} from 'firebase/database';
import { firebaseClient } from './firebase-client';
import {
  connected,
  decodeState,
  emptyHostState,
  encodeState,
  processRequest,
  ROOM_TTL,
  roomMessage,
  startGame,
} from './host';
import type { Envelope, MultiplayerTransport, Request, RoomData, RoomMessage } from './types';
const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codePattern = /^[A-Z2-9]{6}$/;
export interface Callbacks {
  state: (message: RoomMessage) => void;
  connection: (connected: boolean) => void;
  error: (message: string) => void;
}
export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/permission.denied/i.test(message))
    return '방에 접근할 수 없어요. 방 코드와 참가 정보를 확인해주세요.';
  if (/auth\/(operation-not-allowed|configuration-not-found)/.test(message))
    return '친구와 치기 연결이 아직 준비되지 않았어요.';
  if (/network|disconnect|unavailable|timeout/i.test(message))
    return '연결이 잠시 끊어졌어요. 다시 연결될 때까지 기다려주세요.';
  return message;
}
/** SDK calls live here; the UI and game engine do not know Firebase's data model. */
export class FirebaseTransport implements MultiplayerTransport {
  connected = false;
  private disposed = false;
  private unsubscribers: Unsubscribe[] = [];
  private room: RoomData | null = null;
  private lastRevision = -1;
  private lastRound = 0;
  private lastGameVersion = -1;
  private awaitingAnimation = false;
  private processing = false;
  private again = false;
  private presenceKey = crypto.randomUUID();
  private presenceRegistered = false;
  private presenceGeneration = 0;
  private waiters = new Map<
    number,
    { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  constructor(
    private db: Database,
    readonly uid: string,
    readonly code: string,
    private callbacks: Callbacks,
  ) {}
  static async open(
    callbacks: Callbacks,
    code: string | undefined,
    name: string,
    resume = false,
    client: typeof firebaseClient = firebaseClient,
  ) {
    const { db, uid } = await client();
    const now = Date.now();
    // Delete only this user's previously owned rooms; no global/public room enumeration.
    if (!code) {
      let owned: string[] = [];
      try {
        owned = JSON.parse(localStorage.getItem('toki.firebase.owned.v1') ?? '[]');
      } catch {}
      const removed = new Set<string>();
      for (const oldCode of owned.slice(0, 8)) {
        if (!codePattern.test(oldCode)) continue;
        const meta = (await get(ref(db, `rooms/${oldCode}/meta`))).val() as RoomData['meta'] | null;
        if (!meta) removed.add(oldCode);
        else if (meta.hostUid === uid && (meta.status === 'closed' || meta.expiresAt < now)) {
          await remove(ref(db, `rooms/${oldCode}`));
          removed.add(oldCode);
        }
      }
      for (let attempt = 0; attempt < 8; attempt++) {
        const proposed = Array.from(
          { length: 6 },
          () => alphabet[Math.floor(rng() * alphabet.length)],
        ).join('');
        try {
          const result = await runTransaction(
            ref(db, `rooms/${proposed}`),
            (existing) =>
              existing
                ? undefined
                : {
                    meta: {
                      hostUid: uid,
                      status: 'waiting',
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                      expiresAt: now + ROOM_TTL,
                    },
                    players: { [uid]: { name: name.trim().slice(0, 12) || '친구' } },
                    state: encodeState(emptyHostState()),
                  },
            { applyLocally: false },
          );
          if (result.committed) {
            code = proposed;
            break;
          }
        } catch (error) {
          if (attempt === 7 || !/permission.denied/i.test(String(error))) throw error;
        }
      }
      if (!code) throw Error('방을 만들지 못했어요. 다시 시도해주세요.');
      try {
        localStorage.setItem(
          'toki.firebase.owned.v1',
          JSON.stringify([...owned.filter((c) => c !== code && !removed.has(c)), code]),
        );
      } catch {}
    } else {
      code = code.toUpperCase();
      if (!codePattern.test(code)) throw Error('방 코드 6자리를 확인해주세요.');
      const meta = (await get(ref(db, `rooms/${code}/meta`))).val() as RoomData['meta'] | null;
      if (!meta) throw Error('방을 찾을 수 없어요. 방 코드를 확인해주세요.');
      if (meta.expiresAt < now || meta.status === 'closed')
        throw Error('만료되었거나 종료된 방이에요. 새 방을 만들어주세요.');
      if (meta.hostUid !== uid && meta.guestUid !== uid) {
        if (resume) throw Error('참가 정보가 사라졌어요. 새 방으로 다시 참여해주세요.');
        const result = await runTransaction(
          ref(db, `rooms/${code}/meta/guestUid`),
          (current) => (current && current !== uid ? undefined : uid),
          { applyLocally: false },
        );
        if (!result.committed && result.snapshot.val() !== uid)
          throw Error('방이 가득 찼어요. 두 사람이 이미 참여했어요.');
      }
      await set(ref(db, `rooms/${code}/players/${uid}/name`), name.trim().slice(0, 12) || '친구');
    }
    const transport = new FirebaseTransport(db, uid, code, callbacks);
    transport.listen();
    return transport;
  }
  private path(suffix: string) {
    return ref(this.db, `rooms/${this.code}/${suffix}`);
  }
  private listen() {
    this.unsubscribers.push(
      onValue(
        this.path(''),
        (snap) => {
          if (this.disposed) return;
          const room = snap.val() as RoomData | null;
          if (!room) {
            if (this.room) {
              this.room.meta.status = 'closed';
              this.callbacks.state(roomMessage(this.room, this.code, this.uid, false));
            }
            this.room = null;
            this.callbacks.error('방이 종료되었어요. 대기실로 돌아가 새 방을 만들어주세요.');
            return;
          }
          this.room = room;
          const state = decodeState(room);
          const changed = state.revision !== this.lastRevision;
          const animate =
            this.lastRevision >= 0 &&
            changed &&
            state.round === this.lastRound &&
            state.game?.stateVersion !== this.lastGameVersion;
          if (animate) this.awaitingAnimation = true;
          this.lastRevision = state.revision;
          this.lastRound = state.round;
          this.lastGameVersion = state.game?.stateVersion ?? -1;
          this.callbacks.state(roomMessage(room, this.code, this.uid, animate));
          const player = this.uid === room.meta.hostUid ? 0 : 1;
          for (const [seq, waiter] of this.waiters)
            if (state.processed[player] >= seq) {
              clearTimeout(waiter.timer);
              this.waiters.delete(seq);
              const receipt = state.receipts[player];
              if (receipt.seq === seq && receipt.error) waiter.reject(new Error(receipt.error));
              else waiter.resolve();
            }
          if (!animate && !this.awaitingAnimation && state.game && connected(room, this.uid))
            void this.ready(state.round, state.game.stateVersion).catch((error) =>
              this.callbacks.error(readableError(error)),
            );
          if (room.meta.hostUid === this.uid && room.meta.status !== 'closed') void this.pump();
        },
        (error) => this.callbacks.error(readableError(error)),
      ),
    );
    this.unsubscribers.push(
      onValue(ref(this.db, '.info/connected'), (snap) => {
        if (this.disposed) return;
        this.connected = snap.val() === true;
        this.callbacks.connection(this.connected);
        if (this.connected)
          void this.registerPresence().catch((error) => {
            this.presenceRegistered = false;
            if (!this.disposed && this.room?.meta.status !== 'closed')
              this.callbacks.error(readableError(error));
          });
        else {
          this.presenceRegistered = false;
          this.presenceGeneration++;
        }
      }),
    );
  }
  private async registerPresence() {
    if (this.presenceRegistered || this.disposed) return;
    this.presenceRegistered = true;
    const epoch = ++this.presenceGeneration;
    const presence = this.path(`players/${this.uid}/connections/${this.presenceKey}`);
    await onDisconnect(presence).remove();
    if (this.disposed || epoch !== this.presenceGeneration || this.room?.meta.status === 'closed')
      return;
    await set(presence, true);
  }
  private async pump() {
    if (this.processing) {
      this.again = true;
      return;
    }
    this.processing = true;
    try {
      do {
        this.again = false;
        const room = this.room;
        if (!room || this.disposed || !this.connected || room.meta.status === 'closed') break;
        const state = decodeState(room);
        if (!state.game && room.meta.guestUid && connected(room, room.meta.guestUid)) {
          await runTransaction(
            this.path('state'),
            (value) => {
              if (!value) return;
              const old = JSON.parse(value.data);
              if (old.game) return;
              return encodeState(startGame(old, rng));
            },
            { applyLocally: false },
          );
          await update(this.path('meta'), { status: 'active', updatedAt: serverTimestamp() });
        } else if (state.game) {
          const requests = Object.values(room.actions ?? {})
            .flatMap((actions) => Object.values(actions))
            .sort((a, b) => a.createdAt - b.createdAt || a.sequence - b.sequence);
          for (const request of requests) {
            const player = request.uid === room.meta.hostUid ? 0 : 1;
            if (request.sequence <= state.processed[player]) continue;
            await runTransaction(
              this.path('state'),
              (value) => {
                if (!value) return;
                const old = JSON.parse(value.data);
                const next = processRequest(old, room, request, rng);
                return next === old ? undefined : encodeState(next);
              },
              { applyLocally: false },
            );
          }
          // Bound processed action storage; keep the last receipt/action for retries.
          const latest = this.room ? decodeState(this.room) : state;
          const prune: Record<string, null> = {};
          for (const [uid, actions] of Object.entries(room.actions ?? {}))
            for (const [key, action] of Object.entries(actions)) {
              const player = uid === room.meta.hostUid ? 0 : 1;
              if (action.sequence < latest.processed[player]) prune[`actions/${uid}/${key}`] = null;
            }
          if (Object.keys(prune).length) await update(this.path(''), prune);
        }
      } while (this.again && !this.disposed);
    } catch (error) {
      if (!this.disposed && this.connected && !/disconnect/i.test(String(error)))
        this.callbacks.error(readableError(error));
    } finally {
      this.processing = false;
    }
  }
  async ready(round: number, version: number) {
    if (this.disposed || !this.connected || this.room?.meta.status === 'closed') return;
    const state = this.room ? decodeState(this.room) : null;
    if (state?.round === round && state.game?.stateVersion === version)
      this.awaitingAnimation = false;
    const current = this.room?.players?.[this.uid]?.ready;
    if (current?.round === round && current.version === version) return;
    await set(this.path(`players/${this.uid}/ready`), { round, version });
  }
  async action(envelope: Envelope) {
    if (this.disposed || !this.connected) throw Error('연결 복구를 기다려주세요.');
    if (this.waiters.size) throw Error('이전 패 이동을 기다려주세요.');
    const room = this.room;
    if (!room) throw Error('방에 다시 연결해주세요.');
    const player = room.meta.hostUid === this.uid ? 0 : 1;
    const state = decodeState(room);
    const request: Request = { ...envelope, uid: this.uid, createdAt: Date.now() };
    if (request.sequence <= state.processed[player]) return;
    const result = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(request.sequence);
        reject(new Error('응답을 기다리는 중이에요. 방장의 연결을 확인해주세요.'));
      }, 20000);
      this.waiters.set(request.sequence, { resolve, reject, timer });
    });
    // Attach immediately: a receipt can arrive before the write acknowledgment.
    void result.catch(() => {});
    // A request identity can be written only once. Retries use its original record.
    const location = this.path(`actions/${this.uid}/${String(request.sequence).padStart(10, '0')}`);
    try {
      await runTransaction(location, (existing) => (existing ? undefined : request), {
        applyLocally: false,
      });
    } catch (error) {
      const waiter = this.waiters.get(request.sequence);
      if (waiter) {
        clearTimeout(waiter.timer);
        this.waiters.delete(request.sequence);
        waiter.reject(new Error(readableError(error)));
      }
    }
    return result;
  }
  nextRound(round: number, stateVersion: number, sequence: number) {
    return this.action({ round, stateVersion, sequence, action: { type: 'NEXT_ROUND' } });
  }
  async leave() {
    await update(this.path('meta'), { status: 'closed', updatedAt: serverTimestamp() });
    await remove(ref(this.db, `rooms/${this.code}`));
    this.dispose();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.presenceGeneration++;
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    if (this.presenceRegistered && this.room && this.room.meta.status !== 'closed')
      void remove(this.path(`players/${this.uid}/connections/${this.presenceKey}`)).catch(() => {});
    for (const waiter of this.waiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('방에서 나왔어요.'));
    }
    this.waiters.clear();
  }
}
