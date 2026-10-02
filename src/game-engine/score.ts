import { piValue } from './cards';
import type { PlayerState, ScoreResult } from './types';
export function calculateScore(
  player: PlayerState,
  opponent?: PlayerState,
  context: { lastGo?: number | null; nagariMultiplier?: number; playerId?: number } = {},
): ScoreResult {
  const c = player.captured;
  const gwang = c.filter((x) => x.isGwang).length;
  const yeol = c.filter((x) => x.isYeol && !(x.specialType === 'KUKJIN' && player.kukjinAsPi));
  const ribbons = c.filter((x) => x.isTti);
  const countPi = c.reduce((n, x) => n + piValue(x, player.kukjinAsPi), 0);
  const trio = (kind: string) =>
    ribbons.filter((x) => x.ribbonType === kind).length === 3 ? 3 : 0;
  const gwangScore =
    gwang === 5
      ? 15
      : gwang === 4
        ? 4
        : gwang === 3
          ? c.some((x) => x.specialType === 'RAIN')
            ? 2
            : 3
          : 0;
  const yeolScore = Math.max(0, yeol.length - 4),
    godoriScore = yeol.filter((x) => x.isGodori).length === 3 ? 5 : 0;
  const ribbonScore = Math.max(0, ribbons.length - 4),
    hongdanScore = trio('HONGDAN'),
    cheongdanScore = trio('CHEONGDAN'),
    chodanScore = trio('CHODAN');
  const piScore = Math.max(0, countPi - 9);
  const baseScore =
    gwangScore +
    yeolScore +
    godoriScore +
    ribbonScore +
    hongdanScore +
    cheongdanScore +
    chodanScore +
    piScore;
  const goBonus = Math.min(player.goCount, 2),
    goMultiplier = 2 ** Math.max(0, player.goCount - 2),
    shakeMultiplier = 2 ** (player.shakes.length + player.bombs);
  const pibakMultiplier =
    opponent &&
    piScore > 0 &&
    opponent.captured.reduce((n, x) => n + piValue(x, opponent.kukjinAsPi), 0) <= 7
      ? 2
      : 1;
  const gwangbakMultiplier =
    opponent && gwangScore > 0 && !opponent.captured.some((x) => x.isGwang) ? 2 : 1;
  const meongttaMultiplier = yeol.length >= 7 ? 2 : 1;
  const gobakMultiplier =
    opponent && context.lastGo != null && context.lastGo !== context.playerId ? 2 : 1;
  const nagariMultiplier = context.nagariMultiplier ?? 1;
  const finalScore =
    (baseScore + goBonus) *
    goMultiplier *
    shakeMultiplier *
    pibakMultiplier *
    gwangbakMultiplier *
    meongttaMultiplier *
    gobakMultiplier *
    nagariMultiplier;
  return {
    gwangScore,
    yeolScore,
    godoriScore,
    ribbonScore,
    hongdanScore,
    cheongdanScore,
    chodanScore,
    piScore,
    piCount: countPi,
    yeolCount: yeol.length,
    baseScore,
    goBonus,
    goMultiplier,
    shakeMultiplier,
    pibakMultiplier,
    gwangbakMultiplier,
    meongttaMultiplier,
    gobakMultiplier,
    nagariMultiplier,
    finalScore,
  };
}
