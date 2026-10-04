import { CARDS, createDeck, seededRandom, shuffle, piValue } from './cards';
import { calculateScore } from './score';
import {
  RULES,
  type GameState,
  type PlayerState,
  type PlayerId,
  type GameAction,
  type GameEvent,
  type ActionResult,
  type GameView,
} from './types';
export function emptyPlayer(): PlayerState {
  return {
    hand: [],
    captured: [],
    goCount: 0,
    goAtScore: 0,
    shakes: [],
    bombs: 0,
    bombPasses: 0,
    turnsRemaining: 10,
    ppukCount: 0,
    openingPpukStreak: 0,
    emptyStreak: 0,
    kukjinAsPi: false,
    sidePoints: 0,
  };
}
export function createGame(
  options: {
    seed?: number;
    rng?: () => number;
    dealer?: PlayerId;
    nagariMultiplier?: number;
    deck?: ReturnType<typeof createDeck>;
  } = {},
): GameState {
  const rng = options.rng ?? seededRandom(options.seed ?? Date.now());
  let a = 1,
    b = 1;
  while (a === b) {
    a = 1 + Math.floor(rng() * 12);
    b = 1 + Math.floor(rng() * 12);
  }
  const dealer = options.dealer ?? (a < b ? 0 : 1);
  let deck = options.deck ? [...options.deck] : shuffle(createDeck(), rng);
  let players: [PlayerState, PlayerState], floor: GameState['floor'];
  for (let tries = 0; ; tries++) {
    players = [emptyPlayer(), emptyPlayer()];
    players[0].hand = deck.splice(0, 10);
    players[1].hand = deck.splice(0, 10);
    floor = deck.splice(0, 8);
    while (floor.some((c) => c.isBonus)) {
      const bonus = floor.filter((c) => c.isBonus);
      players[dealer].captured.push(...bonus);
      floor = floor.filter((c) => !c.isBonus);
      floor.push(...deck.splice(0, bonus.length));
    }
    if (!floor.some((c) => floor.filter((x) => x.month === c.month).length === 4)) break;
    if (options.deck) throw new Error('초기 바닥 4장: 재분배 필요');
    if (tries > 100) throw new Error('분배 실패');
    deck = shuffle(createDeck(), rng);
  }
  const s: GameState = {
    players,
    floor,
    deck,
    currentPlayer: dealer,
    dealer,
    dealerDraw: [a, b],
    phase: 'PLAY',
    turn: null,
    ppukOwners: {},
    bonusAttachments: {},
    lastGo: null,
    nagariMultiplier: options.nagariMultiplier ?? 1,
    stateVersion: 0,
    turnNumber: 1,
    result: null,
  };
  const chong = players.map((p) =>
    p.hand.some((c) => !c.isBonus && p.hand.filter((x) => x.month === c.month).length === 4),
  );
  if (chong[0] && chong[1]) finish(s, null, 'NAGARI');
  else if (chong[0] || chong[1]) finish(s, chong[0] ? 0 : 1, 'CHONGTONG', 10);
  assertInvariant(s);
  return s;
}
function finish(
  s: GameState,
  winner: PlayerId | null,
  reason: NonNullable<GameState['result']>['reason'],
  fixed?: number,
) {
  s.phase = 'FINISHED';
  const score =
    winner === null
      ? null
      : calculateScore(s.players[winner], s.players[1 - winner], {
          lastGo: s.lastGo,
          playerId: winner,
          nagariMultiplier: s.nagariMultiplier,
        });
  s.result = {
    winner,
    reason,
    score,
    points: fixed !== undefined ? fixed * s.nagariMultiplier : (score?.finalScore ?? 0),
    sidePoints: [s.players[0].sidePoints, s.players[1].sidePoints],
  };
}
function matches(s: GameState, month: number) {
  return s.floor.filter((c) => !c.isBonus && c.month === month);
}
function takeFloor(s: GameState, cards: GameState['floor']) {
  const ids = new Set(cards.map((c) => c.id));
  s.floor = s.floor.filter((c) => !ids.has(c.id));
}
function capturePpuk(s: GameState, month: number, events: GameEvent[]) {
  const t = s.turn!;
  const owner = s.ppukOwners[month];
  if (owner !== undefined) {
    const self = owner === s.currentPlayer;
    t.transfer += self ? 2 : 1;
    events.push({
      type: self ? 'SELF_PPUK' : 'PPUK_CAPTURED',
      player: s.currentPlayer,
      label: self ? '자뻑' : '상대 뻑',
    });
    delete s.ppukOwners[month];
  }
  const attached = s.floor.filter((c) => s.bonusAttachments[c.id] === month);
  takeFloor(s, attached);
  t.captured.push(...attached);
  attached.forEach((c) => delete s.bonusAttachments[c.id]);
}
function reveal(s: GameState, events: GameEvent[]) {
  const t = s.turn!;
  t.stage = 'deck';
  let card = s.deck.shift();
  while (card?.isBonus) {
    t.bonuses.push(card);
    events.push({
      type: 'DECK_CARD_REVEALED',
      player: s.currentPlayer,
      cards: [card],
      stage: 'deck',
      label: '보너스 쌍피',
    });
    card = s.deck.shift();
  }
  t.revealed = card ?? null;
  if (card)
    events.push({
      type: 'DECK_CARD_REVEALED',
      player: s.currentPlayer,
      cards: [card],
      stage: 'deck',
    });
  if (t.played && card?.month === t.played.month) {
    if (t.playMatches.length === 1 && !t.last) {
      s.floor.push(t.played, card, ...t.bonuses);
      t.bonuses.forEach((c) => (s.bonusAttachments[c.id] = card!.month));
      s.ppukOwners[card.month] = s.currentPlayer;
      t.played = null;
      t.revealed = null;
      t.bonuses = [];
      const p = s.players[s.currentPlayer];
      p.ppukCount++;
      if (p.openingPpukStreak === 10 - p.turnsRemaining) {
        p.openingPpukStreak++;
        p.sidePoints += 7 * p.openingPpukStreak;
      }
      p.emptyStreak++;
      events.push({ type: 'PPUK_OCCURRED', player: s.currentPlayer, label: '뻑' });
      endTurn(s, events);
      return;
    }
    if (t.playMatches.length === 2) {
      takeFloor(s, t.playMatches);
      t.captured.push(t.played, card, ...t.playMatches);
      t.played = null;
      t.revealed = null;
      if (!t.last) t.transfer++;
      if (s.players[s.currentPlayer].turnsRemaining === 10)
        s.players[s.currentPlayer].sidePoints += 7;
      events.push({ type: 'TTADAK', player: s.currentPlayer, label: '따닥' });
      complete(s, events);
      return;
    }
    if (t.playMatches.length === 0 && !t.bomb) {
      t.captured.push(t.played, card);
      t.played = null;
      t.revealed = null;
      if (!t.last) {
        t.transfer++;
        events.push({ type: 'JJOK', player: s.currentPlayer, label: '쪽' });
      }
      complete(s, events);
      return;
    }
  }
  // Resolve the hand capture before resolving the draw; the one-match case remains provisional until now.
  if (t.played) {
    if (t.playMatches.length) {
      const chosen = t.playMatches.length === 3 ? t.playMatches : [t.chosen ?? t.playMatches[0]];
      takeFloor(s, chosen);
      t.captured.push(t.played, ...chosen);
      if (chosen.length === 3) capturePpuk(s, t.played.month, events);
    } else s.floor.push(t.played);
    t.played = null;
  }
  if (!card) {
    complete(s, events);
    return;
  }
  const available = matches(s, card.month);
  if (available.length === 2) {
    t.options = available.map((c) => c.id);
    s.phase = 'SELECT_FLOOR';
    events.push({
      type: 'FLOOR_MATCH_REQUIRED',
      player: s.currentPlayer,
      cards: available,
      stage: 'deck',
    });
    return;
  }
  resolveDraw(s, available, events);
}
function resolveDraw(s: GameState, chosen: GameState['floor'], events: GameEvent[]) {
  const t = s.turn!;
  if (t.revealed) {
    if (chosen.length) {
      takeFloor(s, chosen);
      t.captured.push(t.revealed, ...chosen);
      if (chosen.length === 3) capturePpuk(s, t.revealed.month, events);
      events.push({
        type: 'FLOOR_MATCHED',
        player: s.currentPlayer,
        cards: [t.revealed, ...chosen],
        stage: 'deck',
      });
    } else s.floor.push(t.revealed);
    t.revealed = null;
  }
  complete(s, events);
}
function complete(s: GameState, events: GameEvent[]) {
  const t = s.turn!;
  t.captured.push(...t.bonuses);
  t.bonuses = [];
  if (t.captured.length && !s.floor.length && !t.last) {
    t.transfer++;
    events.push({ type: 'SWEEP', player: s.currentPlayer, label: '쓸' });
  }
  if (t.captured.length) {
    s.players[s.currentPlayer].captured.push(...t.captured);
    events.push({ type: 'CARDS_CAPTURED', player: s.currentPlayer, cards: [...t.captured] });
  }
  t.captured = [];
  const other = s.players[1 - s.currentPlayer],
    mine = s.players[s.currentPlayer];
  let remaining = t.transfer;
  while (remaining > 0) {
    const pi = other.captured
      .filter((c) => piValue(c, other.kukjinAsPi) > 0)
      .sort((a, b) => piValue(a, other.kukjinAsPi) - piValue(b, other.kukjinAsPi))[0];
    if (!pi) break;
    other.captured = other.captured.filter((c) => c.id !== pi.id);
    mine.captured.push(pi);
    if (pi.specialType === 'KUKJIN') mine.kukjinAsPi = true;
    remaining -= piValue(pi, other.kukjinAsPi);
    events.push({ type: 'PI_TRANSFERRED', player: s.currentPlayer, cards: [pi] });
  }
  if (!events.some((e) => e.type === 'CARDS_CAPTURED')) mine.emptyStreak++;
  else mine.emptyStreak = 0;
  endTurn(s, events);
}
function endTurn(s: GameState, events: GameEvent[]) {
  const p = s.players[s.currentPlayer];
  p.turnsRemaining--;
  s.turn = null;
  events.push({
    type: 'SCORE_CHANGED',
    player: s.currentPlayer,
    points: calculateScore(p).baseScore,
  });
  if (p.ppukCount >= 3) {
    finish(s, s.currentPlayer, 'THREE_PPUK', 7);
  } else if (p.emptyStreak >= 5) {
    finish(s, s.currentPlayer, 'HEODANG', 7);
  } else {
    decideScore(s, events, true);
  }
  if (s.phase === 'FINISHED')
    events.push({
      type: 'GAME_FINISHED',
      player: s.currentPlayer,
      label: s.result?.reason === 'NAGARI' ? '나가리' : '판 종료',
    });
}
function decideScore(s: GameState, events: GameEvent[], offerKukjin: boolean) {
  const p = s.players[s.currentPlayer];
  if (offerKukjin && !p.kukjinAsPi && p.captured.some((c) => c.specialType === 'KUKJIN')) {
    const withPi = calculateScore({ ...p, kukjinAsPi: true }).baseScore;
    if (withPi >= RULES.stopScore && withPi > p.goAtScore) {
      s.phase = 'SELECT_KUKJIN';
      events.push({ type: 'KUKJIN_REQUIRED', player: s.currentPlayer });
      return;
    }
  }
  const score = calculateScore(p).baseScore;
  if (score >= RULES.stopScore && score > p.goAtScore) {
    if (p.turnsRemaining === 0) finish(s, s.currentPlayer, 'STOP');
    else {
      s.phase = 'GO_STOP';
      events.push({ type: 'GO_STOP_REQUIRED', player: s.currentPlayer });
    }
  } else advance(s, events);
}
function advance(s: GameState, events: GameEvent[]) {
  events.push({ type: 'TURN_ENDED', player: s.currentPlayer });
  s.turnNumber++;
  if (s.players.every((p) => p.turnsRemaining === 0)) {
    finish(s, null, 'NAGARI');
    return;
  }
  s.currentPlayer = (1 - s.currentPlayer) as PlayerId;
  if (s.players[s.currentPlayer].turnsRemaining === 0)
    s.currentPlayer = (1 - s.currentPlayer) as PlayerId;
  s.phase = 'PLAY';
}
export function applyAction(state: GameState, action: GameAction): ActionResult {
  if (state.phase === 'FINISHED') throw new Error('이미 끝난 판입니다.');
  if (action.player !== state.currentPlayer) throw new Error('자신의 차례가 아닙니다.');
  const s: GameState = structuredClone(state),
    events: GameEvent[] = [];
  const p = s.players[action.player];
  if (action.type === 'GO' || action.type === 'STOP') {
    if (s.phase !== 'GO_STOP') throw new Error('고/스톱을 선택할 수 없습니다.');
    if (action.type === 'STOP') {
      finish(s, action.player, 'STOP');
      events.push({ type: 'GAME_FINISHED', player: action.player, label: '스톱' });
    } else {
      p.goCount++;
      p.goAtScore = calculateScore(p).baseScore;
      s.lastGo = action.player;
      events.push({ type: 'GO_DECLARED', player: action.player, label: `${p.goCount}고` });
      if (s.continueTurnAfterGo) s.phase = 'PLAY';
      else advance(s, events);
    }
    delete s.continueTurnAfterGo;
  } else if (action.type === 'SET_KUKJIN') {
    const choosing = s.phase === 'SELECT_KUKJIN';
    if (
      (!choosing && s.phase !== 'PLAY') ||
      p.kukjinAsPi ||
      !p.captured.some((c) => c.specialType === 'KUKJIN') ||
      (action.asPi !== undefined && typeof action.asPi !== 'boolean') ||
      (!choosing && action.asPi === false)
    )
      throw new Error('국화를 바꿀 수 없습니다.');
    if (action.asPi !== false) {
      p.kukjinAsPi = true;
      events.push({ type: 'KUKJIN_CHANGED', player: action.player, label: '국화 → 쌍피' });
      events.push({
        type: 'SCORE_CHANGED',
        player: action.player,
        points: calculateScore(p).baseScore,
      });
    }
    if (choosing) {
      decideScore(s, events, false);
      if (s.phase === 'FINISHED')
        events.push({ type: 'GAME_FINISHED', player: action.player, label: '스톱' });
    } else {
      const score = calculateScore(p).baseScore;
      if (score >= RULES.stopScore && score > p.goAtScore) {
        s.phase = 'GO_STOP';
        s.continueTurnAfterGo = true;
        events.push({ type: 'GO_STOP_REQUIRED', player: action.player });
      }
    }
  } else if (action.type === 'SELECT_FLOOR') {
    if (s.phase !== 'SELECT_FLOOR' || !s.turn?.options.includes(action.cardId))
      throw new Error('먹을 패를 다시 선택해주세요.');
    const card = s.floor.find((c) => c.id === action.cardId)!;
    s.phase = 'PLAY';
    s.turn.options = [];
    if (s.turn.stage === 'hand') {
      s.turn.chosen = card;
      events.push({
        type: 'FLOOR_MATCHED',
        player: action.player,
        cards: [s.turn.played!, card],
        stage: 'hand',
      });
      reveal(s, events);
    } else resolveDraw(s, [card], events);
  } else {
    if (s.phase !== 'PLAY' || s.turn) throw new Error('이전 선택을 마쳐주세요.');
    s.turn = {
      played: null,
      playMatches: [],
      chosen: null,
      revealed: null,
      bonuses: [],
      captured: [],
      transfer: 0,
      last: p.turnsRemaining === 1,
      bomb: false,
      stage: 'hand',
      options: [],
    };
    if (action.type === 'PASS') {
      if (p.bombPasses <= 0) throw new Error('폭탄 뒤집기 권리가 없습니다.');
      p.bombPasses--;
      reveal(s, events);
    } else if (action.type === 'BOMB') {
      const cards = p.hand.filter((c) => c.month === action.month && !c.isBonus),
        floor = matches(s, action.month);
      if (cards.length !== 3 || floor.length !== 1) throw new Error('3장 폭탄 조건이 아닙니다.');
      p.hand = p.hand.filter((c) => c.month !== action.month);
      p.bombs++;
      p.bombPasses += 2;
      s.turn.bomb = true;
      s.turn.captured.push(...cards, ...floor);
      takeFloor(s, floor);
      s.turn.transfer++;
      events.push({ type: 'BOMB', player: action.player, cards, label: '폭탄', stage: 'hand' });
      reveal(s, events);
    } else if (action.type === 'PLAY_CARD') {
      const card = p.hand.find((c) => c.id === action.cardId);
      if (!card) throw new Error('가지고 있지 않은 패입니다.');
      if (action.shake) {
        const trio = p.hand.filter((c) => c.month === card.month && !c.isBonus);
        if (trio.length !== 3 || matches(s, card.month).length || p.shakes.includes(card.month))
          throw new Error('흔들 수 없는 패입니다.');
        p.shakes.push(card.month);
        events.push({ type: 'SHAKE', player: action.player, cards: trio, label: '흔들기' });
      }
      p.hand = p.hand.filter((c) => c.id !== card.id);
      events.push({ type: 'CARD_PLAYED', player: action.player, cards: [card], stage: 'hand' });
      if (card.isBonus) {
        p.captured.push(card);
        const replacement = s.deck.shift();
        if (replacement) p.hand.push(replacement);
        s.turn = null;
        events.push({
          type: 'BONUS_CAPTURED',
          player: action.player,
          cards: [card],
          label: '보너스 쌍피',
        });
      } else {
        s.turn.played = card;
        s.turn.playMatches = matches(s, card.month);
        if (s.turn.playMatches.length === 2) {
          s.phase = 'SELECT_FLOOR';
          s.turn.options = s.turn.playMatches.map((c) => c.id);
          events.push({
            type: 'FLOOR_MATCH_REQUIRED',
            player: action.player,
            cards: s.turn.playMatches,
            stage: 'hand',
          });
        } else {
          if (s.turn.playMatches.length)
            events.push({
              type: 'FLOOR_MATCHED',
              player: action.player,
              cards: [card, ...s.turn.playMatches],
              stage: 'hand',
            });
          reveal(s, events);
        }
      }
    }
  }
  s.stateVersion++;
  assertInvariant(s);
  return { nextState: s, events };
}
export function assertInvariant(s: GameState) {
  const cards = [...s.players.flatMap((p) => [...p.hand, ...p.captured]), ...s.floor, ...s.deck];
  if (s.turn) {
    cards.push(...s.turn.captured, ...s.turn.bonuses);
    if (s.turn.played) cards.push(s.turn.played);
    if (s.turn.revealed) cards.push(s.turn.revealed);
  }
  const ids = cards.map((c) => c.id);
  if (
    ids.length !== 50 ||
    new Set(ids).size !== 50 ||
    ids.some((id) => !CARDS.some((c) => c.id === id))
  )
    throw new Error(`카드 invariant 위반 (${ids.length}/${new Set(ids).size})`);
  s.players.forEach((p) => {
    if (
      p.turnsRemaining < 0 ||
      p.hand.length + p.bombPasses + (s.turn && s.players[s.currentPlayer] === p ? 1 : 0) !==
        p.turnsRemaining
    )
      throw new Error('턴/손패 invariant 위반');
  });
}
export function projectState(s: GameState, player: PlayerId): GameView {
  const publicPlayers = s.players.map((p) => {
    const { hand, ...rest } = p;
    return { ...rest, handCount: hand.length };
  }) as GameView['players'];
  return {
    players: publicPlayers,
    hand: [...s.players[player].hand],
    floor: [...s.floor],
    deckCount: s.deck.length,
    bonusAttachments: { ...s.bonusAttachments },
    currentPlayer: s.currentPlayer,
    dealer: s.dealer,
    dealerDraw: s.dealerDraw,
    phase: s.phase,
    options: s.turn?.options ?? [],
    turnCards: s.turn
      ? [s.turn.played, s.turn.revealed, ...s.turn.captured].filter(
          (c): c is NonNullable<typeof c> => !!c,
        )
      : [],
    stateVersion: s.stateVersion,
    turnNumber: s.turnNumber,
    result: s.result,
    nagariMultiplier: s.nagariMultiplier,
    lastGo: s.lastGo,
    scores: s.players.map((p, id) =>
      calculateScore(p, s.players[1 - id], {
        playerId: id,
        lastGo: s.lastGo,
        nagariMultiplier: s.nagariMultiplier,
      }),
    ) as GameView['scores'],
  };
}
