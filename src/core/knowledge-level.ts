/**
 * Knowledge Level Classifier
 *
 * Classifies a learning item into one of three human-friendly buckets based on
 * how well the learner knows it. This is a presentation-oriented summary of the
 * underlying `confidence` (0-1) signal and the recovery flag, intended for
 * dashboards ("Learning / Familiar / Known").
 *
 * Pure and framework-agnostic (no Angular/Dexie/DOM).
 *
 * @module core
 */

import { ReviewState } from './types';

/**
 * The three knowledge buckets shown to the learner.
 * - `learning`: seen but not yet reliable (low confidence, or in recovery).
 * - `familiar`: getting there — correct some of the time (mid confidence).
 * - `known`: consistently recalled (high confidence).
 */
export type KnowledgeLevel = 'learning' | 'familiar' | 'known';

/**
 * Confidence cut-points for the buckets.
 *
 * Chosen to line up with the thresholds already used elsewhere in the app:
 * - `familiarThreshold` (0.5): below this, the item is still "learning".
 * - `knownThreshold` (0.8): at/above this, the item is "known" — the same
 *   value as the analytics `reliableRecallThreshold`.
 *
 * Anything in between is "familiar".
 */
export interface KnowledgeThresholds {
  familiarThreshold: number;
  knownThreshold: number;
}

export const DEFAULT_KNOWLEDGE_THRESHOLDS: KnowledgeThresholds = {
  familiarThreshold: 0.5,
  knownThreshold: 0.8,
};

/**
 * A count of items in each knowledge bucket, plus the number of items that
 * have never been attempted (`new`). `total` counts items with any review state.
 */
export interface KnowledgeBreakdown {
  learning: number;
  familiar: number;
  known: number;
  /** Items that exist but have never been attempted. */
  neverStudied: number;
  /** Items with at least one attempt (learning + familiar + known). */
  total: number;
}

/**
 * Classify a single review state into a knowledge bucket.
 *
 * Rules (in priority order):
 * 1. An item flagged as repeatedly-forgotten is always `learning`, regardless
 *    of confidence — it needs rehabilitation.
 * 2. Otherwise bucket by confidence against the thresholds.
 */
export function classifyKnowledgeLevel(
  state: Pick<ReviewState, 'confidence' | 'repeatedlyForgotten'>,
  thresholds: KnowledgeThresholds = DEFAULT_KNOWLEDGE_THRESHOLDS
): KnowledgeLevel {
  if (state.repeatedlyForgotten) {
    return 'learning';
  }
  if (state.confidence >= thresholds.knownThreshold) {
    return 'known';
  }
  if (state.confidence >= thresholds.familiarThreshold) {
    return 'familiar';
  }
  return 'learning';
}

/**
 * Summarize a collection of review states into a three-bucket breakdown.
 *
 * Only items with at least one recorded attempt are bucketed. Items that have a
 * review state but no attempts (attemptCount === 0) are counted as
 * `neverStudied` and excluded from the three buckets.
 *
 * @param states - review states to summarize
 * @param thresholds - optional custom cut-points
 */
export function summarizeKnowledge(
  states: readonly Pick<ReviewState, 'confidence' | 'repeatedlyForgotten' | 'attemptCount'>[],
  thresholds: KnowledgeThresholds = DEFAULT_KNOWLEDGE_THRESHOLDS
): KnowledgeBreakdown {
  const breakdown: KnowledgeBreakdown = {
    learning: 0,
    familiar: 0,
    known: 0,
    neverStudied: 0,
    total: 0,
  };

  for (const state of states) {
    if (state.attemptCount === 0) {
      breakdown.neverStudied++;
      continue;
    }
    const level = classifyKnowledgeLevel(state, thresholds);
    breakdown[level]++;
    breakdown.total++;
  }

  return breakdown;
}
