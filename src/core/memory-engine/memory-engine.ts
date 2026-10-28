/**
 * Memory Engine
 * 
 * The core engine that owns per-item review state, writes attempt history,
 * invokes the Recall-Quality Classifier and Scheduler_Interface, and drives
 * the Recovery_Workflow.
 * 
 * This engine is language-agnostic: it operates purely on LearningItem IDs
 * and never branches on Target_Language (R1.6).
 * 
 * Implements R1, R3, R4, R5, R6
 * 
 * @module core/memory-engine
 */

import type {
  AttemptOutcome,
  Attempt,
  ReviewState,
  PerSkillReviewState,
  RecoveryState,
  ReviewStateUpdate,
  ReviewReason,
  MemoryEngineInterface,
  SchedulerInterface,
  SkillDimension,
  ExerciseType,
  RecoveryConfig,
} from '../types';
import { DEFAULT_RECOVERY_CONFIG } from '../types';
import { classifyRecallQuality, isFailureForRecovery, isCorrectUnaided } from '../recall-quality-classifier';

/**
 * Repository interface for persisting review state and attempts.
 * The Memory Engine depends on this abstraction, not on Dexie directly.
 */
export interface ReviewStateRepository {
  getReviewState(itemId: string): Promise<ReviewState | null>;
  saveReviewState(state: ReviewState): Promise<void>;
  getAttempts(itemId: string, since?: string): Promise<Attempt[]>;
  saveAttempt(attempt: Attempt): Promise<void>;
}

/**
 * Generate a UUID v4.
 * Injected for testability.
 */
export type UuidGenerator = () => string;

/**
 * Simple UUID generator using crypto.randomUUID when available.
 */
export function defaultUuidGenerator(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create an empty per-skill review state.
 */
function createEmptyPerSkillState(): PerSkillReviewState {
  return {
    schedulerState: null,
    attemptCount: 0,
    mistakeCount: 0,
    lastAttemptTime: null,
  };
}

/**
 * Create initial review state for a new item.
 */
function createInitialReviewState(itemId: string, now: string): ReviewState {
  return {
    id: defaultUuidGenerator(),
    learningItemId: itemId,
    schedulerState: null,
    perSkillState: {
      'spelling': createEmptyPerSkillState(),
      'meaning': createEmptyPerSkillState(),
      'listening-recognition': createEmptyPerSkillState(),
      'productive-recall': createEmptyPerSkillState(),
    },
    attemptCount: 0,
    mistakeCount: 0,
    confidence: 0,
    repeatedlyForgotten: false,
    recoveryState: null,
    lastExerciseType: null,
    lastExampleId: null,
    updatedAt: now,
  };
}

/**
 * Calculate confidence from recent attempt history.
 * Confidence is a value between 0 and 1 based on recent success rate.
 */
function calculateConfidence(attempts: Attempt[], windowSize: number = 10): number {
  if (attempts.length === 0) return 0;
  
  const recent = attempts.slice(-windowSize);
  const correctCount = recent.filter(a => a.outcome.correct).length;
  return correctCount / recent.length;
}

/**
 * Check if an item should enter recovery based on recent failures.
 * R4.1: >= failureThreshold incorrect or correct-with-hint attempts within rollingWindowDays.
 */
function shouldEnterRecovery(
  attempts: Attempt[],
  config: RecoveryConfig,
  now: string
): boolean {
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - config.rollingWindowDays);
  const windowStartIso = windowStart.toISOString();

  const recentFailures = attempts.filter(a => 
    a.time >= windowStartIso && isFailureForRecovery(a.outcome)
  );

  return recentFailures.length >= config.failureThreshold;
}

/**
 * Check if recovery should be cleared based on consecutive correct-unaided attempts.
 * R4.3: 2 consecutive correct-unaided attempts on reviews >= clearMinSeparationDays apart.
 */
function shouldClearRecovery(
  recoveryState: RecoveryState,
  config: RecoveryConfig
): boolean {
  if (recoveryState.consecutiveUnaidedCorrect < config.clearConsecutiveUnaided) {
    return false;
  }

  const timestamps = recoveryState.consecutiveUnaidedTimestamps;
  if (timestamps.length < config.clearConsecutiveUnaided) {
    return false;
  }

  // Check that the attempts are at least clearMinSeparationDays apart
  for (let i = 1; i < timestamps.length; i++) {
    const prev = new Date(timestamps[i - 1]);
    const curr = new Date(timestamps[i]);
    const daysDiff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < config.clearMinSeparationDays) {
      return false;
    }
  }

  return true;
}

/**
 * Memory Engine implementation.
 */
export class MemoryEngine implements MemoryEngineInterface {
  constructor(
    private readonly repository: ReviewStateRepository,
    private readonly scheduler: SchedulerInterface,
    private readonly config: RecoveryConfig = DEFAULT_RECOVERY_CONFIG,
    private readonly generateUuid: UuidGenerator = defaultUuidGenerator
  ) {}

  /**
   * Record an attempt and update review state (R1.1-R1.5, R7.3).
   */
  async recordAttempt(
    itemId: string,
    outcome: AttemptOutcome,
    now: string,
    exerciseType?: ExerciseType,
    exerciseId?: string,
    sessionId?: string,
    exampleId?: string
  ): Promise<ReviewStateUpdate> {
    // Get or create review state
    let reviewState = await this.repository.getReviewState(itemId);
    if (!reviewState) {
      reviewState = createInitialReviewState(itemId, now);
    }

    // Classify the recall quality
    const { rating } = classifyRecallQuality(outcome);

    // Create and save the attempt record (R1.1)
    const attempt: Attempt = {
      id: this.generateUuid(),
      learningItemId: itemId,
      exerciseId: exerciseId || '',
      sessionId: sessionId || '',
      time: now,
      outcome,
      exerciseType: exerciseType || 'flashcard',
      updatedAt: now,
    };
    await this.repository.saveAttempt(attempt);

    // Update overall counts (R1.4)
    reviewState.attemptCount++;
    if (!outcome.correct) {
      reviewState.mistakeCount++;
    }

    // Update per-skill state (R1.5). Lazily initialize the entry the first
    // time this item is exercised on the given skill dimension.
    let skillState = reviewState.perSkillState[outcome.skillDimension];
    if (!skillState) {
      skillState = createEmptyPerSkillState();
      reviewState.perSkillState[outcome.skillDimension] = skillState;
    }
    skillState.attemptCount++;
    if (!outcome.correct) {
      skillState.mistakeCount++;
    }
    skillState.lastAttemptTime = now;

    // Determine minimum interval (10 min for recovery items, R5.4)
    const minInterval = reviewState.repeatedlyForgotten 
      ? this.config.minDelayMinutes 
      : undefined;

    // Schedule the next review (R2.4)
    const scheduleResult = this.scheduler.schedule({
      state: skillState.schedulerState,
      rating,
      now,
      minIntervalMinutes: minInterval,
    });
    skillState.schedulerState = scheduleResult.state;

    // Also update overall scheduler state
    const overallResult = this.scheduler.schedule({
      state: reviewState.schedulerState,
      rating,
      now,
      minIntervalMinutes: minInterval,
    });
    reviewState.schedulerState = overallResult.state;

    // Get all attempts for confidence and recovery calculations
    const allAttempts = await this.repository.getAttempts(itemId);
    // Note: attempt is already saved to repository, so it's included in allAttempts

    // Update confidence (R1.4)
    reviewState.confidence = calculateConfidence(allAttempts);

    // Handle recovery workflow (R4, R5)
    const recoveryChanged = await this.updateRecoveryState(
      reviewState,
      outcome,
      allAttempts,
      now,
      exerciseType,
      exampleId
    );

    // Update tracking for exercise/context variation
    if (exerciseType) {
      reviewState.lastExerciseType = exerciseType;
    }
    if (exampleId) {
      reviewState.lastExampleId = exampleId;
    }

    reviewState.updatedAt = now;
    await this.repository.saveReviewState(reviewState);

    return {
      reviewState,
      recoveryChanged,
      nextDue: overallResult.due,
    };
  }

  /**
   * Update recovery state based on the new attempt.
   * Returns true if recovery state changed (entered or exited).
   */
  private async updateRecoveryState(
    reviewState: ReviewState,
    outcome: AttemptOutcome,
    attempts: Attempt[],
    now: string,
    exerciseType?: ExerciseType,
    exampleId?: string
  ): Promise<boolean> {
    const wasRecovering = reviewState.repeatedlyForgotten;

    if (!reviewState.repeatedlyForgotten) {
      // Check if we should enter recovery (R4.1, R4.2)
      if (shouldEnterRecovery(attempts, this.config, now)) {
        reviewState.repeatedlyForgotten = true;
        reviewState.recoveryState = {
          enteredAt: now,
          winningExerciseTypes: [],
          consecutiveUnaidedCorrect: 0,
          consecutiveUnaidedTimestamps: [],
          usedExerciseTypes: exerciseType ? [exerciseType] : [],
          usedExampleIds: exampleId ? [exampleId] : [],
        };
        return true;
      }
    } else {
      // Currently in recovery - update state
      const recovery = reviewState.recoveryState!;

      // Track exercise types and examples used (R5.1, R5.2, R5.3)
      if (exerciseType && !recovery.usedExerciseTypes.includes(exerciseType)) {
        recovery.usedExerciseTypes.push(exerciseType);
      }
      if (exampleId && !recovery.usedExampleIds.includes(exampleId)) {
        recovery.usedExampleIds.push(exampleId);
      }

      // Track winning exercise types (R5.5)
      if (isCorrectUnaided(outcome)) {
        if (exerciseType && !recovery.winningExerciseTypes.includes(exerciseType)) {
          recovery.winningExerciseTypes.push(exerciseType);
        }

        // Update consecutive correct-unaided tracking (R4.3)
        recovery.consecutiveUnaidedCorrect++;
        recovery.consecutiveUnaidedTimestamps.push(now);

        // Check if we should clear recovery
        if (shouldClearRecovery(recovery, this.config)) {
          reviewState.repeatedlyForgotten = false;
          reviewState.recoveryState = null;
          return true;
        }
      } else if (isFailureForRecovery(outcome)) {
        // Reset consecutive count on failure (R4.3 - must be consecutive)
        recovery.consecutiveUnaidedCorrect = 0;
        recovery.consecutiveUnaidedTimestamps = [];
      }
    }

    return wasRecovering !== reviewState.repeatedlyForgotten;
  }

  /**
   * Check if an item is in the repeatedly-forgotten state (R4.1).
   * Re-evaluates based on recent failures within the rolling window.
   */
  async isRepeatedlyForgotten(itemId: string, now: string): Promise<boolean> {
    const reviewState = await this.repository.getReviewState(itemId);
    if (!reviewState) {
      return false;
    }
    
    // If not marked as recovering, return false
    if (!reviewState.repeatedlyForgotten) {
      return false;
    }
    
    // Re-evaluate: check if there are still enough recent failures to warrant recovery
    const attempts = await this.repository.getAttempts(itemId);
    return shouldEnterRecovery(attempts, this.config, now);
  }

  /**
   * Get the recovery state for an item, or null if not recovering (R5).
   */
  async recoveryStateFor(itemId: string): Promise<RecoveryState | null> {
    const reviewState = await this.repository.getReviewState(itemId);
    return reviewState?.recoveryState ?? null;
  }

  /**
   * Get the reason why an item is being reviewed (R6.1).
   */
  async reviewReasonFor(itemId: string, now: string): Promise<ReviewReason> {
    const reviewState = await this.repository.getReviewState(itemId);

    if (!reviewState || reviewState.attemptCount === 0) {
      return 'new';
    }

    if (reviewState.repeatedlyForgotten) {
      return 'recovery';
    }

    return 'due';
  }

  /**
   * Get the next exercise type to use for a recovering item (R5.1, R5.2).
   * Returns null if no variation is needed or only one type applies.
   */
  getNextExerciseTypeForRecovery(
    reviewState: ReviewState,
    applicableTypes: ExerciseType[]
  ): ExerciseType | null {
    if (!reviewState.repeatedlyForgotten || !reviewState.recoveryState) {
      return null;
    }

    if (applicableTypes.length <= 1) {
      // No variation possible (R5.1 - vacuously satisfied)
      return applicableTypes[0] || null;
    }

    // Avoid the last used type (R5.1)
    const lastUsed = reviewState.lastExerciseType;
    const alternatives = applicableTypes.filter(t => t !== lastUsed);

    if (alternatives.length === 0) {
      return applicableTypes[0];
    }

    // Prefer types not yet used in this recovery cycle
    const recovery = reviewState.recoveryState;
    const unused = alternatives.filter(t => !recovery.usedExerciseTypes.includes(t));

    if (unused.length > 0) {
      return unused[0];
    }

    // Prefer winning types (types that have produced correct-unaided)
    const winning = alternatives.filter(t => recovery.winningExerciseTypes.includes(t));
    if (winning.length > 0) {
      return winning[0];
    }

    return alternatives[0];
  }

  /**
   * Check if the minimum delay has elapsed for a recovering item (R5.4, R5.6).
   */
  canReviewRecoveringItem(reviewState: ReviewState, now: string): boolean {
    if (!reviewState.repeatedlyForgotten || !reviewState.recoveryState) {
      return true;
    }

    const skillStates = Object.values(reviewState.perSkillState);
    const lastAttempt = skillStates
      .map(s => s.lastAttemptTime)
      .filter((t): t is string => t !== null)
      .sort()
      .pop();

    if (!lastAttempt) {
      return true;
    }

    const lastTime = new Date(lastAttempt).getTime();
    const nowTime = new Date(now).getTime();
    const minDelayMs = this.config.minDelayMinutes * 60 * 1000;

    return (nowTime - lastTime) >= minDelayMs;
  }
}
