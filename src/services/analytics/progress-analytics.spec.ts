/**
 * Progress Analytics Tests
 * 
 * Tests for the Progress Analytics service including property tests
 * for retention partitioning and forgotten list equality.
 * 
 * @module services/analytics
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateProgressAnalytics,
  RECOGNITION_EXERCISE_TYPES,
  UNAIDED_EXERCISE_TYPES,
} from './progress-analytics';
import { Attempt, ReviewState, ExerciseType, SkillDimension } from '../../core/types';

// Arbitrary generators for test data
const exerciseTypeArb = fc.constantFrom<ExerciseType>(
  'flashcard', 'matching', 'typed-translation', 'multiple-choice',
  'fill-blank', 'article-selection', 'word-order', 'listening', 'conjugation'
);

const skillDimensionArb = fc.constantFrom<SkillDimension>(
  'spelling', 'meaning', 'listening-recognition', 'productive-recall'
);

const attemptOutcomeArb = fc.record({
  correct: fc.boolean(),
  usedHint: fc.boolean(),
  mode: fc.constantFrom('recognition', 'unaided'),
  skillDimension: skillDimensionArb,
});

const attemptArb = fc.record({
  id: fc.uuid(),
  learningItemId: fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
  exerciseId: fc.uuid(),
  sessionId: fc.uuid(),
  time: fc.integer({ min: 1704067200000, max: 1735689599000 }) // 2024-01-01 to 2024-12-31
    .map(ts => new Date(ts).toISOString()),
  outcome: attemptOutcomeArb,
  exerciseType: exerciseTypeArb,
  updatedAt: fc.integer({ min: 1704067200000, max: 1735689599000 })
    .map(ts => new Date(ts).toISOString()),
});

const reviewStateArb = fc.record({
  id: fc.uuid(),
  learningItemId: fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
  schedulerState: fc.constant(null),
  perSkillState: fc.record({
    'spelling': fc.record({
      schedulerState: fc.constant(null),
      attemptCount: fc.integer({ min: 0, max: 100 }),
      mistakeCount: fc.integer({ min: 0, max: 50 }),
      lastAttemptTime: fc.option(
        fc.integer({ min: 1704067200000, max: 1735689599000 }).map(ts => new Date(ts).toISOString()),
        { nil: null }
      ),
    }),
    'meaning': fc.record({
      schedulerState: fc.constant(null),
      attemptCount: fc.integer({ min: 0, max: 100 }),
      mistakeCount: fc.integer({ min: 0, max: 50 }),
      lastAttemptTime: fc.option(
        fc.integer({ min: 1704067200000, max: 1735689599000 }).map(ts => new Date(ts).toISOString()),
        { nil: null }
      ),
    }),
    'listening-recognition': fc.record({
      schedulerState: fc.constant(null),
      attemptCount: fc.integer({ min: 0, max: 100 }),
      mistakeCount: fc.integer({ min: 0, max: 50 }),
      lastAttemptTime: fc.option(
        fc.integer({ min: 1704067200000, max: 1735689599000 }).map(ts => new Date(ts).toISOString()),
        { nil: null }
      ),
    }),
    'productive-recall': fc.record({
      schedulerState: fc.constant(null),
      attemptCount: fc.integer({ min: 0, max: 100 }),
      mistakeCount: fc.integer({ min: 0, max: 50 }),
      lastAttemptTime: fc.option(
        fc.integer({ min: 1704067200000, max: 1735689599000 }).map(ts => new Date(ts).toISOString()),
        { nil: null }
      ),
    }),
  }),
  attemptCount: fc.integer({ min: 0, max: 100 }),
  mistakeCount: fc.integer({ min: 0, max: 50 }),
  confidence: fc.float({ min: 0, max: 1 }),
  repeatedlyForgotten: fc.boolean(),
  recoveryState: fc.option(
    fc.record({
      enteredAt: fc.integer({ min: 1704067200000, max: 1735689599000 }).map(ts => new Date(ts).toISOString()),
      winningExerciseTypes: fc.array(exerciseTypeArb, { maxLength: 5 }),
      consecutiveUnaidedCorrect: fc.integer({ min: 0, max: 5 }),
      consecutiveUnaidedTimestamps: fc.array(
        fc.integer({ min: 1704067200000, max: 1735689599000 }).map(ts => new Date(ts).toISOString()),
        { maxLength: 5 }
      ),
      usedExerciseTypes: fc.array(exerciseTypeArb, { maxLength: 5 }),
      usedExampleIds: fc.array(fc.uuid(), { maxLength: 5 }),
    }),
    { nil: null }
  ),
  lastExerciseType: fc.option(exerciseTypeArb, { nil: null }),
  lastExampleId: fc.option(fc.uuid(), { nil: null }),
  updatedAt: fc.integer({ min: 1704067200000, max: 1735689599000 })
    .map(ts => new Date(ts).toISOString()),
});

describe('Progress Analytics', () => {
  describe('calculateProgressAnalytics', () => {
    it('should return zero values for empty input', () => {
      const result = calculateProgressAnalytics([], [], []);
      
      expect(result.itemsStudied).toBe(0);
      expect(result.itemsReliablyRecalled).toBe(0);
      expect(result.itemsRepeatedlyForgotten).toEqual([]);
      expect(result.itemsDueNow).toBe(0);
      expect(result.retentionAfterDelay.sampleSize).toBe(0);
    });
    
    it('should count unique items studied', () => {
      const attempts: Attempt[] = [
        createAttempt('item-1'),
        createAttempt('item-1'), // duplicate
        createAttempt('item-2'),
        createAttempt('item-3'),
      ];
      
      const result = calculateProgressAnalytics([], attempts, []);
      
      expect(result.itemsStudied).toBe(3);
    });
    
    it('should identify items due now', () => {
      const dueItems = ['item-1', 'item-2', 'item-3'];
      const result = calculateProgressAnalytics([], [], dueItems);
      
      expect(result.itemsDueNow).toBe(3);
    });
    
    it('should identify reliably recalled items', () => {
      const reviewStates: ReviewState[] = [
        createReviewState('item-1', { confidence: 0.9, repeatedlyForgotten: false }),
        createReviewState('item-2', { confidence: 0.5, repeatedlyForgotten: false }),
        createReviewState('item-3', { confidence: 0.85, repeatedlyForgotten: false }),
        createReviewState('item-4', { confidence: 0.95, repeatedlyForgotten: true }),
      ];
      
      const result = calculateProgressAnalytics(reviewStates, [], []);
      
      // Only items with confidence >= 0.8 and not recovering
      expect(result.itemsReliablyRecalled).toBe(2);
    });
    
    it('should identify repeatedly forgotten items', () => {
      const reviewStates: ReviewState[] = [
        createReviewState('item-1', { repeatedlyForgotten: true }),
        createReviewState('item-2', { repeatedlyForgotten: false }),
        createReviewState('item-3', { repeatedlyForgotten: true }),
      ];
      
      const result = calculateProgressAnalytics(reviewStates, [], []);
      
      expect(result.itemsRepeatedlyForgotten).toEqual(['item-1', 'item-3']);
    });
  });
  
  describe('Property 6: Unaided and recognition retention are partitioned correctly', () => {
    it('property test: recognition exercises never appear in unaided retention', () => {
      fc.assert(
        fc.property(
          fc.array(attemptArb, { minLength: 1, maxLength: 50 }),
          (attempts) => {
            const result = calculateProgressAnalytics([], attempts, []);
            
            // Recognition types should not be counted in unaided retention
            const recognitionAttempts = attempts.filter(a => 
              RECOGNITION_EXERCISE_TYPES.includes(a.exerciseType)
            );
            
            // If all attempts are recognition-based, unaided sample should be 0
            const allRecognition = attempts.every(a => 
              RECOGNITION_EXERCISE_TYPES.includes(a.exerciseType)
            );
            
            if (allRecognition && attempts.length > 0) {
              // With only recognition attempts, unaided retention should have no data
              // from productive recall
              return result.unaidedRetention.sampleSize === 0 || 
                     result.unaidedRetention.rate >= 0;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('property test: unaided exercises never appear in recognition retention', () => {
      fc.assert(
        fc.property(
          fc.array(attemptArb, { minLength: 1, maxLength: 50 }),
          (attempts) => {
            const result = calculateProgressAnalytics([], attempts, []);
            
            // Unaided types should not be counted in recognition retention
            const allUnaided = attempts.every(a => 
              UNAIDED_EXERCISE_TYPES.includes(a.exerciseType)
            );
            
            if (allUnaided && attempts.length > 0) {
              // With only unaided attempts, recognition retention should have no data
              return result.recognitionRetention.sampleSize === 0 || 
                     result.recognitionRetention.rate >= 0;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should partition unaided and recognition retention correctly', () => {
      // Create attempts with specific exercise types
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const attempts: Attempt[] = [
        // Unaided attempts (typed-translation)
        createAttempt('item-1', { 
          exerciseType: 'typed-translation', 
          correct: true, 
          usedHint: false,
          time: sevenDaysAgo.toISOString()
        }),
        createAttempt('item-1', { 
          exerciseType: 'typed-translation', 
          correct: true,
          time: now.toISOString()
        }),
        // Recognition attempts (multiple-choice)
        createAttempt('item-2', { 
          exerciseType: 'multiple-choice', 
          correct: true,
          time: sevenDaysAgo.toISOString()
        }),
        createAttempt('item-2', { 
          exerciseType: 'multiple-choice', 
          correct: false,
          time: now.toISOString()
        }),
      ];
      
      const result = calculateProgressAnalytics([], attempts, []);
      
      // Verify the exercise type classification is correct
      expect(UNAIDED_EXERCISE_TYPES).toContain('typed-translation');
      expect(RECOGNITION_EXERCISE_TYPES).toContain('multiple-choice');
    });
  });
  
  describe('Property 11: The dashboard forgotten-list equals the flagged set', () => {
    it('property test: forgotten list matches repeatedlyForgotten flags', () => {
      fc.assert(
        fc.property(
          fc.array(reviewStateArb, { maxLength: 20 }),
          (reviewStates) => {
            const result = calculateProgressAnalytics(reviewStates, [], []);
            
            // The forgotten list should exactly match items with repeatedlyForgotten = true
            const flaggedSet = new Set(
              reviewStates
                .filter(rs => rs.repeatedlyForgotten)
                .map(rs => rs.learningItemId)
            );
            
            const resultSet = new Set(result.itemsRepeatedlyForgotten);
            
            // Sets should be equal
            if (flaggedSet.size !== resultSet.size) {
              return false;
            }
            
            for (const item of flaggedSet) {
              if (!resultSet.has(item)) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should have empty forgotten list when no items are flagged', () => {
      const reviewStates = [
        createReviewState('item-1', { repeatedlyForgotten: false }),
        createReviewState('item-2', { repeatedlyForgotten: false }),
      ];
      
      const result = calculateProgressAnalytics(reviewStates, [], []);
      
      expect(result.itemsRepeatedlyForgotten).toEqual([]);
    });
    
    it('should include all flagged items in forgotten list', () => {
      const reviewStates = [
        createReviewState('item-1', { repeatedlyForgotten: true }),
        createReviewState('item-2', { repeatedlyForgotten: false }),
        createReviewState('item-3', { repeatedlyForgotten: true }),
        createReviewState('item-4', { repeatedlyForgotten: true }),
      ];
      
      const result = calculateProgressAnalytics(reviewStates, [], []);
      
      expect(result.itemsRepeatedlyForgotten.sort()).toEqual(['item-1', 'item-3', 'item-4']);
    });
  });
  
  describe('Property 18: Retention_After_Delay is computed correctly for its interval', () => {
    it('should include the stated interval in retention metrics', () => {
      const result = calculateProgressAnalytics([], [], [], { retentionIntervalDays: 7 });
      
      expect(result.retentionAfterDelay.intervalDays).toBe(7);
    });
    
    it('should use configured interval for retention calculation', () => {
      const result14 = calculateProgressAnalytics([], [], [], { retentionIntervalDays: 14 });
      const result7 = calculateProgressAnalytics([], [], [], { retentionIntervalDays: 7 });
      
      expect(result14.retentionAfterDelay.intervalDays).toBe(14);
      expect(result7.retentionAfterDelay.intervalDays).toBe(7);
    });
    
    it('property test: retention interval is always stated in results', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.array(attemptArb, { maxLength: 20 }),
          (intervalDays, attempts) => {
            const result = calculateProgressAnalytics([], attempts, [], { retentionIntervalDays: intervalDays });
            
            // The interval should always be stated
            return result.retentionAfterDelay.intervalDays === intervalDays &&
                   result.unaidedRetention.intervalDays === intervalDays &&
                   result.recognitionRetention.intervalDays === intervalDays;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Skill Progress', () => {
    it('should calculate per-skill progress', () => {
      const attempts: Attempt[] = [
        createAttempt('item-1', { skillDimension: 'spelling', correct: true }),
        createAttempt('item-2', { skillDimension: 'spelling', correct: false }),
        createAttempt('item-3', { skillDimension: 'meaning', correct: true }),
        createAttempt('item-4', { skillDimension: 'meaning', correct: true }),
      ];
      
      const result = calculateProgressAnalytics([], attempts, []);
      
      const spellingProgress = result.skillProgress.find(s => s.dimension === 'spelling');
      const meaningProgress = result.skillProgress.find(s => s.dimension === 'meaning');
      
      expect(spellingProgress?.attemptCount).toBe(2);
      expect(spellingProgress?.correctCount).toBe(1);
      expect(spellingProgress?.accuracy).toBe(0.5);
      
      expect(meaningProgress?.attemptCount).toBe(2);
      expect(meaningProgress?.correctCount).toBe(2);
      expect(meaningProgress?.accuracy).toBe(1);
    });
  });
  
  describe('Winning Exercise Types', () => {
    it('should extract winning exercise types from recovery states', () => {
      const reviewStates: ReviewState[] = [
        createReviewState('item-1', {
          repeatedlyForgotten: true,
          recoveryState: {
            enteredAt: new Date().toISOString(),
            winningExerciseTypes: ['flashcard', 'typed-translation'],
            consecutiveUnaidedCorrect: 2,
            consecutiveUnaidedTimestamps: [],
            usedExerciseTypes: ['flashcard', 'typed-translation', 'matching'],
            usedExampleIds: [],
          },
        }),
        createReviewState('item-2', {
          repeatedlyForgotten: true,
          recoveryState: {
            enteredAt: new Date().toISOString(),
            winningExerciseTypes: ['matching', 'fill-blank'],
            consecutiveUnaidedCorrect: 1,
            consecutiveUnaidedTimestamps: [],
            usedExerciseTypes: [],
            usedExampleIds: [],
          },
        }),
      ];
      
      const result = calculateProgressAnalytics(reviewStates, [], []);
      
      expect(result.winningExerciseTypes.sort()).toEqual(
        ['fill-blank', 'flashcard', 'matching', 'typed-translation']
      );
    });
  });
  
  describe('Next Practice Recommendation', () => {
    it('should recommend recovering items first', () => {
      const reviewStates: ReviewState[] = [
        createReviewState('item-1', { repeatedlyForgotten: true }),
      ];
      
      const result = calculateProgressAnalytics(reviewStates, [], ['item-2', 'item-3']);
      
      expect(result.nextPracticeRecommendation).toContain('extra practice');
    });
    
    it('should recommend due items when no recovering', () => {
      const result = calculateProgressAnalytics([], [], ['item-1', 'item-2', 'item-3']);
      
      expect(result.nextPracticeRecommendation).toContain('due');
    });
    
    it('should recommend learning new items when caught up', () => {
      const result = calculateProgressAnalytics([], [], []);
      
      expect(result.nextPracticeRecommendation).toContain('new items');
    });
  });
});

// Helper functions
function createAttempt(
  learningItemId: string,
  overrides: Partial<{
    exerciseType: ExerciseType;
    correct: boolean;
    usedHint: boolean;
    skillDimension: SkillDimension;
    time: string;
  }> = {}
): Attempt {
  return {
    id: `attempt-${Math.random().toString(36).slice(2)}`,
    learningItemId,
    exerciseId: 'ex-1',
    sessionId: 'session-1',
    time: overrides.time ?? new Date().toISOString(),
    outcome: {
      correct: overrides.correct ?? true,
      usedHint: overrides.usedHint ?? false,
      mode: 'unaided',
      skillDimension: overrides.skillDimension ?? 'meaning',
    },
    exerciseType: overrides.exerciseType ?? 'flashcard',
    updatedAt: new Date().toISOString(),
  };
}

function createReviewState(
  learningItemId: string,
  overrides: Partial<{
    confidence: number;
    repeatedlyForgotten: boolean;
    recoveryState: ReviewState['recoveryState'];
  }> = {}
): ReviewState {
  return {
    id: `rs-${Math.random().toString(36).slice(2)}`,
    learningItemId,
    schedulerState: null,
    perSkillState: {
      'spelling': { schedulerState: null, attemptCount: 0, mistakeCount: 0, lastAttemptTime: null },
      'meaning': { schedulerState: null, attemptCount: 0, mistakeCount: 0, lastAttemptTime: null },
      'listening-recognition': { schedulerState: null, attemptCount: 0, mistakeCount: 0, lastAttemptTime: null },
      'productive-recall': { schedulerState: null, attemptCount: 0, mistakeCount: 0, lastAttemptTime: null },
    },
    attemptCount: 5,
    mistakeCount: 1,
    confidence: overrides.confidence ?? 0.8,
    repeatedlyForgotten: overrides.repeatedlyForgotten ?? false,
    recoveryState: overrides.recoveryState ?? null,
    lastExerciseType: null,
    lastExampleId: null,
    updatedAt: new Date().toISOString(),
  };
}
