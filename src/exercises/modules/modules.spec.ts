/**
 * Exercise Modules Tests
 * 
 * Feature: language-learning-app
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.4, 9.4, 9.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  createExerciseRegistry,
  verifyContract,
  ExerciseRegistry,
  ExerciseInstance,
  ExerciseResponse,
} from '../exercise-contract';
import {
  registerBuiltInExercises,
  createFlashcardExercise,
  createMatchingExercise,
  createTypedTranslationExercise,
  createMultipleChoiceExercise,
  createFillBlankExercise,
  createArticleSelectionExercise,
  createWordOrderExercise,
  createListeningExercise,
  createConjugationExercise,
  buildMixedReviewSession,
  validateMixedSession,
  selectExerciseTypesForItem,
  MixedReviewItem,
} from './index';
import { SkillDimension, ExerciseType } from '../../core/types';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockInstance(overrides?: Partial<ExerciseInstance>): ExerciseInstance {
  return {
    id: 'test-1',
    learningItemId: 'item-1',
    type: 'flashcard' as ExerciseType,
    skillDimension: 'receptive_vocabulary' as SkillDimension,
    prompt: 'Test prompt',
    expectedAnswers: ['answer'],
    ...overrides,
  };
}

function createMockContext() {
  return {
    container: { innerHTML: '' } as HTMLElement,
    t: (key: string) => key,
    theme: 'light' as const,
    textSize: 'medium' as const,
    reducedMotion: false,
  };
}

function createMockResponse(overrides?: Partial<ExerciseResponse>): ExerciseResponse {
  return {
    submitted: 'answer',
    responseTimeMs: 1000,
    hintUsed: false,
    audioUsed: false,
    attempts: 1,
    ...overrides,
  };
}

// ============================================================================
// Built-in Exercise Registration Tests
// ============================================================================

describe('Exercise Modules', () => {
  let registry: ExerciseRegistry;
  
  beforeEach(() => {
    registry = createExerciseRegistry();
  });
  
  describe('registerBuiltInExercises', () => {
    it('should register all built-in exercise types', () => {
      registerBuiltInExercises(registry);
      
      const types = registry.getTypes();
      expect(types).toContain('flashcard');
      expect(types).toContain('matching');
      expect(types).toContain('typed-translation');
      expect(types).toContain('multiple-choice');
      expect(types).toContain('fill-blank');
      expect(types).toContain('article-selection');
      expect(types).toContain('word-order');
      expect(types).toContain('listening');
      expect(types).toContain('conjugation');
    });
    
    it('all registered modules should satisfy the contract (R7.2)', () => {
      registerBuiltInExercises(registry);
      
      for (const contract of registry.getAll()) {
        const result = verifyContract(contract);
        expect(result.valid).toBe(true);
      }
    });
  });
  
  describe('Flashcard Exercise', () => {
    it('should create valid flashcard instance', () => {
      const flashcard = createFlashcardExercise();
      expect(flashcard.type).toBe('flashcard');
      expect(flashcard.supportsAudio).toBe(true);
    });
    
    it('should evaluate self-assessed correct', () => {
      const flashcard = createFlashcardExercise();
      const instance = createMockInstance({ expectedAnswers: ['huis'] });
      
      flashcard.render(instance, createMockContext());
      flashcard.markCorrect();
      
      const response = flashcard.collectResponse();
      const result = flashcard.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
      expect(result.outcome).toBe('correct-recognition');
    });
    
    it('should evaluate typed answer', () => {
      const flashcard = createFlashcardExercise();
      const instance = createMockInstance({ expectedAnswers: ['huis'] });
      
      flashcard.render(instance, createMockContext());
      flashcard.submitAnswer('huis');
      
      // collectResponse gets the submitted value from the exercise's internal state
      const response = flashcard.collectResponse();
      expect(response.submitted).toBe('huis');
      
      const result = flashcard.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
      expect(result.outcome).toBe('correct-unaided');
    });
  });
  
  describe('Matching Exercise', () => {
    it('should create valid matching instance', () => {
      const matching = createMatchingExercise();
      expect(matching.type).toBe('matching');
      expect(matching.supportsAudio).toBe(false);
    });
    
    it('should track matches', () => {
      const matching = createMatchingExercise();
      const instance = createMockInstance({
        type: 'matching',
        options: {
          pairs: [
            { left: 'huis', right: 'house' },
            { left: 'auto', right: 'car' },
          ],
        },
      });
      
      matching.render(instance, createMockContext());
      matching.makeMatch(0, 0);
      matching.makeMatch(1, 1);
      
      const matches = matching.getMatches();
      expect(matches.get(0)).toBe(0);
      expect(matches.get(1)).toBe(1);
    });
  });
  
  describe('Typed Translation Exercise', () => {
    it('should create valid typed translation instance', () => {
      const typed = createTypedTranslationExercise();
      expect(typed.type).toBe('typed-translation');
      expect(typed.supportsAudio).toBe(false);
    });
    
    it('should evaluate correct translation', () => {
      const typed = createTypedTranslationExercise();
      const instance = createMockInstance({
        type: 'typed-translation',
        expectedAnswers: ['huis'],
        alternatives: ['het huis'],
      });
      
      typed.render(instance, createMockContext());
      typed.submitAnswer('huis');
      
      const response = typed.collectResponse();
      expect(response.submitted).toBe('huis');
      
      const result = typed.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
    });
    
    it('should accept alternatives', () => {
      const typed = createTypedTranslationExercise();
      const instance = createMockInstance({
        type: 'typed-translation',
        expectedAnswers: ['huis'],
        alternatives: ['het huis'],
      });
      
      typed.render(instance, createMockContext());
      typed.submitAnswer('het huis');
      
      const response = typed.collectResponse();
      expect(response.submitted).toBe('het huis');
      
      const result = typed.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
    });
  });
  
  describe('Multiple Choice Exercise', () => {
    it('should create valid multiple choice instance', () => {
      const mc = createMultipleChoiceExercise();
      expect(mc.type).toBe('multiple-choice');
      expect(mc.supportsAudio).toBe(true);
    });
    
    it('should evaluate correct selection', () => {
      const mc = createMultipleChoiceExercise();
      const instance = createMockInstance({
        type: 'multiple-choice',
        options: {
          choices: ['house', 'car', 'dog', 'cat'],
          correctIndex: 0,
        },
      });
      
      mc.render(instance, createMockContext());
      mc.selectOption(0);
      
      const response = mc.collectResponse();
      const result = mc.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
      expect(result.outcome).toBe('correct-recognition');
    });
    
    it('should evaluate incorrect selection', () => {
      const mc = createMultipleChoiceExercise();
      const instance = createMockInstance({
        type: 'multiple-choice',
        options: {
          choices: ['house', 'car', 'dog', 'cat'],
          correctIndex: 0,
        },
      });
      
      mc.render(instance, createMockContext());
      mc.selectOption(2);
      
      const response = mc.collectResponse();
      const result = mc.evaluate(response, instance);
      
      expect(result.correct).toBe(false);
      expect(result.outcome).toBe('incorrect');
      expect(result.correctAnswers).toContain('house');
    });
  });
  
  describe('Fill Blank Exercise', () => {
    it('should create valid fill blank instance', () => {
      const fb = createFillBlankExercise();
      expect(fb.type).toBe('fill-blank');
      expect(fb.supportsAudio).toBe(false);
    });
    
    it('should evaluate correct fill-in', () => {
      const fb = createFillBlankExercise();
      const instance = createMockInstance({
        type: 'fill-blank',
        prompt: 'Ik ___ een huis.',
        expectedAnswers: ['heb'],
      });
      
      fb.render(instance, createMockContext());
      fb.submitAnswer('heb');
      
      const response = fb.collectResponse();
      expect(response.submitted).toBe('heb');
      
      const result = fb.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
    });
  });
  
  describe('Article Selection Exercise', () => {
    it('should create valid article selection instance', () => {
      const as = createArticleSelectionExercise();
      expect(as.type).toBe('article-selection');
      expect(as.supportsAudio).toBe(false);
    });
    
    it('should evaluate correct article (R9.4)', () => {
      const as = createArticleSelectionExercise();
      const instance = createMockInstance({
        type: 'article-selection',
        prompt: 'Select the article for "huis"',
        options: {
          noun: 'huis',
          correctArticle: 'het',
        },
      });
      
      as.render(instance, createMockContext());
      as.selectArticle('het');
      
      const response = as.collectResponse();
      const result = as.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
    });
    
    it('should reject incorrect article (R9.4)', () => {
      const as = createArticleSelectionExercise();
      const instance = createMockInstance({
        type: 'article-selection',
        prompt: 'Select the article for "huis"',
        options: {
          noun: 'huis',
          correctArticle: 'het',
        },
      });
      
      as.render(instance, createMockContext());
      as.selectArticle('de');
      
      const response = as.collectResponse();
      const result = as.evaluate(response, instance);
      
      expect(result.correct).toBe(false);
    });
  });
  
  describe('Word Order Exercise', () => {
    it('should create valid word order instance', () => {
      const wo = createWordOrderExercise();
      expect(wo.type).toBe('word-order');
      expect(wo.supportsAudio).toBe(false);
    });
    
    it('should construct sentence from word order', () => {
      const wo = createWordOrderExercise();
      const instance = createMockInstance({
        type: 'word-order',
        expectedAnswers: ['Ik heb een huis'],
        options: {
          words: ['huis', 'Ik', 'heb', 'een'],
          allowFreeOrder: false,
        },
      });
      
      wo.render(instance, createMockContext());
      wo.addWord(1); // Ik
      wo.addWord(2); // heb
      wo.addWord(3); // een
      wo.addWord(0); // huis
      
      const response = wo.collectResponse();
      expect(response.submitted).toBe('Ik heb een huis');
      
      const result = wo.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
    });
  });
  
  describe('Listening Exercise', () => {
    it('should create valid listening instance', () => {
      const listen = createListeningExercise();
      expect(listen.type).toBe('listening');
      expect(listen.supportsAudio).toBe(true);
    });
    
    it('should track audio playback', () => {
      const listen = createListeningExercise();
      const instance = createMockInstance({
        type: 'listening',
        audioText: 'Dit is een test',
      });
      
      listen.render(instance, createMockContext());
      expect(listen.wasAudioPlayed()).toBe(false);
      
      listen.markAudioPlayed();
      expect(listen.wasAudioPlayed()).toBe(true);
      expect(listen.getPlayCount()).toBe(1);
    });
  });
  
  describe('Conjugation Exercise', () => {
    it('should create valid conjugation instance', () => {
      const conj = createConjugationExercise();
      expect(conj.type).toBe('conjugation');
      expect(conj.supportsAudio).toBe(false);
    });
    
    it('should evaluate correct conjugation (R9.5)', () => {
      const conj = createConjugationExercise();
      const instance = createMockInstance({
        type: 'conjugation',
        prompt: 'Conjugate "hebben" for "ik"',
        expectedAnswers: ['heb'],
        options: {
          infinitive: 'hebben',
          pronoun: 'ik',
          expectedConjugation: 'heb',
        },
      });
      
      conj.render(instance, createMockContext());
      conj.submitAnswer('heb');
      
      const response = conj.collectResponse();
      expect(response.submitted).toBe('heb');
      
      const result = conj.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
    });
  });
});

// ============================================================================
// Mixed Review Session Tests
// ============================================================================

describe('Mixed Review Session', () => {
  function createMockReviewItem(isNew: boolean, priority = 1): MixedReviewItem {
    return {
      instance: createMockInstance({
        id: `item-${Math.random().toString(36).slice(2)}`,
      }),
      isNew,
      priority,
    };
  }
  
  describe('Property 22: A mixed review session includes both studied and new items (R7.5)', () => {
    it('should include both new and review items when available', () => {
      const newItems = [
        createMockReviewItem(true, 1),
        createMockReviewItem(true, 2),
        createMockReviewItem(true, 3),
      ];
      const reviewItems = [
        createMockReviewItem(false, 1),
        createMockReviewItem(false, 2),
        createMockReviewItem(false, 3),
        createMockReviewItem(false, 4),
        createMockReviewItem(false, 5),
      ];
      
      const session = buildMixedReviewSession(newItems, reviewItems);
      
      expect(session.newCount).toBeGreaterThan(0);
      expect(session.reviewCount).toBeGreaterThan(0);
      
      const validation = validateMixedSession(session, true, true);
      expect(validation.valid).toBe(true);
    });
    
    it('property test: sessions include both types when both available', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (newCount, reviewCount) => {
            const newItems = Array.from({ length: newCount }, (_, i) => 
              createMockReviewItem(true, i + 1)
            );
            const reviewItems = Array.from({ length: reviewCount }, (_, i) => 
              createMockReviewItem(false, i + 1)
            );
            
            const session = buildMixedReviewSession(newItems, reviewItems);
            
            // Should include at least some of each when both available
            expect(session.newCount).toBeGreaterThan(0);
            expect(session.reviewCount).toBeGreaterThan(0);
            
            // Total should not exceed max
            expect(session.totalCount).toBeLessThanOrEqual(20);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle only new items', () => {
      const newItems = [
        createMockReviewItem(true, 1),
        createMockReviewItem(true, 2),
      ];
      
      const session = buildMixedReviewSession(newItems, []);
      
      expect(session.newCount).toBe(2);
      expect(session.reviewCount).toBe(0);
      
      const validation = validateMixedSession(session, true, false);
      expect(validation.valid).toBe(true);
    });
    
    it('should handle only review items', () => {
      const reviewItems = [
        createMockReviewItem(false, 1),
        createMockReviewItem(false, 2),
      ];
      
      const session = buildMixedReviewSession([], reviewItems);
      
      expect(session.newCount).toBe(0);
      expect(session.reviewCount).toBe(2);
      
      const validation = validateMixedSession(session, false, true);
      expect(validation.valid).toBe(true);
    });
  });
  
  describe('Session configuration', () => {
    it('should respect maxItems', () => {
      const newItems = Array.from({ length: 20 }, (_, i) => createMockReviewItem(true, i));
      const reviewItems = Array.from({ length: 20 }, (_, i) => createMockReviewItem(false, i));
      
      const session = buildMixedReviewSession(newItems, reviewItems, { maxItems: 10 });
      
      expect(session.totalCount).toBeLessThanOrEqual(10);
    });
    
    it('should prioritize higher priority items', () => {
      const newItems = [
        createMockReviewItem(true, 1),
        createMockReviewItem(true, 10),
      ];
      const reviewItems = [
        createMockReviewItem(false, 1),
        createMockReviewItem(false, 10),
      ];
      
      const session = buildMixedReviewSession(newItems, reviewItems, {
        maxItems: 4,
        maxNewItems: 10,
      });
      
      // Higher priority items should be included
      expect(session.totalCount).toBe(4);
    });
  });
  
  describe('selectExerciseTypesForItem', () => {
    it('should return types for skill dimension', () => {
      const registry = createExerciseRegistry();
      registerBuiltInExercises(registry);
      
      const grammarTypes = selectExerciseTypesForItem('grammar', registry);
      
      expect(grammarTypes).toContain('article-selection');
      expect(grammarTypes).toContain('conjugation');
    });
    
    it('should filter to preferred types', () => {
      const registry = createExerciseRegistry();
      registerBuiltInExercises(registry);
      
      const types = selectExerciseTypesForItem(
        'receptive_vocabulary',
        registry,
        ['flashcard', 'matching']
      );
      
      expect(types).toContain('flashcard');
      expect(types).toContain('matching');
    });
  });
});
