/**
 * Tree lesson modes — the 5 activities every Core/theme LEVEL contains, played
 * in sequence (flip → quiz → write → match → builder), exactly like a Journey
 * chapter. A level is complete only when all five modes are passed.
 *
 * Each mode maps to an existing exercise route + its own progress namespace, so
 * the five are tracked independently under one deck level (the Tree synthetic
 * deck), separate from the real Journey.
 *
 * @module app/flashcards/tree
 */
import type { PracticeMode } from '../../services/flashcard.service';

export interface TreeModeDef {
  /** Stable id / order key. */
  id: 'learn' | 'flip' | 'quiz' | 'write' | 'match' | 'match-audio' | 'builder';
  /** Progress namespace (independent per mode). */
  mode: PracticeMode;
  /** Exercise route the node launches. */
  route: string;
  /** Ionicon name for the mode node. */
  icon: string;
  /** i18n key for the mode label (reuses the shared journey.node.* keys). */
  labelKey: string;
}

/** The fixed play order. Index = sequence position (0 = first). */
export const TREE_MODES: readonly TreeModeDef[] = [
  { id: 'learn',   mode: 'journey-learn',   route: '/practice/learn',           icon: 'school-outline',      labelKey: 'journey.node.learn' },
  { id: 'flip',    mode: 'journey-flip',    route: '/practice/flip',            icon: 'albums-outline',      labelKey: 'journey.node.flip' },
  { id: 'quiz',    mode: 'journey-quiz',    route: '/practice/quiz',            icon: 'help',                labelKey: 'journey.node.quiz' },
  { id: 'write',   mode: 'journey-write',   route: '/practice/journey-play',    icon: 'create-outline',      labelKey: 'journey.node.write' },
  { id: 'match',   mode: 'journey-match',   route: '/practice/match',           icon: 'git-compare-outline', labelKey: 'journey.node.match' },
  { id: 'match-audio', mode: 'journey-match-audio', route: '/practice/match',    icon: 'volume-high-outline', labelKey: 'journey.node.matchAudio' },
  { id: 'builder', mode: 'journey-builder', route: '/practice/journey-builder', icon: 'construct-outline',   labelKey: 'journey.node.builder' },
];
