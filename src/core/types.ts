/**
 * Core domain types for the language-learning application.
 * 
 * These types are framework-independent and language-agnostic (R1.6, R2.6).
 * The core domain layer MUST NOT import Angular, Ionic, the DOM, Dexie, or ts-fsrs.
 * 
 * @module core/types
 */

// ============================================================================
// Skill and Exercise Types
// ============================================================================

/**
 * Measurable aspects of knowledge for a learning item.
 * Each dimension is tracked independently (R1.5).
 */
export type SkillDimension = 'spelling' | 'meaning' | 'listening-recognition' | 'productive-recall';

/**
 * Categories of exercises the learner can complete.
 * New types can be added without changing existing modules (R7.6).
 */
export type ExerciseType =
  | 'flashcard'
  | 'matching-word-translation'
  | 'matching-word-image'
  | 'target-to-native'
  | 'native-to-target'
  | 'multiple-choice'
  | 'fill-in-blank'
  | 'typed-vocabulary'
  | 'sentence-translation'
  | 'word-order'
  | 'listening-comprehension'
  | 'audio-dictation'
  | 'grammar-selection'
  | 'verb-conjugation'
  | 'articles-gender-plurals'
  | 'cloze'
  | 'reading'
  | 'mixed-review';

// ============================================================================
// Attempt Classification (R1.2, R1.3, R3)
// ============================================================================

/**
 * How the learner produced the answer.
 * Recognition (selecting from options) vs unaided recall (producing from memory).
 */
export type AttemptMode = 'recognition' | 'unaided';

/**
 * The outcome of a single exercise attempt.
 * Used by the Recall-Quality Classifier to determine scheduling impact.
 */
export interface AttemptOutcome {
  /** Whether the answer was correct */
  correct: boolean;
  /** How the answer was produced (R1.2) */
  mode: AttemptMode;
  /** Whether a hint was used before answering (R1.3) */
  usedHint: boolean;
  /** Which skill dimension this attempt tested */
  skillDimension: SkillDimension;
}

// ============================================================================
// Learning Item (language-agnostic)
// ============================================================================

/**
 * An atomic unit of knowledge to be learned and scheduled.
 * The Memory_Engine operates on these without knowledge of Target_Language (R1.6).
 */
export interface LearningItem {
  id: string;
  /** The language being learned (for content lookup, not engine logic) */
  languageId: string;
  /** Reference to the lesson that introduces this item */
  lessonId: string;
  /** The type of learning item */
  kind: 'vocabulary' | 'grammar' | 'phrase' | 'sentence-pattern';
  /** The prompt shown to the learner */
  prompt: string;
  /** Which skill dimensions this item can be tested on */
  skillDimensions: SkillDimension[];
  /** Content validation state */
  contentState: ContentState;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Content validation states (R12.3).
 * Only 'available' content is presented to learners.
 */
export type ContentState = 'draft' | 'validated' | 'available';

// ============================================================================
// Review State (R1.4, R4, R5)
// ============================================================================

/**
 * Per-item review state tracked by the Memory_Engine.
 */
export interface ReviewState {
  id: string;
  learningItemId: string;
  /** Opaque scheduler state */
  schedulerState: SchedulerState | null;
  /** Per-skill-dimension tracking (R1.5) */
  perSkillState: Record<SkillDimension, PerSkillReviewState>;
  /** Total attempts across all skills */
  attemptCount: number;
  /** Total mistakes across all skills */
  mistakeCount: number;
  /** Derived confidence indicator (0-1) */
  confidence: number;
  /** Whether this item is in the repeated-forgetting state (R4.1) */
  repeatedlyForgotten: boolean;
  /** Active recovery workflow state, if any (R5) */
  recoveryState: RecoveryState | null;
  /** Last exercise type used (for variation tracking) */
  lastExerciseType: ExerciseType | null;
  /** Last example ID used (for context variation) */
  lastExampleId: string | null;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Review state for a single skill dimension.
 */
export interface PerSkillReviewState {
  schedulerState: SchedulerState | null;
  attemptCount: number;
  mistakeCount: number;
  lastAttemptTime: string | null;
}

/**
 * State of the Recovery_Workflow for a repeatedly-forgotten item (R5).
 */
export interface RecoveryState {
  /** When the item entered recovery */
  enteredAt: string;
  /** Exercise types that have produced correct-unaided attempts */
  winningExerciseTypes: ExerciseType[];
  /** Consecutive correct-unaided count toward clearing */
  consecutiveUnaidedCorrect: number;
  /** Timestamps of those consecutive reviews (for separation check) */
  consecutiveUnaidedTimestamps: string[];
  /** Exercise types used since entering recovery */
  usedExerciseTypes: ExerciseType[];
  /** Example IDs used since entering recovery */
  usedExampleIds: string[];
}

// ============================================================================
// Attempt Record (R1.1)
// ============================================================================

/**
 * A persisted record of a single exercise attempt.
 */
export interface Attempt {
  id: string;
  learningItemId: string;
  exerciseId: string;
  sessionId: string;
  /** ISO timestamp */
  time: string;
  /** The attempt outcome */
  outcome: AttemptOutcome;
  /** The exercise type used */
  exerciseType: ExerciseType;
  /** ISO timestamp of creation */
  updatedAt: string;
}

// ============================================================================
// Scheduler Interface (R2)
// ============================================================================

/**
 * FSRS-compatible rating grades.
 * Maps from the engine's recall-quality classification.
 */
export type SchedulerRating = 'again' | 'hard' | 'good' | 'easy';

/**
 * Opaque state managed by the scheduler implementation.
 * The Memory_Engine does not interpret these fields (R2.5).
 */
export interface SchedulerState {
  /** FSRS stability parameter */
  stability: number;
  /** FSRS difficulty parameter */
  difficulty: number;
  /** Next review due time (ISO timestamp) */
  due: string;
  /** Last review time (ISO timestamp, null if never reviewed) */
  lastReview: string | null;
  /** Number of successful reviews */
  reps: number;
  /** Number of lapses (forgetting events) */
  lapses: number;
}

/**
 * Input to the scheduler for computing the next review.
 */
export interface ScheduleInput {
  /** Current state, or null for a new item (R2.3) */
  state: SchedulerState | null;
  /** The rating from the recall-quality classifier */
  rating: SchedulerRating;
  /** Current time (ISO timestamp), injected for testability */
  now: string;
  /** Minimum interval in minutes (used for Recovery 10-min floor, R5.4) */
  minIntervalMinutes?: number;
}

/**
 * Output from the scheduler after computing the next review.
 */
export interface ScheduleResult {
  /** Updated scheduler state */
  state: SchedulerState;
  /** Next review due time (ISO timestamp) */
  due: string;
}

/**
 * The abstraction boundary between the Memory_Engine and scheduling algorithm.
 * The engine imports only this interface, never ts-fsrs directly (R2.1, R2.5).
 */
export interface SchedulerInterface {
  /**
   * Compute the next review schedule based on the rating.
   * @param input - The scheduling input including current state and rating
   * @returns The updated state and next due time
   */
  schedule(input: ScheduleInput): ScheduleResult;

  /**
   * Create initial state for a new item with no history.
   * Uses default FSRS parameters (R2.3).
   * @param now - Current time (ISO timestamp)
   * @returns Initial scheduler state
   */
  initialState(now: string): SchedulerState;
}

// ============================================================================
// Memory Engine Interface (R1, R3, R4, R5, R6)
// ============================================================================

/**
 * The reason why an item is being reviewed (R6.1).
 */
export type ReviewReason = 'due' | 'new' | 'recovery';

/**
 * Result of recording an attempt, used to update UI state.
 */
export interface ReviewStateUpdate {
  /** Updated review state */
  reviewState: ReviewState;
  /** Whether the item just entered or exited recovery */
  recoveryChanged: boolean;
  /** Next due time for this item */
  nextDue: string;
}

/**
 * The core Memory_Engine interface.
 * Language-agnostic: operates on LearningItem IDs without branching on language (R1.6).
 */
export interface MemoryEngineInterface {
  /**
   * Record an attempt and update review state (R1.1-R1.5).
   */
  recordAttempt(itemId: string, outcome: AttemptOutcome, now: string): Promise<ReviewStateUpdate>;

  /**
   * Check if an item is in the repeatedly-forgotten state (R4.1).
   */
  isRepeatedlyForgotten(itemId: string, now: string): Promise<boolean>;

  /**
   * Get the recovery state for an item, or null if not recovering (R5).
   */
  recoveryStateFor(itemId: string): Promise<RecoveryState | null>;

  /**
   * Get the reason why an item is being reviewed (R6.1).
   */
  reviewReasonFor(itemId: string, now: string): Promise<ReviewReason>;
}

// ============================================================================
// Recovery Configuration (R4, R5 - tunable defaults)
// ============================================================================

/**
 * Configuration for the Recovery_Workflow.
 * These are tunable defaults, NOT evidence-based constants.
 */
export interface RecoveryConfig {
  /** Number of failures to trigger recovery (default 3, R4.1) */
  failureThreshold: number;
  /** Rolling window in days for counting failures (default 7, R4.1) */
  rollingWindowDays: number;
  /** Consecutive correct-unaided attempts to clear recovery (default 2, R4.3) */
  clearConsecutiveUnaided: number;
  /** Minimum days between clears (default 1, R4.3) */
  clearMinSeparationDays: number;
  /** Minimum delay in minutes between recovery reviews (default 10, R5.4, R5.6) */
  minDelayMinutes: number;
}

/**
 * Default recovery configuration.
 */
export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  failureThreshold: 3,
  rollingWindowDays: 7,
  clearConsecutiveUnaided: 2,
  clearMinSeparationDays: 1,
  minDelayMinutes: 10,
};

// ============================================================================
// Recall-Quality Classification (R3)
// ============================================================================

/**
 * Result of classifying an attempt's recall quality.
 */
export interface RecallQualityResult {
  /** The scheduler rating */
  rating: SchedulerRating;
  /** Evidence weight for retention calculation (higher = stronger evidence) */
  evidenceWeight: number;
}
