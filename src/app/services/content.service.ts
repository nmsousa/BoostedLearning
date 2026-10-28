/**
 * Content Angular Service
 * 
 * Provides access to learning content through Angular DI.
 * Wraps the ContentStore with synchronous in-memory caching for the seed data.
 * 
 * @module app/services
 */

import { Injectable } from '@angular/core';
import {
  dutchA1Content,
  frenchB2ValidationContent,
} from '../../content';
import type {
  LanguageEntity,
  ModuleEntity,
  LessonEntity,
  LearningItemEntity,
  VocabularyEntity,
  GrammarInfoEntity,
  ExampleEntity,
} from '../../persistence/entities';

/**
 * Enriched learning item with related data
 */
export interface EnrichedItem {
  item: LearningItemEntity;
  vocabulary?: VocabularyEntity;
  grammarInfo?: GrammarInfoEntity;
  examples: ExampleEntity[];
}

/**
 * In-memory content store using seeded data.
 * This avoids async IndexedDB calls for the static curriculum content.
 */
@Injectable({
  providedIn: 'root',
})
export class ContentService {
  private languages: LanguageEntity[] = [];
  private modules: ModuleEntity[] = [];
  private lessons: LessonEntity[] = [];
  private learningItems: LearningItemEntity[] = [];
  private vocabulary: VocabularyEntity[] = [];
  private grammarInfo: GrammarInfoEntity[] = [];
  private examples: ExampleEntity[] = [];
  
  private contentGapLog: string[] = [];
  private initialized = false;

  constructor() {}

  /**
   * Initialize content with seed data
   */
  initialize(): void {
    if (this.initialized) return;
    
    // Load Dutch A1 content
    this.languages.push(dutchA1Content.language);
    this.modules.push(...dutchA1Content.modules);
    this.lessons.push(...dutchA1Content.lessons);
    this.learningItems.push(...dutchA1Content.learningItems);
    this.vocabulary.push(...dutchA1Content.vocabulary);
    this.grammarInfo.push(...dutchA1Content.grammarInfo);
    this.examples.push(...dutchA1Content.examples);
    
    // Load French B2 validation content (marked as validation asset, not shown as course)
    this.languages.push(frenchB2ValidationContent.language);
    this.learningItems.push(...frenchB2ValidationContent.learningItems);
    this.vocabulary.push(...frenchB2ValidationContent.vocabulary);
    
    this.initialized = true;
  }

  /**
   * Get available course languages (excludes validation assets)
   */
  getCourseLanguages(): LanguageEntity[] {
    return this.languages.filter(l => !l.isValidationAsset);
  }

  /**
   * Get modules for a language
   */
  getModulesForLanguage(languageCode: string): ModuleEntity[] {
    const language = this.languages.find(l => l.code === languageCode);
    if (!language) return [];
    return this.modules
      .filter(m => m.languageId === language.id)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get lessons for a module
   */
  getLessonsForModule(moduleId: string): LessonEntity[] {
    return this.lessons
      .filter(l => l.moduleId === moduleId)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get available items for a lesson
   */
  getAvailableItemsForLesson(lessonId: string): LearningItemEntity[] {
    return this.learningItems.filter(
      item => item.lessonId === lessonId && item.contentState === 'available'
    );
  }

  /**
   * Get an enriched item with all related data
   */
  getEnrichedItem(itemId: string): EnrichedItem | null {
    const item = this.learningItems.find(i => i.id === itemId);
    if (!item || item.contentState !== 'available') {
      return null;
    }
    
    const vocab = this.vocabulary.find(v => v.learningItemId === itemId);
    const grammar = this.grammarInfo.find(g => g.learningItemId === itemId);
    const itemExamples = this.examples.filter(e => e.learningItemId === itemId);
    
    return {
      item,
      vocabulary: vocab,
      grammarInfo: grammar,
      examples: itemExamples,
    };
  }

  /**
   * Get items by exercise type
   */
  getItemsForExerciseType(exerciseType: string): LearningItemEntity[] {
    // For now, return all available items
    // Exercise type filtering would depend on exercises being linked
    return this.learningItems.filter(item => item.contentState === 'available');
  }

  /**
   * Log a content gap for missing references
   */
  logContentGap(message: string): void {
    this.contentGapLog.push(message);
  }

  /**
   * Get content gap log
   */
  getContentGapLog(): string[] {
    return [...this.contentGapLog];
  }
}
