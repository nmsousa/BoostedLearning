/**
 * Dexie Database Definition
 * 
 * Uses Dexie.js core only (Apache-2.0), NOT Dexie Cloud.
 * All entities follow the ER diagram with id (UUID) and updatedAt (ISO).
 * 
 * Schema versioning: each schema change is a new version(n).stores(...).upgrade(...) step.
 * Migrations transform existing records in place, preserving learner history (R22.2).
 * 
 * @module persistence/database
 */

import Dexie, { type Table } from 'dexie';
import type {
  LanguageEntity,
  ModuleEntity,
  LessonEntity,
  LearningItemEntity,
  VocabularyEntity,
  GrammarInfoEntity,
  ExampleEntity,
  ExerciseEntity,
  ReviewStateEntity,
  AttemptEntity,
  SessionEntity,
  AchievementEntity,
  LearnerProfileEntity,
} from './entities';

/**
 * Flashcard entities for Quizlet-style practice
 */
export interface FlashcardEntity {
  id: string;
  deckId: string;
  text: string;
  translations: string[];
  audioUrl?: string;
  /** Skill group (duome-imported decks). Optional. */
  skill?: string;
  /** 1-based skill order in the course. Optional. */
  skillOrder?: number;
  correctCount: number;
  incorrectCount: number;
  /** "So-so" (medium) self-ratings. Optional. */
  mediumCount?: number;
  lastSeen: string | null;
  nextReview: string | null;
  streak: number;
  updatedAt: string;
  /**
   * true = manually added by the user (not part of the shipped app data).
   * These cards live only in this device's IndexedDB and are lost on
   * reinstall / device change unless exported. Used to show the
   * "custom / not synced" indicator and to drive the export feature.
   */
  isCustom?: boolean;
  /** ISO timestamp of when a manual card was created (for export ordering). */
  createdAt?: string;
  /**
   * Serialized FSRS spaced-repetition state (JSON of a ts-fsrs Card) used by
   * the Flashcards (flip + self-rating) mode. Independent from the Write
   * mode's correct/incorrect counters above. Undefined until first reviewed.
   */
  fsrs?: string;
}

export interface FlashcardDeckEntity {
  id: string;
  name: string;
  languageCode: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Level progress - tracks best star rating per level
 */
export interface LevelProgressEntity {
  id: string;           // Format: "deckId-mode-levelNumber"
  deckId: string;
  mode: string;         // Practice mode: 'flip' | 'write' | 'match' | 'quiz'
  levelNumber: number;
  bestStars: number;    // 0-3
  bestScore: number;    // Best percentage achieved
  attempts: number;     // How many times attempted
  lastAttempt: string;  // ISO timestamp
  /** Fastest completion time in seconds (Match mode). Optional / undefined for
   *  modes or records that don't track time. */
  bestTimeSeconds?: number;
  /** Best combo streak achieved (Match mode). Optional. */
  bestCombo?: number;
}

/**
 * The BoostedLearning IndexedDB database.
 * 
 * Domain/UI code MUST access data through Repositories, never through this class directly.
 * This ensures entities remain inspectable/assertable in tests (R22.5).
 */
export class BoostedLearningDatabase extends Dexie {
  // Content tables
  languages!: Table<LanguageEntity, string>;
  modules!: Table<ModuleEntity, string>;
  lessons!: Table<LessonEntity, string>;
  learningItems!: Table<LearningItemEntity, string>;
  vocabulary!: Table<VocabularyEntity, string>;
  grammarInfo!: Table<GrammarInfoEntity, string>;
  examples!: Table<ExampleEntity, string>;
  exercises!: Table<ExerciseEntity, string>;

  // Learner state tables
  reviewStates!: Table<ReviewStateEntity, string>;
  attempts!: Table<AttemptEntity, string>;
  sessions!: Table<SessionEntity, string>;
  achievements!: Table<AchievementEntity, string>;
  learnerProfile!: Table<LearnerProfileEntity, string>;

  // Flashcard tables (Quizlet-style practice)
  flashcardDecks!: Table<FlashcardDeckEntity, string>;
  flashcards!: Table<FlashcardEntity, string>;
  levelProgress!: Table<LevelProgressEntity, string>;

  constructor() {
    super('BoostedLearningDB');

    // Version 1: Initial schema
    this.version(1).stores({
      // Content tables - indexed for queries
      languages: 'id, code, isValidationAsset',
      modules: 'id, languageId, order',
      lessons: 'id, moduleId, order',
      learningItems: 'id, languageId, lessonId, contentState, kind',
      vocabulary: 'id, learningItemId',
      grammarInfo: 'id, learningItemId, partOfSpeech',
      examples: 'id, learningItemId, contentState',
      exercises: 'id, learningItemId, type, contentState',

      // Learner state tables - indexed for queries
      reviewStates: 'id, learningItemId, repeatedlyForgotten',
      attempts: 'id, learningItemId, exerciseId, sessionId, timestamp, skillDimension',
      sessions: 'id, startedAt, endedAt',
      achievements: 'id, code, earnedAt',
      learnerProfile: 'id',
    });

    // Version 2: Add flashcard tables
    this.version(2).stores({
      // Keep existing tables
      languages: 'id, code, isValidationAsset',
      modules: 'id, languageId, order',
      lessons: 'id, moduleId, order',
      learningItems: 'id, languageId, lessonId, contentState, kind',
      vocabulary: 'id, learningItemId',
      grammarInfo: 'id, learningItemId, partOfSpeech',
      examples: 'id, learningItemId, contentState',
      exercises: 'id, learningItemId, type, contentState',
      reviewStates: 'id, learningItemId, repeatedlyForgotten',
      attempts: 'id, learningItemId, exerciseId, sessionId, timestamp, skillDimension',
      sessions: 'id, startedAt, endedAt',
      achievements: 'id, code, earnedAt',
      learnerProfile: 'id',
      
      // New flashcard tables
      flashcardDecks: 'id, name, languageCode',
      flashcards: 'id, deckId, text, nextReview',
    });

    // Version 3: Add level progress table
    this.version(3).stores({
      // Keep existing tables
      languages: 'id, code, isValidationAsset',
      modules: 'id, languageId, order',
      lessons: 'id, moduleId, order',
      learningItems: 'id, languageId, lessonId, contentState, kind',
      vocabulary: 'id, learningItemId',
      grammarInfo: 'id, learningItemId, partOfSpeech',
      examples: 'id, learningItemId, contentState',
      exercises: 'id, learningItemId, type, contentState',
      reviewStates: 'id, learningItemId, repeatedlyForgotten',
      attempts: 'id, learningItemId, exerciseId, sessionId, timestamp, skillDimension',
      sessions: 'id, startedAt, endedAt',
      achievements: 'id, code, earnedAt',
      learnerProfile: 'id',
      flashcardDecks: 'id, name, languageCode',
      flashcards: 'id, deckId, text, nextReview',
      
      // Level progress tracking
      levelProgress: 'id, deckId, levelNumber, bestStars',
    });

    // Version 4: Index manually-added (custom) cards so they can be
    // listed and exported. Existing records keep isCustom = undefined,
    // which is treated as a non-custom (imported) card.
    this.version(4).stores({
      languages: 'id, code, isValidationAsset',
      modules: 'id, languageId, order',
      lessons: 'id, moduleId, order',
      learningItems: 'id, languageId, lessonId, contentState, kind',
      vocabulary: 'id, learningItemId',
      grammarInfo: 'id, learningItemId, partOfSpeech',
      examples: 'id, learningItemId, contentState',
      exercises: 'id, learningItemId, type, contentState',
      reviewStates: 'id, learningItemId, repeatedlyForgotten',
      attempts: 'id, learningItemId, exerciseId, sessionId, timestamp, skillDimension',
      sessions: 'id, startedAt, endedAt',
      achievements: 'id, code, earnedAt',
      learnerProfile: 'id',
      flashcardDecks: 'id, name, languageCode',
      flashcards: 'id, deckId, text, nextReview, isCustom',
      levelProgress: 'id, deckId, levelNumber, bestStars',
    });

    // Version 5: Add serialized FSRS state to flashcards for the flip +
    // self-rating Flashcards mode. No new index needed; existing records
    // keep fsrs = undefined (treated as a brand-new card on first review).
    this.version(5).stores({
      languages: 'id, code, isValidationAsset',
      modules: 'id, languageId, order',
      lessons: 'id, moduleId, order',
      learningItems: 'id, languageId, lessonId, contentState, kind',
      vocabulary: 'id, learningItemId',
      grammarInfo: 'id, learningItemId, partOfSpeech',
      examples: 'id, learningItemId, contentState',
      exercises: 'id, learningItemId, type, contentState',
      reviewStates: 'id, learningItemId, repeatedlyForgotten',
      attempts: 'id, learningItemId, exerciseId, sessionId, timestamp, skillDimension',
      sessions: 'id, startedAt, endedAt',
      achievements: 'id, code, earnedAt',
      learnerProfile: 'id',
      flashcardDecks: 'id, name, languageCode',
      flashcards: 'id, deckId, text, nextReview, isCustom',
      levelProgress: 'id, deckId, levelNumber, bestStars',
    });

    // Version 6: Track level progress PER practice mode. The id format changes
    // from "deckId-levelNumber" to "deckId-mode-levelNumber" and a `mode`
    // index is added. Legacy mode-less rows can't be attributed to a mode, so
    // they are cleared on upgrade (level stars reset once; re-earned per mode).
    this.version(6).stores({
      languages: 'id, code, isValidationAsset',
      modules: 'id, languageId, order',
      lessons: 'id, moduleId, order',
      learningItems: 'id, languageId, lessonId, contentState, kind',
      vocabulary: 'id, learningItemId',
      grammarInfo: 'id, learningItemId, partOfSpeech',
      examples: 'id, learningItemId, contentState',
      exercises: 'id, learningItemId, type, contentState',
      reviewStates: 'id, learningItemId, repeatedlyForgotten',
      attempts: 'id, learningItemId, exerciseId, sessionId, timestamp, skillDimension',
      sessions: 'id, startedAt, endedAt',
      achievements: 'id, code, earnedAt',
      learnerProfile: 'id',
      flashcardDecks: 'id, name, languageCode',
      flashcards: 'id, deckId, text, nextReview, isCustom',
      levelProgress: 'id, deckId, mode, levelNumber, bestStars',
    }).upgrade(async tx => {
      // Drop legacy records that predate per-mode tracking.
      await tx.table('levelProgress').clear();
    });
  }
}

/**
 * Singleton database instance.
 * Use getDatabase() to access it.
 */
let dbInstance: BoostedLearningDatabase | null = null;

/**
 * Get the database instance, creating it if necessary.
 */
export function getDatabase(): BoostedLearningDatabase {
  if (!dbInstance) {
    dbInstance = new BoostedLearningDatabase();
  }
  return dbInstance;
}

/**
 * Reset the database instance (primarily for testing).
 */
export async function resetDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.delete();
    dbInstance = null;
  }
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
