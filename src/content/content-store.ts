/**
 * Content Store Service
 * 
 * Provides access to learning content with state management.
 * Only `available` content is ever presented to learners (R12.1, R12.3, R12.4).
 * 
 * @module content/content-store
 */

import type { ContentState, ExerciseType, SkillDimension } from '../core/types';
import type {
  LanguageEntity,
  ModuleEntity,
  LessonEntity,
  LearningItemEntity,
  VocabularyEntity,
  GrammarInfoEntity,
  ExampleEntity,
  ExerciseEntity,
} from '../persistence/entities';
import type { Repositories } from '../persistence';
import {
  transitionContentState,
  canPresentToLearners,
  type ContentSource,
  type TransitionOptions,
  type StateTransitionResult,
} from './content-state-machine';
import {
  validateContent,
  type ContentForValidation,
} from './content-validation';

/**
 * Event logged when content gaps are detected.
 */
export interface ContentGapEvent {
  timestamp: string;
  type: 'missing_reference' | 'invalid_reference' | 'no_available_content';
  itemId?: string;
  message: string;
}

/**
 * Enriched learning item with all related content.
 */
export interface EnrichedLearningItem {
  item: LearningItemEntity;
  vocabulary?: VocabularyEntity;
  grammarInfo?: GrammarInfoEntity;
  examples: ExampleEntity[];
  exercises: ExerciseEntity[];
}

/**
 * Selection criteria for item selector.
 */
export interface ItemSelectionCriteria {
  /** Only return items in these skill dimensions */
  skillDimensions?: SkillDimension[];
  /** Exclude items with these IDs */
  excludeItemIds?: string[];
  /** Only return items with these exercise types available */
  exerciseTypes?: ExerciseType[];
  /** Exclude specific exercise types */
  excludeExerciseTypes?: ExerciseType[];
  /** Exclude specific example IDs */
  excludeExampleIds?: string[];
  /** Maximum number of items to return */
  limit?: number;
}

/**
 * Content Store - provides access to learning content.
 */
export class ContentStore {
  private contentGapLog: ContentGapEvent[] = [];

  constructor(private repos: Repositories) {}

  // ==========================================================================
  // Language Queries
  // ==========================================================================

  /**
   * Get all available course languages (excludes validation assets).
   */
  async getCourseLanguages(): Promise<LanguageEntity[]> {
    return this.repos.languages.getCourseLanguages();
  }

  /**
   * Get a language by code.
   */
  async getLanguageByCode(code: string): Promise<LanguageEntity | undefined> {
    return this.repos.languages.getByCode(code);
  }

  /**
   * Get validation asset languages (for testing purposes only).
   */
  async getValidationAssets(): Promise<LanguageEntity[]> {
    return this.repos.languages.getValidationAssets();
  }

  // ==========================================================================
  // Module/Lesson Queries
  // ==========================================================================

  /**
   * Get modules for a language, ordered.
   */
  async getModules(languageId: string): Promise<ModuleEntity[]> {
    return this.repos.modules.getByLanguage(languageId);
  }

  /**
   * Get lessons for a module, ordered.
   */
  async getLessons(moduleId: string): Promise<LessonEntity[]> {
    return this.repos.lessons.getByModule(moduleId);
  }

  // ==========================================================================
  // Learning Item Queries (Available Only)
  // ==========================================================================

  /**
   * Get available learning items for a language.
   * Only returns `available` content (R12.1, R12.3, R12.4).
   */
  async getAvailableItems(languageId: string): Promise<LearningItemEntity[]> {
    return this.repos.learningItems.getAvailable(languageId);
  }

  /**
   * Get available learning items for a lesson.
   */
  async getAvailableItemsForLesson(lessonId: string): Promise<LearningItemEntity[]> {
    const items = await this.repos.learningItems.getByLesson(lessonId);
    return items.filter(item => canPresentToLearners(item.contentState));
  }

  /**
   * Get an enriched learning item with all related content.
   * Only returns if item is `available`.
   */
  async getEnrichedItem(itemId: string): Promise<EnrichedLearningItem | null> {
    const item = await this.repos.learningItems.getById(itemId);
    
    if (!item) {
      this.logContentGap({
        type: 'missing_reference',
        itemId,
        message: `Learning item not found: ${itemId}`,
      });
      return null;
    }

    if (!canPresentToLearners(item.contentState)) {
      this.logContentGap({
        type: 'invalid_reference',
        itemId,
        message: `Learning item is not available (state: ${item.contentState}): ${itemId}`,
      });
      return null;
    }

    const [vocabulary, grammarInfo, examples, exercises] = await Promise.all([
      this.repos.vocabulary.getByLearningItem(itemId),
      this.repos.grammarInfo.getByLearningItem(itemId),
      this.repos.examples.getAvailableByLearningItem(itemId),
      this.repos.exercises.getAvailableByLearningItem(itemId),
    ]);

    return {
      item,
      vocabulary,
      grammarInfo,
      examples,
      exercises,
    };
  }

  /**
   * Select available items matching criteria.
   * Used by Session/Item Selector for exercise-type/context variation (R5.1, R5.3).
   */
  async selectItems(
    languageId: string,
    criteria: ItemSelectionCriteria = {}
  ): Promise<EnrichedLearningItem[]> {
    const availableItems = await this.getAvailableItems(languageId);
    let filtered = availableItems;

    // Filter by skill dimensions
    if (criteria.skillDimensions && criteria.skillDimensions.length > 0) {
      filtered = filtered.filter(item =>
        item.skillDimensions.some(sd => criteria.skillDimensions!.includes(sd))
      );
    }

    // Exclude specific items
    if (criteria.excludeItemIds && criteria.excludeItemIds.length > 0) {
      const excludeSet = new Set(criteria.excludeItemIds);
      filtered = filtered.filter(item => !excludeSet.has(item.id));
    }

    // Apply limit before enriching (for performance)
    if (criteria.limit && criteria.limit > 0) {
      filtered = filtered.slice(0, criteria.limit * 2); // Get more than needed in case some fail enrichment
    }

    // Enrich items and apply exercise type filters
    const enriched: EnrichedLearningItem[] = [];
    for (const item of filtered) {
      const enrichedItem = await this.getEnrichedItem(item.id);
      if (!enrichedItem) continue;

      // Filter by exercise types
      if (criteria.exerciseTypes && criteria.exerciseTypes.length > 0) {
        const hasMatchingExercise = enrichedItem.exercises.some(
          ex => criteria.exerciseTypes!.includes(ex.type)
        );
        if (!hasMatchingExercise) continue;
      }

      // Exclude specific exercise types
      if (criteria.excludeExerciseTypes && criteria.excludeExerciseTypes.length > 0) {
        enrichedItem.exercises = enrichedItem.exercises.filter(
          ex => !criteria.excludeExerciseTypes!.includes(ex.type)
        );
        if (enrichedItem.exercises.length === 0) continue;
      }

      // Exclude specific examples
      if (criteria.excludeExampleIds && criteria.excludeExampleIds.length > 0) {
        const excludeSet = new Set(criteria.excludeExampleIds);
        enrichedItem.examples = enrichedItem.examples.filter(
          ex => !excludeSet.has(ex.id)
        );
      }

      enriched.push(enrichedItem);

      if (criteria.limit && enriched.length >= criteria.limit) {
        break;
      }
    }

    if (enriched.length === 0 && filtered.length > 0) {
      this.logContentGap({
        type: 'no_available_content',
        message: `No items match selection criteria for language ${languageId}`,
      });
    }

    return enriched;
  }

  // ==========================================================================
  // Content State Management
  // ==========================================================================

  /**
   * Transition a learning item's content state.
   */
  async transitionItemState(
    itemId: string,
    targetState: ContentState,
    options: TransitionOptions = {}
  ): Promise<StateTransitionResult> {
    const item = await this.repos.learningItems.getById(itemId);
    if (!item) {
      return {
        success: false,
        newState: 'draft',
        error: `Learning item not found: ${itemId}`,
      };
    }

    // For draft → validated, run validation
    if (item.contentState === 'draft' && targetState === 'validated') {
      const contentForValidation = await this.getContentForValidation(itemId);
      if (!contentForValidation) {
        return {
          success: false,
          newState: item.contentState,
          error: 'Could not load content for validation',
        };
      }

      const validationResult = validateContent(contentForValidation);
      options = { ...options, validationResult };
    }

    const result = transitionContentState(item.contentState, targetState, options);

    if (result.success) {
      item.contentState = result.newState;
      item.updatedAt = new Date().toISOString();
      await this.repos.learningItems.save(item);
    }

    return result;
  }

  /**
   * Bulk transition items to a state (e.g., publish a lesson).
   */
  async bulkTransitionItems(
    itemIds: string[],
    targetState: ContentState,
    options: TransitionOptions = {}
  ): Promise<Map<string, StateTransitionResult>> {
    const results = new Map<string, StateTransitionResult>();

    for (const itemId of itemIds) {
      const result = await this.transitionItemState(itemId, targetState, options);
      results.set(itemId, result);
    }

    return results;
  }

  // ==========================================================================
  // Content Gap Logging
  // ==========================================================================

  /**
   * Get logged content gap events.
   */
  getContentGapLog(): ContentGapEvent[] {
    return [...this.contentGapLog];
  }

  /**
   * Clear the content gap log.
   */
  clearContentGapLog(): void {
    this.contentGapLog = [];
  }

  private logContentGap(event: Omit<ContentGapEvent, 'timestamp'>): void {
    this.contentGapLog.push({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  private async getContentForValidation(itemId: string): Promise<ContentForValidation | null> {
    const item = await this.repos.learningItems.getById(itemId);
    if (!item) return null;

    const [vocabulary, grammarInfo, examples, exercises] = await Promise.all([
      this.repos.vocabulary.getByLearningItem(itemId),
      this.repos.grammarInfo.getByLearningItem(itemId),
      this.repos.examples.getByLearningItem(itemId),
      this.repos.exercises.getByLearningItem(itemId),
    ]);

    return {
      item,
      vocabulary,
      grammarInfo,
      examples,
      exercises,
    };
  }
}

/**
 * Factory function to create a ContentStore.
 */
export function createContentStore(repos: Repositories): ContentStore {
  return new ContentStore(repos);
}
