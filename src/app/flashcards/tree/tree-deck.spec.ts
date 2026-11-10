import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FlashcardService } from '../../services/flashcard.service';

/**
 * Regression test for the "Travel opens Education" bug: the synthetic Tree deck
 * must map each skill to a STABLE, contiguous level, even when the SAME English
 * word recurs across skills (core words reused across themes). The engine's
 * global cross-skill de-dup + empty-skill dropping must NOT apply to tree decks.
 */
describe('Tree synthetic deck level mapping', () => {
  let svc: FlashcardService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(FlashcardService);
  });

  it('keeps every skill as its own contiguous level, including shared words', () => {
    // 'travel' and 'education' both include "to use/book"-style shared words to
    // force the old global de-dup to collapse a skill if it were applied.
    const groups = [
      { skill: 'Core 1', words: [{ fr: 'je', en: 'I' }, { fr: 'tu', en: 'you' }] },
      { skill: 'travel:1', words: [{ fr: 'la gare', en: 'station' }, { fr: 'le livre', en: 'book' }] },
      { skill: 'education:1', words: [{ fr: 'l’école', en: 'school' }, { fr: 'le livre', en: 'book' }] },
      { skill: 'nature:1', words: [{ fr: 'l’arbre', en: 'tree' }] },
    ];
    const deckId = svc.registerTreeDeck('fr', groups);

    // Level N (1-based) must contain exactly the Nth group's words.
    expect(svc.getLevelCards(deckId, 1).map(c => c.text)).toEqual(['je', 'tu']);
    expect(svc.getLevelCards(deckId, 2).map(c => c.text)).toEqual(['la gare', 'le livre']);
    // education keeps "le livre" even though travel already had it (no global
    // de-dup for tree decks) — so it does NOT shift to nature's cards.
    expect(svc.getLevelCards(deckId, 3).map(c => c.text)).toEqual(['l’école', 'le livre']);
    expect(svc.getLevelCards(deckId, 4).map(c => c.text)).toEqual(['l’arbre']);
  });

  it('uses the id prefix for a fresh progress namespace', () => {
    const deckId = svc.registerTreeDeck('fr', [{ skill: 'Core 1', words: [{ fr: 'je', en: 'I' }] }], 'tree-v2');
    expect(deckId).toBe('tree-v2-fr');
    expect(svc.isTreeDeckId(deckId)).toBe(true);
    expect(svc.getLevelCards(deckId, 1)[0].id).toBe('tree-v2-fr-0-0');
  });

  it('plays only the level\'s own words in Match (other slots are not lessons)', () => {
    const groups = [
      { skill: 'Core 1', words: [{ fr: 'je', en: 'I' }, { fr: 'et', en: 'and' }] },
      { skill: 'Core 2', words: [{ fr: '—', en: '—' }] },
      { skill: 'food:1', words: [{ fr: 'le café', en: 'coffee' }, { fr: 'le thé', en: 'tea' }] },
    ];
    const deckId = svc.registerTreeDeck('fr', groups, 'tree-v2');
    expect(svc.getMatchSessionCards(deckId, 3).map(c => c.text)).toEqual(['le café', 'le thé']);
  });

  it('shows the authored English, never the course deck\'s curated overrides', () => {
    const deckId = svc.registerTreeDeck('fr', [{ skill: 'Core 3', words: [{ fr: 'ma', en: 'my (f.)' }] }], 'tree-v2');
    expect(svc.bestTranslation(svc.getLevelCards(deckId, 1)[0])).toBe('my (f.)');
  });

  it('exposes one level per registered skill', async () => {
    const groups = [
      { skill: 'Core 1', words: [{ fr: 'je', en: 'I' }] },
      { skill: 'travel:1', words: [{ fr: 'la gare', en: 'station' }] },
      { skill: 'health:1', words: [{ fr: 'le médecin', en: 'doctor' }] },
    ];
    const deckId = svc.registerTreeDeck('fr', groups);
    const levels = await svc.getDeckLevels(deckId, 'journey-flip');
    expect(levels.length).toBe(3);
  });
});
