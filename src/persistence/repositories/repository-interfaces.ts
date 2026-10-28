/**
 * Repository Interfaces
 * 
 * All Dexie access goes through these repositories.
 * Domain/UI code never touches Dexie directly (R22.5).
 * 
 * @module persistence/repositories
 */

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
} from '../entities';
import type { SkillDimension, ExerciseType, ContentState } from '../../core/types';

// ============================================================================
// Base Repository Interface
// ============================================================================

/**
 * Base repository operations available for all entities.
 */
export interface Repository<T> {
  /** Get an entity by ID */
  getById(id: string): Promise<T | undefined>;
  
  /** Get all entities */
  getAll(): Promise<T[]>;
  
  /** Create or update an entity */
  save(entity: T): Promise<void>;
  
  /** Save multiple entities in a transaction */
  saveMany(entities: T[]): Promise<void>;
  
  /** Delete an entity by ID */
  delete(id: string): Promise<void>;
  
  /** Delete all entities */
  deleteAll(): Promise<void>;
  
  /** Count all entities */
  count(): Promise<number>;
}

// ============================================================================
// Content Repositories
// ============================================================================

export interface LanguageRepository extends Repository<LanguageEntity> {
  /** Get language by code (e.g., 'nl', 'fr') */
  getByCode(code: string): Promise<LanguageEntity | undefined>;
  
  /** Get all languages that are actual courses (not validation assets) */
  getCourseLanguages(): Promise<LanguageEntity[]>;
  
  /** Get validation asset languages (e.g., French B2 set) */
  getValidationAssets(): Promise<LanguageEntity[]>;
}

export interface ModuleRepository extends Repository<ModuleEntity> {
  /** Get modules for a language, ordered */
  getByLanguage(languageId: string): Promise<ModuleEntity[]>;
}

export interface LessonRepository extends Repository<LessonEntity> {
  /** Get lessons for a module, ordered */
  getByModule(moduleId: string): Promise<LessonEntity[]>;
}

export interface LearningItemRepository extends Repository<LearningItemEntity> {
  /** Get items for a lesson */
  getByLesson(lessonId: string): Promise<LearningItemEntity[]>;
  
  /** Get items for a language */
  getByLanguage(languageId: string): Promise<LearningItemEntity[]>;
  
  /** Get only available items (R12.3, R12.4) */
  getAvailable(languageId: string): Promise<LearningItemEntity[]>;
  
  /** Get items by content state */
  getByContentState(state: ContentState): Promise<LearningItemEntity[]>;
}

export interface VocabularyRepository extends Repository<VocabularyEntity> {
  /** Get vocabulary for a learning item */
  getByLearningItem(learningItemId: string): Promise<VocabularyEntity | undefined>;
}

export interface GrammarInfoRepository extends Repository<GrammarInfoEntity> {
  /** Get grammar info for a learning item */
  getByLearningItem(learningItemId: string): Promise<GrammarInfoEntity | undefined>;
  
  /** Get items by part of speech */
  getByPartOfSpeech(partOfSpeech: string): Promise<GrammarInfoEntity[]>;
}

export interface ExampleRepository extends Repository<ExampleEntity> {
  /** Get examples for a learning item */
  getByLearningItem(learningItemId: string): Promise<ExampleEntity[]>;
  
  /** Get only available examples */
  getAvailableByLearningItem(learningItemId: string): Promise<ExampleEntity[]>;
}

export interface ExerciseRepository extends Repository<ExerciseEntity> {
  /** Get exercises for a learning item */
  getByLearningItem(learningItemId: string): Promise<ExerciseEntity[]>;
  
  /** Get exercises of a specific type */
  getByType(type: ExerciseType): Promise<ExerciseEntity[]>;
  
  /** Get only available exercises for a learning item */
  getAvailableByLearningItem(learningItemId: string): Promise<ExerciseEntity[]>;
}

// ============================================================================
// Learner State Repositories
// ============================================================================

export interface ReviewStateRepository extends Repository<ReviewStateEntity> {
  /** Get review state for a learning item */
  getByLearningItem(learningItemId: string): Promise<ReviewStateEntity | undefined>;
  
  /** Get all items in recovery state */
  getRecovering(): Promise<ReviewStateEntity[]>;
  
  /** Get items due for review before a given time */
  getDueBefore(time: string): Promise<ReviewStateEntity[]>;
  
  /** Get items with no review state (new items) */
  getItemsWithoutState(itemIds: string[]): Promise<string[]>;
}

export interface AttemptRepository extends Repository<AttemptEntity> {
  /** Get attempts for a learning item */
  getByLearningItem(learningItemId: string): Promise<AttemptEntity[]>;
  
  /** Get attempts for a learning item within a time window */
  getByLearningItemInWindow(
    learningItemId: string,
    startTime: string,
    endTime: string
  ): Promise<AttemptEntity[]>;
  
  /** Get attempts for a session */
  getBySession(sessionId: string): Promise<AttemptEntity[]>;
  
  /** Get attempts by skill dimension */
  getBySkillDimension(
    learningItemId: string,
    skillDimension: SkillDimension
  ): Promise<AttemptEntity[]>;
  
  /** Get the most recent attempts for an item */
  getRecentByLearningItem(learningItemId: string, limit: number): Promise<AttemptEntity[]>;
}

export interface SessionRepository extends Repository<SessionEntity> {
  /** Get the current active session (endedAt is null) */
  getActiveSession(): Promise<SessionEntity | undefined>;
  
  /** Get sessions within a date range */
  getInDateRange(startDate: string, endDate: string): Promise<SessionEntity[]>;
  
  /** Get the most recent sessions */
  getRecent(limit: number): Promise<SessionEntity[]>;
}

export interface AchievementRepository extends Repository<AchievementEntity> {
  /** Get achievement by code */
  getByCode(code: string): Promise<AchievementEntity | undefined>;
  
  /** Check if an achievement has been earned */
  hasEarned(code: string): Promise<boolean>;
  
  /** Get achievements earned within a date range */
  getEarnedInRange(startDate: string, endDate: string): Promise<AchievementEntity[]>;
}

export interface LearnerProfileRepository extends Repository<LearnerProfileEntity> {
  /** Get the learner profile (there should only be one) */
  getProfile(): Promise<LearnerProfileEntity | undefined>;
  
  /** Create or update the learner profile */
  saveProfile(profile: LearnerProfileEntity): Promise<void>;
}
