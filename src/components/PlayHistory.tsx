import { useState } from 'react';
import { Modal } from './Modal';
import type { PlayHistory as History } from '../lib/play-history';

const reasons = {
  STOP: '스톱',
  NAGARI: '나가리',
  CHONGTONG: '총통',
  THREE_PPUK: '3뻑',
  HEODANG: '허당',
};
export function PlayHistory({
  history,
  onClose,
  onReset,
}: {
  history: History;
  onClose: () => void;
  onReset: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const { solo } = history;
  const rounds = solo.wins + solo.losses + solo.draws;
  return (
    <>
      <Modal title="최근 기록" onClose={onClose} className="history-modal">
        <section className="history-summary" aria-label="혼자 치기 누적 기록">
          <h3>혼자 치기 누적 기록</h3>
          <p>
            <strong>
              {solo.wins}승 {solo.losses}패 {solo.draws}무
            </strong>
            <span>
              총 {rounds}판 · 누적 {solo.points}점
            </span>
          </p>
          <button className="secondary" disabled={!rounds} onClick={() => setConfirm(true)}>
            혼자 치기 기록 초기화
          </button>
        </section>
        <p className="fine-print">
          이 브라우저에 저장됩니다. 누적 기록은 계속 유지하고, 최근 판은 100개까지 보여드려요.
        </p>
        {history.recent.length ? (
          <ol className="history-list">
            {history.recent.map((r) => (
              <li key={r.id}>
                <div>
                  <strong className={`history-outcome ${r.outcome}`}>
                    {r.outcome === 'win' ? '승리' : r.outcome === 'loss' ? '패배' : '무승부'}
                  </strong>
                  <span>
                    {r.mode === 'single' ? '혼자 치기' : '친구와 치기'} · {r.opponent}
                  </span>
                </div>
                <div>
                  <span>
                    {reasons[r.reason]} · {r.points}점
                  </span>
                  <time dateTime={new Date(r.at).toISOString()}>
                    {new Date(r.at).toLocaleString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="history-empty">아직 끝낸 판이 없어요. 한 판 즐기고 기록을 남겨보세요.</p>
        )}
      </Modal>
      {confirm && (
        <Modal title="혼자 치기 기록을 초기화할까요?" onClose={() => setConfirm(false)}>
          <p>
            혼자 치기의 누적 승패·점수와 최근 기록을 모두 지웁니다. 친구와 치기 기록은 유지됩니다.
          </p>
          <button
            className="primary"
            onClick={() => {
              onReset();
              setConfirm(false);
            }}
          >
            기록 초기화
          </button>
          <button className="secondary" onClick={() => setConfirm(false)}>
            취소
          </button>
        </Modal>
      )}
    </>
  );
}
