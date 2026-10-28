/**
 * Persistence Layer
 * 
 * Provides IndexedDB persistence via Dexie.js (core only, Apache-2.0).
 * Domain/UI code accesses data through repositories, never Dexie directly.
 * 
 * @module persistence
 */

// Database
export { BoostedLearningDatabase, getDatabase, resetDatabase, closeDatabase } from './database';

// Entities
export type {
  BaseEntity,
  LanguageEntity,
  ModuleEntity,
  LessonEntity,
  LearningItemEntity,
  VocabularyEntity,
  GrammarInfoEntity,
  PresentTenseConjugation,
  ExampleEntity,
  ExerciseEntity,
  ReviewStateEntity,
  AttemptEntity,
  SessionEntity,
  SessionMix,
  AchievementEntity,
  LearnerProfileEntity,
} from './entities';
export { DEFAULT_LEARNER_PROFILE } from './entities';

// Repositories
export {
  createRepositories,
  type Repositories,
  type Repository,
  type LanguageRepository,
  type ModuleRepository,
  type LessonRepository,
  type LearningItemRepository,
  type VocabularyRepository,
  type GrammarInfoRepository,
  type ExampleRepository,
  type ExerciseRepository,
  type ReviewStateRepository,
  type AttemptRepository,
  type SessionRepository,
  type AchievementRepository,
  type LearnerProfileRepository,
  DexieLanguageRepository,
  DexieModuleRepository,
  DexieLessonRepository,
  DexieLearningItemRepository,
  DexieVocabularyRepository,
  DexieGrammarInfoRepository,
  DexieExampleRepository,
  DexieExerciseRepository,
  DexieReviewStateRepository,
  DexieAttemptRepository,
  DexieSessionRepository,
  DexieAchievementRepository,
  DexieLearnerProfileRepository,
} from './repositories';

// Export/Import/Backup
export {
  exportAll,
  exportLearnerData,
  importAll,
  importLearnerData,
  deleteLearnerData,
  deleteAllData,
  validateFullExport,
  validateLearnerBackup,
  exportToJson,
  parseExportJson,
  type ExportMetadata,
  type ContentExport,
  type LearnerDataExport,
  type FullExport,
  type LearnerBackup,
  type ImportValidationResult,
} from './export-import';
