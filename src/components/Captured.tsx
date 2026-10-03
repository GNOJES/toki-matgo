import { Card } from './Card';
import { piValue } from '../game-engine/cards';
import type { Card as HwatuCard, PlayerView, ScoreResult } from '../game-engine/types';
export function Captured({
  player,
  score,
  onZoom,
  hiddenIds = [],
}: {
  player: PlayerView;
  score: ScoreResult;
  onZoom: (cards: HwatuCard[], title: string, captured?: boolean) => void;
  hiddenIds?: string[];
}) {
  const groups = [
    { name: '광', points: score.gwangScore, cards: player.captured.filter((c) => c.isGwang) },
    {
      name: '열끗',
      points: score.yeolScore + score.godoriScore,
      cards: player.captured.filter(
        (c) => c.isYeol && !(c.specialType === 'KUKJIN' && player.kukjinAsPi),
      ),
    },
    {
      name: '띠',
      points: score.ribbonScore + score.hongdanScore + score.cheongdanScore + score.chodanScore,
      cards: player.captured.filter((c) => c.isTti),
    },
    {
      name: '피',
      points: score.piScore,
      cards: player.captured.filter((c) => piValue(c, player.kukjinAsPi) > 0),
    },
  ];
  return (
    <div className="captured" data-testid="captured">
      {groups.map((g) => (
        <button
          key={g.name}
          className="captured-group"
          onClick={() => onZoom(g.cards, `먹은 ${g.name} (현재 ${g.points}점)`, true)}
          aria-label={`먹은 ${g.name} ${g.cards.length}장 확대`}
        >
          <span className="group-title">
            {g.name}
            <small>
              {g.name === '피'
                ? g.cards.reduce((n, c) => n + piValue(c, player.kukjinAsPi), 0)
                : g.cards.length}
            </small>
          </span>
          <span className="mini-stack">
            {g.cards.length ? (
              g.cards.map((c, i) => (
                <span
                  key={c.id}
                  data-captured-card-id={c.id}
                  style={{
                    visibility: hiddenIds.includes(c.id) ? 'hidden' : undefined,
                    left: `${(i / Math.max(1, g.cards.length - 1)) * Math.min(48, g.cards.length * 8)}%`,
                  }}
                >
                  <Card card={c} />
                </span>
              ))
            ) : (
              <span className="empty-slot" />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
