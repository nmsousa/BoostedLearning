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
