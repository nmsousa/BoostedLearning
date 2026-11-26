/**
 * Glossary service: builds the French word glossary once and answers
 * "what does this word mean?" for tap-to-translate.
 *
 * Sources, in priority order (a better source is never overridden):
 *  1. hand-written common words and verb forms (shared/french-glosses.ts): final,
 *     nothing is added to their meanings;
 *  2. the Explore+ lesson words, then the Explore Core + topic words (these
 *     add to each other's meanings: a word can mean several things);
 *  4. the course deck (7,000+ cards) as a last, noisy fallback: only the first
 *     meanings, and only for words nobody else knows.
 *
 * French only for now (the lessons are French); other languages get no glosses.
 */
import { Injectable, inject } from '@angular/core';
import { FlashcardService } from '../services/flashcard.service';
import { normKey, type Glossary, type TokenGloss } from './glossary';
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

  /**
   * The meaning of ONE word on its own (a Builder tile). Without hinting the
   * word order: only when the word has no meaning alone does it borrow the
   * phrase it belongs to in `context` ("plaît" → s’il vous plaît = please).
   */
  wordLines(lang: string, word: string, context?: readonly string[]): string[] {
    const own = this.lookup(lang, [word])[0].lines;
    if (own.length || !context) return own;
    const i = context.findIndex(t => normKey(t) === normKey(word));
    return i >= 0 ? this.lookup(lang, context)[i].lines : own;
  }

  /** What to show for each word of a sentence (same length as `tokens`). */
  lookup(lang: string, tokens: readonly string[]): TokenGloss[] {
    const g = this.glossary(lang);
    return g ? g.lookup(tokens) : tokens.map(() => ({ lines: [] }));
  }
}
