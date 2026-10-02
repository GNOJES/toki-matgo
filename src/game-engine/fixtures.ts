import { CARDS, seededRandom, shuffle } from './cards';
import { assertInvariant, createGame } from './engine';
import type { Card, GameState } from './types';
export const FIXTURE_NAMES = [
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
] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];
/** Development fixtures still contain precisely 50 identities and follow initial dealing rules. */
export function createFixture(name: FixtureName, seed = 12345): GameState {
  if (name === '열두 달 바닥') {
    const s = createGame({ seed, dealer: 0 });
    const floor = CARDS.filter((c) => !c.isBonus && c.id.endsWith('-0'));
    const remaining = shuffle(
      CARDS.filter((c) => !floor.includes(c)),
      seededRandom(seed),
    );
    s.floor = floor;
    s.players[0].hand = remaining.splice(0, 10);
    s.players[1].hand = remaining.splice(0, 10);
    s.players.forEach((p) => {
      p.captured = [];
    });
    s.deck = remaining;
    s.phase = 'PLAY';
    s.result = null;
    assertInvariant(s);
    return s;
  }
  const setups: Record<
    Exclude<FixtureName, '열두 달 바닥'>,
    { hand: string[]; floor: string[]; draw: string[]; opponent: string[] }
  > = {
    '뻑과 보너스': {
      hand: ['m1-2'],
      floor: ['m1-0'],
      draw: ['bonus-0', 'm1-1'],
      opponent: ['m1-3'],
    },
    '바닥 두 장 · 따닥': { hand: ['m1-2'], floor: ['m1-0', 'm1-1'], draw: ['m1-3'], opponent: [] },
    '3장 폭탄': { hand: ['m1-0', 'm1-1', 'm1-2'], floor: ['m1-3'], draw: ['m4-2'], opponent: [] },
    '보너스 손패': { hand: ['bonus-0'], floor: ['m1-0'], draw: ['m4-2'], opponent: [] },
    '폭탄과 피 강탈': {
      hand: ['m1-0', 'm1-1', 'm1-2'],
      floor: ['m1-3'],
      draw: ['m4-2'],
      opponent: [],
    },
    '국화 선택': {
      hand: ['m2-0'],
      floor: ['m1-0', 'm4-0', 'm5-0', 'm6-0', 'm7-0', 'm8-0', 'm10-0', 'm11-0'],
      draw: ['m3-0'],
      opponent: [],
    },
    '국화 점수 선택': {
      hand: ['m2-0'],
      floor: ['m1-0', 'm4-0', 'm5-0', 'm6-0', 'm7-0', 'm8-0', 'm10-0', 'm11-0'],
      draw: ['m3-0'],
      opponent: [],
    },
    흔들기: { hand: ['m1-0', 'm1-1', 'm1-2'], floor: [], draw: ['m4-2'], opponent: ['m1-3'] },
    자뻑: { hand: ['m1-3'], floor: ['m1-0', 'm1-1', 'm1-2'], draw: ['m4-2'], opponent: [] },
  };
  const def = setups[name];
  const resolve = (ids: string[]) => ids.map((id) => CARDS.find((c) => c.id === id)!);
  let hand = resolve(def.hand),
    floor = resolve(def.floor),
    draw = resolve(def.draw),
    opponent = resolve(def.opponent);
  const captured = name.startsWith('국화')
    ? [
        CARDS.find((c) => c.specialType === 'KUKJIN')!,
        ...(name === '국화 점수 선택' ? CARDS.filter((c) => c.piValue === 1).slice(0, 15) : []),
      ]
    : [];
  const used = new Set([...hand, ...floor, ...draw, ...opponent, ...captured].map((c) => c.id));
  let remaining = shuffle(
    CARDS.filter((c) => !used.has(c.id)),
    seededRandom(seed),
  );
  function fill(target: Card[], size: number, allowBonus: boolean) {
    while (target.length < size) {
      const i = remaining.findIndex(
        (c) =>
          (allowBonus || !c.isBonus) &&
          (c.isBonus || target.filter((t) => t.month === c.month).length < 3),
      );
      if (i < 0) throw Error('분배할 수 없는 fixture');
      target.push(...remaining.splice(i, 1));
    }
  }
  fill(hand, 10, true);
  fill(opponent, 10, true);
  fill(floor, 8, false);
  const s = createGame({
    deck: [...hand, ...opponent, ...floor, ...draw, ...remaining, ...captured],
    dealer: 0,
    seed,
  });
  if (captured.length) {
    s.deck = s.deck.filter((c) => !captured.includes(c));
    s.players[0].captured = captured;
  }
  if (name === '폭탄과 피 강탈') {
    const i = s.deck.findIndex((c) => c.piValue === 1);
    if (i < 0) throw Error('피 강탈 검증용 피가 없어요.');
    s.players[1].captured.push(...s.deck.splice(i, 1));
  }
  if (name === '자뻑') {
    s.ppukOwners[1] = 0;
    s.players[0].ppukCount = 1;
  }
  assertInvariant(s);
  return s;
}
export function createCustomDeal(
  input: { hand: string[]; floor: string[]; draw: string[] },
  seed = 12345,
): GameState {
  if (input.hand.length !== 10 || input.floor.length !== 8)
    throw Error('내 손패 10장 / 바닥 8장을 지정해주세요.');
  const ids = [...input.hand, ...input.floor, ...input.draw];
  if (new Set(ids).size !== ids.length) throw Error('중복 카드 ID가 있어요.');
  const resolve = (list: string[]) =>
    list.map((id) => {
      const c = CARDS.find((c) => c.id === id);
      if (!c) throw Error(`알 수 없는 카드: ${id}`);
      return c;
    });
  const remaining = shuffle(
    CARDS.filter((c) => !ids.includes(c.id)),
    seededRandom(seed),
  );
  if (remaining.length < 10) throw Error('상대 손패에 필요한 10장을 남겨주세요.');
  return createGame({
    deck: [
      ...resolve(input.hand),
      ...remaining.splice(0, 10),
      ...resolve(input.floor),
      ...resolve(input.draw),
      ...remaining,
    ],
    dealer: 0,
    seed,
  });
}
