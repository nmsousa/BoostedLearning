/**
 * Explore+ placement — two kinds of short, game-like checks built from the
 * authored question bank (placement-bank.ts, imported from "CEFR - Test"):
 *
 * 1. INITIAL PLACEMENT (once, at the start): adaptive, 10–12 questions.
 *    Starts with an easy Pre-A1 question; a right answer moves one band up, a
 *    wrong one moves one band down. It stops after 10 questions once the
 *    estimate is stable (unchanged over the last 2 answers), at most 12.
 *    Estimated level = the highest band with ≥ 2 right AND ≥ 60% right there.
 *    The learner starts at the NEXT band (that's what they need to learn).
 *
 * 2. LEVEL-UNLOCK TEST (later, for ONE band): only that band's questions,
 *    8 for Pre-A1–B1, 10 for B2+. ≥ 75% unlocks the band (all of it); 100%
 *    (or ≥ 90%) is a strong pass, otherwise it's a provisional pass with a
 *    revision tip; below 75% the band stays locked ("not yet").
 *
 * Results only ever RAISE what is unlocked, never lower it (lesson-engine.ts).
 */
import { BANDS, type LessonBand } from './lesson-types';
import { GLOBAL_ITEMS, LEVEL_ITEMS } from './placement-bank';
import type { PlacementItem, PlacementSkill } from './placement-types';

export const GLOBAL_MIN = 10;
export const GLOBAL_MAX = 12;
export const LEVEL_PASS = 0.75;
export const LEVEL_STRONG = 0.9;

export interface PlacementAnswer { item: PlacementItem; correct: boolean }

/** Course bands (the lessons) that have questions, in order. */
export function courseBands(): LessonBand[] {
  return BANDS.map(b => b.id).filter(id => GLOBAL_ITEMS.some(i => i.band === id) || (LEVEL_ITEMS[id]?.length ?? 0) > 0);
}

function shuffled<T>(a: readonly T[], rand: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/** Highest band index with ≥ 2 right and ≥ 60% right, or -1. */
export function estimateLevel(answers: readonly PlacementAnswer[], bands: readonly LessonBand[]): number {
  let best = -1;
  bands.forEach((band, i) => {
    const at = answers.filter(a => a.item.band === band);
    const right = at.filter(a => a.correct).length;
    if (right >= 2 && right / at.length >= 0.6) best = i;
  });
  return best;
}

/** Adaptive initial placement (one instance per test run). */
export class AdaptivePlacement {
  readonly answers: PlacementAnswer[] = [];
  /** Index into `bands` of the next question's band. */
  private level = 0;
  private readonly used = new Set<string>();

  constructor(
    readonly bands: readonly LessonBand[] = courseBands(),
    private readonly rand: () => number = Math.random,
  ) {}

  get maxQuestions(): number { return GLOBAL_MAX; }

  /** The next question, or null when the test is over. */
  next(): PlacementItem | null {
    if (this.done) return null;
    // Nearest band (current first, then the closest ones) with an unused item.
    const order = [...this.bands.keys()].sort((a, b) => Math.abs(a - this.level) - Math.abs(b - this.level) || a - b);
    for (const bi of order) {
      const band = this.bands[bi];
      // Global items first, then that band's level-test items as a reserve.
      const pool = [...GLOBAL_ITEMS.filter(i => i.band === band), ...(LEVEL_ITEMS[band] ?? [])]
        .filter(i => !this.used.has(i.id));
      const globals = pool.filter(i => GLOBAL_ITEMS.includes(i));
      const pick = shuffled(globals.length ? globals : pool, this.rand)[0];
      if (pick) { this.used.add(pick.id); return pick; }
    }
    return null;
  }

  record(item: PlacementItem, correct: boolean): void {
    this.answers.push({ item, correct });
    const at = this.bands.indexOf(item.band as LessonBand);
    const from = at >= 0 ? at : this.level;
    this.level = Math.max(0, Math.min(this.bands.length - 1, from + (correct ? 1 : -1)));
  }

  get done(): boolean {
    const n = this.answers.length;
    if (n >= GLOBAL_MAX) return true;
    if (n < GLOBAL_MIN) return false;
    // Enough evidence: the estimate didn't move over the last 2 answers.
    return estimateLevel(this.answers, this.bands) === estimateLevel(this.answers.slice(0, n - 2), this.bands);
  }

  /** Estimated level (-1 = below Pre-A1) and the band to start in. */
  result(): { level: number; start: number } {
    const level = estimateLevel(this.answers, this.bands);
    return { level, start: Math.min(this.bands.length - 1, level + 1) };
  }
}

/** The questions of a level-unlock test for one band (8, or 10 from B2). */
export function levelTestQuestions(band: LessonBand, rand: () => number = Math.random): PlacementItem[] {
  const count = BANDS.findIndex(b => b.id === band) >= BANDS.findIndex(b => b.id === 'b2') ? 10 : 8;
  const own = shuffled(LEVEL_ITEMS[band] ?? [], rand);
  const extra = shuffled(GLOBAL_ITEMS.filter(i => i.band === band), rand);
  return [...own, ...extra].slice(0, count);
}

export type LevelVerdict = 'strong' | 'provisional' | 'notYet';

export function levelVerdict(correct: number, total: number): LevelVerdict {
  if (total <= 0) return 'notYet';
  const pct = correct / total;
  if (pct >= LEVEL_STRONG) return 'strong';
  return pct >= LEVEL_PASS ? 'provisional' : 'notYet';
}

/** Per-skill result, for the strengths / to-work-on summary. */
export function skillBreakdown(answers: readonly PlacementAnswer[]): { strengths: PlacementSkill[]; weaknesses: PlacementSkill[] } {
  const skills: PlacementSkill[] = ['languageUse', 'vocabulary', 'reading', 'listening'];
  const strengths: PlacementSkill[] = [];
  const weaknesses: PlacementSkill[] = [];
  for (const sk of skills) {
    const at = answers.filter(a => a.item.skill === sk);
    if (!at.length) continue;
    const pct = at.filter(a => a.correct).length / at.length;
    if (pct >= 0.7) strengths.push(sk);
    else if (pct < 0.5) weaknesses.push(sk);
  }
  return { strengths, weaknesses };
}
