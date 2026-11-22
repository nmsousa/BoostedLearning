/**
 * Explore+ placement test: find the band where the learner should start.
 *
 * Band by band (Pre-A1 → A1 → A2), ask PER_BAND questions built from that
 * band's authored sentences (English prompt → pick the right French sentence;
 * the wrong options are other sentences of the same band). Getting at least
 * PASS of them right moves on to the next band; otherwise the learner starts
 * at the first lesson of that band. Passing every band starts at the last band.
 */
import { BANDS, type LessonBand } from './lesson-types';
import { LESSONS, shuffled } from './lessons';

export const PLACEMENT_PER_BAND = 4;
export const PLACEMENT_PASS = 3;
const OPTIONS = 4;

export interface PlacementQuestion {
  band: LessonBand;
  prompt: string;
  options: string[];
  answer: string;
}

/** Bands that have lessons, in order. */
export function placementBands(): LessonBand[] {
  return BANDS.map(b => b.id).filter(id => LESSONS.some(l => l.band === id));
}

/**
 * The questions for one band: one sentence from each of PER_BAND lessons spread
 * across the band (early → late), so the test samples the whole band.
 */
export function placementQuestions(band: LessonBand): PlacementQuestion[] {
  const lessons = LESSONS.filter(l => l.band === band);
  if (!lessons.length) return [];
  const n = Math.min(PLACEMENT_PER_BAND, lessons.length);
  const picks = Array.from({ length: n }, (_v, i) => lessons[Math.floor((i * lessons.length) / n)]);
  const all = lessons.flatMap(l => l.sentences);
  return picks.map(lesson => {
    const q = shuffled(lesson.sentences)[0];
    const wrong = shuffled(all.filter(x => x.fr !== q.fr && x.en !== q.en)).map(x => x.fr);
    const options = shuffled([q.fr, ...[...new Set(wrong)].slice(0, OPTIONS - 1)]);
    return { band, prompt: q.en, options, answer: q.fr };
  });
}

/** True when a band's score lets the learner skip it. */
export function bandPassed(correct: number): boolean {
  return correct >= PLACEMENT_PASS;
}

/**
 * Where to start, from the bands answered so far (in order) and how many each
 * got right. Returns the band to start in and its first lesson id.
 */
export function placementResult(scores: { band: LessonBand; correct: number }[]): { band: LessonBand; lessonId: string } {
  const bands = placementBands();
  let band = bands[0];
  for (const sc of scores) {
    band = sc.band;
    if (!bandPassed(sc.correct)) break;
    const next = bands[bands.indexOf(sc.band) + 1];
    if (next) band = next;
  }
  const first = LESSONS.find(l => l.band === band) ?? LESSONS[0];
  return { band, lessonId: first.id };
}
