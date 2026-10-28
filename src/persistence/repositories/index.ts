/**
 * Repository module exports
 * 
 * @module persistence/repositories
 */

// Interfaces
export type {
  Repository,
  LanguageRepository,
  ModuleRepository,
  LessonRepository,
  LearningItemRepository,
  VocabularyRepository,
  GrammarInfoRepository,
  ExampleRepository,
  ExerciseRepository,
  ReviewStateRepository,
  AttemptRepository,
  SessionRepository,
  AchievementRepository,
  LearnerProfileRepository,
} from './repository-interfaces';

// Implementations
export {
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
} from './dexie-repositories';

// Factory for creating repository instances
import {
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
} from './dexie-repositories';

/**
 * Factory for creating repository instances.
 * Provides a single point of configuration for all repositories.
 */
export function createRepositories() {
  return {
    languages: new DexieLanguageRepository(),
    modules: new DexieModuleRepository(),
    lessons: new DexieLessonRepository(),
    learningItems: new DexieLearningItemRepository(),
    vocabulary: new DexieVocabularyRepository(),
    grammarInfo: new DexieGrammarInfoRepository(),
    examples: new DexieExampleRepository(),
    exercises: new DexieExerciseRepository(),
    reviewStates: new DexieReviewStateRepository(),
    attempts: new DexieAttemptRepository(),
    sessions: new DexieSessionRepository(),
    achievements: new DexieAchievementRepository(),
    learnerProfile: new DexieLearnerProfileRepository(),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
