import type { ScoreResult } from '../game-engine/types';

export function GoStopDecision({
  score,
  goCount,
  onGo,
  onStop,
}: {
  score: ScoreResult;
  goCount: number;
  onGo: () => void;
  onStop: () => void;
}) {
  const multipliers = [
    score.pibakMultiplier > 1 ? '피박 ×2' : '',
    score.gwangbakMultiplier > 1 ? '광박 ×2' : '',
    score.meongttaMultiplier > 1 ? '멍따 ×2' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <section className="go-stop-decision" aria-label="고·스톱 결정">
      <div className="go-stop-summary" title={multipliers}>
        <strong>
          {score.baseScore}점 · {goCount}고
        </strong>
        <span>스톱하면 {score.finalScore}점</span>
        {multipliers && <small>{multipliers}</small>}
      </div>
      <button className="secondary" aria-label="고 조금 더 이어가요" onClick={onGo}>
        고<small className="sr-only">조금 더 이어가요</small>
      </button>
      <button className="primary" aria-label="스톱 이번 판을 마쳐요" onClick={onStop}>
        스톱<small className="sr-only">이번 판을 마쳐요</small>
      </button>
    </section>
  );
}
