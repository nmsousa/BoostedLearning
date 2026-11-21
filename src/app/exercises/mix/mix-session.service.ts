/**
 * MixSessionService — builds an INTERLEAVED single-question Mix session.
 *
 * Unlike playing a full exercise of each type back-to-back, Mix plays ONE
 * question at a time of varying types in a woven order (e.g. quiz, match,
 * builder, blank, builder, match, write, blank, match-audio, quiz). Each item
 * is a small, self-contained question the Mix page renders + grades inline —
 * no sub-pages, so nothing can cascade.
 *
 * The item generators are pure-ish: they take the level's cards (+ earlier for
 * phrases) and produce plain data. Progress for the Mix node is saved by the
 * page under 'journey-mix' when launched for a real level.
 *
 * @module app/exercises/mix
 */
import { Injectable } from '@angular/core';
import type { Flashcard } from '../../services/flashcard.service';
import {
  buildTreeTokens, generatePhrases, type GeneratedPhrase, type SourceCard,
} from '../../../core/phrase-builder/phrase-builder';

export type MixItemKind = 'quiz' | 'audio' | 'blank' | 'match' | 'builder' | 'write';

/** A multiple-choice option (quiz / audio / blank). */
export interface MixChoice { label: string; correct: boolean; }

/** Quiz: show the word, pick its translation. Audio: same but play audio. */
export interface MixQuizItem {
  kind: 'quiz' | 'audio';
  prompt: string;            // the French word (shown for quiz, spoken for audio)
  audioUrl: string | null;
  choices: MixChoice[];
}

/** Blank: a sentence with one word missing, pick the missing word. */
export interface MixBlankItem {
  kind: 'blank';
  before: string;
  after: string;
  gloss: string;             // English hint
  answer: string;
  full: string;              // whole sentence (for audio)
  choices: MixChoice[];
}

/** Match: a mini-board of a few pairs, link each word to its translation. */
export interface MixMatchItem {
  kind: 'match';
  pairs: { id: string; fr: string; en: string }[];
}

/** Builder: arrange the word chips into the correct phrase. */
export interface MixBuilderItem {
  kind: 'builder';
  gloss: string;             // English prompt
  tokens: string[];          // correct order
  bank: string[];            // shuffled tokens + a few distractors
  target: string;            // whole phrase (for audio)
}

/** Write: type the translation of the prompt. */
export interface MixWriteItem {
  kind: 'write';
  gloss: string;             // English prompt (what to translate FROM)
  accepted: string[];        // acceptable target answers
  target: string;            // canonical answer (for audio + reveal)
}

export type MixItem = MixQuizItem | MixBlankItem | MixMatchItem | MixBuilderItem | MixWriteItem;

export interface MixSession {
  deckId: string;
  level: number;
  items: MixItem[];
  index: number;             // current item
  correct: number;           // items answered correctly first try
}

@Injectable({ providedIn: 'root' })
export class MixSessionService {
  private session: MixSession | null = null;

  /** Total questions in a Mix session. */
  private static readonly TOTAL = 10;
  private static readonly OPTIONS = 4;

  /**
   * Woven plans per familiarity stage (always mixed, assistance fades):
   *  0 Recognition  — French → native, pick / match / listen (1 Builder at the end).
   *  1 Guided       — native → French with word blocks (Builder, Blanks), 1 Write.
   *  2 Independent  — mostly Write (no word bank), a little Builder/Match to vary.
   */
  static readonly PLANS: Record<0 | 1 | 2, MixItemKind[]> = {
    0: ['quiz', 'match', 'audio', 'quiz', 'blank', 'match', 'audio', 'quiz', 'match', 'builder'],
    1: ['quiz', 'builder', 'match', 'blank', 'builder', 'audio', 'write', 'blank', 'builder', 'match'],
    2: ['builder', 'write', 'match', 'write', 'blank', 'write', 'audio', 'write', 'builder', 'write'],
  };

  /** A word's familiarity: 0 new, 1 practised, 2 well practised. */
  static familiarity(c: Flashcard): 0 | 1 | 2 {
    const recent = c.recentResults ?? [];
    const lastWrong = recent[recent.length - 1] === 'incorrect';
    if (c.correctCount >= 5 && c.streak >= 3 && !lastWrong) return 2;
    if (c.correctCount >= 2 && !lastWrong) return 1;
    return 0;
  }

  /** The level's stage from the average word familiarity (≥0.75 guided, ≥1.5 independent). */
  static levelStage(cards: Flashcard[]): 0 | 1 | 2 {
    if (!cards.length) return 0;
    const avg = cards.reduce((s, c) => s + MixSessionService.familiarity(c), 0) / cards.length;
    return avg >= 1.5 ? 2 : avg >= 0.75 ? 1 : 0;
  }

  current(): MixSession | null { return this.session; }
  currentItem(): MixItem | null {
    const s = this.session;
    return s && s.index < s.items.length ? s.items[s.index] : null;
  }
  advance(): void { if (this.session) this.session.index++; }
  recordCorrect(): void { if (this.session) this.session.correct++; }
  clear(): void { this.session = null; }

  /**
   * Build an interleaved session for a level.
   *  - `cards`     : the level's own cards (quiz/audio/match prompts).
   *  - `phraseSrc` : current + earlier cards for phrase generation (builder/blank).
   *  - `writeSrc`  : phrase cards for Write (target + translation).
   *  - `bestTr`    : resolver for a card's best English translation.
   */
  start(
    deckId: string,
    level: number,
    cards: Flashcard[],
    current: SourceCard[],
    earlier: SourceCard[],
    bestTr: (c: Flashcard) => string,
  ): MixSession {
    const items: MixItem[] = [];

    // Pools.
    const playable = cards.filter(c => c.text && c.text !== '—');
    const phrases = this.safe(() => generatePhrases(buildTreeTokens(current, earlier), 12, 'fr', { engine: 'v2', seed: 1 + Math.floor(Math.random() * 1e6) }));
    const blankPhrases = phrases.filter(p => p.blankIndex !== undefined);
    const buildPhrases = phrases.filter(p => p.tokens.length >= 2);

    // Progressive difficulty (docs/LEVEL-ALGORITHM.md): the plan depends on how
    // familiar the learner already is with THIS level's words, not on the unit.
    const stage = MixSessionService.levelStage(playable);
    const plan = MixSessionService.PLANS[stage];
    // Recognition picks the least familiar words; Write picks the most familiar.
    const byFamiliarity = [...playable].sort((a, b) => MixSessionService.familiarity(a) - MixSessionService.familiarity(b));
    const newest = byFamiliarity.slice(0, Math.max(4, Math.ceil(byFamiliarity.length / 2)));
    const known = byFamiliarity.slice(-Math.max(4, Math.ceil(byFamiliarity.length / 2)));

    let bi = 0, bli = 0, writes = 0;
    for (const kind of plan) {
      if (items.length >= MixSessionService.TOTAL) break;
      let item: MixItem | null = null;
      switch (kind) {
        case 'quiz':  item = this.quizItem(playable, bestTr, false, newest); break;
        case 'audio': item = this.quizItem(playable, bestTr, true, newest); break;
        case 'blank': item = this.blankItem(blankPhrases[bli++]); break;
        case 'match': item = this.matchItem(playable, bestTr); break;
        case 'builder': item = this.builderItem(buildPhrases[bi++]); break;
        // Late stage: alternate phrase Write and single-word Write of known words.
        case 'write':
          item = stage === 2 && writes % 2 === 1
            ? this.writeItem(null, known, bestTr)
            : this.writeItem(buildPhrases[bi++] ?? null, known, bestTr);
          writes++;
          break;
      }
      // If a type couldn't be built (not enough content), fall back to a quiz.
      if (!item) item = this.quizItem(playable, bestTr, false);
      if (item) items.push(item);
    }

    this.session = { deckId, level, items: items.slice(0, MixSessionService.TOTAL), index: 0, correct: 0 };
    return this.session;
  }

  // ── Item generators ─────────────────────────────────────────────────────────

  private quizItem(cards: Flashcard[], bestTr: (c: Flashcard) => string, audio: boolean, promptPool: Flashcard[] = cards): MixQuizItem | null {
    if (cards.length < 2) return null;
    const card = this.pick(promptPool.length ? promptPool : cards);
    const correct = bestTr(card);
    const pool = cards
      .filter(c => c.id !== card.id)
      .map(bestTr)
      .filter(t => t && t !== '—' && t.toLowerCase() !== correct.toLowerCase());
    const distractors = this.uniqueShuffle(pool).slice(0, MixSessionService.OPTIONS - 1);
    const choices = this.shuffle([correct, ...distractors]).map(label => ({ label, correct: label === correct }));
    return { kind: audio ? 'audio' : 'quiz', prompt: card.text, audioUrl: card.audioUrl ?? null, choices };
  }

  private blankItem(p: GeneratedPhrase | undefined): MixBlankItem | null {
    if (!p || p.blankIndex === undefined) return null;
    const idx = p.blankIndex;
    const answer = p.tokens[idx];
    const before = p.tokens.slice(0, idx).join(' ');
    const after = p.tokens.slice(idx + 1).join(' ');
    const distractors = (p.distractors ?? []).filter(d => d.toLowerCase() !== answer.toLowerCase());
    if (distractors.length < MixSessionService.OPTIONS - 1) return null;
    const choices = this.shuffle([answer, ...this.uniqueShuffle(distractors).slice(0, MixSessionService.OPTIONS - 1)])
      .map(label => ({ label, correct: label === answer }));
    return { kind: 'blank', before, after, gloss: p.en, answer, full: p.target, choices };
  }

  private matchItem(cards: Flashcard[], bestTr: (c: Flashcard) => string): MixMatchItem | null {
    const usable = this.uniqueByText(cards).filter(c => {
      const en = bestTr(c);
      return en && en !== '—' && en.toLowerCase() !== c.text.toLowerCase();
    });
    if (usable.length < 3) return null;
    const picked = this.uniqueShuffle2(usable).slice(0, 3);
    const pairs = picked.map(c => ({ id: c.id, fr: c.text, en: bestTr(c) }));
    return { kind: 'match', pairs };
  }

  private builderItem(p: GeneratedPhrase | undefined): MixBuilderItem | null {
    if (!p || p.tokens.length < 2) return null;
    const distractors = (p.distractors ?? []).slice(0, 2);
    const bank = this.shuffle([...p.tokens, ...distractors]);
    return { kind: 'builder', gloss: p.en, tokens: p.tokens, bank, target: p.target };
  }

  private writeItem(p: GeneratedPhrase | null, cards: Flashcard[], bestTr: (c: Flashcard) => string): MixWriteItem | null {
    if (p && p.tokens.length >= 2) {
      return { kind: 'write', gloss: p.en, accepted: [p.target], target: p.target };
    }
    // Fall back to a single-word write from a card.
    if (cards.length) {
      const card = this.pick(cards);
      return { kind: 'write', gloss: bestTr(card), accepted: [card.text], target: card.text };
    }
    return null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  private pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
  private shuffle<T>(a: T[]): T[] {
    const r = [...a];
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  private uniqueShuffle(a: string[]): string[] { return this.shuffle([...new Set(a)]); }
  private uniqueShuffle2<T>(a: T[]): T[] { return this.shuffle(a); }
  private uniqueByText(cards: Flashcard[]): Flashcard[] {
    const seen = new Set<string>(); const out: Flashcard[] = [];
    for (const c of cards) { const k = c.text.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(c); } }
    return out;
  }
  private safe<T>(fn: () => T[]): T[] { try { return fn(); } catch { return []; } }
}
