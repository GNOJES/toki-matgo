import type { GameResult, PlayerId } from '../game-engine/types';
import type { Stats } from '../multiplayer/types';

export const HISTORY_KEY = 'toki.play-history.v1';
export interface PlayRecord {
  id: string;
  at: number;
  mode: 'single' | 'multi';
  opponent: string;
  outcome: 'win' | 'loss' | 'draw';
  points: number;
  reason: GameResult['reason'];
}
export interface PlayHistory {
  solo: { wins: number; losses: number; draws: number; points: number; opponentPoints: number };
  recent: PlayRecord[];
}
export const emptyHistory = (): PlayHistory => ({
  solo: { wins: 0, losses: 0, draws: 0, points: 0, opponentPoints: 0 },
  recent: [],
});
const count = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
export function parseHistory(raw: string | null): PlayHistory {
  try {
    const h = JSON.parse(raw ?? 'null');
    if (
      !h?.solo ||
      !['wins', 'losses', 'draws', 'points', 'opponentPoints'].every((key) => count(h.solo[key])) ||
      !Array.isArray(h.recent)
    )
      return emptyHistory();
    const recent = h.recent
      .filter(
        (r: PlayRecord) =>
          r &&
          typeof r.id === 'string' &&
          count(r.at) &&
          r.at <= 8640000000000000 &&
          ['single', 'multi'].includes(r.mode) &&
          typeof r.opponent === 'string' &&
          ['win', 'loss', 'draw'].includes(r.outcome) &&
          count(r.points) &&
          ['STOP', 'NAGARI', 'CHONGTONG', 'THREE_PPUK', 'HEODANG'].includes(r.reason),
      )
      .slice(0, 100);
    return { solo: h.solo, recent };
  } catch {
    return emptyHistory();
  }
}
export function addResult(
  history: PlayHistory,
  input: {
    id: string;
    mode: PlayRecord['mode'];
    opponent: string;
    me: PlayerId;
    result: GameResult;
    at?: number;
  },
): PlayHistory {
  if (history.recent.some((r) => r.id === input.id)) return history;
  const { result: r, me } = input;
  const outcome: PlayRecord['outcome'] =
    r.winner === null ? 'draw' : r.winner === me ? 'win' : 'loss';
  const solo = { ...history.solo };
  if (input.mode === 'single') {
    solo[outcome === 'win' ? 'wins' : outcome === 'loss' ? 'losses' : 'draws']++;
    solo.points += r.sidePoints[me] + (r.winner === me ? r.points : 0);
    solo.opponentPoints += r.sidePoints[1 - me] + (r.winner === 1 - me ? r.points : 0);
  }
  return {
    solo,
    recent: [
      {
        id: input.id,
        at: input.at ?? Date.now(),
        mode: input.mode,
        opponent: input.opponent,
        outcome,
        points: r.points,
        reason: r.reason,
      },
      ...history.recent,
    ].slice(0, 100),
  };
}
export const soloStats = (h: PlayHistory): Stats => ({
  wins: [h.solo.wins, h.solo.losses],
  points: [h.solo.points, h.solo.opponentPoints],
});
export const resetSolo = (h: PlayHistory): PlayHistory => ({
  solo: emptyHistory().solo,
  recent: h.recent.filter((r) => r.mode !== 'single'),
});
