/**
 * Tree lesson modes — the activities a Core/theme LEVEL contains, played in
 * sequence (learn → quiz → write → match → match-audio → builder → builder+ →
 * mix). A level is complete only when all the REQUIRED modes are passed.
 *
 * Flashcards (flip) is NOT in the required sequence: it's offered as OPTIONAL
 * review (see FLASHCARDS_REVIEW_MODE) and never gates level completion.
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

/** The fixed play order of the REQUIRED modes. Index = sequence position. */
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

/**
 * Flashcards (flip) — OPTIONAL review, NOT part of the required sequence and
 * never counted toward level completion. Surfaced as a separate "Review"
 * action (e.g. on the Explore+ detail page).
 */
export const FLASHCARDS_REVIEW_MODE: TreeModeDef = {
  id: 'flip', mode: 'journey-flip', route: '/practice/flip', icon: 'albums-outline', labelKey: 'journey.node.flip',
};
