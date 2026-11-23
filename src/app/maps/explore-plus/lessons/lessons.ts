/**
 * Explore+ lessons — the full ordered list + the helpers the games use.
 *
 * Lesson N (1-based, in LESSONS order) is deck level N of the "lesson-<lang>"
 * deck. Games read the level's words from the deck as usual, and its authored
 * sentences from `lessonPhrases(level)` (never generated).
 */
import type { GeneratedPhrase } from '../../../../core/phrase-builder/phrase-builder';
import { BANDS, type BandDef, type Lesson, type LessonBand, type LessonSentence, type LessonWord } from './lesson-types';
import { LESSONS_PRE_A1 } from './lessons-pre-a1';
import { LESSONS_A1 } from './lessons-a1';
import { LESSONS_A2 } from './lessons-a2';
import { LESSONS_B1 } from './lessons-b1';
import { LESSONS_B2 } from './lessons-b2';

export * from './lesson-types';

/** Every lesson in learning order (band by band). */
export const LESSONS: readonly Lesson[] = [...LESSONS_PRE_A1, ...LESSONS_A1, ...LESSONS_A2, ...LESSONS_B1, ...LESSONS_B2];

/**
 * Fixed deck layout: each band owns BAND_SLOTS levels (Pre-A1 → 1–40, A1 →
 * 41–80, A2 → 81–120…), so adding a lesson at the end of a band never shifts
 * the saved progress of the next bands. Unused slots are "—" placeholders.
 */
export const BAND_SLOTS = 40;

export function bandOf(band: LessonBand): BandDef {
  return BANDS.find(b => b.id === band) ?? BANDS[0];
}

function lessonsOfBand(band: LessonBand): Lesson[] {
  return LESSONS.filter(l => l.band === band);
}

/** The lesson at a deck level (1-based), or undefined (placeholder slot). */
export function lessonAtLevel(level: number): Lesson | undefined {
  if (level < 1) return undefined;
  const band = BANDS[Math.floor((level - 1) / BAND_SLOTS)];
  return band ? lessonsOfBand(band.id)[(level - 1) % BAND_SLOTS] : undefined;
}

/** Deck level (1-based) of a lesson id, or 0. */
export function levelOfLesson(id: string): number {
  const lesson = LESSONS.find(l => l.id === id);
  if (!lesson) return 0;
  const b = BANDS.findIndex(x => x.id === lesson.band);
  return b * BAND_SLOTS + lessonsOfBand(lesson.band).indexOf(lesson) + 1;
}

/** The deck groups to register: one per slot, in level order. */
export function lessonDeckGroups(): { skill: string; words: { fr: string; en: string }[] }[] {
  return Array.from({ length: BANDS.length * BAND_SLOTS }, (_v, i) => {
    const lesson = lessonAtLevel(i + 1);
    return lesson
      ? { skill: lesson.title, words: lesson.words.map(w => ({ fr: w.fr, en: w.en })) }
      : { skill: `— ${i + 1}`, words: [{ fr: '—', en: '—' }] };
  });
}

/** Word metadata (note / icon) by French text, for the Learn cards. */
export function lookupLessonWord(fr: string): LessonWord | undefined {
  const k = fr.trim().toLowerCase();
  for (const l of LESSONS) {
    const w = l.words.find(x => x.fr.toLowerCase() === k);
    if (w) return w;
  }
  return undefined;
}

/** The sentence's words, without punctuation ("Bonjour, madame !" → Bonjour, madame). */
export function sentenceTokens(fr: string): string[] {
  return fr
    .split(/\s+/)
    .map(t => t.replace(/^[«"“(¿¡]+/, '').replace(/[.,!?;:…»"”)]+$/, ''))
    .filter(Boolean);
}

/** Index of the sentence's focus word in its tokens (-1 if missing). */
export function keyIndex(sentence: LessonSentence): number {
  const k = sentence.key.toLowerCase();
  return sentenceTokens(sentence.fr).findIndex(t => t.toLowerCase() === k);
}

/** An authored sentence in the shape every phrase game already uses. */
export function toPhrase(sentence: LessonSentence): GeneratedPhrase {
  const tokens = sentenceTokens(sentence.fr);
  const idx = keyIndex(sentence);
  return {
    tokens,
    target: sentence.fr,
    en: sentence.en,
    ...(idx >= 0 ? { blankIndex: idx } : {}),
    distractors: [...sentence.wrong],
    accepted: [sentence.fr, ...(sentence.alt ?? [])],
  };
}

/** Fisher–Yates shuffle (copy). */
export function shuffled<T>(a: readonly T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Up to `max` of a lesson's authored sentences as phrases, in random order. */
export function lessonPhrases(level: number, max = 12): GeneratedPhrase[] {
  const lesson = lessonAtLevel(level);
  if (!lesson) return [];
  return shuffled(lesson.sentences).slice(0, max).map(toPhrase);
}

/** Up to `max` sentences for Write: the French to type + every accepted answer. */
export function lessonWriteItems(level: number, max: number): { fr: string; en: string; accepted: string[] }[] {
  const lesson = lessonAtLevel(level);
  if (!lesson) return [];
  return shuffled(lesson.sentences).slice(0, max).map(x => ({
    fr: x.fr, en: x.en, accepted: [x.fr, ...(x.alt ?? [])],
  }));
}
