/**
 * Dexie Repository Implementations
 * 
 * Concrete implementations wrapping all Dexie access.
 * Domain/UI code uses repository interfaces, never Dexie directly (R22.5).
 * 
 * @module persistence/repositories
 */

import type { Table } from 'dexie';
import { getDatabase } from '../database';
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
import type {
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
import type { SkillDimension, ExerciseType, ContentState } from '../../core/types';

// ============================================================================
// Base Repository Implementation
// ============================================================================

/**
 * Base repository with common CRUD operations.
 */
abstract class BaseDexieRepository<T extends { id: string }> implements Repository<T> {
  protected abstract getTable(): Table<T, string>;

  async getById(id: string): Promise<T | undefined> {
    return this.getTable().get(id);
  }

  async getAll(): Promise<T[]> {
    return this.getTable().toArray();
  }

  async save(entity: T): Promise<void> {
    await this.getTable().put(entity);
  }

  async saveMany(entities: T[]): Promise<void> {
    await this.getTable().bulkPut(entities);
  }

  async delete(id: string): Promise<void> {
    await this.getTable().delete(id);
  }

  async deleteAll(): Promise<void> {
    await this.getTable().clear();
  }

  async count(): Promise<number> {
    return this.getTable().count();
  }
}

// ============================================================================
// Content Repository Implementations
// ============================================================================

export class DexieLanguageRepository
  extends BaseDexieRepository<LanguageEntity>
  implements LanguageRepository
{
  protected getTable() {
    return getDatabase().languages;
  }

  async getByCode(code: string): Promise<LanguageEntity | undefined> {
    return this.getTable().where('code').equals(code).first();
  }

  async getCourseLanguages(): Promise<LanguageEntity[]> {
    // Filter in-memory since boolean indexing is tricky
    const all = await this.getTable().toArray();
    return all.filter(lang => !lang.isValidationAsset);
  }

  async getValidationAssets(): Promise<LanguageEntity[]> {
    // Filter in-memory since boolean indexing is tricky
    const all = await this.getTable().toArray();
    return all.filter(lang => lang.isValidationAsset);
  }
}

export class DexieModuleRepository
  extends BaseDexieRepository<ModuleEntity>
  implements ModuleRepository
{
  protected getTable() {
    return getDatabase().modules;
  }

  async getByLanguage(languageId: string): Promise<ModuleEntity[]> {
    return this.getTable()
      .where('languageId')
      .equals(languageId)
      .sortBy('order');
  }
}

export class DexieLessonRepository
  extends BaseDexieRepository<LessonEntity>
  implements LessonRepository
{
  protected getTable() {
    return getDatabase().lessons;
  }

  async getByModule(moduleId: string): Promise<LessonEntity[]> {
    return this.getTable()
      .where('moduleId')
      .equals(moduleId)
      .sortBy('order');
  }
}

export class DexieLearningItemRepository
  extends BaseDexieRepository<LearningItemEntity>
  implements LearningItemRepository
{
  protected getTable() {
    return getDatabase().learningItems;
  }

  async getByLesson(lessonId: string): Promise<LearningItemEntity[]> {
    return this.getTable().where('lessonId').equals(lessonId).toArray();
  }

  async getByLanguage(languageId: string): Promise<LearningItemEntity[]> {
    return this.getTable().where('languageId').equals(languageId).toArray();
  }

  async getAvailable(languageId: string): Promise<LearningItemEntity[]> {
    return this.getTable()
      .where('[languageId+contentState]')
      .equals([languageId, 'available'])
      .toArray()
      .catch(() => {
        // Fallback if compound index doesn't exist
        return this.getTable()
          .where('languageId')
          .equals(languageId)
          .filter(item => item.contentState === 'available')
          .toArray();
      });
  }

  async getByContentState(state: ContentState): Promise<LearningItemEntity[]> {
    return this.getTable().where('contentState').equals(state).toArray();
  }
}

export class DexieVocabularyRepository
  extends BaseDexieRepository<VocabularyEntity>
  implements VocabularyRepository
{
  protected getTable() {
    return getDatabase().vocabulary;
  }

  async getByLearningItem(learningItemId: string): Promise<VocabularyEntity | undefined> {
    return this.getTable().where('learningItemId').equals(learningItemId).first();
  }
}

export class DexieGrammarInfoRepository
  extends BaseDexieRepository<GrammarInfoEntity>
  implements GrammarInfoRepository
{
  protected getTable() {
    return getDatabase().grammarInfo;
  }

  async getByLearningItem(learningItemId: string): Promise<GrammarInfoEntity | undefined> {
    return this.getTable().where('learningItemId').equals(learningItemId).first();
  }

  async getByPartOfSpeech(partOfSpeech: string): Promise<GrammarInfoEntity[]> {
    return this.getTable().where('partOfSpeech').equals(partOfSpeech).toArray();
  }
}

export class DexieExampleRepository
  extends BaseDexieRepository<ExampleEntity>
  implements ExampleRepository
{
  protected getTable() {
    return getDatabase().examples;
  }

  async getByLearningItem(learningItemId: string): Promise<ExampleEntity[]> {
    return this.getTable().where('learningItemId').equals(learningItemId).toArray();
  }

  async getAvailableByLearningItem(learningItemId: string): Promise<ExampleEntity[]> {
    return this.getTable()
      .where('learningItemId')
      .equals(learningItemId)
      .filter(example => example.contentState === 'available')
      .toArray();
  }
}

export class DexieExerciseRepository
  extends BaseDexieRepository<ExerciseEntity>
  implements ExerciseRepository
{
  protected getTable() {
    return getDatabase().exercises;
  }

  async getByLearningItem(learningItemId: string): Promise<ExerciseEntity[]> {
    return this.getTable().where('learningItemId').equals(learningItemId).toArray();
  }

  async getByType(type: ExerciseType): Promise<ExerciseEntity[]> {
    return this.getTable().where('type').equals(type).toArray();
  }

  async getAvailableByLearningItem(learningItemId: string): Promise<ExerciseEntity[]> {
    return this.getTable()
      .where('learningItemId')
      .equals(learningItemId)
      .filter(exercise => exercise.contentState === 'available')
      .toArray();
  }
}

// ============================================================================
// Learner State Repository Implementations
// ============================================================================

export class DexieReviewStateRepository
  extends BaseDexieRepository<ReviewStateEntity>
  implements ReviewStateRepository
{
  protected getTable() {
    return getDatabase().reviewStates;
  }

  async getByLearningItem(learningItemId: string): Promise<ReviewStateEntity | undefined> {
    return this.getTable().where('learningItemId').equals(learningItemId).first();
  }

  async getRecovering(): Promise<ReviewStateEntity[]> {
    // Filter in-memory since boolean indexing is tricky
    const all = await this.getTable().toArray();
    return all.filter(state => state.repeatedlyForgotten);
  }

  async getDueBefore(time: string): Promise<ReviewStateEntity[]> {
    const all = await this.getTable().toArray();
    return all.filter(
      state => state.schedulerState && state.schedulerState.due <= time
    );
  }

  async getItemsWithoutState(itemIds: string[]): Promise<string[]> {
    const existingStates = await this.getTable()
      .where('learningItemId')
      .anyOf(itemIds)
      .toArray();
    const existingItemIds = new Set(existingStates.map(s => s.learningItemId));
    return itemIds.filter(id => !existingItemIds.has(id));
  }
}

export class DexieAttemptRepository
  extends BaseDexieRepository<AttemptEntity>
  implements AttemptRepository
{
  protected getTable() {
    return getDatabase().attempts;
  }

  async getByLearningItem(learningItemId: string): Promise<AttemptEntity[]> {
    return this.getTable()
      .where('learningItemId')
      .equals(learningItemId)
      .sortBy('timestamp');
  }

  async getByLearningItemInWindow(
    learningItemId: string,
    startTime: string,
    endTime: string
  ): Promise<AttemptEntity[]> {
    return this.getTable()
      .where('learningItemId')
      .equals(learningItemId)
      .filter(attempt => attempt.timestamp >= startTime && attempt.timestamp <= endTime)
      .sortBy('timestamp');
  }

  async getBySession(sessionId: string): Promise<AttemptEntity[]> {
    return this.getTable()
      .where('sessionId')
      .equals(sessionId)
      .sortBy('timestamp');
  }

  async getBySkillDimension(
    learningItemId: string,
    skillDimension: SkillDimension
  ): Promise<AttemptEntity[]> {
    return this.getTable()
      .where('learningItemId')
      .equals(learningItemId)
      .filter(attempt => attempt.skillDimension === skillDimension)
      .sortBy('timestamp');
  }

  async getRecentByLearningItem(learningItemId: string, limit: number): Promise<AttemptEntity[]> {
    const attempts = await this.getTable()
      .where('learningItemId')
      .equals(learningItemId)
      .reverse()
      .sortBy('timestamp');
    return attempts.slice(0, limit).reverse();
  }
}

export class DexieSessionRepository
  extends BaseDexieRepository<SessionEntity>
  implements SessionRepository
{
  protected getTable() {
    return getDatabase().sessions;
  }

  async getActiveSession(): Promise<SessionEntity | undefined> {
    const all = await this.getTable().toArray();
    return all.find(session => session.endedAt === null);
  }

  async getInDateRange(startDate: string, endDate: string): Promise<SessionEntity[]> {
    return this.getTable()
      .where('startedAt')
      .between(startDate, endDate, true, true)
      .sortBy('startedAt');
  }

  async getRecent(limit: number): Promise<SessionEntity[]> {
    const sessions = await this.getTable()
      .orderBy('startedAt')
      .reverse()
      .toArray();
    return sessions.slice(0, limit);
  }
}

export class DexieAchievementRepository
  extends BaseDexieRepository<AchievementEntity>
  implements AchievementRepository
{
  protected getTable() {
    return getDatabase().achievements;
  }

  async getByCode(code: string): Promise<AchievementEntity | undefined> {
    return this.getTable().where('code').equals(code).first();
  }

  async hasEarned(code: string): Promise<boolean> {
    const count = await this.getTable().where('code').equals(code).count();
    return count > 0;
  }

  async getEarnedInRange(startDate: string, endDate: string): Promise<AchievementEntity[]> {
    return this.getTable()
      .where('earnedAt')
      .between(startDate, endDate, true, true)
      .sortBy('earnedAt');
  }
}

export class DexieLearnerProfileRepository
  extends BaseDexieRepository<LearnerProfileEntity>
  implements LearnerProfileRepository
{
  protected getTable() {
    return getDatabase().learnerProfile;
  }

  async getProfile(): Promise<LearnerProfileEntity | undefined> {
    const profiles = await this.getTable().toArray();
    return profiles[0];
  }

  async saveProfile(profile: LearnerProfileEntity): Promise<void> {
    await this.save(profile);
  }
}
