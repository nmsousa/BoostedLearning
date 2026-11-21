/**
 * Star rules shared by every game (one place, so the scoring, the "stop early"
 * rule and the admin explanation can never disagree). See docs/LEVEL-ALGORITHM.md.
 *
 * Accuracy games (Quiz, Write, Mix, Blanks): stars from the % answered right.
 *   3★ = 100%, 2★ = 85%+, 1★ = 50%+ (= the game is finished / passed).
 *
 * Match (timed): 3 seconds per pair, the same for every level.
 *   3★ = no mistakes AND within the time
 *   2★ = at most 1 mistake (any time), e.g. no mistakes but too slow
 *   1★ = at least half of the pairs matched without a mistake
 * Match Audio: the same, but untimed (you have to wait for each clip).
 *
 * Every game with right/wrong answers stops early once MORE than half of its
 * questions have been answered wrong: it shows an encouraging message and goes
 * back to the level page so the learner can try again. Builder / Builder+ never
 * mark an answer wrong (they only let you place the correct word), so they can't
 * fail and have no stars.
 */

/** Seconds allowed per pair in Match (for 3 stars). Same for every level. */
export const MATCH_SECONDS_PER_PAIR = 3;

/** Minimum % for each star count (accuracy games, and Match's % mapping). */
export const STAR_PERCENT = { 3: 100, 2: 85, 1: 50 } as const;

/** Stars for an accuracy %. 50%+ = 1 star = finished. */
export function starsFromPercent(pct: number): 0 | 1 | 2 | 3 {
  if (pct >= STAR_PERCENT[3]) return 3;
  if (pct >= STAR_PERCENT[2]) return 2;
  if (pct >= STAR_PERCENT[1]) return 1;
  return 0;
}

/** True once MORE than half of the questions have been answered wrong. */
export function tooManyMistakes(wrong: number, total: number): boolean {
  return total > 0 && wrong > total / 2;
}

/** Match stars. `timed` = false for Match Audio (no time limit). */
export function matchStars(o: { pairs: number; mistakes: number; seconds: number; timed: boolean }): 0 | 1 | 2 | 3 {
  if (o.pairs <= 0) return 0;
  const inTime = !o.timed || o.seconds <= o.pairs * MATCH_SECONDS_PER_PAIR;
  if (o.mistakes === 0 && inTime) return 3;
  if (o.mistakes <= 1) return 2;
  const clean = Math.max(0, o.pairs - o.mistakes);
  return clean >= o.pairs / 2 ? 1 : 0;
}

/**
 * The % saved for a Match round, chosen so the shared % → stars mapping gives
 * exactly `matchStars` (progress, best stars and unlocking all read the %).
 */
export function matchScorePercent(o: { pairs: number; mistakes: number; seconds: number; timed: boolean }): number {
  const stars = matchStars(o);
  if (stars === 3) return 100;
  if (stars === 2) return STAR_PERCENT[2];
  const clean = Math.max(0, o.pairs - o.mistakes);
  const pct = o.pairs > 0 ? Math.round((clean / o.pairs) * 100) : 0;
  return stars === 1 ? Math.max(STAR_PERCENT[1], Math.min(pct, STAR_PERCENT[2] - 1)) : Math.min(pct, STAR_PERCENT[1] - 1);
}

/** m:ss */
export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// ── Admin explanations (admin-only, so plain English) ─────────────────────────

/** The star rules for an accuracy game with `total` questions. */
export function accuracyRulesText(gameName: string, total: number): string {
  const need = (pct: number) => Math.ceil((total * pct) / 100);
  const stop = Math.floor(total / 2) + 1;
  return [
    `${gameName}: ${total} question${total === 1 ? '' : 's'} in this round.`,
    '',
    `★★★  all ${total} right`,
    `★★   at least ${need(STAR_PERCENT[2])} right (85%)`,
    `★    at least ${need(STAR_PERCENT[1])} right (50%) — the round counts as finished`,
    '',
    `Stops early after ${stop} wrong answer${stop === 1 ? '' : 's'} (more than half), with an encouraging message.`,
    'Stars are the best result across plays; 1★ marks the activity as done.',
  ].join('\n');
}

/** The star rules for a Match board of `pairs` pairs. */
export function matchRulesText(pairs: number, timed: boolean): string {
  const seconds = pairs * MATCH_SECONDS_PER_PAIR;
  const half = Math.ceil(pairs / 2);
  const stop = Math.floor(pairs / 2) + 1;
  return [
    `${timed ? 'Match' : 'Match Audio'}: ${pairs} pair${pairs === 1 ? '' : 's'}.`,
    '',
    timed
      ? `★★★  0 mistakes in ${fmtTime(seconds)} or less (${MATCH_SECONDS_PER_PAIR} s per pair)`
      : '★★★  0 mistakes (no time limit)',
    timed ? '★★   at most 1 mistake (any time), or 0 mistakes but slower' : '★★   at most 1 mistake',
    `★    at least ${half} pair${half === 1 ? '' : 's'} matched without a mistake — the board counts as finished`,
    '',
    `Stops early after ${stop} mistake${stop === 1 ? '' : 's'} (more than half), with an encouraging message.`,
  ].join('\n');
}

/** Builder / Builder+ (self-checking, no stars). */
export function builderRulesText(gameName: string, phrases: number): string {
  return [
    `${gameName}: ${phrases} phrase${phrases === 1 ? '' : 's'}.`,
    '',
    'No stars: you can only place the next correct word, so a phrase can never be wrong.',
    'Finishing every phrase completes the activity.',
  ].join('\n');
}
