import { describe, it, expect } from 'vitest';
import { lookupCoreWord, CORE_TIERS, THEME_DEFS } from './tree-curriculum';

/** The Learn step looks words up by French text to show their note / emoji. */
describe('lookupCoreWord (Learn step metadata)', () => {
  it('returns a Core word with its grammar note', () => {
    const w = lookupCoreWord('je');
    expect(w).toBeDefined();
    expect(w!.en).toBe('I');
    expect(w!.note).toMatch(/j’ai|vowel/);
  });

  it('returns a theme L1 word with its emoji', () => {
    const cafe = lookupCoreWord('le café');
    expect(cafe?.icon).toBe('☕');
    const prof = lookupCoreWord('le professeur');
    expect(prof?.icon).toBe('👨‍🏫');
  });

  it('returns undefined for an unknown word', () => {
    expect(lookupCoreWord('xyzzy')).toBeUndefined();
  });

  it('indexes both Core and theme words', () => {
    // A Core word and a theme word both resolve.
    expect(lookupCoreWord(CORE_TIERS[0].words[0].fr)).toBeDefined();
    expect(lookupCoreWord(THEME_DEFS[0].tiers[0][0].fr)).toBeDefined();
  });
});
