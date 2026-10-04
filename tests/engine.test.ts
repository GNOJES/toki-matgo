import { describe, it, expect } from 'vitest';
import { CARDS, createDeck, seededRandom, shuffle } from '../src/game-engine/cards';
import {
  applyAction,
  assertInvariant,
  createGame,
  emptyPlayer,
  projectState,
} from '../src/game-engine/engine';
import { calculateScore } from '../src/game-engine/score';
import { chooseAction } from '../src/game-engine/ai';
import type { GameState, PlayerState, Card } from '../src/game-engine/types';
const cards = (...ids: string[]) =>
  ids.map((id) => {
    const c = CARDS.find((x) => x.id === id);
    if (!c) throw Error(id);
    return c;
  });
function scored(ids: string[], props: Partial<PlayerState> = {}) {
  return { ...emptyPlayer(), captured: cards(...ids), ...props };
}
function fixture(
  hand: string[],
  floor: string[],
  draw: string[],
  props: Partial<PlayerState> = {},
): GameState {
  const p = { ...emptyPlayer(), hand: cards(...hand), turnsRemaining: hand.length, ...props };
  const used = new Set([...hand, ...floor, ...draw, ...p.captured.map((c) => c.id)]);
  const other = {
    ...emptyPlayer(),
    hand: [],
    turnsRemaining: 0,
    captured: CARDS.filter((c) => !used.has(c.id)),
  };
  return {
    players: [p, other],
    floor: cards(...floor),
    deck: cards(...draw),
    currentPlayer: 0,
    dealer: 0,
    dealerDraw: [1, 2],
    phase: 'PLAY',
    turn: null,
    ppukOwners: {},
    bonusAttachments: {},
    lastGo: null,
    nagariMultiplier: 1,
    stateVersion: 0,
    turnNumber: 1,
    result: null,
  };
}
const play = (s: GameState, id: string) =>
  applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: id });
describe('deck & setup', () => {
  it('50 identities / 48 originals / exactly two double bonuses', () => {
    const d = createDeck();
    expect(d).toHaveLength(50);
    expect(new Set(d.map((c) => c.id)).size).toBe(50);
    expect(d.filter((c) => c.isBonus)).toHaveLength(2);
    expect(d.filter((c) => c.isBonus).every((c) => c.piValue === 2)).toBe(true);
    for (let i = 1; i <= 12; i++) expect(d.filter((c) => c.month === i)).toHaveLength(4);
  });
  it('shuffle identity and seed determinism', () => {
    expect(shuffle(CARDS, seededRandom(4))).toEqual(shuffle(CARDS, seededRandom(4)));
    expect(
      shuffle(CARDS, seededRandom(8))
        .map((c) => c.id)
        .sort(),
    ).toEqual(CARDS.map((c) => c.id).sort());
    expect(createGame({ seed: 123 })).toEqual(createGame({ seed: 123 }));
  });
  it('initial deal and bonus pickup conserve all cards', () => {
    for (let seed = 1; seed < 100; seed++) {
      const s = createGame({ seed });
      expect(s.players.map((p) => p.hand.length)).toEqual([10, 10]);
      expect(s.floor).toHaveLength(8);
      expect(s.floor.some((c) => c.isBonus)).toBe(false);
      assertInvariant(s);
    }
  });
  it('initial floor bonus belongs to dealer, replacements maintained', () => {
    let s: GameState | undefined;
    for (let seed = 0; seed < 100; seed++) {
      const g = createGame({ seed, dealer: 0 });
      if (g.players[0].captured.some((c) => c.isBonus)) {
        s = g;
        break;
      }
    }
    expect(s).toBeDefined();
    expect(s!.floor).toHaveLength(8);
  });
  it.each([0, 1] as const)(
    'dealer %i captures consecutive opening bonuses and refills eight floor cards',
    (dealer) => {
      const regular = CARDS.filter((c) => !c.isBonus).sort(
        (a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]),
      );
      const deck = [
        ...regular.slice(0, 20),
        ...cards('bonus-0'),
        ...regular.slice(20, 27),
        ...cards('bonus-1'),
        ...regular.slice(27),
      ];
      const s = createGame({ deck, dealer });
      expect(s.players[dealer].captured.map((c) => c.id)).toEqual(['bonus-0', 'bonus-1']);
      expect(s.players[1 - dealer].captured).toHaveLength(0);
      expect(s.floor).toHaveLength(8);
      expect(s.floor.some((c) => c.isBonus)).toBe(false);
      expect(s.deck).toHaveLength(20);
      assertInvariant(s);
    },
  );
  it('initial chongtong ends at 10 without continuing', () => {
    const head = cards('m1-0', 'm1-1', 'm1-2', 'm1-3');
    const deck = [
      ...head,
      ...shuffle(
        CARDS.filter((c) => !head.includes(c)),
        seededRandom(7),
      ),
    ];
    const s = createGame({ deck, dealer: 0 });
    expect(s.result?.reason).toBe('CHONGTONG');
    expect(s.result?.points).toBe(10);
  });
});
describe('matching and special events', () => {
  it('no match leaves played and draw on floor', () => {
    const s = fixture(['m1-2', 'm2-2'], ['m3-2'], ['m4-2']);
    const r = play(s, 'm1-2');
    expect(r.nextState.floor.map((c) => c.id)).toEqual(['m3-2', 'm1-2', 'm4-2']);
    expect(s.stateVersion).toBe(0);
  });
  it('single match captures pair', () => {
    const r = play(fixture(['m1-2', 'm2-2'], ['m1-3', 'm3-2'], ['m4-2']), 'm1-2');
    expect(r.nextState.players[0].captured.map((c) => c.id)).toContain('m1-3');
  });
  it('two matches pause, reject bad selection, then resolve selected card', () => {
    const r = play(fixture(['m1-2', 'm2-2'], ['m1-0', 'm1-1', 'm3-2'], ['m4-2']), 'm1-2');
    expect(r.nextState.phase).toBe('SELECT_FLOOR');
    assertInvariant(r.nextState);
    expect(() =>
      applyAction(r.nextState, { type: 'SELECT_FLOOR', player: 0, cardId: 'm3-2' }),
    ).toThrow();
    const next = applyAction(r.nextState, {
      type: 'SELECT_FLOOR',
      player: 0,
      cardId: 'm1-0',
    }).nextState;
    expect(next.players[0].captured.some((c) => c.id === 'm1-0')).toBe(true);
    expect(next.floor.some((c) => c.id === 'm1-1')).toBe(true);
  });
  it('three on floor captures all four', () => {
    const r = play(fixture(['m1-2', 'm2-2'], ['m1-0', 'm1-1', 'm1-3', 'm3-2'], ['m4-2']), 'm1-2');
    expect(r.nextState.players[0].captured.filter((c) => c.month === 1)).toHaveLength(4);
  });
  it('deck matching with two requires another choice', () => {
    const r = play(fixture(['m1-2', 'm2-2'], ['m4-0', 'm4-1'], ['m4-2']), 'm1-2');
    expect(r.nextState.phase).toBe('SELECT_FLOOR');
    expect(r.nextState.turn?.stage).toBe('deck');
    const n = applyAction(r.nextState, {
      type: 'SELECT_FLOOR',
      player: 0,
      cardId: 'm4-0',
    }).nextState;
    expect(n.players[0].captured.map((c) => c.id)).toContain('m4-0');
  });
  it('ppuk keeps three and revealed bonus on floor', () => {
    const r = play(fixture(['m1-2', 'm2-2'], ['m1-0'], ['bonus-0', 'm1-1']), 'm1-2');
    expect(r.nextState.floor).toHaveLength(4);
    expect(r.nextState.ppukOwners[1]).toBe(0);
    expect(r.nextState.bonusAttachments['bonus-0']).toBe(1);
    expect(projectState(r.nextState, 0).bonusAttachments['bonus-0']).toBe(1);
    expect(r.events.some((e) => e.type === 'PPUK_OCCURRED')).toBe(true);
  });
  it.each([0, 1] as const)('ppuk owner %i determines one/two pi transfer', (owner) => {
    const s = fixture(['m1-3', 'm2-2'], ['m1-0', 'm1-1', 'm1-2', 'm3-2', 'bonus-0'], ['m4-2']);
    s.ppukOwners[1] = owner;
    s.bonusAttachments['bonus-0'] = 1;
    const r = play(s, 'm1-3');
    expect(r.events.filter((e) => e.type === 'PI_TRANSFERRED')).toHaveLength(owner === 0 ? 2 : 1);
    expect(r.nextState.players[0].captured.some((c) => c.id === 'bonus-0')).toBe(true);
  });
  it('jjok / sweep emit separate transfers', () => {
    const r = play(fixture(['m1-2', 'm2-2'], [], ['m1-3']), 'm1-2');
    expect(r.events.map((e) => e.type)).toContain('JJOK');
    expect(r.events.map((e) => e.type)).toContain('SWEEP');
    expect(r.events.filter((e) => e.type === 'PI_TRANSFERRED')).toHaveLength(2);
  });
  it('ttadak collects four after hand selection', () => {
    const s = fixture(['m1-2', 'm2-2'], ['m1-0', 'm1-1', 'm3-2'], ['m1-3']);
    const first = play(s, 'm1-2');
    const r = applyAction(first.nextState, { type: 'SELECT_FLOOR', player: 0, cardId: 'm1-0' });
    expect(r.events.map((e) => e.type)).toContain('TTADAK');
    expect(r.nextState.players[0].captured.filter((c) => c.month === 1)).toHaveLength(4);
  });
  it('last regular turn excludes ppuk / jjok', () => {
    const r = play(fixture(['m1-2'], ['m1-0'], ['m1-1']), 'm1-2');
    expect(r.events.some((e) => e.type === 'PPUK_OCCURRED')).toBe(false);
    expect(r.nextState.players[0].captured.filter((c) => c.month === 1)).toHaveLength(2);
    const j = play(fixture(['m1-2'], [], ['m1-3']), 'm1-2');
    expect(j.events.some((e) => e.type === 'JJOK' || e.type === 'SWEEP')).toBe(false);
  });
  it('shake is optional, public and doubles only on victory', () => {
    const s = fixture(['m1-0', 'm1-1', 'm1-2', 'm2-2'], ['m3-2'], ['m4-2']);
    const r = applyAction(s, { type: 'PLAY_CARD', player: 0, cardId: 'm1-0', shake: true });
    expect(r.nextState.players[0].shakes).toEqual([1]);
    expect(r.events[0].cards).toHaveLength(3);
    expect(calculateScore(r.nextState.players[0]).shakeMultiplier).toBe(2);
  });
  it('three-card bomb gives two pass rights, no two-card bomb', () => {
    const s = fixture(['m1-0', 'm1-1', 'm1-2'], ['m1-3', 'm3-2'], ['m4-2', 'm5-2', 'm6-2']);
    const r = applyAction(s, { type: 'BOMB', player: 0, month: 1 });
    expect(r.nextState.players[0].bombPasses).toBe(2);
    expect(r.nextState.players[0].turnsRemaining).toBe(2);
    const n = applyAction(r.nextState, { type: 'PASS', player: 0 }).nextState;
    assertInvariant(n);
    expect(n.players[0].bombPasses).toBe(1);
    expect(() =>
      applyAction(fixture(['m1-0', 'm1-1'], ['m1-3'], ['m4-2']), {
        type: 'BOMB',
        player: 0,
        month: 1,
      }),
    ).toThrow();
  });
  it('third ppuk terminates even without normal score', () => {
    const s = fixture(['m1-2', 'm2-2'], ['m1-0'], ['m1-1'], { ppukCount: 2 });
    const r = play(s, 'm1-2');
    expect(r.nextState.result?.reason).toBe('THREE_PPUK');
    expect(r.nextState.result?.points).toBe(7);
  });
  it('first ppuk awards side score and first ttadak awards 7', () => {
    const s = fixture(['m1-2', 'm2-2'], ['m1-0'], ['m1-1']);
    s.players[0].turnsRemaining = 10;
    s.players[0].bombPasses = 8;
    const r = play(s, 'm1-2');
    expect(r.nextState.players[0].sidePoints).toBe(7);
  });
  it('fifth empty turn is heodang', () => {
    const s = fixture(['m1-2', 'm2-2'], ['m3-2'], ['m4-2'], { emptyStreak: 4 });
    expect(play(s, 'm1-2').nextState.result?.reason).toBe('HEODANG');
  });
  it('both out of turns without score is nagari', () => {
    expect(play(fixture(['m1-2'], ['m3-2'], ['m4-2']), 'm1-2').nextState.result?.reason).toBe(
      'NAGARI',
    );
  });
});
describe('bonus', () => {
  it('hand bonus replaces hand, same turn, no stealing', () => {
    const s = fixture(['bonus-0', 'm1-2'], ['m3-2'], ['m4-2']);
    const r = play(s, 'bonus-0');
    expect(r.nextState.currentPlayer).toBe(0);
    expect(r.nextState.players[0].hand.map((c) => c.id)).toEqual(['m1-2', 'm4-2']);
    expect(r.events.some((e) => e.type === 'PI_TRANSFERRED')).toBe(false);
    assertInvariant(r.nextState);
  });
  it('revealed bonuses both captured / four pi, no direct steal', () => {
    const r = play(fixture(['m1-2', 'm2-2'], ['m3-2'], ['bonus-0', 'bonus-1', 'm4-2']), 'm1-2');
    expect(calculateScore(r.nextState.players[0]).piCount).toBe(4);
    expect(r.events.filter((e) => e.type === 'DECK_CARD_REVEALED')).toHaveLength(3);
    expect(r.events.some((e) => e.type === 'PI_TRANSFERRED')).toBe(false);
  });
});
describe('score fixtures', () => {
  it.each([
    [['m1-0', 'm3-0', 'm8-0'], 3],
    [['m1-0', 'm3-0', 'm12-0'], 2],
    [['m1-0', 'm3-0', 'm8-0', 'm12-0'], 4],
    [['m1-0', 'm3-0', 'm8-0', 'm11-0', 'm12-0'], 15],
  ] as [string[], number][])('gwang %j → %i', (ids, n) =>
    expect(calculateScore(scored(ids)).gwangScore).toBe(n),
  );
  it('godori / animal counts', () => {
    const s = calculateScore(scored(['m2-0', 'm4-0', 'm8-1', 'm5-0', 'm6-0']));
    expect(s.yeolScore).toBe(1);
    expect(s.godoriScore).toBe(5);
  });
  it.each([
    ['HONGDAN', ['m1-1', 'm2-1', 'm3-1'], 'hongdanScore'],
    ['CHEONGDAN', ['m6-1', 'm9-1', 'm10-1'], 'cheongdanScore'],
    ['CHODAN', ['m4-1', 'm5-1', 'm7-1'], 'chodanScore'],
  ] as const)('%s gives 3', (_, ids, key) => expect(calculateScore(scored([...ids]))[key]).toBe(3));
  it('rain ribbon excluded from chodan, ribbons +1 after five', () => {
    const s = calculateScore(scored(['m4-1', 'm5-1', 'm12-2', 'm1-1', 'm6-1']));
    expect(s.chodanScore).toBe(0);
    expect(s.ribbonScore).toBe(1);
  });
  it('pi weighted and kukjin never counted twice', () => {
    const p = scored(['m1-2', 'm1-3', 'm2-2', 'm2-3', 'm3-2', 'm3-3', 'm11-1', 'bonus-0', 'm9-0']);
    expect(calculateScore(p).piScore).toBe(1);
    expect(calculateScore({ ...p, kukjinAsPi: true }).piScore).toBe(3);
    expect(calculateScore({ ...p, kukjinAsPi: true }).yeolCount).toBe(0);
  });
  it.each([
    [1, 1, 1],
    [2, 2, 1],
    [3, 2, 2],
    [4, 2, 4],
    [5, 2, 8],
  ])('%i go bonus %i multiplier %i', (goCount, bonus, mult) => {
    const r = calculateScore({ ...emptyPlayer(), goCount });
    expect(r.goBonus).toBe(bonus);
    expect(r.goMultiplier).toBe(mult);
  });
  it('combined multipliers fixed calculation order', () => {
    const p = scored(
      [
        'm1-0',
        'm3-0',
        'm8-0',
        'm2-0',
        'm4-0',
        'm5-0',
        'm6-0',
        'm7-0',
        'm8-1',
        'm10-0',
        'bonus-0',
        'bonus-1',
        'm11-1',
        'm12-3',
        'm1-2',
        'm1-3',
      ],
      { goCount: 3, shakes: [2], bombs: 1 },
    );
    const r = calculateScore(p, emptyPlayer(), { lastGo: 1, playerId: 0, nagariMultiplier: 2 });
    expect(r.baseScore).toBe(12);
    expect(r.finalScore).toBe((12 + 2) * 2 * 4 * 2 * 2 * 2 * 2 * 2);
  });
  it('kukjin conversion is action-validated and irreversible', () => {
    const s = fixture(['m1-2', 'm2-2'], ['m3-2'], ['m4-2'], { captured: cards('m9-0') });
    const n = applyAction(s, { type: 'SET_KUKJIN', player: 0 }).nextState;
    expect(n.players[0].kukjinAsPi).toBe(true);
    expect(() => applyAction(n, { type: 'SET_KUKJIN', player: 0 })).toThrow();
  });
});
describe('validation / security / AI simulations', () => {
  it('rejects wrong turn, nonexistent card, wrong phase without mutation', () => {
    const s = createGame({ seed: 123, dealer: 0 });
    const before = JSON.stringify(s);
    expect(() =>
      applyAction(s, { type: 'PLAY_CARD', player: 1, cardId: s.players[1].hand[0].id }),
    ).toThrow();
    expect(() => play(s, 'fake')).toThrow();
    expect(() => applyAction(s, { type: 'GO', player: 0 })).toThrow();
    expect(JSON.stringify(s)).toBe(before);
  });
  it('projections exclude other hand and deck identities', () => {
    const s = createGame({ seed: 42 });
    for (const player of [0, 1] as const) {
      const v = projectState(s, player);
      expect(v).not.toHaveProperty('deck');
      expect(v.players[1 - player]).not.toHaveProperty('hand');
      const data = JSON.stringify(v);
      for (const c of s.players[1 - player].hand) expect(data).not.toContain(`"${c.id}"`);
      for (const c of s.deck) expect(data).not.toContain(`"${c.id}"`);
    }
  });
  it('1000 full deterministic AI rounds preserve all identities and terminate', () => {
    for (let seed = 0; seed < 1000; seed++) {
      let s = createGame({ seed });
      let steps = 0;
      while (s.phase !== 'FINISHED' && steps++ < 100) {
        const id = s.currentPlayer;
        const a = chooseAction(projectState(s, id), id, 'hard', seededRandom(seed + steps));
        s = applyAction(s, a).nextState;
        assertInvariant(s);
      }
      expect(s.phase, `seed ${seed}`).toBe('FINISHED');
    }
  });
});
describe('additional rule regressions', () => {
  it('first three consecutive ppuks settle 7 + 14 + 21 plus fixed 7 = 49', () => {
    let s = fixture(['m1-2', 'm2-2', 'm3-2'], ['m1-0', 'm2-0', 'm3-0'], ['m1-1', 'm2-1', 'm3-1'], {
      turnsRemaining: 10,
      bombPasses: 7,
    });
    for (const id of ['m1-2', 'm2-2', 'm3-2']) s = play(s, id).nextState;
    expect(s.result?.reason).toBe('THREE_PPUK');
    expect(s.result?.sidePoints[0]).toBe(42);
    expect(s.result!.points + s.result!.sidePoints[0]).toBe(49);
  });
  it('opening ttadak awards 7 and steals one pi', () => {
    const s = fixture(['m1-2', 'm2-2'], ['m1-0', 'm1-1', 'm3-2'], ['m1-3'], {
      turnsRemaining: 10,
      bombPasses: 8,
    });
    const r = applyAction(play(s, 'm1-2').nextState, {
      type: 'SELECT_FLOOR',
      player: 0,
      cardId: 'm1-0',
    });
    expect(r.nextState.players[0].sidePoints).toBe(7);
    expect(r.events.filter((e) => e.type === 'PI_TRANSFERRED')).toHaveLength(1);
  });
  it('7+ score pauses, GO needs more base score, STOP preserves arithmetic', () => {
    let s = fixture(['m1-2', 'm2-2', 'm4-2'], ['m5-2'], ['m6-2', 'm7-2'], {
      captured: cards('m1-0', 'm3-0', 'm8-0', 'm2-0', 'm4-0', 'm8-1'),
    });
    s = play(s, 'm1-2').nextState;
    expect(s.phase).toBe('GO_STOP');
    s = applyAction(s, { type: 'GO', player: 0 }).nextState;
    expect(s.players[0].goCount).toBe(1);
    expect(s.players[0].goAtScore).toBe(8);
    s = play(s, 'm2-2').nextState;
    expect(s.phase).toBe('PLAY');
  });
  it('last regular turn automatically stops if score increased', () => {
    const s = fixture(['m1-2'], ['m5-2'], ['m6-2'], {
      captured: cards('m1-0', 'm3-0', 'm8-0', 'm2-0', 'm4-0', 'm8-1'),
    });
    expect(play(s, 'm1-2').nextState.result?.reason).toBe('STOP');
  });
  it('pi transfer can take a double when no single is available', () => {
    const s = fixture(['m1-2', 'm2-2'], [], ['m1-3']);
    const other = s.players[1];
    const bonus = other.captured.filter((c) => c.isBonus);
    s.players[0].captured.push(...other.captured.filter((c) => !c.isBonus));
    other.captured = bonus;
    const r = play(s, 'm1-2');
    expect(
      r.events.filter((e) => e.type === 'PI_TRANSFERRED').map((e) => e.cards![0].piValue),
    ).toEqual([2]);
  });
  it('pi and gwang bak boundaries are exact', () => {
    const p = scored([
      'm1-0',
      'm3-0',
      'm8-0',
      'bonus-0',
      'bonus-1',
      'm11-1',
      'm12-3',
      'm1-2',
      'm1-3',
    ]);
    const seven = scored(['m2-2', 'm2-3', 'm3-2', 'm3-3', 'm4-2', 'm4-3', 'm5-2']);
    expect(calculateScore(p, seven).pibakMultiplier).toBe(2);
    expect(
      calculateScore(p, { ...seven, captured: [...seven.captured, ...cards('m5-3')] })
        .pibakMultiplier,
    ).toBe(1);
    expect(
      calculateScore(p, { ...seven, captured: [...seven.captured, ...cards('m12-0')] })
        .gwangbakMultiplier,
    ).toBe(1);
  });
});
it('normal event order makes matching and draw readable before capture/score', () => {
  const r = play(fixture(['m1-2', 'm2-2'], ['m1-3', 'm3-2'], ['m4-2']), 'm1-2');
  expect(r.events.map((e) => e.type)).toEqual([
    'CARD_PLAYED',
    'FLOOR_MATCHED',
    'DECK_CARD_REVEALED',
    'CARDS_CAPTURED',
    'SCORE_CHANGED',
    'TURN_ENDED',
  ]);
});

describe('equivalent plain-pi floor matches', () => {
  it('automatically strikes just one identical pi when playing from hand', () => {
    const s = fixture(['m1-0', 'm5-0'], ['m1-2', 'm1-3'], ['m3-2']);
    const { nextState, events } = play(s, 'm1-0');
    expect(nextState.phase).not.toBe('SELECT_FLOOR');
    expect(nextState.players[0].captured.map((c) => c.id)).toContain('m1-2');
    expect(nextState.floor.map((c) => c.id)).toContain('m1-3');
    expect(
      events.find((e) => e.type === 'FLOOR_MATCHED' && e.stage === 'hand')?.cards?.map((c) => c.id),
    ).toEqual(['m1-0', 'm1-2']);
    expect(events.some((e) => e.type === 'FLOOR_MATCH_REQUIRED')).toBe(false);
    assertInvariant(nextState);
  });
  it('automatically takes one identical pi for a revealed deck card', () => {
    const { nextState, events } = play(
      fixture(['m2-0', 'm5-0'], ['m1-2', 'm1-3'], ['m1-0']),
      'm2-0',
    );
    expect(nextState.phase).not.toBe('SELECT_FLOOR');
    expect(nextState.players[0].captured.map((c) => c.id)).toContain('m1-2');
    expect(nextState.floor.map((c) => c.id)).toContain('m1-3');
    expect(events.some((e) => e.type === 'FLOOR_MATCH_REQUIRED')).toBe(false);
    assertInvariant(nextState);
  });
  it('preserves ttadak when the fourth card is revealed after automatic choice', () => {
    const { nextState, events } = play(
      fixture(['m1-0', 'm5-0'], ['m1-2', 'm1-3'], ['m1-1']),
      'm1-0',
    );
    expect(events.some((e) => e.type === 'TTADAK')).toBe(true);
    expect(nextState.players[0].captured.filter((c) => c.month === 1)).toHaveLength(4);
    assertInvariant(nextState);
  });
  it.each(['hand', 'deck'])('keeps the %s choice when pi values differ', (stage) => {
    const s =
      stage === 'hand'
        ? fixture(['m11-0', 'm5-0'], ['m11-1', 'm11-2'], ['m3-2'])
        : fixture(['m2-0', 'm5-0'], ['m11-1', 'm11-2'], ['m11-0']);
    expect(play(s, s.players[0].hand[0].id).nextState.phase).toBe('SELECT_FLOOR');
  });
});
