/**
 * Memory Engine Angular Service
 *
 * Tracks learning state for the Angular app. State is held in in-memory maps
 * for fast synchronous reads and mirrored to IndexedDB (via the persistence
 * repositories) so progress survives app restarts. On startup the maps are
 * hydrated from storage; after each attempt the affected item is written back.
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
import {
  KnowledgeBreakdown,
  summarizeKnowledge,
} from '../../core/knowledge-level';
import { classifyRecallQuality } from '../../core/recall-quality-classifier';
import { createFsrsAdapter } from '../../core/scheduler';
import {
  createRepositories,
  type Repositories,
} from '../../persistence/repositories';
import {
  ReviewStateEntity,
  AttemptEntity,
} from '../../persistence/entities';

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

/** Map a core ReviewState to its persisted entity shape. */
function toReviewStateEntity(state: ReviewState): ReviewStateEntity {
  return {
    id: state.id,
    learningItemId: state.learningItemId,
    schedulerState: state.schedulerState,
    perSkillState: state.perSkillState,
    attemptCount: state.attemptCount,
    mistakeCount: state.mistakeCount,
    confidence: state.confidence,
    repeatedlyForgotten: state.repeatedlyForgotten,
    recoveryState: state.recoveryState,
    lastExerciseType: state.lastExerciseType,
    lastExampleId: state.lastExampleId,
    updatedAt: state.updatedAt,
  };
}

/** Map a persisted review-state entity back to the core ReviewState shape. */
function fromReviewStateEntity(entity: ReviewStateEntity): ReviewState {
  return {
    id: entity.id,
    learningItemId: entity.learningItemId,
    schedulerState: entity.schedulerState,
    perSkillState: entity.perSkillState,
    attemptCount: entity.attemptCount,
    mistakeCount: entity.mistakeCount,
    confidence: entity.confidence,
    repeatedlyForgotten: entity.repeatedlyForgotten,
    recoveryState: entity.recoveryState,
    lastExerciseType: entity.lastExerciseType,
    lastExampleId: entity.lastExampleId,
    updatedAt: entity.updatedAt,
  };
}

/** Map a core Attempt (nested outcome) to the flattened persisted entity. */
function toAttemptEntity(attempt: Attempt): AttemptEntity {
  return {
    id: attempt.id,
    learningItemId: attempt.learningItemId,
    exerciseId: attempt.exerciseId,
    sessionId: attempt.sessionId,
    timestamp: attempt.time,
    correct: attempt.outcome.correct,
    mode: attempt.outcome.mode,
    usedHint: attempt.outcome.usedHint,
    skillDimension: attempt.outcome.skillDimension,
    exerciseType: attempt.exerciseType,
    updatedAt: attempt.updatedAt,
  };
}

/** Map a flattened attempt entity back to the core Attempt shape. */
function fromAttemptEntity(entity: AttemptEntity): Attempt {
  return {
    id: entity.id,
    learningItemId: entity.learningItemId,
    exerciseId: entity.exerciseId,
    sessionId: entity.sessionId,
    time: entity.timestamp,
    outcome: {
      correct: entity.correct,
      mode: entity.mode,
      usedHint: entity.usedHint,
      skillDimension: entity.skillDimension,
    },
    exerciseType: entity.exerciseType,
    updatedAt: entity.updatedAt,
  };
}

@Injectable({
  providedIn: 'root',
})
export class MemoryEngineService {
  private reviewStates = new Map<string, ReviewState>();
  private attempts = new Map<string, Attempt[]>();
  private scheduler = createFsrsAdapter();

  /**
   * Dexie-backed repositories. Progress is kept in the in-memory maps for
   * synchronous reads, and mirrored to IndexedDB so it survives app restarts.
   * Null when IndexedDB is unavailable (e.g. during SSR or unit tests), in
   * which case the service degrades gracefully to in-memory only.
   */
  private readonly repos: Repositories | null;

  /** Resolves once saved state has been loaded from IndexedDB into the maps. */
  readonly ready: Promise<void>;

  constructor() {
    this.repos =
      typeof indexedDB !== 'undefined' ? createRepositories() : null;
    this.ready = this.loadFromStorage();
  }

  /**
   * Hydrate the in-memory maps from IndexedDB. Runs once at startup. Failures
   * are swallowed so a storage problem never blocks the UI — the app simply
   * starts with empty state.
   */
  private async loadFromStorage(): Promise<void> {
    if (!this.repos) return;
    try {
      const [states, attempts] = await Promise.all([
        this.repos.reviewStates.getAll(),
        this.repos.attempts.getAll(),
      ]);

      for (const entity of states) {
        const state = fromReviewStateEntity(entity);
        this.reviewStates.set(state.learningItemId, state);
      }

      for (const entity of attempts) {
        const attempt = fromAttemptEntity(entity);
        const list = this.attempts.get(attempt.learningItemId) ?? [];
        list.push(attempt);
        this.attempts.set(attempt.learningItemId, list);
      }

      // Keep each item's attempts in chronological order.
      for (const list of this.attempts.values()) {
        list.sort((a, b) => a.time.localeCompare(b.time));
      }
    } catch (err) {
      console.warn('MemoryEngine: failed to load saved progress', err);
    }
  }

  /**
   * Persist a single item's review state and its latest attempt to IndexedDB.
   * Fire-and-forget: callers stay synchronous and a write failure is logged
   * but never surfaced to the UI.
   */
  private persist(state: ReviewState, attempt: Attempt): void {
    if (!this.repos) return;
    void Promise.all([
      this.repos.reviewStates.save(toReviewStateEntity(state)),
      this.repos.attempts.save(toAttemptEntity(attempt)),
    ]).catch(err => {
      console.warn('MemoryEngine: failed to persist progress', err);
    });
  }

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

    // Mirror to IndexedDB so progress survives app restarts.
    this.persist(state, attempt);
  }

  /**
   * Summarize all tracked items into the three knowledge buckets
   * (Learning / Familiar / Known) shown on the home screen.
   */
  getKnowledgeBreakdown(): KnowledgeBreakdown {
    return summarizeKnowledge([...this.reviewStates.values()]);
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
