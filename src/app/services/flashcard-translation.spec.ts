/**
 * Tests for FlashcardService.bestTranslation — picking a clean English
 * translation to display, instead of the unreliable translations[0] from the
 * imported Duolingo/duome data.
 *
 * Curated overrides are language-scoped, so cards are attached to a deck whose
 * languageCode selects the right curated map (nl vs fr).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FlashcardService, Flashcard, FlashcardDeck } from './flashcard.service';

const NL_DECK = 'deck-nl';
const FR_DECK = 'deck-fr';

function card(text: string, translations: string[], deckId = NL_DECK): Flashcard {
  return {
    id: 't-' + text,
    deckId,
    text,
    translations,
    correctCount: 0,
    incorrectCount: 0,
    lastSeen: null,
    nextReview: null,
    streak: 0,
  };
}

/** Register minimal decks so language-scoped curated lookups resolve. */
function seedDecks(svc: FlashcardService): void {
  const mk = (id: string, languageCode: string): FlashcardDeck => ({
    id,
    name: id,
    languageCode,
    isBundled: true,
    createdAt: '',
    updatedAt: '',
    cards: [],
  });
  // Reach the private signal in tests to seed decks.
  (svc as unknown as { decksSignal: { set: (d: FlashcardDeck[]) => void } })
    .decksSignal.set([mk(NL_DECK, 'nl'), mk(FR_DECK, 'fr')]);
}

describe('FlashcardService.bestTranslation', () => {
  let svc: FlashcardService;

  beforeEach(() => {
    svc = new FlashcardService(null as never);
    seedDecks(svc);
  });

  it('uses curated overrides for high-frequency Dutch words', () => {
    expect(svc.bestTranslation(card('hebben', ['carved', 've', 'having', 'have']))).toBe('have');
    expect(svc.bestTranslation(card('zijn', ["it'd", 've', 'be', 'his', 'are']))).toBe('are');
    expect(svc.bestTranslation(card('hij', ['it', 'he', 'christopher']))).toBe('he');
  });

  it('uses language-scoped curated overrides (de = the in NL, of in FR)', () => {
    expect(svc.bestTranslation(card('de', ['the'], NL_DECK))).toBe('the');
    expect(svc.bestTranslation(card('de', ["president's", 'of'], FR_DECK))).toBe('of');
  });

  it('trusts translations[0] when it is clean', () => {
    // "est" leads with "is" — the correct primary sense.
    expect(svc.bestTranslation(card('est', ['is', 'has been', 'east', 'are'], FR_DECK))).toBe('is');
  });

  it('skips noun possessives but keeps real contractions', () => {
    expect(svc.bestTranslation(card('vriendx', ["boyfriend's", 'friend', "friend's"]))).toBe('friend');
    // "il est" -> "he's" is a legitimate contraction, not junk.
    expect(svc.bestTranslation(card('il estx', ["he's", "it's"], FR_DECK))).toBe("he's");
  });

  it('prefers base form over -ing gerund', () => {
    expect(svc.bestTranslation(card('parle', ['talking', 'speak', 'talk'], FR_DECK))).toBe('speak');
  });

  it('keeps an -ing word when it is the only sensible meaning', () => {
    expect(svc.bestTranslation(card('charmant', ['charming'], FR_DECK))).toBe('charming');
  });

  it('keeps clarified forms in parentheses', () => {
    expect(svc.bestTranslation(card('jullie', ['you (plural)', 'your (plural)']))).toBe('you (plural)');
  });

  it('returns empty string when there are no translations', () => {
    expect(svc.bestTranslation(card('xyz', []))).toBe('');
  });
});

describe('FlashcardService.isSameInBothLanguages / playableCards', () => {
  let svc: FlashcardService;

  beforeEach(() => {
    svc = new FlashcardService(null as never);
    seedDecks(svc);
  });

  it('detects words identical in both languages (case/space insensitive)', () => {
    expect(svc.isSameInBothLanguages(card('water', ['water']))).toBe(true);
    expect(svc.isSameInBothLanguages(card('Man ', ['man']))).toBe(true);
    expect(svc.isSameInBothLanguages(card('hond', ['dog']))).toBe(false);
  });

  it('playableCards filters out identical-in-both-languages cards', () => {
    const cards = [
      card('water', ['water']),
      card('hond', ['dog']),
      card('vrouw', ['woman']),
    ];
    const playable = svc.playableCards(cards);
    expect(playable.map(c => c.text)).toEqual(['hond', 'vrouw']);
  });
});
