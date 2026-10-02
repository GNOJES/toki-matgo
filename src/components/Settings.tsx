import { Modal } from './Modal';
import type { Preferences } from '../lib/preferences';
export function Settings({
  prefs,
  onChange,
  onClose,
  onRules,
}: {
  prefs: Preferences;
  onChange: (p: Preferences) => void;
  onClose: () => void;
  onRules: () => void;
}) {
  return (
    <Modal title="편안하게, 내 속도로" onClose={onClose}>
      <p className="muted">패를 보고 생각할 시간은 언제나 충분해요.</p>
      <fieldset>
        <legend>패를 치는 속도</legend>
        <div className="segmented">
          {(
            [
              ['physical', '실제패 느낌'],
              ['normal', '보통'],
              ['fast', '빠르게'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              aria-pressed={prefs.speed === v}
              onClick={() => onChange({ ...prefs, speed: v })}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>혼자 칠 때 상대 난이도</legend>
        <div className="segmented">
          {(
            [
              ['easy', '쉬움'],
              ['normal', '보통'],
              ['hard', '어려움'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              aria-pressed={prefs.difficulty === v}
              onClick={() => onChange({ ...prefs, difficulty: v })}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="toggle-row">
        패 부딪히는 소리
        <input
          type="checkbox"
          checked={prefs.sound}
          onChange={(e) => onChange({ ...prefs, sound: e.target.checked })}
        />
      </label>
      <label className="toggle-row">
        가벼운 진동
        <input
          type="checkbox"
          checked={prefs.haptic}
          onChange={(e) => onChange({ ...prefs, haptic: e.target.checked })}
        />
      </label>
      <p className="fine-print">진동은 지원되는 기기에서 작동해요.</p>
      <button className="secondary" onClick={onRules}>
        맞고 안내
      </button>
      <p className="fine-print">
        화투 그림:{' '}
        <a href="https://www.marcusrichert.com/images/hwatu/" target="_blank" rel="noreferrer">
          Marcus Richert
        </a>
        {' · '}원작 Louie Mantia, Jr.
        <br />
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        {' · '}
        <a href="/cards/LICENSE.txt" target="_blank" rel="noreferrer">
          출처·이용 안내
        </a>
      </p>
      <button className="primary" onClick={onClose}>
        이대로 좋아요
      </button>
    </Modal>
  );
}
