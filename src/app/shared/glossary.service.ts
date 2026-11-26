/**
 * Glossary service: builds the French glossary once and answers
 * "what does this word / block mean?" for tap-to-translate.
 *
 * Sources, in priority order (a better source is never overridden):
 *  1. hand-written common words and verb forms (shared/french-glosses.ts): final,
 *     nothing is added to their meanings;
 *  2. the Explore+ lesson words, then the Explore Core + topic words (these
 *     add to each other's meanings: a word can mean several things);
 *  3. the course deck (7,000+ cards) as a last, noisy fallback: only the first
 *     meanings, and only for single words nobody else knows.
 *
 * French only for now (the lessons are French); other languages get no glosses.
 */
import { Injectable, inject } from '@angular/core';
import { FlashcardService } from '../services/flashcard.service';
import type { Glossary, GlossSegment } from './glossary';
import { authoredFrenchGlossary } from './glossary-data';

/** Course-deck translations that are noise for a learner ("'s", repeats of the word). */
function cleanDeckMeanings(text: string, translations: readonly string[]): string[] {
  const t = text.toLowerCase();
  return translations
    .map(x => x.trim())
    .filter(x => x && !/'s$/i.test(x) && !/^'/.test(x) && x.toLowerCase() !== t)
    .slice(0, 3);
}

@Injectable({ providedIn: 'root' })
export class GlossaryService {
  private flashcards = inject(FlashcardService);
  private cache = new Map<string, Glossary>();

  /** True when this language has tap-to-translate. */
  supports(lang: string): boolean { return lang === 'fr'; }

  private glossary(lang: string): Glossary | null {
    if (!this.supports(lang)) return null;
    const cached = this.cache.get(lang);
    if (cached) return cached;
    const g = authoredFrenchGlossary();
    const deck = this.flashcards.languageCards(lang);
    g.add(deck.flatMap(c => {
      const en = cleanDeckMeanings(c.text, c.translations);
      return en.length ? [{ fr: c.text, en: en.join(' / ') }] : [];
    }), { fallback: true });
    // Only keep a glossary built with the course deck loaded; otherwise rebuild
    // later instead of being stuck without the fallback.
    if (deck.length > 0) this.cache.set(lang, g);
    return g;
  }

  /** A sentence in the language being learned → segments with their English meaning(s). */
  learning(lang: string, text: string): GlossSegment[] | null {
    return this.glossary(lang)?.segmentSentence(text) ?? null;
  }

  /**
   * The English sentence of an exercise → segments with the French for each
   * word or block. `frTokens` is the French sentence it translates.
   */
  native(lang: string, text: string, frTokens: readonly string[]): GlossSegment[] | null {
    return this.glossary(lang)?.alignNative(text, frTokens) ?? null;
  }
}
