import { it, expect } from 'vitest';
import {
  emptyHistory,
  addResult,
  parseHistory,
  resetSolo,
  soloStats,
} from '../src/lib/play-history';
import type { GameResult } from '../src/game-engine/types';
const result: GameResult = {
  winner: 0,
  reason: 'STOP',
  points: 7,
  sidePoints: [2, 3],
  score: null,
};
const single = {
  id: 'a',
  mode: 'single' as const,
  me: 0 as const,
  opponent: '토끼',
  result,
  at: 1000,
};

it('counts wins, losses, draws and both instant scores across persisted sessions', () => {
  let h = addResult(emptyHistory(), single);
  h = parseHistory(JSON.stringify(h));
  h = addResult(h, { ...single, id: 'b', result: { ...result, winner: 1 } });
  h = addResult(h, {
    ...single,
    id: 'c',
    result: { ...result, winner: null, points: 0, reason: 'NAGARI' },
  });
  expect(h.solo).toEqual({ wins: 1, losses: 1, draws: 1, points: 13, opponentPoints: 16 });
  expect(soloStats(h)).toEqual({ wins: [1, 1], points: [13, 16] });
  expect(addResult(h, single)).toBe(h);
});
it('keeps cumulative totals beyond 100 recent rounds', () => {
  let h = emptyHistory();
  for (let i = 0; i < 130; i++) h = addResult(h, { ...single, id: String(i) });
  expect(h.recent).toHaveLength(100);
  expect(h.recent[0].id).toBe('129');
  expect(h.solo.wins).toBe(130);
  expect(h.solo.points).toBe(1170);
});
it('records friends from the local player perspective without changing solo totals and preserves them on reset', () => {
  const solo = addResult(emptyHistory(), single);
  const h = addResult(solo, { ...single, id: 'friend', mode: 'multi', me: 1, opponent: '친구' });
  expect(h.recent[0].outcome).toBe('loss');
  expect(h.solo).toEqual(solo.solo);
  const cleared = resetSolo(h);
  expect(cleared.solo).toEqual(emptyHistory().solo);
  expect(cleared.recent.map((r) => r.id)).toEqual(['friend']);
});
it('recovers from missing or corrupt browser storage and invalid dates', () => {
  for (const raw of [null, '{', '{}', JSON.stringify({ solo: { wins: -1 }, recent: [] })])
    expect(parseHistory(raw)).toEqual(emptyHistory());
  const h = addResult(emptyHistory(), { ...single, at: Number.MAX_SAFE_INTEGER });
  expect(parseHistory(JSON.stringify(h)).recent).toHaveLength(0);
});
