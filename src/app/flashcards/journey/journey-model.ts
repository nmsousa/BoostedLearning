/**
 * Journey data model, shared by the classic Journey map and Journey+.
 *
 * A chapter is ONE skill level, played as a fixed sequence of activity nodes
 * (Flashcards → Quiz → Write → Match → Builder, + Blanks on French decks).
 * Both pages read the same `journey-*` progress, so they always agree on what
 * is passed / unlocked.
 *
 * @module app/flashcards/journey
 */
import type { DeckLevel, PracticeMode } from '../../services/flashcard.service';
import type { LevelProgressEntity } from '../../../persistence/database';

/** Activity types of a chapter, in play order. */
export type JourneyNodeType = 'flip' | 'quiz' | 'write' | 'match' | 'builder' | 'blanks';

/** One node (activity) within a chapter. */
export interface JourneyNode {
  type: JourneyNodeType;
  /** The per-node progress mode ('journey-flip', …). */
  mode: PracticeMode;
  /** The exercise route to navigate to. */
  route: string;
  icon: string;
  color: string;
  passed: boolean;
  unlocked: boolean;
}

/** A chapter = ONE skill, played as the fixed single-pass nodes. */
export interface JourneyChapter {
  /** Chapter number (1-based). */
  number: number;
  /** Skill name ('' for decks without named skills). */
  name: string;
  /** The skill's level number (shared level index used by every node mode). */
  levelNumber: number;
  /** Words in the level (used for duration estimates). */
  cardCount: number;
  nodes: JourneyNode[];
  /** How many nodes are passed. */
  done: number;
  /** Reachable: chapter 1, or the previous chapter is complete. */
  unlocked: boolean;
  /** All nodes passed. */
  complete: boolean;
}

interface NodeDef {
  type: JourneyNodeType;
  mode: PracticeMode;
  route: string;
  icon: string;
  color: string;
}

/** Node definitions in play order. */
export const JOURNEY_NODE_DEFS: readonly NodeDef[] = [
  { type: 'flip',    mode: 'journey-flip',    route: '/practice/flip',            icon: 'albums-outline',      color: 'primary' },
  { type: 'quiz',    mode: 'journey-quiz',    route: '/practice/quiz',            icon: 'help', color: 'success' },
  { type: 'write',   mode: 'journey-write',   route: '/practice/journey-play',    icon: 'create-outline',      color: 'secondary' },
  { type: 'match',   mode: 'journey-match',   route: '/practice/match',           icon: 'git-compare-outline', color: 'tertiary' },
  { type: 'builder', mode: 'journey-builder', route: '/practice/journey-builder', icon: 'construct-outline',   color: 'warning' },
];

/** The French-only Blanks node, appended to each chapter on French decks. */
export const JOURNEY_BLANKS_NODE_DEF: NodeDef = {
  type: 'blanks', mode: 'journey-blanks', route: '/practice/blanks', icon: 'reorder-four-outline', color: 'danger',
};

/** A node is passed once its best score reaches this. */
export const JOURNEY_PASS_SCORE = 70;

/**
 * Build one chapter per skill level from the bulk progress map
 * (`getDeckLevelProgressMap`, keyed "mode-levelNumber"). Nodes unlock left to
 * right (first node, or the previous one passed); a chapter unlocks when the
 * previous chapter is complete (chapter 1 always).
 */
export function buildJourneyChapters(
  levels: DeckLevel[],
  progress: Map<string, LevelProgressEntity>,
  isFrench: boolean,
): JourneyChapter[] {
  const nodeDefs = isFrench ? [...JOURNEY_NODE_DEFS, JOURNEY_BLANKS_NODE_DEF] : [...JOURNEY_NODE_DEFS];

  const chapters: JourneyChapter[] = [];
  let prevComplete = true;
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const chapterUnlocked = prevComplete;
    const passed = nodeDefs.map(def =>
      (progress.get(`${def.mode}-${level.levelNumber}`)?.bestScore ?? 0) >= JOURNEY_PASS_SCORE,
    );
    const nodes: JourneyNode[] = nodeDefs.map((def, n) => ({
      ...def,
      passed: passed[n],
      unlocked: chapterUnlocked && (n === 0 || passed[n - 1]),
    }));
    const done = passed.filter(Boolean).length;
    const complete = done === nodeDefs.length;
    chapters.push({
      number: i + 1,
      name: level.skill ?? '',
      levelNumber: level.levelNumber,
      cardCount: level.cardCount,
      nodes,
      done,
      unlocked: chapterUnlocked,
      complete,
    });
    prevComplete = complete;
  }
  return chapters;
}
