/**
 * FSRS Adapter
 * 
 * Implements SchedulerInterface by delegating to ts-fsrs.
 * This is the ONLY module that imports ts-fsrs (R2.1).
 * If ts-fsrs needs to be dropped, only this adapter changes.
 * 
 * Implements R2.2, R2.3, R2.4
 * 
 * @module core/scheduler/fsrs-adapter
 */

import { createEmptyCard, fsrs, type Card, type Grade, type FSRS } from 'ts-fsrs';
import type {
  SchedulerInterface,
  SchedulerState,
  SchedulerRating,
  ScheduleInput,
  ScheduleResult,
} from '../types';

/**
 * Map our SchedulerRating to FSRS Grade.
 */
function ratingToGrade(rating: SchedulerRating): Grade {
  switch (rating) {
    case 'again':
      return 1; // FSRS Grade.Again
    case 'hard':
      return 2; // FSRS Grade.Hard
    case 'good':
      return 3; // FSRS Grade.Good
    case 'easy':
      return 4; // FSRS Grade.Easy
  }
}

/**
 * Convert FSRS Card state to our SchedulerState.
 */
function cardToSchedulerState(card: Card): SchedulerState {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: card.due.toISOString(),
    lastReview: card.last_review ? card.last_review.toISOString() : null,
    reps: card.reps,
    lapses: card.lapses,
  };
}

/**
 * Convert our SchedulerState to FSRS Card.
 */
function schedulerStateToCard(state: SchedulerState): Card {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: 0, // Will be recalculated by FSRS
    scheduled_days: 0, // Will be recalculated by FSRS
    reps: state.reps,
    lapses: state.lapses,
    state: state.reps === 0 ? 0 : (state.lapses > 0 ? 3 : 2), // New, Review, or Relearning
    last_review: state.lastReview ? new Date(state.lastReview) : undefined,
    learning_steps: 0, // Current step in learning (0 for review cards)
  };
}

/**
 * FSRS Adapter implementing the SchedulerInterface.
 * 
 * @example
 * ```typescript
 * const scheduler = new FsrsAdapter();
 * const result = scheduler.schedule({
 *   state: null, // new item
 *   rating: 'good',
 *   now: new Date().toISOString(),
 * });
 * ```
 */
export class FsrsAdapter implements SchedulerInterface {
  private readonly fsrs: FSRS;

  constructor() {
    // Use default FSRS parameters (R2.3)
    this.fsrs = fsrs();
  }

  /**
   * Create initial state for a new item with no history.
   * Uses default FSRS parameters (R2.3).
   */
  initialState(now: string): SchedulerState {
    const card = createEmptyCard(new Date(now));
    return cardToSchedulerState(card);
  }

  /**
   * Compute the next review schedule based on the rating.
   * 
   * @param input - The scheduling input
   * @returns The updated state and next due time
   */
  schedule(input: ScheduleInput): ScheduleResult {
    const { state, rating, now, minIntervalMinutes } = input;
    
    // Validate the date early
    const nowDate = new Date(now);
    if (isNaN(nowDate.getTime())) {
      console.warn('Invalid date provided to scheduler, using fallback');
      return this.createFallbackResult(new Date());
    }
    
    const grade = ratingToGrade(rating);

    // Get or create the card
    let card: Card;
    if (state === null) {
      // New item - use default initial state (R2.3)
      card = createEmptyCard(nowDate);
    } else {
      card = schedulerStateToCard(state);
    }

    try {
      // Get the scheduling result for this grade
      const schedulingCards = this.fsrs.repeat(card, nowDate);
      const result = schedulingCards[grade];

      if (!result || !result.card) {
        // Fallback on error - return initial state with immediate review
        console.warn('FSRS scheduling returned invalid result, using fallback');
        return this.createFallbackResult(nowDate);
      }

      let newState = cardToSchedulerState(result.card);

      // Enforce minimum interval if specified (R5.4 - Recovery 10-min floor)
      if (minIntervalMinutes !== undefined && minIntervalMinutes > 0) {
        const minDue = new Date(nowDate.getTime() + minIntervalMinutes * 60 * 1000);
        const scheduledDue = new Date(newState.due);
        
        if (scheduledDue < minDue) {
          newState = {
            ...newState,
            due: minDue.toISOString(),
          };
        }
      }

      return {
        state: newState,
        due: newState.due,
      };
    } catch (error) {
      // Log diagnostic and fallback (per design Error Handling)
      console.error('FSRS scheduling error:', error);
      return this.createFallbackResult(nowDate);
    }
  }

  /**
   * Create a fallback result when FSRS fails.
   * Returns initial state with a 1-day review interval.
   */
  private createFallbackResult(now: Date): ScheduleResult {
    const fallbackDue = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day later
    const state: SchedulerState = {
      stability: 1,
      difficulty: 5,
      due: fallbackDue.toISOString(),
      lastReview: now.toISOString(),
      reps: 0,
      lapses: 0,
    };
    return {
      state,
      due: state.due,
    };
  }
}

/**
 * Create a new FSRS adapter instance.
 * Factory function for dependency injection.
 */
export function createFsrsAdapter(): SchedulerInterface {
  return new FsrsAdapter();
}
