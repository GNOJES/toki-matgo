import { isRequest } from './requests';
import { applyAction, createGame, projectState } from '../game-engine/engine';
import type { PlayerId } from '../game-engine/types';
import type { HostState, RoomData, RoomMessage, Request } from './types';
export const ROOM_TTL = 24 * 60 * 60 * 1000;
export const emptyHostState = (): HostState => ({
  revision: 0,
  round: 0,
  game: null,
  events: [],
  stats: { wins: [0, 0], points: [0, 0] },
  processed: [0, 0],
  nextReady: [false, false],
  receipts: [{ seq: 0 }, { seq: 0 }],
  settledVersion: null,
});
export function decodeState(room: RoomData): HostState {
  return JSON.parse(room.state.data);
}
export function encodeState(state: HostState) {
  return { version: state.revision, data: JSON.stringify(state) };
}
export const connected = (room: RoomData, uid?: string): boolean =>
  !!uid && Object.values(room.players?.[uid]?.connections ?? {}).some(Boolean);
export function readyToAct(room: RoomData, state: HostState): boolean {
  return (
    !!state.game &&
    [room.meta.hostUid, room.meta.guestUid].every(
      (uid) =>
        !!uid &&
        connected(room, uid) &&
        room.players?.[uid]?.ready?.round === state.round &&
        room.players?.[uid]?.ready?.version === state.game!.stateVersion,
    )
  );
}
function settle(state: HostState) {
  const game = state.game;
  if (!game?.result || state.settledVersion === game.stateVersion) return;
  const result = game.result;
  if (result.winner !== null) {
    state.stats.wins[result.winner]++;
    state.stats.points[result.winner] += result.points;
  }
  state.stats.points[0] += result.sidePoints[0];
  state.stats.points[1] += result.sidePoints[1];
  state.settledVersion = game.stateVersion;
}
/** Only the host calls this. Transactions may retry; the committed state is the sole result. */
export function startGame(state: HostState, rng: () => number): HostState {
  if (state.game) return state;
  const next = structuredClone(state);
  next.game = createGame({ rng });
  next.round = 1;
  next.revision++;
  next.events = [];
  settle(next);
  return next;
}
export function processRequest(
  state: HostState,
  room: RoomData,
  request: Request,
  rng: () => number,
): HostState {
  const player: PlayerId = request.uid === room.meta.hostUid ? 0 : 1;
  if (request.uid !== room.meta.hostUid && request.uid !== room.meta.guestUid)
    throw Error('참가 정보가 맞지 않아요.');
  if (!Number.isSafeInteger(request.sequence) || request.sequence < 1)
    throw Error('잘못된 요청이에요.');
  if (request.sequence <= state.processed[player]) return state;
  if (request.sequence !== state.processed[player] + 1) return state; // Never skip an unprocessed request.
  const next = structuredClone(state);
  next.revision++;
  next.events = [];
  next.processed[player] = request.sequence;
  next.receipts[player] = { seq: request.sequence };
  try {
    if (!isRequest(request)) throw Error('잘못된 요청이에요.');
    if (room.meta.status === 'closed' || room.meta.expiresAt <= Date.now())
      throw Error('종료된 방이에요. 새 방을 만들어주세요.');
    if (!next.game || request.round !== next.round) throw Error('현재 판에서 다시 선택해주세요.');
    if (request.stateVersion !== next.game.stateVersion)
      throw Error('화면이 바뀌었어요. 다시 선택해주세요.');
    if (!connected(room, room.meta.hostUid) || !connected(room, room.meta.guestUid))
      throw Error('친구의 연결을 기다려주세요.');
    if (request.action.type === 'NEXT_ROUND') {
      if (next.game.phase !== 'FINISHED') throw Error('판이 끝난 뒤 다시 칠 수 있어요.');
      next.nextReady[player] = true;
      if (next.nextReady.every(Boolean)) {
        const previous = next.game;
        next.game = createGame({
          rng,
          dealer: previous.result?.winner ?? previous.dealer,
          nagariMultiplier: previous.result?.winner === null ? 2 : 1,
        });
        next.round++;
        next.nextReady = [false, false];
        next.settledVersion = null;
      }
    } else {
      if (!readyToAct(room, state)) throw Error('패 이동을 마칠 때까지 기다려주세요.');
      const result = applyAction(next.game, { ...request.action, player });
      next.game = result.nextState;
      next.events = result.events;
    }
    settle(next);
  } catch (error) {
    next.receipts[player].error = error instanceof Error ? error.message : '다시 선택해주세요.';
  }
  return next;
}
export function roomMessage(
  room: RoomData,
  code: string,
  uid: string,
  events: boolean,
): RoomMessage {
  const state = decodeState(room),
    me: PlayerId = uid === room.meta.hostUid ? 0 : 1;
  return {
    code,
    me,
    nickname: room.players?.[uid]?.name ?? (me === 0 ? '방장' : '참가자'),
    names: [
      room.players?.[room.meta.hostUid]?.name ?? '방장',
      room.players?.[room.meta.guestUid ?? '']?.name ?? '참가자',
    ],
    connected: [connected(room, room.meta.hostUid), connected(room, room.meta.guestUid)],
    round: state.round,
    stats: state.stats,
    nextReady: state.nextReady,
    actionSequence: state.processed[me],
    canAct:
      room.meta.status !== 'closed' && room.meta.expiresAt > Date.now() && readyToAct(room, state),
    game: state.game ? projectState(state.game, me) : null,
    events: events ? state.events : [],
    revision: state.revision,
    closed: room.meta.status === 'closed' || room.meta.expiresAt <= Date.now(),
    expiresAt: room.meta.expiresAt,
  };
}
