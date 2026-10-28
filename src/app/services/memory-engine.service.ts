/**
 * Memory Engine Angular Service
 * 
 * Provides in-memory tracking of learning state for the Angular app.
 * Uses simple maps instead of IndexedDB for MVP simplicity.
 * 
 * @module app/services
 */

import { Injectable } from '@angular/core';
import {
  AttemptOutcome,
  AttemptOutcomeResult,
  SkillDimension,
  ExerciseType,
  ReviewReason,
  ReviewState,
  Attempt,
  PerSkillReviewState,
  parseOutcomeResult,
} from '../../core/types';
import { classifyRecallQuality } from '../../core/recall-quality-classifier';
import { createFsrsAdapter } from '../../core/scheduler';

/**
 * Create empty per-skill state
 */
function createEmptyPerSkillState(): PerSkillReviewState {
  return {
    schedulerState: null,
    attemptCount: 0,
    mistakeCount: 0,
    lastAttemptTime: null,
  };
}

@Injectable({
  providedIn: 'root',
})
export class MemoryEngineService {
  private reviewStates = new Map<string, ReviewState>();
  private attempts = new Map<string, Attempt[]>();
  private scheduler = createFsrsAdapter();

  constructor() {}

  /**
   * Record an attempt on a learning item
   */
  recordAttempt(
    itemId: string,
    outcomeResult: AttemptOutcomeResult,
    exerciseType: ExerciseType,
    skillDimension: SkillDimension,
    hintUsed: boolean,
    now: Date = new Date()
  ): void {
    const nowIso = now.toISOString();
    
    // Convert outcome result to full AttemptOutcome
    const outcome = parseOutcomeResult(outcomeResult, skillDimension);
    
    // Get or create review state
    let state = this.reviewStates.get(itemId);
    if (!state) {
      state = this.createInitialReviewState(itemId, nowIso);
    }

    // Classify recall quality
    const { rating } = classifyRecallQuality(outcome);

    // Create attempt record
    const attempt: Attempt = {
      id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      learningItemId: itemId,
      exerciseId: '',
      sessionId: '',
      time: nowIso,
      outcome,
      exerciseType,
      updatedAt: nowIso,
    };

    // Save attempt
    const itemAttempts = this.attempts.get(itemId) || [];
    itemAttempts.push(attempt);
    this.attempts.set(itemId, itemAttempts);

    // Update state counts
    state.attemptCount++;
    if (!outcome.correct) {
      state.mistakeCount++;
    }

    // Update per-skill state (lazily initialize if this skill is untracked)
    let skillState = state.perSkillState[skillDimension];
    if (!skillState) {
      skillState = createEmptyPerSkillState();
      state.perSkillState[skillDimension] = skillState;
    }
    skillState.attemptCount++;
    if (!outcome.correct) {
      skillState.mistakeCount++;
    }
    skillState.lastAttemptTime = nowIso;

    // Update scheduler state
    const scheduleResult = this.scheduler.schedule({
      state: state.schedulerState,
      rating,
      now: nowIso,
    });
    state.schedulerState = scheduleResult.state;

    // Update confidence
    state.confidence = this.calculateConfidence(itemAttempts);

    // Update tracking
    state.lastExerciseType = exerciseType;
    state.updatedAt = nowIso;

    this.reviewStates.set(itemId, state);
  }

  /**
   * Get the review reason for an item
   */
  getReviewReason(itemId: string): ReviewReason {
    const state = this.reviewStates.get(itemId);
    if (!state || state.attemptCount === 0) {
      return 'new';
    }
    if (state.repeatedlyForgotten) {
      return 'recovery';
    }
    return 'due';
  }

  /**
   * Get the review state for an item
   */
  getReviewState(itemId: string): ReviewState | null {
    return this.reviewStates.get(itemId) ?? null;
  }

  /**
   * Check if an item is in recovery
   */
  isRecovering(itemId: string): boolean {
    const state = this.reviewStates.get(itemId);
    return state?.repeatedlyForgotten ?? false;
  }

  /**
   * Get all recovering items
   */
  getRecoveringItems(): string[] {
    const recovering: string[] = [];
    for (const [itemId, state] of this.reviewStates) {
      if (state.repeatedlyForgotten) {
        recovering.push(itemId);
      }
    }
    return recovering;
  }

  /**
   * Get items due for review
   */
  getDueItems(now: Date = new Date()): string[] {
    const nowTime = now.getTime();
    const dueItems: string[] = [];

    for (const [itemId, state] of this.reviewStates) {
      if (state.schedulerState && state.schedulerState.due) {
        const dueTime = new Date(state.schedulerState.due).getTime();
        if (dueTime <= nowTime) {
          dueItems.push(itemId);
        }
      }
    }

    return dueItems;
  }

  /**
   * Get attempt history for an item
   */
  getAttemptHistory(itemId: string): Attempt[] {
    return this.attempts.get(itemId) || [];
  }

  private createInitialReviewState(itemId: string, now: string): ReviewState {
    return {
      id: `rs-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      learningItemId: itemId,
      schedulerState: null,
      perSkillState: {
        'spelling': createEmptyPerSkillState(),
        'meaning': createEmptyPerSkillState(),
        'listening-recognition': createEmptyPerSkillState(),
        'productive-recall': createEmptyPerSkillState(),
        'receptive_vocabulary': createEmptyPerSkillState(),
        'productive_vocabulary': createEmptyPerSkillState(),
        'grammar': createEmptyPerSkillState(),
        'listening_comprehension': createEmptyPerSkillState(),
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

  private calculateConfidence(attempts: Attempt[], windowSize: number = 10): number {
    if (attempts.length === 0) return 0;
    const recent = attempts.slice(-windowSize);
    const correctCount = recent.filter(a => a.outcome.correct).length;
    return correctCount / recent.length;
  }
}
