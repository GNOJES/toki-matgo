import { it, expect } from 'vitest';
import { withParticle } from '../src/lib/korean';
it('selects particles for Hangul names, jamo, decomposed Hangul, digits and decorations', () => {
  expect(withParticle('지훈', '이/가')).toBe('지훈이');
  expect(withParticle('민수', '이/가')).toBe('민수가');
  expect(withParticle('지훈', '은/는')).toBe('지훈은');
  expect(withParticle('민수', '을/를')).toBe('민수를');
  expect(withParticle('지훈', '과/와')).toBe('지훈과');
  expect(withParticle('하늘', '으로/로')).toBe('하늘로');
  expect(withParticle('지훈', '으로/로')).toBe('지훈으로');
  expect(withParticle('지훈🐰', '이/가')).toBe('지훈🐰이');
  expect(withParticle('지훈'.normalize('NFD'), '이/가')).toBe('지훈이');
  expect(withParticle('친구7', '은/는')).toBe('친구7은');
  expect(withParticle('친구2', '은/는')).toBe('친구2는');
  expect(withParticle('친구1', '으로/로')).toBe('친구1로');
  expect(withParticle('민수', '의')).toBe('민수의');
});
