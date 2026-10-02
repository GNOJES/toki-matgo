type Particle = '이/가' | '은/는' | '을/를' | '과/와' | '으로/로' | '의';

/** Hangul final consonants, including names ending in digits or decorative symbols. */
export function withParticle(name: string, particle: Particle): string {
  const text = name.trim().normalize('NFC');
  const last = [...text].reverse().find((c) => /[가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]/i.test(c)) ?? '';
  const code = last.codePointAt(0) ?? 0;
  const final = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : 0;
  const consonant = final > 0 || /[ㄱ-ㅎ013678]/.test(last);
  const rieul = final === 8 || last === 'ㄹ' || /[178]/.test(last);
  const [closed, open = closed] = particle.split('/');
  return text + (consonant && !(particle === '으로/로' && rieul) ? closed : open);
}
