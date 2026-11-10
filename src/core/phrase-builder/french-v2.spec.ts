import { describe, it, expect } from 'vitest';
import {
  buildTokens, buildTreeTokens, generatePhrases, type GeneratedPhrase, type SourceCard,
} from './phrase-builder';
import { elides, pluralFr, pluralEn } from './french-v2';
import { CORE_TIERS, THEME_DEFS, type CoreWord } from '../../app/flashcards/tree/tree-curriculum';

const src = (w: CoreWord): SourceCard => ({ text: w.fr, translations: [w.en] });
const core = (upTo: number): CoreWord[] => CORE_TIERS.filter(c => c.tier <= upTo && c.authored).flatMap(c => c.words);
const theme = (id: string, tier: number): CoreWord[] => THEME_DEFS.find(t => t.id === id)!.tiers[tier - 1];

/** Phrases for a level: `current` words + the words the learner already knows. */
function phrases(current: CoreWord[], earlier: CoreWord[], max = 60): GeneratedPhrase[] {
  return generatePhrases(buildTreeTokens(current.map(src), earlier.map(src)), max, 'fr', { engine: 'v2' });
}
const targets = (ps: GeneratedPhrase[]) => ps.map(p => p.target);

describe('phrase-builder v2 (Tree)', () => {
  it('Core 1 alone builds phrases from its own words', () => {
    const ps = phrases(core(1), []);
    expect(ps.length).toBeGreaterThanOrEqual(5);
    expect(targets(ps)).toContain('un ami et une amie');
    expect(targets(ps)).toContain('c’est une amie');
    expect(targets(ps)).toContain('j’ai un ami');
    // Same English gloss → the prompt says which gender to build.
    expect(ps.find(p => p.target === 'un ami et une amie')!.en).toBe('A friend (m.) and a friend (f.)');
  });

  it('Core 1 + Education L1 → "un professeur et un élève"', () => {
    const ps = phrases(theme('education', 1), core(1));
    const p = ps.find(x => x.target === 'un professeur et un élève');
    expect(p).toBeDefined();
    expect(p!.tokens).toEqual(['un', 'professeur', 'et', 'un', 'élève']);
    expect(p!.en).toBe('A teacher and a pupil');
    // l’élève is m./f.: never offer "une" (it would make a second valid answer).
    expect(p!.distractors).not.toContain('une');
    // The gender note on the English side ("school (f.)") picks the article.
    expect(targets(ps)).toContain('c’est une école');
    expect(targets(ps).some(t => /^j’ai un (livre|cours|examen)$/.test(t))).toBe(true);
  });

  it('every phrase uses a word of the current level', () => {
    const current = theme('education', 1);
    const currentFr = new Set(current.map(w => w.fr.replace(/^(le|la|les|un|une) /, '').replace(/^l’/, '')));
    for (const p of phrases(current, core(1))) {
      expect(p.tokens.some(t => currentFr.has(t.replace(/^l’/, '')))).toBe(true);
      expect(p.target.replace(/ \?$/, '')).toBe(p.tokens.join(' '));
    }
  });

  it('merges elided articles into one chip (l’école) and contracts à + le (au)', () => {
    const t2 = targets(phrases(theme('education', 1), core(2)));
    expect(t2.some(t => /^l’(école|examen|élève|étudiant) est (ici|là)$/.test(t))).toBe(true);
    const ps5 = phrases(core(5), [...core(4), ...theme('food', 1), ...theme('education', 1), ...theme('home', 1)]);
    const t5 = targets(ps5);
    expect(t5.some(t => / au restaurant$/.test(t))).toBe(true);
    expect(t5.some(t => / à l’école$/.test(t))).toBe(true);
    expect(ps5.find(p => p.target.endsWith(' à la maison'))?.en).toMatch(/at home$/);
  });

  it('uses mon before a feminine noun starting with a vowel (mon école)', () => {
    const t = targets(phrases(theme('education', 1), core(3)));
    expect(t).toContain('c’est mon école');
    expect(t.some(x => /\bma école\b/.test(x))).toBe(false);
  });

  it('agrees adjectives and uses nouvel before a vowel', () => {
    const t = targets(phrases(theme('home', 1), core(3)));
    expect(t.some(x => /\bune (petite|grande|nouvelle|bonne) (maison|chambre|cuisine|table|chaise|porte|fenêtre)\b/.test(x))).toBe(true);
    const nouvel = generatePhrases(buildTreeTokens(
      [{ text: 'nouveau', translations: ['new'] }],
      [{ text: 'c’est', translations: ['it is'] }, { text: 'un', translations: ['a (m.)'] }, { text: 'l’ordinateur', translations: ['computer (m.)'] }],
    ), 10, 'fr', { engine: 'v2' });
    expect(targets(nouvel)).toContain('c’est un nouvel ordinateur');
  });

  it('keeps the object pronoun "le" apart from the article "le"', () => {
    const upTo9 = core(9);
    const before = targets(phrases(CORE_TIERS[8].words, core(8)));
    expect(before.some(t => /^je (le|la|les) /.test(t))).toBe(false);
    const after = targets(phrases(CORE_TIERS[13].words, [...upTo9, ...core(13), ...theme('education', 1)]));
    expect(after.some(t => /^je (le|la|les) (prends|veux)$/.test(t))).toBe(true);
  });

  it('never produces the classic article / contraction mistakes', () => {
    const levels: [CoreWord[], CoreWord[]][] = [];
    const knownThemes = THEME_DEFS.flatMap(th => th.tiers.slice(0, 3).flat());
    for (const ct of CORE_TIERS.filter(c => c.authored)) levels.push([ct.words, [...core(ct.tier - 1), ...knownThemes]]);
    for (const th of THEME_DEFS) th.tiers.forEach((w, i) => levels.push([w, [...core(i + 1), ...th.tiers.slice(0, i).flat()]]));
    for (const [cur, earlier] of levels) {
      for (const p of phrases(cur, earlier)) {
        const t = p.target;
        // (?<!\p{L}) instead of \b: JS \b treats "è" as a non-word character.
        expect(t, t).not.toMatch(/(?<![\p{L}’])(le|la|ma|ta|de|que|ne) [aeiouéèêâîôh]/u); // elision missed
        expect(t, t).not.toMatch(/(?<![\p{L}’])à (le|les) /u);                              // au / aux
        expect(t, t).not.toMatch(/(?<![\p{L}’])de (le|les) /u);                             // du / des
        expect(t, t).not.toMatch(/(?<![\p{L}’])(un|une) (eau|argent|pain|fromage|musique)(?!\p{L})/u); // uncountables
        expect(p.en.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('gives every authored Tree level at least 3 phrases', () => {
    const knownThemes = ['food', 'education', 'home'].flatMap(id => THEME_DEFS.find(t => t.id === id)!.tiers.flat());
    for (const ct of CORE_TIERS.filter(c => c.authored)) {
      const pool = [...core(ct.tier - 1), ...(ct.tier > 1 ? knownThemes : [])];
      expect(phrases(ct.words, pool, 5).length, `Core ${ct.tier}`).toBeGreaterThanOrEqual(3);
    }
    for (const th of THEME_DEFS) {
      th.tiers.forEach((w, i) => {
        const n = phrases(w, [...core(i + 1), ...th.tiers.slice(0, i).flat()], 5).length;
        expect(n, `${th.id} L${i + 1}`).toBeGreaterThanOrEqual(3);
      });
    }
  });

  it('a seed varies the session but stays deterministic', () => {
    const tokens = buildTreeTokens(theme('food', 1).map(src), core(1).map(src));
    const a = generatePhrases(tokens, 5, 'fr', { engine: 'v2', seed: 7 }).map(p => p.target);
    const b = generatePhrases(tokens, 5, 'fr', { engine: 'v2', seed: 7 }).map(p => p.target);
    expect(a).toEqual(b);
  });

  it('buildTreeTokens keeps homographs and demotes words the learner already knows', () => {
    const tokens = buildTreeTokens(
      [{ text: 'le', translations: ['him / it (object)'] }, { text: 'et', translations: ['and'] }],
      [{ text: 'le', translations: ['the (m.)'] }, { text: 'et', translations: ['and'] }],
    );
    expect(tokens.filter(t => t.text === 'le')).toHaveLength(2);
    expect(tokens.find(t => t.text === 'et')!.fromCurrentChapter).toBe(false);
  });

  it('leaves the legacy generator untouched without the v2 option', () => {
    const tokens = buildTokens([{ text: 'mère', translations: ['mother'] }], [{ text: 'la', translations: ['the'] }]);
    expect(generatePhrases(tokens, 6).every(p => p.distractors === undefined)).toBe(true);
  });
});

describe('french-v2 morphology helpers', () => {
  it('detects elision (vowel / mute h, not h aspiré)', () => {
    expect(elides('école')).toBe(true);
    expect(elides('hôtel')).toBe(true);
    expect(elides('héros')).toBe(false);
    expect(elides('livre')).toBe(false);
  });

  it('pluralises French and English nouns', () => {
    expect(pluralFr('animal')).toBe('animaux');
    expect(pluralFr('bureau')).toBe('bureaux');
    expect(pluralFr('cours')).toBe('cours');
    expect(pluralFr('festival')).toBe('festivals');
    expect(pluralFr('livre')).toBe('livres');
    expect(pluralFr('salle de bain')).toBeNull();
    expect(pluralEn('child')).toBe('children');
    expect(pluralEn('party')).toBe('parties');
    expect(pluralEn('class')).toBe('classes');
    expect(pluralEn('piece of furniture')).toBe('pieces of furniture');
  });
});
