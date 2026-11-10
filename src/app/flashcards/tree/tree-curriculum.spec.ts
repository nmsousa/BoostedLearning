import { describe, it, expect } from 'vitest';
import {
  CORE_TIERS, THEME_DEFS, TREE_CONFIG, TREE_LAYOUT, coreLevelOf, themeLevelOf, type CoreWord,
} from './tree-curriculum';

/** Same normalisation the deck uses to de-duplicate prompts inside a level. */
const promptKey = (en: string) => en.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Write-mode safety: the French side is exactly what the learner types. */
function expectWriteSafe(words: CoreWord[], label: string): void {
  for (const w of words) {
    expect(w.fr, `${label}: "${w.fr}" has a note in French`).not.toMatch(/[()]/);
    expect(w.fr, `${label}: "${w.fr}" has alternatives`).not.toMatch(/ \/ /);
    expect(w.fr.trim().length, label).toBeGreaterThan(0);
    expect(w.en.trim().length, label).toBeGreaterThan(0);
  }
  const keys = words.map(w => promptKey(w.en));
  expect(new Set(keys).size, `${label}: duplicate English prompts`).toBe(keys.length);
}

describe('tree-curriculum', () => {
  it('splits the Core into small authored tiers (about a dozen words)', () => {
    const authored = CORE_TIERS.filter(c => c.authored);
    expect(authored.map(c => c.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const ct of authored) {
      expect(ct.words.length, `Core ${ct.tier}`).toBeGreaterThanOrEqual(10);
      expect(ct.words.length, `Core ${ct.tier}`).toBeLessThanOrEqual(14);
      expectWriteSafe(ct.words, `Core ${ct.tier}`);
    }
  });

  it('keeps Core 1 to the basics needed for first phrases', () => {
    const fr = CORE_TIERS[0].words.map(w => w.fr);
    for (const must of ['je', 'un', 'une', 'le', 'la', 'l’', 'et', 'ou', 'c’est', 'j’ai']) expect(fr).toContain(must);
    for (const later of ['vouloir', 'pouvoir', 'qui', 'où', 'pourquoi', 'de / d’']) expect(fr).not.toContain(later);
  });

  it('keeps the last Core tiers as not-yet-authored (coming soon)', () => {
    for (const ct of CORE_TIERS.filter(c => c.tier > 14)) expect(ct.authored).toBe(false);
    expect(TREE_CONFIG.coreTiers).toBe(CORE_TIERS.length);
  });

  it('every theme has three authored, Write-safe levels', () => {
    for (const th of THEME_DEFS) {
      expect(th.tiers.length).toBe(3);
      th.tiers.forEach((tier, i) => {
        expect(tier.length).toBeGreaterThanOrEqual(8);
        expectWriteSafe(tier, `${th.id} L${i + 1}`);
      });
    }
  });

  it('gives every l’ / les noun its gender on the English side', () => {
    const all = [...CORE_TIERS.filter(c => c.authored).flatMap(c => c.words), ...THEME_DEFS.flatMap(t => t.tiers.flat())];
    for (const w of all.filter(x => /^(l’\p{L}|les )/u.test(x.fr))) {
      expect(w.en, w.fr).toMatch(/\((m|f)\.( ?\/ ?(m|f)\.)?( pl\.)?\)/);
    }
  });

  it('uses a fixed level layout with room to grow', () => {
    expect(CORE_TIERS.length).toBeLessThanOrEqual(TREE_LAYOUT.coreSlots);
    for (const th of THEME_DEFS) expect(th.tiers.length).toBeLessThanOrEqual(TREE_LAYOUT.themeSlots);
    expect(coreLevelOf(1)).toBe(1);
    expect(themeLevelOf(0, 1)).toBe(TREE_LAYOUT.coreSlots + 1);
    expect(themeLevelOf(1, 1)).toBe(TREE_LAYOUT.coreSlots + TREE_LAYOUT.themeSlots + 1);
  });
});
