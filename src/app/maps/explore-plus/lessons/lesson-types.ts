/**
 * Explore+ lesson curriculum — content contract.
 *
 * Explore+ is organised as LESSONS grouped by CEFR band (Pre-A1, A1, A2, …).
 * Each lesson is one small mission: a subject (greetings, the café, the doctor…)
 * + the grammar it needs, with its own words AND its own authored sentences.
 * Nothing French is generated at runtime: the games only pick, shuffle and
 * mix this authored content (see lessons.ts → lessonPhrases).
 *
 * Authoring rules (checked by lessons.spec.ts):
 *  - `id` is permanent (progress is keyed by lesson order AND the id must never
 *    be reused for different content). Append new lessons at the END of a band
 *    file; never reorder published lessons.
 *  - word `fr` is exactly what the learner types and hears; nouns WITH their
 *    article ("le café", "l’hôtel"); no standalone fragments ("l’", "de l’").
 *  - word `en` is the bare English ("coffee"); the app adds "the / a" itself.
 *    For nouns starting with l’ or les, add the gender: "hotel (m.)".
 *  - sentence `key` is ONE word of `fr` (the blank in Blanks, the focus word);
 *    `wrong` are 3 single words that are clearly wrong in that slot (they are
 *    the Blanks options and the extra Builder tiles).
 *  - `alt` lists other accepted answers for Write (e.g. the feminine form).
 *  - When an English prompt could mean tu or vous, say which: "(tu)" / "(vous)".
 *
 * Ideas kept for later (inspired by Babbel's review items): per-item health /
 * next review date / mistake count, a highlighted focus word in the sentence,
 * a speaker role for dialogue audio, and an image per sentence.
 */

export type LessonBand = 'pre-a1' | 'a1' | 'a2' | 'b1' | 'b2';

export interface LessonWord {
  fr: string;
  en: string;
  /** Short usage / grammar note shown on the Learn card. */
  note?: string;
  /** One emoji shown on the Learn card. */
  icon?: string;
}

export interface LessonSentence {
  fr: string;
  en: string;
  /** The focus word (must be one of the sentence's words). */
  key: string;
  /** Three wrong options for the focus word. */
  wrong: [string, string, string];
  /** Other accepted answers for Write. */
  alt?: string[];
}

export interface Lesson {
  /** Permanent id, e.g. "a1-03". */
  id: string;
  band: LessonBand;
  /** One emoji for the lesson card. */
  icon: string;
  title: string;
  /** What the learner can DO after the lesson. */
  goal: string;
  /** The grammar idea of the lesson, in one line. */
  grammar: string;
  words: LessonWord[];
  sentences: LessonSentence[];
}

export interface BandDef {
  id: LessonBand;
  /** CEFR label shown on cards ("A1"). */
  cefr: string;
  /** i18n key for the band name ("Beginner"). */
  nameKey: string;
  /** Card colour hue. */
  hue: number;
}

export const BANDS: readonly BandDef[] = [
  { id: 'pre-a1', cefr: 'Pre-A1', nameKey: 'xp.band.preA1', hue: 195 },
  { id: 'a1', cefr: 'A1', nameKey: 'xp.band.a1', hue: 262 },
  { id: 'a2', cefr: 'A2', nameKey: 'xp.band.a2', hue: 22 },
  { id: 'b1', cefr: 'B1', nameKey: 'xp.band.b1', hue: 150 },
  { id: 'b2', cefr: 'B2', nameKey: 'xp.band.b2', hue: 335 },
];

/** Compact sentence helper for the band files. */
export function s(
  fr: string, en: string, key: string, wrong: [string, string, string], alt?: string[],
): LessonSentence {
  return alt ? { fr, en, key, wrong, alt } : { fr, en, key, wrong };
}
