import { randomBytes } from 'node:crypto';
import { applyAction, createGame, projectState } from '../src/game-engine/engine';
import type {
  GameAction,
  GameEvent,
  GameState,
  GameView,
  PlayerId,
} from '../src/game-engine/types';
export interface Session {
  token: string;
  nickname: string;
  socketId: string | null;
  sequence: number;
  readyVersion: number;
}
export interface Stats {
  wins: [number, number];
  points: [number, number];
}
export interface Room {
  code: string;
  sessions: [Session | null, Session | null];
  game: GameState | null;
  round: number;
  stats: Stats;
  nextReady: boolean[];
  settledVersion: number | null;
  touchedAt: number;
}
export interface RoomStore {
  get(code: string): Room | undefined;
  set(room: Room): void;
  delete(code: string): void;
  values(): Iterable<Room>;
}
export class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();
  get(code: string) {
    return this.rooms.get(code);
  }
  set(room: Room) {
    this.rooms.set(room.code, room);
  }
  delete(code: string) {
    this.rooms.delete(code);
  }
  values() {
    return this.rooms.values();
  }
}
export interface RoomSnapshot {
  code: string;
  me: PlayerId;
  nickname: string;
  names: [string, string];
  connected: [boolean, boolean];
  game: GameView | null;
  round: number;
  stats: Stats;
  nextReady: boolean[];
  actionSequence: number;
  canAct: boolean;
}
export interface Envelope {
  round: number;
  sequence: number;
  stateVersion: number;
  action: Omit<GameAction, 'player'> & { player?: PlayerId };
}
const random = () => randomBytes(4).readUInt32LE() / 0x100000000;
function session(nickname: string, socketId: string): Session {
  return {
    token: randomBytes(32).toString('hex'),
    nickname: nickname.trim().slice(0, 12) || '친구',
    socketId,
    sequence: 0,
    readyVersion: 0,
  };
}
export class RoomService {
  constructor(readonly store: RoomStore = new MemoryRoomStore()) {}
  create(nickname: string, socketId: string) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join(
        '',
      );
    } while (this.store.get(code));
    const room: Room = {
      code,
      sessions: [session(nickname, socketId), null],
      game: null,
      round: 0,
      stats: { wins: [0, 0], points: [0, 0] },
      nextReady: [false, false],
      settledVersion: null,
      touchedAt: Date.now(),
    };
    this.store.set(room);
    return { room, player: 0 as PlayerId, token: room.sessions[0]!.token };
  }
  join(code: string, nickname: string, socketId: string, token?: string) {
    const room = this.store.get(code.toUpperCase());
    if (!room) throw Error('방이 없거나 만료되었어요. 새 방을 만들어주세요.');
    if (token) {
      const id = room.sessions.findIndex((s) => s?.token === token);
      if (id < 0) throw Error('이 방의 참가 정보가 아니에요.');
      const player = id as PlayerId;
      const previousSocket = room.sessions[player]!.socketId;
      room.sessions[player]!.socketId = socketId;
      room.sessions[player]!.readyVersion = room.game?.stateVersion ?? 0;
      room.touchedAt = Date.now();
      return { room, player, token, previousSocket };
    }
    if (room.sessions[1]) throw Error('두 사람이 이미 참여한 방이에요.');
    room.sessions[1] = session(nickname, socketId);
    room.game = createGame({ rng: random });
    room.round = 1;
    this.settle(room);
    return { room, player: 1 as PlayerId, token: room.sessions[1].token, previousSocket: null };
  }
  snapshot(room: Room, player: PlayerId): RoomSnapshot {
    return {
      code: room.code,
      me: player,
      nickname: room.sessions[player]!.nickname,
      names: room.sessions.map((s) => s?.nickname ?? '친구') as [string, string],
      connected: room.sessions.map((s) => !!s?.socketId) as [boolean, boolean],
      game: room.game ? projectState(room.game, player) : null,
      round: room.round,
      stats: room.stats,
      nextReady: room.nextReady,
      actionSequence: room.sessions[player]!.sequence,
      canAct:
        !!room.game &&
        room.sessions.every((s) => !!s?.socketId && s.readyVersion >= room.game!.stateVersion),
    };
  }
  action(room: Room, player: PlayerId, envelope: Envelope): GameEvent[] {
    const own = room.sessions[player]!;
    if (envelope.round !== room.round)
      throw Error('이전 판의 요청이에요. 현재 판에서 다시 선택해주세요.');
    if (!room.game) throw Error('친구가 들어오면 시작해요.');
    if (!Number.isSafeInteger(envelope.sequence) || envelope.sequence < 1)
      throw Error('잘못된 요청 번호입니다.');
    if (envelope.sequence === own.sequence) return [];
    if (envelope.sequence !== own.sequence + 1)
      throw Error('이미 처리했거나 순서가 맞지 않는 요청이에요.');
    if (envelope.stateVersion !== room.game.stateVersion)
      throw Error('화면이 갱신되었어요. 다시 선택해주세요.');
    if (!room.sessions.every((s) => s?.socketId)) throw Error('상대방 연결을 기다리는 중');
    if (!this.snapshot(room, player).canAct) throw Error('패 이동을 마칠 때까지 기다려주세요.');
    const result = applyAction(room.game, { ...envelope.action, player } as GameAction);
    room.game = result.nextState;
    own.sequence = envelope.sequence;
    room.touchedAt = Date.now();
    this.settle(room);
    return result.events;
  }
  ready(room: Room, player: PlayerId, version: number) {
    if (room.game && version === room.game.stateVersion)
      room.sessions[player]!.readyVersion = version;
  }
  nextRound(room: Room, player: PlayerId) {
    if (room.game?.phase !== 'FINISHED') throw Error('판이 끝난 뒤 다시 칠 수 있어요.');
    room.nextReady[player] = true;
    if (room.nextReady.every(Boolean)) {
      const previous = room.game;
      room.game = createGame({
        rng: random,
        dealer: previous.result?.winner ?? previous.dealer,
        nagariMultiplier: previous.result?.winner === null ? 2 : 1,
      });
      room.round++;
      room.nextReady = [false, false];
      room.settledVersion = null;
      room.sessions.forEach((s) => {
        if (s) {
          s.sequence = 0;
          s.readyVersion = 0;
        }
      });
      this.settle(room);
    }
    room.touchedAt = Date.now();
  }
  disconnect(room: Room, player: PlayerId, socketId: string) {
    const s = room.sessions[player];
    if (s?.socketId === socketId) s.socketId = null;
    room.touchedAt = Date.now();
  }
  settle(room: Room) {
    if (room.game?.result && room.settledVersion !== room.game.stateVersion) {
      room.settledVersion = room.game.stateVersion;
      const r = room.game.result;
      if (r.winner !== null) {
        room.stats.wins[r.winner]++;
        room.stats.points[r.winner] += r.points;
      }
      room.stats.points[0] += r.sidePoints[0];
      room.stats.points[1] += r.sidePoints[1];
    }
  }
  cleanup(now = Date.now()) {
    for (const room of this.store.values())
      if (room.sessions.every((s) => !s?.socketId) && now - room.touchedAt > 30 * 60 * 1000)
        this.store.delete(room.code);
  }
}
