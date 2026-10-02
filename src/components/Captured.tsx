import { Card } from './Card';
import { piValue } from '../game-engine/cards';
import type { Card as HwatuCard, PlayerView } from '../game-engine/types';
export function Captured({
  player,
  onZoom,
}: {
  player: PlayerView;
  onZoom: (cards: HwatuCard[], title: string) => void;
}) {
  const groups = [
    { name: '광', cards: player.captured.filter((c) => c.isGwang) },
    {
      name: '열끗',
      cards: player.captured.filter(
        (c) => c.isYeol && !(c.specialType === 'KUKJIN' && player.kukjinAsPi),
      ),
    },
    { name: '띠', cards: player.captured.filter((c) => c.isTti) },
    { name: '피', cards: player.captured.filter((c) => piValue(c, player.kukjinAsPi) > 0) },
  ];
  return (
    <div className="captured" data-testid="captured">
      {groups.map((g) => (
        <button
          key={g.name}
          className="captured-group"
          onClick={() => onZoom(g.cards, `먹은 ${g.name}`)}
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
                  style={{
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
