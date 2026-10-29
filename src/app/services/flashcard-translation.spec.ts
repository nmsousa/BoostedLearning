/**
 * Tests for FlashcardService.bestTranslation — picking a clean English
 * translation to display (used by the Match game), instead of the unreliable
 * translations[0] from the imported Duolingo data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FlashcardService, Flashcard } from './flashcard.service';

function card(text: string, translations: string[]): Flashcard {
  return {
    id: 't-' + text,
    deckId: 'd',
    text,
    translations,
    correctCount: 0,
    incorrectCount: 0,
    lastSeen: null,
    nextReview: null,
    streak: 0,
  };
}

describe('FlashcardService.bestTranslation', () => {
  let svc: FlashcardService;

  beforeEach(() => {
    // bestTranslation is pure over the card; HttpClient is unused by it.
    svc = new FlashcardService(null as never);
  });

  it('uses curated overrides for high-frequency words', () => {
    expect(svc.bestTranslation(card('hebben', ['carved', 've', 'having', 'have']))).toBe('have');
    expect(svc.bestTranslation(card('zijn', ["it'd", 've', 'be', 'his', 'are']))).toBe('are');
    expect(svc.bestTranslation(card('mannen', ["man's", 'men', 'husbands']))).toBe('men');
    expect(svc.bestTranslation(card('hij', ['it', 'he', 'christopher']))).toBe('he');
  });

  it('skips apostrophe contractions/possessives', () => {
    // No curated entry; "friend" chosen over "boyfriend's".
    expect(svc.bestTranslation(card('vriendx', ["boyfriend's", 'friend', "friend's"]))).toBe('friend');
  });

  it('skips 1-2 char fragments like "ve"', () => {
    expect(svc.bestTranslation(card('makenx', ['ve', 'making', 'make']))).toBe('make');
  });

  it('prefers base form over -ing gerund', () => {
    expect(svc.bestTranslation(card('kopen', ['buying', 'buy', 'purchase']))).toBe('buy');
  });

  it('deprioritizes negations', () => {
    expect(svc.bestTranslation(card('wetenx', ["didn't", 'know', 'knowing']))).toBe('know');
  });

  it('keeps clarified forms in parentheses', () => {
    expect(svc.bestTranslation(card('jullie', ['your (plural)', 'you (plural)']))).toBe('you (plural)');
  });

  it('falls back to the first translation if nothing clean remains', () => {
    expect(svc.bestTranslation(card('xyz', ["a'b"]))).toBe("a'b");
  });

  it('returns empty string when there are no translations', () => {
    expect(svc.bestTranslation(card('xyz', []))).toBe('');
  });
});

describe('FlashcardService.isSameInBothLanguages / playableCards', () => {
  let svc: FlashcardService;

  beforeEach(() => {
    svc = new FlashcardService(null as never);
  });

  it('detects words identical in both languages (case/space insensitive)', () => {
    expect(svc.isSameInBothLanguages(card('water', ['water']))).toBe(true);
    expect(svc.isSameInBothLanguages(card('Man ', ['man']))).toBe(true);
    expect(svc.isSameInBothLanguages(card('hond', ['dog']))).toBe(false);
  });

  it('respects the curated translation when checking identity', () => {
    // "man" is curated to "man", so it counts as identical.
    expect(svc.isSameInBothLanguages(card('man', ["guy's", 'husband', 'man']))).toBe(true);
  });

  it('playableCards filters out identical-in-both-languages cards', () => {
    const cards = [
      card('water', ['water']),
      card('hond', ['dog']),
      card('man', ["guy's", 'man']),
      card('vrouw', ['woman']),
    ];
    const playable = svc.playableCards(cards);
    expect(playable.map(c => c.text)).toEqual(['hond', 'vrouw']);
  });
});
