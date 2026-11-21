import { matchScorePercent, matchStars, starsFromPercent, tooManyMistakes, MATCH_SECONDS_PER_PAIR } from './star-rules';

describe('star rules', () => {
  it('maps % to stars with 1 star at 50%', () => {
    expect(starsFromPercent(100)).toBe(3);
    expect(starsFromPercent(85)).toBe(2);
    expect(starsFromPercent(84)).toBe(1);
    expect(starsFromPercent(50)).toBe(1);
    expect(starsFromPercent(49)).toBe(0);
  });

  it('stops only after MORE than half are wrong', () => {
    expect(tooManyMistakes(5, 10)).toBe(false);
    expect(tooManyMistakes(6, 10)).toBe(true);
    expect(tooManyMistakes(3, 5)).toBe(true);
    expect(tooManyMistakes(2, 5)).toBe(false);
    expect(tooManyMistakes(1, 0)).toBe(false);
  });

  it('gives Match 3 stars only with no mistakes in 3 s per pair', () => {
    const pairs = 6;
    const limit = pairs * MATCH_SECONDS_PER_PAIR;
    expect(matchStars({ pairs, mistakes: 0, seconds: limit, timed: true })).toBe(3);
    expect(matchStars({ pairs, mistakes: 0, seconds: limit + 1, timed: true })).toBe(2);
    expect(matchStars({ pairs, mistakes: 1, seconds: 5, timed: true })).toBe(2);
    expect(matchStars({ pairs, mistakes: 3, seconds: 5, timed: true })).toBe(1);
    expect(matchStars({ pairs, mistakes: 4, seconds: 5, timed: true })).toBe(0);
  });

  it('does not time Match Audio', () => {
    expect(matchStars({ pairs: 6, mistakes: 0, seconds: 999, timed: false })).toBe(3);
  });

  it('saves a Match % that maps back to the same stars', () => {
    for (let mistakes = 0; mistakes <= 6; mistakes++) {
      for (const seconds of [5, 100]) {
        const o = { pairs: 6, mistakes, seconds, timed: true };
        expect(starsFromPercent(matchScorePercent(o))).toBe(matchStars(o));
      }
    }
  });
});
