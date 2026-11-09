import { describe, it, expect } from 'vitest';
import { CORE_TIERS, THEME_DEFS } from './tree-curriculum';

describe('tree-curriculum', () => {
  it('has Core tiers 1, 2 and 3 authored and playable', () => {
    for (const tier of [1, 2, 3]) {
      const ct = CORE_TIERS.find(c => c.tier === tier)!;
      expect(ct.authored).toBe(true);
      // A real lesson has a meaningful word list (no "—" placeholder).
      expect(ct.words.length).toBeGreaterThanOrEqual(10);
      expect(ct.words.every(w => w.fr !== '—')).toBe(true);
    }
  });

  it('keeps Core tiers 4-6 as not-yet-authored (coming soon)', () => {
    for (const tier of [4, 5, 6]) {
      expect(CORE_TIERS.find(c => c.tier === tier)!.authored).toBe(false);
    }
  });

  it('every theme has three authored levels with ~10 words each', () => {
    for (const th of THEME_DEFS) {
      expect(th.tiers.length).toBe(3);
      for (const tier of th.tiers) {
        expect(tier.length).toBeGreaterThanOrEqual(8);
        expect(tier.every(w => w.fr && w.en)).toBe(true);
      }
    }
  });
});
