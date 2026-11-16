/**
 * Tree lesson modes — the activities a Core/theme LEVEL contains: a Learn step,
 * then 7 games (quiz, write, match, match-audio, builder, builder+, mix). A level
 * is complete when Learn is done and any 5 of the 7 games are passed, in any
 * order (see tierProgress below) — the other 2 are optional.
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
  id: 'learn' | 'flip' | 'quiz' | 'write' | 'match' | 'match-audio' | 'builder' | 'builder-plus' | 'mix';
  /** Progress namespace (independent per mode). */
  mode: PracticeMode;
  /** Exercise route the node launches. */
  route: string;
  /** Ionicon name for the mode node. */
  icon: string;
  /** i18n key for the mode label (reuses the shared journey.node.* keys). */
  labelKey: string;
}

/** The modes of a level, in display order (Learn first, then the games). */
export const TREE_MODES: readonly TreeModeDef[] = [
  { id: 'learn',   mode: 'journey-learn',   route: '/practice/learn',           icon: 'school-outline',      labelKey: 'journey.node.learn' },
  { id: 'quiz',    mode: 'journey-quiz',    route: '/practice/quiz',            icon: 'help',                labelKey: 'journey.node.quiz' },
  { id: 'write',   mode: 'journey-write',   route: '/practice/journey-play',    icon: 'create-outline',      labelKey: 'journey.node.write' },
  { id: 'match',   mode: 'journey-match',   route: '/practice/match',           icon: 'git-compare-outline', labelKey: 'journey.node.match' },
  { id: 'match-audio', mode: 'journey-match-audio', route: '/practice/match',    icon: 'volume-high-outline', labelKey: 'journey.node.matchAudio' },
  { id: 'builder', mode: 'journey-builder', route: '/practice/journey-builder', icon: 'construct-outline',   labelKey: 'journey.node.builder' },
  { id: 'builder-plus', mode: 'journey-builder-plus', route: '/practice/journey-builder-plus', icon: 'construct', labelKey: 'journey.node.builderPlus' },
  // Mix is the LAST node: a mixed session of the level's activities. It counts
  // toward tier completion like the others and is double-tap-completable (admin).
  { id: 'mix',     mode: 'journey-mix',     route: '/practice/mix',             icon: 'shuffle-outline',     labelKey: 'home.mode.mix' },
];

// ── Completion rule ───────────────────────────────────────────────────────────
// A level is complete when its Learn step is done AND at least REQUIRED_GAMES of
// the GAME modes (every mode except Learn) are passed — in ANY order. The rest
// are optional. One shared rule so Explore, Explore+, the level page and the
// radial Tree can never disagree.

/** How many of the games must be passed to complete a level. */
export const REQUIRED_GAMES = 5;

/** Learn is the teaching intro; every other mode is a "game". */
export function isGameMode(m: { id: string }): boolean { return m.id !== 'learn'; }

/** Number of game modes available per level (7 today). */
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
};
