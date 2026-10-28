/**
 * Persistence Layer Entities
 * 
 * All entities from the ER diagram with id (UUID) and updatedAt (ISO) on every entity.
 * Uses Dexie.js core only (Apache-2.0), NOT Dexie Cloud.
 * 
 * @module persistence/entities
 */

import type {
  SkillDimension,
  ExerciseType,
  AttemptMode,
  SchedulerState,
  PerSkillReviewState,
  RecoveryState,
  ContentState,
  TolerancePolicy,
} from '../core/types';

// ============================================================================
// Base Entity
// ============================================================================

/**
 * Base fields present on all entities.
 * Provides stable identity (UUID) and change tracking (updatedAt).
 */
export interface BaseEntity {
  /** Unique identifier (UUID) */
  id: string;
  /** ISO timestamp of last modification */
  updatedAt: string;
}

// ============================================================================
// Language & Content Structure
// ============================================================================

/**
 * A target language available for learning.
 */
export interface LanguageEntity extends BaseEntity {
  /** ISO language code (e.g., 'nl', 'fr') */
  code: string;
  /** Display name (e.g., 'Dutch', 'French') */
  name: string;
  /** If true, this is a validation asset (e.g., French B2 set), not a course (R11.3) */
  isValidationAsset: boolean;
}

/**
 * A module grouping related lessons (e.g., "A1.1 - Greetings").
 */
export interface ModuleEntity extends BaseEntity {
  languageId: string;
  /** Display order within the language */
  order: number;
  /** Module title */
  title: string;
  /** CEFR objective (e.g., "A1.1", "A2.2") */
  cefrObjective: string;
}

/**
 * A lesson within a module introducing specific learning items.
 */
export interface LessonEntity extends BaseEntity {
  moduleId: string;
  /** Display order within the module */
  order: number;
  /** Lesson title */
  title: string;
  /** CEFR-aligned learning objective */
  cefrObjective: string;
  /** Optional reference to grammar explanation */
  grammarExplanationId: string | null;
}

// ============================================================================
// Learning Items & Content
// ============================================================================

/**
 * An atomic unit of knowledge to be learned.
 */
export interface LearningItemEntity extends BaseEntity {
  languageId: string;
  lessonId: string;
  /** Type of learning item */
  kind: 'vocabulary' | 'grammar' | 'phrase' | 'sentence-pattern';
  /** The prompt shown to learners */
  prompt: string;
  /** Which skill dimensions can be tested */
  skillDimensions: SkillDimension[];
  /** Content validation state (R12) */
  contentState: ContentState;
}

/**
 * Vocabulary-specific data for a learning item.
 */
export interface VocabularyEntity extends BaseEntity {
  learningItemId: string;
  /** The word/phrase in the target language */
  targetText: string;
  /** Curated set of valid answers (R8.1) */
  acceptedAnswers: string[];
  /** Alternative translations that are also correct (R8.5) */
  alternativeTranslations: string[];
}

/**
 * Grammar-specific data for a learning item.
 * Dutch-specific fields are isolated here so the engine stays language-agnostic (R9).
 */
export interface GrammarInfoEntity extends BaseEntity {
  learningItemId: string;
  /** Part of speech (noun, verb, adjective, etc.) */
  partOfSpeech: string;
  /** Dutch article: 'de' or 'het' (R9.1) */
  dutchArticle: 'de' | 'het' | null;
  /** Dutch plural form (R9.2) */
  pluralForm: string | null;
  /** Dutch present tense conjugation map (R9.3) */
  presentTenseConjugation: PresentTenseConjugation | null;
}

/**
 * Present tense conjugation for Dutch verbs.
 */
export interface PresentTenseConjugation {
  ik: string;       // I
  jij: string;      // you (singular informal)
  hij: string;      // he/she/it
  wij: string;      // we
  jullie: string;   // you (plural)
  zij: string;      // they
}

/**
 * An example sentence illustrating a learning item.
 */
export interface ExampleEntity extends BaseEntity {
  learningItemId: string;
  /** The example in the target language */
  sentenceTarget: string;
  /** The example in the explanation language */
  sentenceExplanation: string;
  /** Content validation state (R12) */
  contentState: ContentState;
}

/**
 * An exercise that tests a learning item.
 */
export interface ExerciseEntity extends BaseEntity {
  learningItemId: string;
  /** The type of exercise */
  type: ExerciseType;
  /** Exercise-specific configuration */
  config: Record<string, unknown>;
  /** Learning objective for this exercise (R7.2) */
  objective: string;
  /** Content validation state (R12) */
  contentState: ContentState;
}

// ============================================================================
// Review & Learning State
// ============================================================================

/**
 * Per-item review state tracked by the Memory_Engine.
 */
export interface ReviewStateEntity extends BaseEntity {
  learningItemId: string;
  /** Opaque FSRS scheduler state */
  schedulerState: SchedulerState | null;
  /** Per-skill-dimension tracking (R1.5). Partial: only exercised dimensions are stored. */
  perSkillState: Partial<Record<SkillDimension, PerSkillReviewState>>;
  /** Total attempts across all skills */
  attemptCount: number;
  /** Total mistakes across all skills */
  mistakeCount: number;
  /** Derived confidence indicator (0-1) */
  confidence: number;
  /** Whether in repeated-forgetting state (R4.1) */
  repeatedlyForgotten: boolean;
  /** Active recovery workflow state (R5) */
  recoveryState: RecoveryState | null;
  /** Last exercise type used (for variation) */
  lastExerciseType: ExerciseType | null;
  /** Last example ID used (for context variation) */
  lastExampleId: string | null;
}

/**
 * A persisted record of a single exercise attempt (R1.1).
 */
export interface AttemptEntity extends BaseEntity {
  learningItemId: string;
  exerciseId: string;
  sessionId: string;
  /** ISO timestamp of the attempt */
  timestamp: string;
  /** Whether the answer was correct */
  correct: boolean;
  /** Recognition or unaided recall (R1.2) */
  mode: AttemptMode;
  /** Whether a hint was used (R1.3) */
  usedHint: boolean;
  /** Which skill dimension was tested */
  skillDimension: SkillDimension;
  /** The exercise type used */
  exerciseType: ExerciseType;
}

// ============================================================================
// Session & Progress
// ============================================================================

/**
 * A learning session grouping multiple attempts.
 */
export interface SessionEntity extends BaseEntity {
  /** ISO timestamp when session started */
  startedAt: string;
  /** ISO timestamp when session ended (null if still active) */
  endedAt: string | null;
  /** Number of items studied in this session */
  itemsStudied: number;
  /** Mix of item types in this session */
  mix: SessionMix;
}

/**
 * Breakdown of item types in a session.
 */
export interface SessionMix {
  newItems: number;
  reviewItems: number;
  recoveryItems: number;
}

/**
 * An achievement earned by the learner (R19).
 */
export interface AchievementEntity extends BaseEntity {
  /** Unique code for this achievement type */
  code: string;
  /** ISO timestamp when earned */
  earnedAt: string;
  /** Human-readable reason */
  reason: string;
}

/**
 * Learner profile and preferences (R15, R16, R21).
 */
export interface LearnerProfileEntity extends BaseEntity {
  /** Explanation language: 'pt' | 'fr' | 'en' (R16.1) */
  explanationLanguage: 'pt' | 'fr' | 'en';
  /** UI theme: 'light' | 'dark' | 'system' (R21.3) */
  theme: 'light' | 'dark' | 'system';
  /** Text size scale factor (R21.4) */
  textSizeScale: number;
  /** Reduced motion preference (R21.6) */
  reducedMotion: boolean;
  /** Reduced distraction mode (R19.7) */
  reducedDistraction: boolean;
  /** Preferred session length in minutes (R19.2) */
  sessionLengthPref: number;
  /** Whether reminders are enabled (R19.3) */
  remindersEnabled: boolean;
  /** Current streak count */
  streakDays: number;
  /** Last practice date (ISO) */
  lastPracticeDate: string | null;
  /** Total XP-equivalent points (R19.1) */
  totalXp: number;
}

// ============================================================================
// Default values
// ============================================================================

/**
 * Default learner profile for new installations.
 */
export const DEFAULT_LEARNER_PROFILE: Omit<LearnerProfileEntity, 'id' | 'updatedAt'> = {
  explanationLanguage: 'pt', // Portuguese default (R16.1)
  theme: 'system',
  textSizeScale: 1.0,
  reducedMotion: false,
  reducedDistraction: false,
  sessionLengthPref: 15, // 15 minutes default
  remindersEnabled: false,
  streakDays: 0,
  lastPracticeDate: null,
  totalXp: 0,
};
