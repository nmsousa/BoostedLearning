/**
 * Tree lesson modes — the activities a Core/theme LEVEL contains: a Learn step,
 * then 8 games (quiz, write, match, match-audio, builder, builder+, blanks, mix).
 * A level is complete when Learn is done and any 6 of the 8 games are passed, in
 * any order (see tierProgress below) — the other 2 are optional.
 *
 * Flashcards (flip) is not one of them: it's offered as OPTIONAL review (see
 * FLASHCARDS_REVIEW_MODE) and never gates level completion.
 *
 * Each mode maps to an existing exercise route + its own progress namespace, so
 * they're tracked independently under one deck level (the Tree synthetic deck),
 * separate from the real Journey.
 *
 * @module app/maps/tree
 */
import type { PracticeMode } from '../../services/flashcard.service';

export interface TreeModeDef {
  /** Stable id / order key. */
  id: 'learn' | 'flip' | 'quiz' | 'write' | 'match' | 'match-audio' | 'builder' | 'builder-plus' | 'blanks' | 'mix';
  /** Progress namespace (independent per mode). */
  mode: PracticeMode;
  /** Exercise route the node launches. */
  route: string;
  /** Ionicon name for the mode node. */
  icon: string;
  /** i18n key for the mode label (reuses the shared journey.node.* keys). */
  labelKey: string;
  /** The home page's i18n key for this mode ('home.mode.quiz'); its '.desc' sibling
   *  is the one-line description. The level page shows the same name + description
   *  as the home card, so a mode reads the same everywhere. */
  homeKey: string;
  /** Home-card accent for the icon colour ('' = the default text colour). */
  accent: '' | 'write' | 'match' | 'match-audio' | 'quiz' | 'builder' | 'builder-plus' | 'blanks';
}

/** The modes of a level, in display order (Learn first, then the games). */
export const TREE_MODES: readonly TreeModeDef[] = [
  { id: 'learn',   mode: 'journey-learn',   route: '/practice/learn',           icon: 'school-outline',      labelKey: 'journey.node.learn', homeKey: 'home.mode.learn', accent: '' },
  { id: 'quiz',    mode: 'journey-quiz',    route: '/practice/quiz',            icon: 'help',                labelKey: 'journey.node.quiz', homeKey: 'home.mode.quiz', accent: 'quiz' },
  { id: 'write',   mode: 'journey-write',   route: '/practice/journey-play',    icon: 'create-outline',      labelKey: 'journey.node.write', homeKey: 'home.mode.write', accent: 'write' },
  { id: 'match',   mode: 'journey-match',   route: '/practice/match',           icon: 'git-compare-outline', labelKey: 'journey.node.match', homeKey: 'home.mode.match', accent: 'match' },
  { id: 'match-audio', mode: 'journey-match-audio', route: '/practice/match',    icon: 'volume-high-outline', labelKey: 'journey.node.matchAudio', homeKey: 'home.mode.matchAudio', accent: 'match-audio' },
  { id: 'builder', mode: 'journey-builder', route: '/practice/journey-builder', icon: 'construct-outline',   labelKey: 'journey.node.builder', homeKey: 'home.mode.builder', accent: 'builder' },
  { id: 'builder-plus', mode: 'journey-builder-plus', route: '/practice/journey-builder-plus', icon: 'construct', labelKey: 'journey.node.builderPlus', homeKey: 'home.mode.builderPlus', accent: 'builder-plus' },
  // Blanks: pick the missing word in a sentence (authored sentences in Explore+).
  { id: 'blanks',  mode: 'journey-blanks',  route: '/practice/blanks',          icon: 'reorder-four-outline', labelKey: 'home.mode.blanks', homeKey: 'home.mode.blanks', accent: 'blanks' },
  // Mix is the LAST node: a mixed session of the level's activities. It counts
  // toward tier completion like the others and is double-tap-completable (admin).
  { id: 'mix',     mode: 'journey-mix',     route: '/practice/mix',             icon: 'shuffle-outline',     labelKey: 'home.mode.mix', homeKey: 'home.mode.mix', accent: '' },
];

// ── Completion rule ───────────────────────────────────────────────────────────
// A level is complete when its Learn step is done AND at least REQUIRED_GAMES of
// the GAME modes (every mode except Learn) are passed — in ANY order. The rest
// are optional. One shared rule so Explore, Explore+, the level page and the
// radial Tree can never disagree.

/** How many of the games must be passed to complete a level. */
export const REQUIRED_GAMES = 6;

/** Learn is the teaching intro; every other mode is a "game". */
export function isGameMode(m: { id: string }): boolean { return m.id !== 'learn'; }

/** Number of game modes available per level (8 today). */
export const GAME_COUNT = TREE_MODES.filter(isGameMode).length;

export type ModeState = 'done' | 'active' | 'locked';

/** A level's progress under the completion rule. */
export interface TierProgress {
  learnDone: boolean;
  /** Games passed so far (can exceed REQUIRED_GAMES: extras are optional). */
  gamesDone: number;
  gamesRequired: number;
  gamesTotal: number;
  /** Learn done AND gamesDone >= gamesRequired. */
  complete: boolean;
  /** 0–100: Learn + the required games, capped (extra games don't add). */
  percent: number;
}

/** Compute a level's progress; `passed(m)` says whether a mode is passed. */
export function tierProgress(passed: (m: TreeModeDef) => boolean): TierProgress {
  const learnDone = TREE_MODES.some(m => !isGameMode(m) && passed(m));
  const gamesDone = TREE_MODES.filter(m => isGameMode(m) && passed(m)).length;
  const steps = 1 + REQUIRED_GAMES;
  const doneSteps = (learnDone ? 1 : 0) + Math.min(gamesDone, REQUIRED_GAMES);
  return {
    learnDone, gamesDone, gamesRequired: REQUIRED_GAMES, gamesTotal: GAME_COUNT,
    complete: learnDone && gamesDone >= REQUIRED_GAMES,
    percent: Math.round((doneSteps / steps) * 100),
  };
}

/**
 * Per-mode state, aligned with TREE_MODES order: a passed mode is 'done'; Learn
 * is always playable; the games open once Learn is done (then ALL are open, in
 * any order). An unauthored tier locks everything.
 */
export function modeStates(passed: (m: TreeModeDef) => boolean, authored = true): ModeState[] {
  const learnDone = TREE_MODES.some(m => !isGameMode(m) && passed(m));
  return TREE_MODES.map(m => {
    if (!authored) return 'locked';
    if (passed(m)) return 'done';
    return isGameMode(m) && !learnDone ? 'locked' : 'active';
  });
}

/**
 * Flashcards (flip) — OPTIONAL review, NOT part of the required sequence and
 * never counted toward level completion. Surfaced as a separate "Review"
 * action (e.g. on the Explore+ detail page).
 */
export const FLASHCARDS_REVIEW_MODE: TreeModeDef = {
  id: 'flip', mode: 'journey-flip', route: '/practice/flip', icon: 'albums-outline', labelKey: 'journey.node.flip',
  homeKey: 'home.mode.flashcards', accent: '',
};

/** Minimum score for a mode to count as passed (= 1 star). */
const TREE_PASS_SCORE = 50;   // = 1 star (shared/star-rules.ts)

/**
 * Whether a mode is PASSED, from its saved progress. It is the BEST result that
 * counts (1+ stars earned in any play), not the running average of every play:
 * `bestScore` is an average over all rounds, so earlier weak plays could keep a
 * later 2-star result from ever counting as completed. `bestStars` keeps the
 * best round, so once you've earned a star the mode stays done.
 */
export function isModePassed(p: { bestStars?: number; bestScore?: number } | undefined | null): boolean {
  return (p?.bestStars ?? 0) >= 1 || (p?.bestScore ?? 0) >= TREE_PASS_SCORE;
}
