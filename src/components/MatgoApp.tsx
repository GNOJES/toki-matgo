'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import QRCode from 'qrcode';
import { registerPwa } from '../lib/register-pwa';
import { cardFlight, type FlightGeometry } from '../lib/card-motion';
import { syncFloorLayout, FLOOR_PLACES, type FloorLayout } from '../lib/floor-layout';
import { useAppBack } from '../lib/use-app-back';
import { Card } from './Card';
import { RabbitMark } from './RabbitMark';
import { Modal } from './Modal';
import { Settings } from './Settings';
import { Captured } from './Captured';
import { BombPassCard } from './BombPassCard';
import { PlayHistory } from './PlayHistory';
import {
  HISTORY_KEY,
  emptyHistory,
  parseHistory,
  addResult,
  soloStats,
  resetSolo,
  type PlayHistory as History,
} from '../lib/play-history';
import { CARDS } from '../game-engine/cards';
import { applyAction, createGame, projectState } from '../game-engine/engine';
import { chooseAction } from '../game-engine/ai';
import { calculateScore } from '../game-engine/score';
import {
  DEFAULT_PREFS,
  readPreferences,
  savePreferences,
  unlockAudio,
  feedback,
  type Preferences,
} from '../lib/preferences';
import type {
  Card as HwatuCard,
  GameAction,
  GameEvent,
  GameState,
  GameView,
  PlayerId,
} from '../game-engine/types';
import type { MultiplayerTransport, RoomMessage, Stats } from '../multiplayer/types';
interface SavedRoom {
  code: string;
  uid: string;
}
const eventLabel: Record<string, string> = {
  CARD_PLAYED: '패를 내려놓아요',
  FLOOR_MATCHED: '같은 무늬를 만났어요',
  DECK_CARD_REVEALED: '뒤집은 패를 확인해요',
  CARDS_CAPTURED: '패를 걷어와요',
  PI_TRANSFERRED: '상대 피를 가져와요',
  SCORE_CHANGED: '점수를 확인해요',
  TURN_ENDED: '다음 차례',
  FLOOR_MATCH_REQUIRED: '먹을 바닥패를 골라주세요',
};
const effectDetails: Record<string, string> = {
  BOMB: '세 장을 한 번에!',
  SWEEP: '바닥패를 모두 획득!',
  JJOK: '뒤집은 패까지 한 쌍!',
  TTADAK: '같은 월 네 장 획득!',
  PPUK_OCCURRED: '세 장이 바닥에 남아요',
  SHAKE: '승리하면 점수 두 배!',
};
const emptyStats: Stats = { wins: [0, 0], points: [0, 0] };
function storeItem(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}
function getItem(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function MatgoApp() {
  const [screen, setScreen] = useState<'home' | 'friends' | 'lobby' | 'game'>('home');
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const [nickname, setNickname] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [room, setRoom] = useState<RoomMessage | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const viewRef = useRef<GameView | null>(null);
  const logical = useRef<GameState | null>(null);
  const [me, setMe] = useState<PlayerId>(0);
  const meRef = useRef<PlayerId>(0);
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [round, setRound] = useState(1);
  const roundRef = useRef(1);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [playHistory, setPlayHistory] = useState<History>(emptyHistory);
  const [kukjinMenu, setKukjinMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<History>(emptyHistory());
  const soloRoundId = useRef('');
  const recorded = useRef(new Set<string>());
  const [dealerNotice, setDealerNotice] = useState(false);
  const floorLayout = useRef<FloorLayout>(new Map());
  const [impact, setImpact] = useState<{ key: number; x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [specialEffect, setSpecialEffect] = useState<{ label: string; detail: string } | null>(
    null,
  );
  const [status, setStatus] = useState('');
  const [highlight, setHighlight] = useState<string[]>([]);
  const [motion, setMotion] = useState<{
    key: number;
    cards: HwatuCard[];
    kind: string;
    other: boolean;
    geometry: FlightGeometry;
    duration: number;
    strike?: { angle: number; dx: number; dy: number; swing: number };
  } | null>(null);
  const waitingFlight = useRef<
    Partial<
      Record<'hand' | 'deck', { cards: HwatuCard[]; geometry: FlightGeometry; mine: boolean }>
    >
  >({});
  const [struck, setStruck] = useState<
    Record<string, { card: HwatuCard; angle: number; dx: number; dy: number }>
  >({});
  const [landing, setLanding] = useState<string | null>(null);
  const [selected, setSelected] = useState<HwatuCard | null>(null);
  const [zoom, setZoom] = useState<{ cards: HwatuCard[]; title: string } | null>(null);
  const [settings, setSettings] = useState(false);
  const [rules, setRules] = useState(false);
  const [invite, setInvite] = useState(false);
  const [exit, setExit] = useState(false);
  const [disconnectedSince, setDisconnectedSince] = useState<number | null>(null);
  const [connectionSeconds, setConnectionSeconds] = useState(0);
  const [special, setSpecial] = useState<{ card: HwatuCard; bomb: boolean } | null>(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(true);
  const [entering, setEntering] = useState(false);
  const multiplayer = useRef<MultiplayerTransport | null>(null);
  const connectionAttempt = useRef(0);
  const saved = useRef<SavedRoom | null>(null);
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const seq = useRef(0);
  const [debug, setDebug] = useState(false);
  const [seed, setSeed] = useState('12345');
  const [skip, setSkip] = useState(false);
  const skipRef = useRef(false);
  skipRef.current = skip;
  const [customDeal, setCustomDeal] = useState('');
  const [log, setLog] = useState<GameEvent[]>([]);
  const [debugPanel, setDebugPanel] = useState(false);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const publish = useCallback((v: GameView) => {
    floorLayout.current = syncFloorLayout(floorLayout.current, v.floor);
    viewRef.current = v;
    setView(v);
  }, []);
  const updatePrefs = (p: Preferences) => {
    setPrefs(p);
    savePreferences(p);
  };
  const present = useCallback(
    (next: GameView, events: GameEvent[], newRound = false) => {
      const epoch = generation.current;
      if (!events.length) {
        if (!busyRef.current || newRound) publish(next);
        return;
      }
      busyRef.current = true;
      setBusy(true);
      queue.current = queue.current
        .then(async () => {
          if (epoch !== generation.current) return;
          let shown = structuredClone(viewRef.current ?? next);
          let motionKey = Date.now();
          const factor =
            skipRef.current && process.env.NODE_ENV === 'development'
              ? 0
              : window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 0.12
                : prefsRef.current.speed === 'physical'
                  ? 1
                  : prefsRef.current.speed === 'normal'
                    ? 0.65
                    : 0.35;
          const pause = async (ms: number) => {
            if (factor) await new Promise<void>((resolve) => setTimeout(resolve, ms * factor));
            return epoch === generation.current;
          };
          for (const e of events) {
            if (epoch !== generation.current) return;
            setLog((old) => [...old.slice(-100), e]);
            setStatus(e.label ?? eventLabel[e.type] ?? '');
            setHighlight(e.cards?.map((c) => c.id) ?? []);
            if (effectDetails[e.type])
              setSpecialEffect({ label: e.label ?? e.type, detail: effectDetails[e.type] });
            const mine = e.player === meRef.current;
            const ids = new Set(e.cards?.map((c) => c.id));
            const fly = async (
              cards: HwatuCard[],
              source: FlightGeometry,
              targetId?: string,
              deck = false,
            ) => {
              if (!cards.length) return true;
              const c = cards[0];
              // Reserve a real empty slot before measuring its final layout.
              if (!targetId && !shown.floor.some((f) => f.id === c.id)) {
                shown.floor.push(c);
                flushSync(() => {
                  setLanding(c.id);
                  publish({ ...shown });
                });
                targetId = c.id;
              }
              const geometry = cardFlight(cards, deck ? 'flip' : 'play', mine, targetId);
              // Keep the original source even when the hand/deck changed during a choice.
              const centerX = source.fromX + source.width / 2;
              const centerY = source.fromY + source.height / 2;
              geometry.fromX = centerX - geometry.width / 2;
              geometry.fromY = centerY - geometry.height / 2;
              const strikes = [
                { angle: -14, dx: -6, dy: 4, swing: -16 },
                { angle: 12, dx: 7, dy: -3, swing: 18 },
                { angle: -9, dx: 4, dy: 6, swing: -10 },
                { angle: 17, dx: -5, dy: 1, swing: 14 },
              ];
              const strike = strikes[Math.floor(Math.random() * strikes.length)];
              setMotion({
                key: motionKey++,
                cards,
                kind: targetId === c.id ? 'place' : 'play',
                other: !mine,
                geometry,
                duration: 440 * factor,
                strike,
              });
              if (!(await pause(320))) return false;
              if (targetId !== c.id)
                setImpact({
                  key: motionKey,
                  x: geometry.toX + geometry.width / 2,
                  y: geometry.toY + geometry.height / 2,
                });
              feedback(prefsRef.current);
              if (!(await pause(120))) return false;
              if (targetId !== c.id && targetId)
                setStruck((old) => ({ ...old, [targetId!]: { card: c, ...strike } }));
              publish({ ...shown });
              setLanding(null);
              setMotion(null);
              return pause(140);
            };
            if (e.type === 'CARD_PLAYED' || e.type === 'BOMB') {
              const cards = e.cards ?? [];
              const source = cardFlight(cards, cards[0]?.isBonus ? 'bonus' : 'play', mine);
              const choice = events.some(
                (event) => event.type === 'FLOOR_MATCH_REQUIRED' && event.stage === 'hand',
              );
              const match = events.find(
                (event) => event.type === 'FLOOR_MATCHED' && event.stage === 'hand',
              );
              if (mine) shown.hand = shown.hand.filter((c) => !ids.has(c.id));
              else
                shown.players[e.player].handCount = Math.max(
                  0,
                  shown.players[e.player].handCount - cards.length,
                );
              publish({ ...shown });
              if (cards[0]?.isBonus) {
                setStatus('보너스 쌍피');
                setMotion({
                  key: motionKey++,
                  cards,
                  kind: 'bonus',
                  other: !mine,
                  geometry: source,
                  duration: 360 * factor,
                });
                if (!(await pause(360))) return;
                if (!(await pause(650))) return;
              } else if (choice) {
                waitingFlight.current.hand = { cards, geometry: source, mine };
                setMotion({
                  key: motionKey++,
                  cards,
                  kind: 'waiting',
                  other: !mine,
                  geometry: source,
                  duration: 0,
                });
              } else if (
                !(await fly(
                  cards,
                  source,
                  match?.cards?.[1]?.id ??
                    (e.type === 'BOMB'
                      ? shown.floor.find((c) => c.month === cards[0]?.month)?.id
                      : undefined),
                ))
              )
                return;
            } else if (e.type === 'DECK_CARD_REVEALED') {
              const cards = e.cards ?? [];
              const source = cardFlight(cards, 'flip', mine);
              shown.deckCount = Math.max(0, shown.deckCount - 1);
              publish({ ...shown });
              setMotion({
                key: motionKey++,
                cards,
                kind: 'flip',
                other: !mine,
                geometry: source,
                duration: 420 * factor,
              });
              if (!(await pause(420))) return;
              if (!(await pause(180))) return;
              if (cards[0]?.isBonus) {
                setMotion(null);
                continue;
              }
              const choice = events.some(
                (event) => event.type === 'FLOOR_MATCH_REQUIRED' && event.stage === 'deck',
              );
              const match = events.find(
                (event) =>
                  event.type === 'FLOOR_MATCHED' &&
                  event.stage === 'deck' &&
                  event.cards?.[0]?.id === cards[0]?.id,
              );
              if (choice) {
                waitingFlight.current.deck = { cards, geometry: source, mine };
                setMotion({
                  key: motionKey++,
                  cards,
                  kind: 'waiting',
                  other: !mine,
                  geometry: source,
                  duration: 0,
                });
              } else if (
                !(await fly(
                  cards,
                  source,
                  match?.cards?.[1]?.id ??
                    shown.floor.find((c) => c.month === cards[0]?.month && !c.isBonus)?.id,
                  true,
                ))
              )
                return;
            } else if (
              e.type === 'CARDS_CAPTURED' ||
              e.type === 'PI_TRANSFERRED' ||
              e.type === 'BONUS_CAPTURED'
            ) {
              const kind =
                e.type === 'PI_TRANSFERRED'
                  ? 'transfer'
                  : e.type === 'BONUS_CAPTURED'
                    ? 'bonus-capture'
                    : 'capture';
              setMotion({
                key: motionKey++,
                cards: e.cards ?? [],
                kind,
                other: !mine,
                geometry: cardFlight(e.cards ?? [], kind, mine),
                duration: 450 * factor,
              });
              feedback(prefsRef.current);
              if (!(await pause(450))) return;
              setStruck((old) =>
                Object.fromEntries(
                  Object.entries(old).filter(
                    ([target, hit]) => !ids.has(target) && !ids.has(hit.card.id),
                  ),
                ),
              );
              shown.floor = shown.floor.filter((c) => !ids.has(c.id));
              shown.players[1 - e.player].captured = shown.players[1 - e.player].captured.filter(
                (c) => !ids.has(c.id),
              );
              for (const c of e.cards ?? [])
                if (!shown.players[e.player].captured.some((x) => x.id === c.id))
                  shown.players[e.player].captured.push(c);
              publish({ ...shown });
              setMotion(null);
            } else if (e.type === 'FLOOR_MATCHED') {
              const stage = e.stage ?? 'hand';
              const waiting = waitingFlight.current[stage];
              if (waiting && waiting.cards[0]?.id === e.cards?.[0]?.id) {
                delete waitingFlight.current[stage];
                if (
                  !(await fly(waiting.cards, waiting.geometry, e.cards?.[1]?.id, stage === 'deck'))
                )
                  return;
              }
            } else if (e.type === 'SCORE_CHANGED') {
              shown.scores[e.player] = next.scores[e.player];
              publish({ ...shown });
              if (!(await pause(350))) return;
            } else if (e.label) {
              feedback(prefsRef.current, 'special');
              if (!(await pause(850))) return;
            }
          }
          if (epoch !== generation.current) return;
          publish(next);
          if (next.phase !== 'SELECT_FLOOR') {
            setMotion(null);
            setStruck({});
            setImpact(null);
            waitingFlight.current = {};
          }
          setLanding(null);
          setHighlight([]);
          setStatus('');
          setSpecialEffect(null);
          setImpact(null);
          busyRef.current = false;
          setBusy(false);
          if (modeRef.current === 'multi')
            void multiplayer.current
              ?.ready(roundRef.current, next.stateVersion)
              .catch(() => setError('연결을 복구하고 있어요.'));
        })
        .catch(() => {
          if (epoch === generation.current) {
            publish(next);
            setBusy(false);
            busyRef.current = false;
            setMotion(null);
            setStruck({});
            setImpact(null);
            setLanding(null);
            waitingFlight.current = {};
            setError('패 이동을 복구했어요. 계속 칠 수 있어요.');
          }
        });
    },
    [publish],
  );
  const saveResult = useCallback((input: Parameters<typeof addResult>[1]) => {
    if (recorded.current.has(input.id)) return;
    recorded.current.add(input.id);
    const stored = getItem(HISTORY_KEY);
    const next = addResult(stored === null ? historyRef.current : parseHistory(stored), input);
    historyRef.current = next;
    setPlayHistory(next);
    storeItem(HISTORY_KEY, JSON.stringify(next));
    if (input.mode === 'single') setStats(soloStats(next));
  }, []);
  const connectRoom = useCallback(
    (code?: string, _uid?: string, name?: string) => {
      const attempt = ++connectionAttempt.current;
      setEntering(true);
      setError('');
      setConnected(false);
      setMode('multi');
      modeRef.current = 'multi';
      setScreen('lobby');
      multiplayer.current?.dispose();
      multiplayer.current = null;
      void import('../multiplayer/firebase-transport')
        .then(async ({ FirebaseTransport, readableError }) => {
          try {
            const transport = await FirebaseTransport.open(
              {
                connection: (value) => {
                  if (attempt === connectionAttempt.current) setConnected(value);
                },
                error: (message) => {
                  if (attempt === connectionAttempt.current) setError(message);
                },
                state: (data: RoomMessage) => {
                  if (attempt !== connectionAttempt.current) return;
                  const newRound = roundRef.current !== data.round;
                  roundRef.current = data.round;
                  setRound(data.round);
                  setStats(data.stats);
                  setRoom(data);
                  seq.current = data.actionSequence;
                  meRef.current = data.me;
                  setMe(data.me);
                  setEntering(false);
                  if (data.closed) {
                    generation.current++;
                    busyRef.current = false;
                    setBusy(false);
                    setMotion(null);
                    setImpact(null);
                    setZoom(null);
                    setSpecial(null);
                    setInvite(false);
                    setSettings(false);
                    setRules(false);
                    setError('방이 종료되었어요. 대기실로 돌아가 새 방을 만들어주세요.');
                    return;
                  }
                  if (data.game) {
                    if (data.game.result)
                      saveResult({
                        id: `multi:${data.code}:${data.expiresAt}:${data.round}:${data.me}`,
                        mode: 'multi',
                        opponent: data.names[1 - data.me],
                        me: data.me,
                        result: data.game.result,
                      });
                    setScreen('game');
                    if (newRound) {
                      floorLayout.current = new Map();
                      generation.current++;
                      queue.current = Promise.resolve();
                      busyRef.current = false;
                      setBusy(false);
                      setMotion(null);
                      setStruck({});
                      setImpact(null);
                      setLanding(null);
                      waitingFlight.current = {};
                      publish(data.game);
                    }
                    present(data.game, data.events, newRound);
                  } else setScreen('lobby');
                },
              },
              code,
              name ?? getItem('toki.nickname.v1') ?? '',
              !!_uid,
            );
            if (attempt !== connectionAttempt.current) {
              transport.dispose();
              return;
            }
            multiplayer.current = transport;
            saved.current = { code: transport.code, uid: transport.uid };
            storeItem('toki.firebase.room.v1', JSON.stringify(saved.current));
          } catch (error) {
            if (attempt !== connectionAttempt.current) return;
            setEntering(false);
            setError(readableError(error));
            setScreen('friends');
          }
        })
        .catch(() => {
          if (attempt === connectionAttempt.current) {
            setEntering(false);
            setScreen('friends');
            setError('연결을 준비하지 못했어요. 다시 시도해주세요.');
          }
        });
    },
    [present, publish, saveResult],
  );
  useEffect(() => {
    const storedHistory = parseHistory(getItem(HISTORY_KEY));
    historyRef.current = storedHistory;
    setPlayHistory(storedHistory);
    setStats(soloStats(storedHistory));
    setPrefs(readPreferences());
    setNickname(getItem('toki.nickname.v1') ?? '');
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room')?.toUpperCase();
    setDebug(process.env.NODE_ENV === 'development' && params.get('debug') === '1');
    let prior: SavedRoom | null = null;
    try {
      prior = JSON.parse(getItem('toki.firebase.room.v1') ?? 'null');
    } catch {}
    if (
      prior &&
      typeof prior.code === 'string' &&
      typeof prior.uid === 'string' &&
      (!code || code === prior.code)
    ) {
      saved.current = prior;
      connectRoom(prior.code, prior.uid);
    } else if (code) {
      setCodeInput(code);
      setScreen('friends');
    }
    const syncHistory = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== HISTORY_KEY && event.key !== null))
        return;
      const next = parseHistory(event.key === null ? null : event.newValue);
      historyRef.current = next;
      setPlayHistory(next);
      if (modeRef.current === 'single') setStats(soloStats(next));
    };
    window.addEventListener('storage', syncHistory);
    const cleanupPwa = registerPwa();
    return () => {
      window.removeEventListener('storage', syncHistory);
      cleanupPwa();
      generation.current++;
      connectionAttempt.current++;
      multiplayer.current?.dispose();
      if (touchTimer.current) clearTimeout(touchTimer.current);
    };
  }, [connectRoom]);
  const startSingle = (previous?: GameState | null) => {
    floorLayout.current = new Map();
    setDealerNotice(false);
    generation.current++;
    queue.current = Promise.resolve();
    busyRef.current = false;
    setBusy(false);
    setMotion(null);
    setStruck({});
    setImpact(null);
    setHighlight([]);
    setStatus('');
    setSpecialEffect(null);
    setLanding(null);
    waitingFlight.current = {};
    setRoom(null);
    setError('');
    setLog([]);
    setMode('single');
    modeRef.current = 'single';
    meRef.current = 0;
    setMe(0);
    const nextRound = previous ? round + 1 : 1;
    roundRef.current = nextRound;
    setRound(nextRound);
    soloRoundId.current = crypto.randomUUID();
    if (!previous) setStats(soloStats(historyRef.current));
    const game = createGame(
      debug
        ? {
            seed: Number(seed) + (previous ? nextRound : 0),
            dealer: previous?.result?.winner ?? previous?.dealer,
            nagariMultiplier: previous?.result?.winner === null ? 2 : 1,
          }
        : {
            dealer: previous?.result?.winner ?? previous?.dealer,
            nagariMultiplier: previous?.result?.winner === null ? 2 : 1,
            rng: () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
          },
    );
    logical.current = game;
    publish(projectState(game, 0));
    setScreen('game');
    setDealerNotice(!debug && !game.result);
    unlockAudio();
    if (game.result) recordResult(game);
  };
  const startDebugFixture = async (name?: string) => {
    if (!debug || process.env.NODE_ENV !== 'development') return;
    try {
      const fixtures = await import('../game-engine/fixtures');
      const game = name
        ? fixtures.createFixture(
            name as import('../game-engine/fixtures').FixtureName,
            Number(seed),
          )
        : fixtures.createCustomDeal(JSON.parse(customDeal), Number(seed));
      floorLayout.current = new Map();
      setDealerNotice(false);
      generation.current++;
      queue.current = Promise.resolve();
      busyRef.current = false;
      setBusy(false);
      setMotion(null);
      setStruck({});
      setImpact(null);
      setHighlight([]);
      setStatus('');
      setSpecialEffect(null);
      setLanding(null);
      waitingFlight.current = {};
      setRoom(null);
      setMode('single');
      modeRef.current = 'single';
      meRef.current = 0;
      setMe(0);
      logical.current = game;
      setRound(1);
      roundRef.current = 1;
      soloRoundId.current = crypto.randomUUID();
      setStats(soloStats(historyRef.current));
      setLog([]);
      publish(projectState(game, 0));
      setScreen('game');
      setDebugPanel(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '분배 정보를 확인해주세요.');
    }
  };
  const recordResult = useCallback(
    (game: GameState) => {
      if (game.result)
        saveResult({
          id: soloRoundId.current,
          mode: 'single',
          opponent: '토끼',
          me: 0,
          result: game.result,
        });
    },
    [saveResult],
  );
  const dispatch = useCallback(
    (action: GameAction) => {
      if (busyRef.current) return;
      setError('');
      setSelected(null);
      setSpecial(null);
      setKukjinMenu(false);
      unlockAudio();
      if (modeRef.current === 'multi') {
        if (!multiplayer.current?.connected) {
          setError('연결 복구를 기다려주세요.');
          return;
        }
        const current = viewRef.current;
        if (!current) return;
        busyRef.current = true;
        setBusy(true);
        const epoch = generation.current;
        void multiplayer.current
          .action({
            round: roundRef.current,
            sequence: seq.current + 1,
            stateVersion: current.stateVersion,
            action,
          })
          .catch((error) => {
            if (epoch !== generation.current) return;
            busyRef.current = false;
            setBusy(false);
            setError(error instanceof Error ? error.message : '패를 다시 선택해주세요.');
          });
        return;
      }
      try {
        if (!logical.current) return;
        const r = applyAction(logical.current, action);
        logical.current = r.nextState;
        present(projectState(r.nextState, 0), r.events);
        if (r.nextState.result) recordResult(r.nextState);
      } catch (e) {
        setError(e instanceof Error ? e.message : '패를 다시 선택해주세요.');
      }
    },
    [present, recordResult],
  );
  useEffect(() => {
    if (
      mode !== 'single' ||
      screen !== 'game' ||
      busy ||
      dealerNotice ||
      kukjinMenu ||
      debugPanel ||
      !view ||
      view.currentPlayer !== 1 ||
      view.phase === 'FINISHED' ||
      settings ||
      zoom ||
      rules ||
      exit
    )
      return;
    const delay = skip && debug ? 0 : 700 + Math.random() * 700;
    const timer = setTimeout(() => {
      if (logical.current)
        dispatch(chooseAction(projectState(logical.current, 1), 1, prefs.difficulty));
    }, delay);
    return () => clearTimeout(timer);
  }, [
    mode,
    screen,
    dealerNotice,
    kukjinMenu,
    debugPanel,
    busy,
    view,
    prefs.difficulty,
    dispatch,
    skip,
    debug,
    settings,
    zoom,
    rules,
    exit,
  ]);
  const leave = () => {
    floorLayout.current = new Map();
    setDealerNotice(false);
    generation.current++;
    queue.current = Promise.resolve();
    busyRef.current = false;
    setBusy(false);
    setMotion(null);
    setStruck({});
    setImpact(null);
    setHighlight([]);
    setStatus('');
    setSpecialEffect(null);
    setLanding(null);
    waitingFlight.current = {};
    connectionAttempt.current++;
    const previousTransport = multiplayer.current;
    multiplayer.current = null;
    if (previousTransport) void previousTransport.leave().catch(() => previousTransport.dispose());
    storeItem('toki.firebase.room.v1', null);
    saved.current = null;
    setScreen('home');
    setRoom(null);
    setView(null);
    viewRef.current = null;
    logical.current = null;
    setExit(false);
    setKukjinMenu(false);
    setInvite(false);
    setError('');
    history.replaceState({ ...history.state }, '', window.location.pathname);
  };
  useAppBack(() => {
    setSelected(null);
    if (screen === 'friends') leave();
    else if (screen === 'game' || screen === 'lobby') setExit(true);
  }, screen !== 'home');
  const inviteUrl =
    typeof window !== 'undefined' && room ? `${window.location.origin}/?room=${room.code}` : '';
  useEffect(() => {
    if (inviteUrl)
      void QRCode.toDataURL(inviteUrl, {
        width: 220,
        margin: 2,
        color: { dark: '#254d3e', light: '#faf7ef' },
      }).then(setQr);
  }, [inviteUrl]);
  const canPlay =
    !!view &&
    !busy &&
    !dealerNotice &&
    view.currentPlayer === me &&
    (mode === 'single' || (connected && !!room?.canAct));
  const nick = nickname.trim() || '나';
  const opponent = mode === 'single' ? '토끼' : (room?.names[1 - me] ?? '친구');
  const zoomCards = (cards: HwatuCard[], title: string) => setZoom({ cards, title });
  const tapCard = (c: HwatuCard) => {
    if (held.current) {
      held.current = false;
      return;
    }
    if (!canPlay || view?.phase !== 'PLAY') return;
    const ownMonth = view.hand.filter((x) => x.month === c.month && !x.isBonus),
      floorMonth = view.floor.filter((x) => x.month === c.month);
    if (
      ownMonth.length === 3 &&
      (floorMonth.length === 1 ||
        (!floorMonth.length && !view.players[me].shakes.includes(c.month)))
    )
      setSpecial({ card: c, bomb: floorMonth.length === 1 });
    else dispatch({ type: 'PLAY_CARD', player: me, cardId: c.id });
  };
  const nextRound = () => {
    if (mode === 'single') startSingle(logical.current);
    else if (view && multiplayer.current) {
      const epoch = generation.current;
      void multiplayer.current
        .nextRound(roundRef.current, view.stateVersion, seq.current + 1)
        .catch((error) => {
          if (epoch === generation.current)
            setError(error instanceof Error ? error.message : '다음 판을 기다려주세요.');
        });
    }
  };
  const interrupted =
    mode === 'multi' && !!room && !room.closed && (!connected || !room.connected[1 - me]);
  useEffect(() => {
    if (!interrupted) {
      setDisconnectedSince(null);
      setConnectionSeconds(0);
      return;
    }
    const since = Date.now();
    setDisconnectedSince(since);
    const timer = setInterval(
      () => setConnectionSeconds(Math.floor((Date.now() - since) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [interrupted]);
  const snapshotStatus =
    !connected && mode === 'multi'
      ? '연결을 복구하고 있어요'
      : mode === 'multi' && room && !room.connected[1 - me]
        ? me === 1
          ? '방장의 연결을 기다리고 있어요.'
          : '친구의 연결을 기다리고 있어요.'
        : busy
          ? status
          : view?.phase === 'SELECT_KUKJIN'
            ? view.currentPlayer === me
              ? '국화 열끗 · 쌍피를 선택해주세요'
              : `${opponent}의 국화 선택을 기다려요`
            : view?.phase === 'SELECT_FLOOR'
              ? view.currentPlayer === me
                ? '먹을 바닥패를 골라주세요'
                : `${opponent}의 선택을 기다려요`
              : view?.currentPlayer === me
                ? '내 차례 · 손패를 톡 눌러주세요'
                : `${opponent}가 패를 고르고 있어요`;
  return (
    <main className={`app ${screen === 'game' ? 'playing' : ''}`}>
      {showHistory && (
        <PlayHistory
          history={playHistory}
          onClose={() => setShowHistory(false)}
          onReset={() => {
            const stored = getItem(HISTORY_KEY);
            const next = resetSolo(stored === null ? historyRef.current : parseHistory(stored));
            historyRef.current = next;
            setPlayHistory(next);
            storeItem(HISTORY_KEY, JSON.stringify(next));
            if (mode === 'single') setStats(soloStats(next));
          }}
        />
      )}
      {screen === 'home' && (
        <section className="home">
          <header className="home-header">
            <a
              className="brand"
              href="/"
              aria-label="토끼맞고 홈"
              onClick={(event) => {
                event.preventDefault();
                leave();
              }}
            >
              토끼<span>맞고</span>
              <RabbitMark />
            </a>
            <button className="icon-button" aria-label="설정" onClick={() => setSettings(true)}>
              <SettingsIcon />
            </button>
          </header>
          <div className="home-copy">
            <span className="eyebrow">
              <span className="small-flower" /> 둘이서, 느긋하게
            </span>
            <h1>
              패는 없어도,
              <br />
              마주 앉은 것처럼.
            </h1>
            <p>
              스마트폰 두 대면 충분해요.
              <br />
              소중한 사람과 나누는 작은 한 판.
            </p>
          </div>
          <div className="home-table">
            <span className="table-stitch" />
            <span className="table-caption">오늘, 한 판 어때요?</span>
            <div className="hero-cards">
              {['m1-0', 'm3-1', 'm8-0', 'm6-1', 'm2-0'].map((id, i) => (
                <span key={id} style={{ '--i': i } as CSSProperties}>
                  <Card card={CARDS.find((c) => c.id === id)} />
                </span>
              ))}
            </div>
          </div>
          <div className="home-actions">
            <button className="primary" onClick={() => startSingle()}>
              <span>
                혼자 치기<small>토끼와 편안한 연습 한 판</small>
              </span>
              <span aria-hidden>↗</span>
            </button>
            <button
              className="secondary"
              onClick={() => {
                setScreen('friends');
                unlockAudio();
              }}
            >
              <span>
                친구와 치기<small>방 코드로 함께하는 맞고</small>
              </span>
              <span aria-hidden>↗</span>
            </button>
            <button
              className="secondary history-menu"
              aria-label="최근 기록"
              onClick={() => setShowHistory(true)}
            >
              <span>
                최근 기록<small>지난 판과 혼자 치기 누적 기록</small>
              </span>
              <span aria-hidden>↗</span>
            </button>
          </div>
        </section>
      )}
      {screen === 'friends' && (
        <section className="connection-screen">
          <header>
            <button className="icon-button" aria-label="홈으로" onClick={leave}>
              ←
            </button>
            <span className="brand">
              토끼<span>맞고</span>
              <RabbitMark />
            </span>
            <button className="icon-button" aria-label="설정" onClick={() => setSettings(true)}>
              <SettingsIcon />
            </button>
          </header>
          <span className="eyebrow">우리 둘만의 화투판</span>
          <h1>내 이름으로 함께해요.</h1>
          <p className="muted">친구에게 표시될 내 이름을 먼저 적고, 방을 만들거나 참여하세요.</p>
          <label className="field">
            내 이름 · 두 경우 모두 이 이름으로 참여해요
            <input
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                storeItem('toki.nickname.v1', e.target.value);
              }}
              maxLength={12}
              placeholder="친구 이름이 아닌, 내 이름 또는 별명"
              autoComplete="nickname"
            />
          </label>
          <button
            className="primary"
            disabled={entering}
            onClick={() => connectRoom(undefined, undefined, nickname.trim() || '방장')}
          >
            내 이름으로 방 만들기 <span>＋</span>
          </button>
          <p className="name-help">
            이름을 비우면 방을 만들 때는 방장, 참여할 때는 참가자로 표시돼요.
          </p>
          <div className="or-divider">친구가 만든 방에 들어가려면</div>
          <label className="field">
            친구가 알려준 방 코드
            <input
              className="room-input"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              maxLength={4}
              placeholder="숫자 4자리 · 예: 0123"
              inputMode="numeric"
              pattern="[0-9]{4}"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          <button
            className="secondary"
            disabled={entering || codeInput.length !== 4}
            onClick={() => connectRoom(codeInput, undefined, nickname.trim() || '참가자')}
          >
            내 이름으로 참여 <span>→</span>
          </button>
          <p className="fine-print">
            같은 방의 두 사람만 패를 볼 수 있어요.
            <br />방 코드나 초대 링크를 아는 친구와 둘이서 즐겨요.
          </p>
        </section>
      )}
      {screen === 'lobby' && (
        <section className="connection-screen lobby">
          <header>
            <button className="icon-button" aria-label="나가기" onClick={leave}>
              ←
            </button>
            <span className="brand">
              토끼<span>맞고</span>
              <RabbitMark />
            </span>
          </header>
          <span className="eyebrow">화투판을 펼쳤어요</span>
          <h1>{room ? '친구를 기다려요.' : '화투판에 연결 중…'}</h1>
          <p className="muted">링크를 보내거나, 아래 코드를 알려주세요.</p>
          {room && <InviteContent code={room.code} url={inviteUrl} qr={qr} onError={setError} />}
          <p className="fine-print">
            방은 생성 후 24시간 유지됩니다. 나가기를 선택하면 두 사람의 방이 종료돼요.
          </p>
          <p className="waiting-note">
            <span className="status-dot" />
            {connected ? '친구가 들어오면 함께 시작해요.' : '연결을 복구하고 있어요.'}
          </p>
        </section>
      )}
      {screen === 'game' && view && (
        <section
          className="game-table"
          data-testid="game-table"
          aria-label="맞고 게임판"
          data-phase={view.phase}
          data-current={view.currentPlayer}
          data-me={me}
          data-version={view.stateVersion}
          data-round={round}
          data-busy={busy}
          data-can-act={canPlay}
        >
          <header className="game-header">
            <button className="icon-button" aria-label="나가기" onClick={() => setExit(true)}>
              ←
            </button>
            <span className="table-logo">
              토끼<span>맞고</span>
              <RabbitMark />
            </span>
            <span className="round">{round}번째 판</span>
            {mode === 'multi' && (
              <button
                className="icon-button"
                aria-label="친구 초대"
                onClick={() => setInvite(true)}
              >
                ↗
              </button>
            )}
            <button className="icon-button" aria-label="설정" onClick={() => setSettings(true)}>
              <SettingsIcon />
            </button>
          </header>
          <PlayerInfo
            name={opponent}
            score={view.scores[1 - me].baseScore}
            go={view.players[1 - me].goCount}
            active={view.currentPlayer !== me}
            dealer={view.dealer !== me}
            wins={stats.wins[1 - me]}
            handCount={view.players[1 - me].handCount}
            passes={view.players[1 - me].bombPasses}
          />
          <Captured
            player={view.players[1 - me]}
            onZoom={zoomCards}
            hiddenIds={motion?.kind === 'transfer' ? motion.cards.map((c) => c.id) : []}
          />
          <div className="floor-area" data-testid="floor-area">
            <div className="deck" aria-label={`뒤집힌 덱 ${view.deckCount}장`}>
              <Card back />
              <span>
                {view.deckCount}
                <small>남은 패</small>
              </span>
            </div>
            {interrupted && disconnectedSince && (
              <div className="connection-banner" role="status">
                <strong>
                  {!connected ? '내 연결이 잠시 끊겼어요' : `${opponent}의 재접속을 기다려요`}
                </strong>
                <span>
                  진행 중인 판을 보관했어요. 같은 기기로 돌아오면 이어서 칠 수 있어요. ·{' '}
                  {connectionSeconds}초
                </span>
                {connectionSeconds >= 120 && (
                  <button onClick={() => setExit(true)}>기다림을 끝내고 나가기</button>
                )}
              </div>
            )}
            <div className="floor-grid" data-testid="floor-cards">
              {Array.from(
                new Set(
                  view.floor.map((c) =>
                    c.isBonus ? (view.bonusAttachments?.[c.id] ?? 0) : c.month,
                  ),
                ),
              ).map((month) => (
                <div
                  className="floor-month"
                  key={month}
                  data-floor-month={month}
                  style={
                    {
                      '--stack-direction':
                        FLOOR_PLACES[floorLayout.current.get(month)?.slot ?? 0][0] > 50 ? -1 : 1,
                      '--pile-count': view.floor.filter(
                        (c) =>
                          (c.isBonus ? (view.bonusAttachments?.[c.id] ?? 0) : c.month) === month,
                      ).length,
                      '--slot-x': `${FLOOR_PLACES[floorLayout.current.get(month)?.slot ?? 0][0]}%`,
                      '--slot-y': `${FLOOR_PLACES[floorLayout.current.get(month)?.slot ?? 0][1]}%`,
                    } as CSSProperties
                  }
                >
                  {view.floor
                    .filter(
                      (c) => (c.isBonus ? (view.bonusAttachments?.[c.id] ?? 0) : c.month) === month,
                    )
                    .map((c, i) => (
                      <button
                        key={c.id}
                        style={
                          {
                            '--pile-index': c.isBonus
                              ? 2
                              : (floorLayout.current.get(month)?.cards.get(c.id) ?? i),
                            '--pile-top': c.isBonus ? '12px' : '0px',
                            '--rest-angle': `${FLOOR_PLACES[floorLayout.current.get(month)?.slot ?? 0][2] + ((floorLayout.current.get(month)?.cards.get(c.id) ?? i) % 2 ? 2 : 0)}deg`,
                            visibility: landing === c.id ? 'hidden' : undefined,
                          } as CSSProperties
                        }
                        data-floor-card-id={c.id}
                        className={`floor-card ${view.options.includes(c.id) || highlight.includes(c.id) || selected?.month === c.month ? 'highlighted' : ''}`}
                        onClick={() => {
                          if (
                            canPlay &&
                            view.phase === 'SELECT_FLOOR' &&
                            view.options.includes(c.id)
                          )
                            dispatch({ type: 'SELECT_FLOOR', player: me, cardId: c.id });
                          else
                            zoomCards(
                              view.floor.filter(
                                (card) =>
                                  (card.isBonus
                                    ? (view.bonusAttachments?.[card.id] ?? 0)
                                    : card.month) === month,
                              ),
                              '바닥패 크게 보기',
                            );
                        }}
                        aria-label={`${c.name}${canPlay && view.phase === 'SELECT_FLOOR' && view.options.includes(c.id) ? ' 먹기' : ' 바닥패 확대'}`}
                      >
                        <Card card={c} />
                        {struck[c.id] && (
                          <span
                            className="landed-card"
                            data-floor-card-id={struck[c.id].card.id}
                            style={{
                              transform: `translate(${struck[c.id].dx}px, ${struck[c.id].dy}px) rotate(${struck[c.id].angle}deg)`,
                            }}
                          >
                            <Card card={struck[c.id].card} />
                          </span>
                        )}
                      </button>
                    ))}
                </div>
              ))}
            </div>
            {impact && (
              <div
                key={`impact-${impact.key}`}
                className="slap-impact"
                aria-hidden="true"
                style={{ left: impact.x, top: impact.y }}
              >
                <span className="impact-ring" />
                {Array.from({ length: 6 }, (_, i) => (
                  <i key={i} style={{ '--ray': `${i * 60 + 15}deg` } as CSSProperties} />
                ))}
              </div>
            )}
            {motion && (
              <div
                key={motion.key}
                data-target-card-id={motion.geometry.targetId}
                data-moving-card-id={motion.cards[0]?.id}
                className={`card-motion ${motion.kind} ${motion.other ? 'other' : ''}`}
                style={
                  {
                    '--from-x': `${motion.geometry.fromX}px`,
                    '--from-y': `${motion.geometry.fromY}px`,
                    '--to-x': `${motion.geometry.toX}px`,
                    '--to-y': `${motion.geometry.toY}px`,
                    '--duration': `${motion.duration}ms`,
                    '--motion-width': `${motion.geometry.width}px`,
                    '--motion-height': `${motion.geometry.height}px`,
                    '--land-angle': `${motion.strike?.angle ?? 0}deg`,
                    '--land-x': `${motion.strike?.dx ?? 0}px`,
                    '--land-y': `${motion.strike?.dy ?? 0}px`,
                    '--swing-angle': `${motion.strike?.swing ?? 0}deg`,
                  } as CSSProperties
                }
              >
                {motion.cards.slice(0, 4).map((c, i) => (
                  <span key={c.id} style={{ '--i': i } as CSSProperties}>
                    {motion.kind === 'flip' ? (
                      <span className="flip-face">
                        <span className="flip-back">
                          <Card back />
                        </span>
                        <span className="flip-front">
                          <Card card={c} />
                        </span>
                      </span>
                    ) : (
                      <Card card={c} />
                    )}
                  </span>
                ))}
              </div>
            )}
            <div className={`turn-message ${busy && specialEffect ? 'callout' : ''}`} role="status">
              {busy && specialEffect ? (
                <>
                  {specialEffect.label}
                  <small>{specialEffect.detail}</small>
                </>
              ) : (
                snapshotStatus
              )}
            </div>
          </div>
          <PlayerInfo
            name={mode === 'multi' ? (room?.names[me] ?? nick) : nick}
            score={view.scores[me].baseScore}
            go={view.players[me].goCount}
            active={view.currentPlayer === me}
            dealer={view.dealer === me}
            wins={stats.wins[me]}
          />
          <Captured
            player={view.players[me]}
            onZoom={zoomCards}
            hiddenIds={motion?.kind === 'transfer' ? motion.cards.map((c) => c.id) : []}
          />
          <div className="hand-area" data-testid="hand-area">
            <div className="hand-grid">
              {[...view.hand]
                .sort((a, b) => a.month - b.month)
                .map((c) => (
                  <button
                    key={c.id}
                    data-card-id={c.id}
                    className={`hand-card ${selected?.id === c.id ? 'selected' : ''} ${view.floor.some((f) => f.month === c.month && !c.isBonus) ? 'matchable' : ''}`}
                    aria-label={`${c.name} 내기`}
                    aria-disabled={!canPlay || view.phase !== 'PLAY'}
                    onPointerDown={() => {
                      held.current = false;
                      setSelected(c);
                      touchTimer.current = setTimeout(() => {
                        held.current = true;
                        zoomCards([c], c.name);
                        setSelected(null);
                      }, 500);
                    }}
                    onPointerUp={() => {
                      if (touchTimer.current) clearTimeout(touchTimer.current);
                    }}
                    onPointerCancel={() => {
                      if (touchTimer.current) clearTimeout(touchTimer.current);
                      setSelected(null);
                    }}
                    onPointerLeave={() => {
                      if (touchTimer.current) clearTimeout(touchTimer.current);
                    }}
                    onClick={() => tapCard(c)}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <Card card={c} />
                  </button>
                ))}
              {Array.from({ length: view.players[me].bombPasses }, (_, i) => (
                <button
                  key={`bomb-pass-${i}`}
                  className="hand-card bomb-pass"
                  data-bomb-pass={i}
                  aria-label="폭탄패 사용 · 덱 한 장 뒤집기"
                  aria-disabled={!canPlay || view.phase !== 'PLAY'}
                  disabled={!canPlay || view.phase !== 'PLAY'}
                  onClick={() => dispatch({ type: 'PASS', player: me })}
                >
                  <BombPassCard />
                </button>
              ))}
            </div>
            {!view.hand.length && view.players[me].bombPasses === 0 && (
              <p className="muted">손패를 모두 냈어요.</p>
            )}
          </div>
          <div className="table-tools">
            {view.players[me].captured.some((c) => c.specialType === 'KUKJIN') &&
            !view.players[me].kukjinAsPi ? (
              <button
                disabled={!canPlay || view.phase !== 'PLAY'}
                className="kukjin-button"
                onClick={() => setKukjinMenu(true)}
              >
                국화 열끗 · 쌍피 선택
              </button>
            ) : null}
            {debug && <button onClick={() => setDebugPanel(true)}>개발</button>}
          </div>
        </section>
      )}
      {view &&
        canPlay &&
        !zoom &&
        !settings &&
        !rules &&
        !exit &&
        (view.phase === 'SELECT_KUKJIN' || kukjinMenu) && (
          <Modal
            title="국화를 쌍피로 사용할까요?"
            onClose={() => {
              if (view.phase !== 'SELECT_KUKJIN') setKukjinMenu(false);
            }}
          >
            <div className="kukjin-preview">
              <Card card={CARDS.find((c) => c.specialType === 'KUKJIN')} />
            </div>
            <p>
              열끗으로 두거나 피 두 장으로 옮길 수 있어요. 쌍피로 바꾸면 다시 열끗으로 되돌릴 수
              없어요.
            </p>
            <div className="kukjin-choices">
              <button
                className="primary"
                disabled={!canPlay}
                onClick={() => dispatch({ type: 'SET_KUKJIN', player: me, asPi: true })}
              >
                쌍피로 사용
                <small>
                  피 2장 · 기본{' '}
                  {calculateScore({ ...view.players[me], hand: [], kukjinAsPi: true }).baseScore}점
                </small>
              </button>
              <button
                className="secondary"
                disabled={!canPlay}
                onClick={() =>
                  view.phase === 'SELECT_KUKJIN'
                    ? dispatch({ type: 'SET_KUKJIN', player: me, asPi: false })
                    : setKukjinMenu(false)
                }
              >
                열끗으로 유지<small>열끗 1장 · 기본 {view.scores[me].baseScore}점</small>
              </button>
            </div>
          </Modal>
        )}
      {error && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button aria-label="알림 닫기" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {settings && (
        <Settings
          prefs={prefs}
          onChange={updatePrefs}
          onClose={() => setSettings(false)}
          onRules={() => setRules(true)}
        />
      )}
      {rules && (
        <Modal title="맞고, 천천히 익혀요" onClose={() => setRules(false)}>
          <p>
            같은 월의 화투를 만나면 두 패를 가져와요. 손패를 한 장 내고, 가운데 더미에서 한 장
            뒤집습니다.
          </p>
          <div className="rules-cards">
            <Card card={CARDS[0]} />
            <Card card={CARDS[1]} />
            <span>같은 1월 → 함께 먹어요</span>
          </div>
          <p>
            광, 열끗, 띠, 피를 모아 <strong>7점</strong>이 되면 고 또는 스톱을 골라요. 스톱은 이번
            판 승리, 고는 더 큰 점수를 위한 한 번 더.
          </p>
          <dl className="breakdown">
            <div>
              <dt>광</dt>
              <dd>3광 3점 · 비광 포함 2점</dd>
            </div>
            <div>
              <dt>고도리</dt>
              <dd>2·4·8월 새 세 장 5점</dd>
            </div>
            <div>
              <dt>홍단 · 청단 · 초단</dt>
              <dd>각 세 장 3점</dd>
            </div>
            <div>
              <dt>피</dt>
              <dd>10피부터 1점 · 쌍피는 2피</dd>
            </div>
          </dl>
          <p className="fine-print">
            기본 화투 48장에 보너스 쌍피 두 장을 더해요. 미션과 게임머니는 없어요. 손패는 톡 눌러
            내고, 길게 눌러 크게 볼 수 있어요.
          </p>
          <button className="primary" onClick={() => setRules(false)}>
            알겠어요
          </button>
        </Modal>
      )}
      {zoom && (
        <Modal title={zoom.title} onClose={() => setZoom(null)} className="zoom-modal">
          <div className="zoom-grid">
            {zoom.cards.map((c) => (
              <div key={c.id}>
                <Card card={c} />
                <strong>{c.isBonus ? '보너스' : `${c.month}월`}</strong>
                <span>{c.name.replace(/^\d+월 /, '')}</span>
                <small>
                  {c.isGodori
                    ? '고도리'
                    : c.ribbonType === 'HONGDAN'
                      ? '홍단'
                      : c.ribbonType === 'CHEONGDAN'
                        ? '청단'
                        : c.ribbonType === 'CHODAN'
                          ? '초단'
                          : c.specialType === 'KUKJIN'
                            ? '열끗 또는 쌍피'
                            : c.piValue === 2
                              ? '2피'
                              : ''}
                </small>
              </div>
            ))}
          </div>
          {!zoom.cards.length && <p className="muted">아직 먹은 패가 없어요.</p>}
        </Modal>
      )}
      {dealerNotice && view && screen === 'game' && !exit && (
        <Modal
          title="이번 판의 선"
          onClose={() => setDealerNotice(false)}
          className="dealer-notice"
        >
          <div className="dealer-portrait">{view.dealer === 0 ? '🐰' : '🐇'}</div>
          <p>
            <strong>{view.dealer === 0 ? '내가 선이에요' : '토끼가 선이에요'}</strong>
          </p>
          <p className="opening-bonus-note">
            {view.players[view.dealer].captured.filter((c) => c.isBonus).length > 0 &&
              `시작 보너스 ${view.players[view.dealer].captured.filter((c) => c.isBonus).length}장은 선이 가져갔어요. 바닥은 8장으로 보충했어요.`}
          </p>
          <p>
            {view.dealer === 0 ? '내 패부터 천천히 골라주세요.' : '준비되면 토끼가 먼저 패를 내요.'}
          </p>
          <button className="primary" onClick={() => setDealerNotice(false)}>
            게임 시작
          </button>
        </Modal>
      )}
      {special && (
        <Modal
          title={special.bomb ? '세 장을 함께 낼까요?' : '같은 무늬 세 장이에요'}
          onClose={() => setSpecial(null)}
        >
          <div className="rules-cards">
            {view?.hand
              .filter((c) => c.month === special.card.month)
              .map((c) => (
                <Card key={c.id} card={c} />
              ))}
          </div>
          <p>
            {special.bomb
              ? '폭탄으로 네 장을 먹고, 나중에 두 번 덱만 뒤집을 수 있어요. 이기면 점수가 두 배예요.'
              : '흔들면 상대에게 세 장을 보여주고, 이번 판에 이겼을 때 점수가 두 배예요.'}
          </p>
          <button
            className="primary"
            onClick={() =>
              dispatch(
                special.bomb
                  ? { type: 'BOMB', player: me, month: special.card.month }
                  : { type: 'PLAY_CARD', player: me, cardId: special.card.id, shake: true },
              )
            }
          >
            {special.bomb ? '폭탄 내기' : '흔들고 내기'}
          </button>
          <button
            className="secondary"
            onClick={() => dispatch({ type: 'PLAY_CARD', player: me, cardId: special.card.id })}
          >
            한 장만 그냥 내기
          </button>
        </Modal>
      )}
      {view?.phase === 'SELECT_FLOOR' && canPlay && !zoom && !settings && (
        <Modal title="어떤 패를 먹을까요?" onClose={() => {}} className="decision-modal">
          <p className="muted">같은 월 두 장 중 한 장을 골라주세요.</p>
          <div className="floor-choices">
            {view.floor
              .filter((c) => view.options.includes(c.id))
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => dispatch({ type: 'SELECT_FLOOR', player: me, cardId: c.id })}
                  aria-label={`${c.name} 선택`}
                >
                  <Card card={c} />
                  <span>{c.name.replace(/^\d+월 /, '')}</span>
                </button>
              ))}
          </div>
        </Modal>
      )}
      {view?.phase === 'GO_STOP' && canPlay && !zoom && !settings && (
        <Modal title="여기서 멈출까요?" onClose={() => {}} className="decision-modal">
          <span className="eyebrow">지금 선택할 수 있어요</span>
          <div className="decision-score">
            {view.scores[me].baseScore}
            <span>점</span>
          </div>
          <p>
            {view.players[me].goCount}고 · 현재 {view.scores[me].finalScore}점으로 정산
          </p>
          <div className="risk-badges">
            {view.scores[me].pibakMultiplier > 1 && <span>피박 ×2</span>}
            {view.scores[me].gwangbakMultiplier > 1 && <span>광박 ×2</span>}
            {view.scores[me].meongttaMultiplier > 1 && <span>멍따 ×2</span>}
          </div>
          <div className="decision-actions">
            <button className="secondary" onClick={() => dispatch({ type: 'GO', player: me })}>
              고<small>조금 더 이어가요</small>
            </button>
            <button className="primary" onClick={() => dispatch({ type: 'STOP', player: me })}>
              스톱<small>이번 판을 마쳐요</small>
            </button>
          </div>
        </Modal>
      )}
      {view?.result && !busy && !zoom && !settings && screen === 'game' && (
        <Modal
          title={
            view.result.winner === null
              ? '다음 판을 기약해요'
              : view.result.winner === me
                ? '기분 좋은 한 판!'
                : `${opponent}의 멋진 한 판`
          }
          onClose={() => {}}
          className="result-modal"
        >
          <span className="eyebrow">
            {round}번째 판 ·{' '}
            {view.result.reason === 'NAGARI'
              ? '나가리 · 다음 판 2배'
              : view.result.reason === 'CHONGTONG'
                ? '총통'
                : view.result.reason === 'THREE_PPUK'
                  ? '3뻑'
                  : view.result.reason === 'HEODANG'
                    ? '허당'
                    : '스톱'}
          </span>
          <div className="decision-score">
            {view.result.points}
            <span>점</span>
          </div>
          {view.result.winner !== null && (
            <p className="fine-print">
              {view.players[view.result.winner].goCount}고 · 흔들기{' '}
              {view.players[view.result.winner].shakes.length}회 · 폭탄{' '}
              {view.players[view.result.winner].bombs}회
            </p>
          )}
          {view.result.score && (
            <ScoreBreakdown score={view.result.score} fixed={view.result.reason !== 'STOP'} />
          )}
          <p className="fine-print">
            즉시 점수 · 나 {view.result.sidePoints[me]} / {opponent}{' '}
            {view.result.sidePoints[1 - me]}
            <br />
            {mode === 'single' ? '혼자 치기 누적' : '이번 모임'} · {stats.wins[me]}승{' '}
            {stats.wins[1 - me]}패 · 누적 {stats.points[me]}점
          </p>
          <button
            className="primary"
            disabled={mode === 'multi' && !!room?.nextReady[me]}
            onClick={nextRound}
          >
            {mode === 'multi' && room?.nextReady[me] ? '친구의 준비를 기다려요' : '한 판 더'}
          </button>
          <button className="text-button" onClick={leave}>
            대기실로
          </button>
        </Modal>
      )}
      {invite && room && (
        <Modal title="우리 화투판 초대" onClose={() => setInvite(false)}>
          <InviteContent code={room.code} url={inviteUrl} qr={qr} onError={setError} />
        </Modal>
      )}
      {mode === 'multi' && room?.closed && !exit && (
        <Modal
          title={
            room.expiresAt <= Date.now() ? '방 유지 시간이 끝났어요' : '친구가 방을 종료했어요'
          }
          onClose={leave}
        >
          <p>두 사람의 게임은 종료됐어요. 끝나지 않은 판은 승패에 반영하지 않아요.</p>
          <button className="primary" onClick={leave}>
            홈으로 돌아가기
          </button>
        </Modal>
      )}
      {exit && (
        <Modal title="대기실로 돌아갈까요?" onClose={() => setExit(false)}>
          <p>
            {mode === 'multi'
              ? '나가면 친구의 게임도 종료돼요. 잠깐 연결이 끊긴 경우에는 이 화면에서 기다리면 이어서 칠 수 있어요.'
              : '이번 판의 진행 상황은 저장되지 않아요.'}
          </p>
          <button className="primary" onClick={() => setExit(false)}>
            계속 치기
          </button>
          <button className="secondary" onClick={leave}>
            대기실로
          </button>
        </Modal>
      )}
      {debug && debugPanel && (
        <Modal title="개발 · 룰 검증" onClose={() => setDebugPanel(false)}>
          <label className="field">
            RNG seed
            <input value={seed} onChange={(e) => setSeed(e.target.value)} />
          </label>
          <button
            className="secondary"
            onClick={() => {
              setDebugPanel(false);
              startSingle();
            }}
          >
            seed로 새 판
          </button>
          <label className="toggle-row">
            애니메이션 건너뛰기
            <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
          </label>
          <fieldset>
            <legend>희귀 규칙 fixture · 내 1월 패를 내세요</legend>
            <div className="fixture-buttons">
              {[
                '뻑과 보너스',
                '바닥 두 장 · 따닥',
                '3장 폭탄',
                '폭탄과 피 강탈',
                '보너스 손패',
                '국화 선택',
                '국화 점수 선택',
                '흔들기',
                '자뻑',
                '열두 달 바닥',
              ].map((name) => (
                <button
                  className="secondary"
                  key={name}
                  onClick={() => void startDebugFixture(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </fieldset>
          <details>
            <summary>직접 패 분배</summary>
            <p className="fine-print">
              JSON: hand(내 패 ID 10장), floor(8장), draw(뒤집을 순서). 나머지는 seed로 섞습니다.
            </p>
            <textarea
              aria-label="직접 패 분배 JSON"
              value={customDeal}
              onChange={(e) => setCustomDeal(e.target.value)}
              placeholder={'{"hand":["m1-0",...],"floor":[...],"draw":[...]}'}
            />
            <button className="secondary" onClick={() => void startDebugFixture()}>
              이 분배로 시작
            </button>
          </details>
          <p>
            CPU 입력은 projectState만 사용합니다. 아래 원본 상태는 싱글플레이 개발 화면에서만
            표시됩니다.
          </p>
          <details>
            <summary>현재 GameState / deck 순서</summary>
            <pre>{JSON.stringify(logical.current, null, 2)}</pre>
          </details>
          <details>
            <summary>event log ({log.length})</summary>
            <pre>{JSON.stringify(log, null, 2)}</pre>
          </details>
        </Modal>
      )}
    </main>
  );
}
function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" fill="var(--surface,#f7f3e9)" />
      <circle cx="15" cy="17" r="3" fill="var(--surface,#f7f3e9)" />
    </svg>
  );
}
function PlayerInfo({
  name,
  score,
  go,
  active,
  dealer,
  wins,
  handCount,
  passes,
}: {
  name: string;
  score: number;
  go: number;
  active: boolean;
  dealer: boolean;
  wins: number;
  handCount?: number;
  passes?: number;
}) {
  return (
    <div className={`player-info ${active ? 'active' : ''}`}>
      <span className="player-name">
        <span className="player-dot" />
        {name}
        {handCount !== undefined && (
          <small className="hand-count" data-testid="opponent-hand">
            {handCount}장{passes ? ` · 뒤집기 ${passes}회` : ''}
          </small>
        )}
        {dealer && <small className="dealer-badge">선</small>}
        <small className="win-count">{wins}승</small>
      </span>
      <span className="player-score">
        {go > 0 && <small>{go}고</small>}
        <strong>{score}</strong>
        <span>점</span>
      </span>
    </div>
  );
}
function InviteContent({
  code,
  url,
  qr,
  onError,
}: {
  code: string;
  url: string;
  qr: string;
  onError: (s: string) => void;
}) {
  const share = async () => {
    try {
      if (navigator.share)
        await navigator.share({
          title: '토끼맞고 · 같이 한 판',
          text: `우리 화투판에 들어와요. 방 코드 ${code}`,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        onError('초대 링크를 복사했어요.');
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError'))
        onError('공유하지 못했어요. 아래 링크를 복사해주세요.');
    }
  };
  return (
    <div className="invite-content">
      <div className="room-code" data-testid="room-code">
        {code}
      </div>
      {qr && (
        <img className="qr" src={qr} width={180} height={180} alt={`방 ${code} 초대 QR 코드`} />
      )}
      <button className="primary" onClick={share}>
        초대 링크 보내기 ↗
      </button>
      <button
        className="secondary"
        onClick={() => {
          void navigator.clipboard
            .writeText(url)
            .then(() => onError('링크를 복사했어요.'))
            .catch(() => onError('아래 링크를 길게 눌러 복사해주세요.'));
        }}
      >
        링크 복사
      </button>
      <input aria-label="초대 링크" readOnly value={url} onFocus={(e) => e.target.select()} />
    </div>
  );
}
function ScoreBreakdown({
  score: s,
  fixed,
}: {
  score: NonNullable<GameState['result']>['score'] & {};
  fixed: boolean;
}) {
  const multipliers = [
    ['고 배수', s.goMultiplier],
    ['흔들기 / 폭탄', s.shakeMultiplier],
    ['피박', s.pibakMultiplier],
    ['광박', s.gwangbakMultiplier],
    ['멍따', s.meongttaMultiplier],
    ['고박', s.gobakMultiplier],
    ['전판 나가리', s.nagariMultiplier],
  ] as const;
  return (
    <dl className="breakdown">
      <div>
        <dt>광 · 열끗 · 띠 · 피</dt>
        <dd>
          {s.gwangScore} · {s.yeolScore + s.godoriScore} ·{' '}
          {s.ribbonScore + s.hongdanScore + s.cheongdanScore + s.chodanScore} · {s.piScore}
        </dd>
      </div>
      <div>
        <dt>기본 점수</dt>
        <dd>{s.baseScore}점</dd>
      </div>
      {!fixed && s.goBonus > 0 && (
        <div>
          <dt>고 추가점</dt>
          <dd>+{s.goBonus}</dd>
        </div>
      )}
      {multipliers
        .filter(([label, n]) => n > 1 && (!fixed || label === '전판 나가리'))
        .map(([label, n]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>×{n}</dd>
          </div>
        ))}
      {fixed && (
        <div>
          <dt>특수 승리</dt>
          <dd>족보 대신 고정 점수</dd>
        </div>
      )}
    </dl>
  );
}
