/**
 * Mixed Review Session Module
 * 
 * Composes other exercise modules to combine previously studied
 * with newly introduced items in one session.
 * 
 * Requirements: 7.1, 7.5
 * Design: Exercise module contract
 * 
 * @module exercises/modules
 */

import { ExerciseRegistry, ExerciseInstance, ExerciseContract } from '../exercise-contract';
import { ExerciseType, SkillDimension } from '../../core/types';

/**
 * Item for mixed review - includes the exercise instance and metadata
 */
export interface MixedReviewItem {
  /** The exercise instance */
  instance: ExerciseInstance;
  /** Whether this is a new item (never seen) or review (previously studied) */
  isNew: boolean;
  /** Priority score for ordering (higher = more urgent) */
  priority: number;
}

/**
 * Configuration for mixed review session
 */
export interface MixedReviewConfig {
  /** Maximum number of items per session */
  maxItems?: number;
  /** Ratio of new items to review items (e.g., 0.3 = 30% new) */
  newItemRatio?: number;
  /** Minimum number of new items to include (if available) */
  minNewItems?: number;
  /** Maximum number of new items to include */
  maxNewItems?: number;
}

const DEFAULT_CONFIG: Required<MixedReviewConfig> = {
  maxItems: 20,
  newItemRatio: 0.25, // 25% new items by default
  minNewItems: 2,
  maxNewItems: 5,
};

/**
 * Result of building a mixed review session
 */
export interface MixedReviewSession {
  /** Items in presentation order */
  items: MixedReviewItem[];
  /** Count of new items */
  newCount: number;
  /** Count of review items */
  reviewCount: number;
  /** Total items */
  totalCount: number;
}

/**
 * Build a mixed review session combining new and review items.
 * 
 * Property 22: A mixed review session includes both studied and new items
 * 
 * @param newItems - Items the user hasn't seen yet
 * @param reviewItems - Items due for review
 * @param config - Session configuration
 * @returns The mixed review session
 */
export function buildMixedReviewSession(
  newItems: MixedReviewItem[],
  reviewItems: MixedReviewItem[],
  config: MixedReviewConfig = {}
): MixedReviewSession {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Sort by priority (higher priority first)
  const sortedNew = [...newItems].sort((a, b) => b.priority - a.priority);
  const sortedReview = [...reviewItems].sort((a, b) => b.priority - a.priority);
  
  // Calculate how many of each to include
  let newCount = Math.min(
    sortedNew.length,
    Math.max(cfg.minNewItems, Math.floor(cfg.maxItems * cfg.newItemRatio)),
    cfg.maxNewItems
  );
  
  // Fill remaining slots with review items
  const reviewCount = Math.min(
    sortedReview.length,
    cfg.maxItems - newCount
  );
  
  // If we have room and more new items available, add them
  const remainingSlots = cfg.maxItems - newCount - reviewCount;
  if (remainingSlots > 0 && sortedNew.length > newCount && newCount < cfg.maxNewItems) {
    const additionalNew = Math.min(
      remainingSlots,
      sortedNew.length - newCount,
      cfg.maxNewItems - newCount
    );
    newCount += additionalNew;
  }
  
  // Select items
  const selectedNew = sortedNew.slice(0, newCount);
  const selectedReview = sortedReview.slice(0, reviewCount);
  
  // Interleave: start with some reviews to warm up, then mix in new items
  const items = interleaveItems(selectedNew, selectedReview);
  
  return {
    items,
    newCount: selectedNew.length,
    reviewCount: selectedReview.length,
    totalCount: items.length,
  };
}

/**
 * Interleave new and review items for optimal learning.
 * Pattern: Review, Review, New, Review, Review, New, etc.
 */
function interleaveItems(
  newItems: MixedReviewItem[],
  reviewItems: MixedReviewItem[]
): MixedReviewItem[] {
  const result: MixedReviewItem[] = [];
  let newIndex = 0;
  let reviewIndex = 0;
  let itemsSinceNew = 0;
  
  // Target: insert a new item every 2-3 review items
  const insertAfter = 2;
  
  while (newIndex < newItems.length || reviewIndex < reviewItems.length) {
    // Check if we should insert a new item
    const shouldInsertNew = 
      newIndex < newItems.length && 
      (itemsSinceNew >= insertAfter || reviewIndex >= reviewItems.length);
    
    if (shouldInsertNew) {
      result.push(newItems[newIndex]);
      newIndex++;
      itemsSinceNew = 0;
    } else if (reviewIndex < reviewItems.length) {
      result.push(reviewItems[reviewIndex]);
      reviewIndex++;
      itemsSinceNew++;
    }
  }
  
  return result;
}

/**
 * Check if a session satisfies Property 22:
 * A mixed review session includes both studied and new items
 */
export function validateMixedSession(
  session: MixedReviewSession,
  hasNewAvailable: boolean,
  hasReviewAvailable: boolean
): { valid: boolean; reason?: string } {
  // If both types are available, session should include both
  if (hasNewAvailable && hasReviewAvailable) {
    if (session.newCount === 0) {
      return { valid: false, reason: 'No new items included despite availability' };
    }
    if (session.reviewCount === 0) {
      return { valid: false, reason: 'No review items included despite availability' };
    }
  }
  
  // If only one type available, session should include at least some
  if (hasNewAvailable && session.newCount === 0) {
    return { valid: false, reason: 'No new items included' };
  }
  if (hasReviewAvailable && session.reviewCount === 0) {
    return { valid: false, reason: 'No review items included' };
  }
  
  return { valid: true };
}

/**
 * Select appropriate exercise types for an item based on skill dimension
 * and available exercise modules.
 */
export function selectExerciseTypesForItem(
  skillDimension: SkillDimension,
  registry: ExerciseRegistry,
  preferredTypes?: ExerciseType[]
): ExerciseType[] {
  const availableTypes = registry.getTypesForSkillDimension(skillDimension);
  
  if (preferredTypes && preferredTypes.length > 0) {
    // Filter to only available types
    const filtered = preferredTypes.filter(t => availableTypes.includes(t));
    return filtered.length > 0 ? filtered : availableTypes;
  }
  
  return availableTypes;
}
