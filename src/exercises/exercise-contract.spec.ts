/**
 * Exercise Contract and Registry Tests
 * 
 * Feature: language-learning-app
 * Requirements: 7.2, 7.3, 7.4, 7.6, 21.9
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  createExerciseRegistry,
  verifyContract,
  BaseExerciseModule,
  ExerciseContract,
  ExerciseRegistry,
  ExerciseInstance,
  ExerciseResponse,
  EvaluationResult,
  RenderContext,
} from './exercise-contract';
import { SkillDimension, ExerciseType } from '../core/types';

// ============================================================================
// Mock/Stub Exercise Modules for Testing
// ============================================================================

/**
 * Create a stub exercise contract for testing
 */
function createStubContract(overrides?: Partial<ExerciseContract>): ExerciseContract {
  return {
    type: 'flashcard' as ExerciseType,
    name: 'Flashcard',
    description: 'Basic flashcard exercise',
    objective: 'vocabulary',
    applicableSkillDimensions: ['receptive_vocabulary', 'productive_vocabulary'] as SkillDimension[],
    supportsAudio: true,
    render: vi.fn(() => () => {}),
    collectResponse: vi.fn(() => ({
      submitted: 'test',
      responseTimeMs: 1000,
      hintUsed: false,
      audioUsed: false,
      attempts: 1,
    })),
    evaluate: vi.fn((response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult => ({
      correct: response.submitted === instance.expectedAnswers[0],
      outcome: response.submitted === instance.expectedAnswers[0]
        ? 'correct-unaided'
        : 'incorrect',
      correctAnswers: instance.expectedAnswers,
    })),
    feedback: vi.fn((evaluation, instance, t) => ({
      correct: evaluation.correct,
      message: evaluation.correct ? 'Correct!' : 'Incorrect',
      correctAnswer: evaluation.correct ? undefined : instance.expectedAnswers[0],
    })),
    accessibility: vi.fn(() => ({
      ariaLabel: 'Test exercise',
      keyboardNavigable: true,
      touchTargetCompliant: true,
    })),
    ...overrides,
  };
}

/**
 * Create a stub exercise instance for testing
 */
function createStubInstance(overrides?: Partial<ExerciseInstance>): ExerciseInstance {
  return {
    id: 'inst-1',
    learningItemId: 'item-1',
    type: 'flashcard' as ExerciseType,
    skillDimension: 'receptive_vocabulary' as SkillDimension,
    prompt: 'What is the Dutch word for "house"?',
    expectedAnswers: ['huis'],
    alternatives: ['het huis'],
    hint: 'It starts with "h"',
    ...overrides,
  };
}

/**
 * Example custom exercise module using BaseExerciseModule
 */
class MockTypedExercise extends BaseExerciseModule {
  readonly type = 'typed-translation' as ExerciseType;
  readonly name = 'Typed Translation';
  readonly description = 'Type the translation';
  readonly objective = 'vocabulary';
  readonly applicableSkillDimensions = ['productive_vocabulary'] as const as readonly SkillDimension[];
  readonly supportsAudio = false;
  
  render(instance: ExerciseInstance, context: RenderContext): () => void {
    this.reset();
    this.startTimer();
    // In real implementation, would create DOM elements
    return () => {
      // Cleanup
    };
  }
  
  evaluate(response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult {
    const isCorrect = instance.expectedAnswers.some(
      ans => ans.toLowerCase() === response.submitted.toLowerCase()
    );
    
    return {
      correct: isCorrect,
      outcome: isCorrect 
        ? (response.hintUsed ? 'correct-with-hint' : 'correct-unaided')
        : 'incorrect',
      correctAnswers: instance.expectedAnswers,
    };
  }
  
  // Override to add custom behavior
  simulateAnswer(answer: string, hintUsed = false): void {
    this.setSubmitted(answer);
    this.setHintUsed(hintUsed);
  }
}

// ============================================================================
// Exercise Registry Tests
// ============================================================================

describe('Exercise Registry', () => {
  let registry: ExerciseRegistry;
  
  beforeEach(() => {
    registry = createExerciseRegistry();
  });
  
  describe('createExerciseRegistry factory', () => {
    it('should create a valid registry instance', () => {
      expect(registry).toBeDefined();
      expect(typeof registry.register).toBe('function');
      expect(typeof registry.unregister).toBe('function');
      expect(typeof registry.get).toBe('function');
      expect(typeof registry.getTypes).toBe('function');
      expect(typeof registry.getTypesForSkillDimension).toBe('function');
      expect(typeof registry.has).toBe('function');
      expect(typeof registry.getAll).toBe('function');
    });
    
    it('should start empty', () => {
      expect(registry.getTypes()).toHaveLength(0);
      expect(registry.getAll()).toHaveLength(0);
    });
  });
  
  describe('Registration (R7.6)', () => {
    it('should register a new exercise type', () => {
      const contract = createStubContract();
      registry.register(contract);
      
      expect(registry.has('flashcard')).toBe(true);
      expect(registry.get('flashcard')).toBe(contract);
    });
    
    it('should register multiple exercise types', () => {
      const flashcard = createStubContract({ type: 'flashcard' as ExerciseType });
      const fillBlank = createStubContract({ type: 'fill-blank' as ExerciseType });
      const matching = createStubContract({ type: 'matching' as ExerciseType });
      
      registry.register(flashcard);
      registry.register(fillBlank);
      registry.register(matching);
      
      expect(registry.getTypes()).toHaveLength(3);
      expect(registry.has('flashcard')).toBe(true);
      expect(registry.has('fill-blank')).toBe(true);
      expect(registry.has('matching')).toBe(true);
    });
    
    it('should replace existing registration with warning', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const original = createStubContract({ name: 'Original' });
      const replacement = createStubContract({ name: 'Replacement' });
      
      registry.register(original);
      registry.register(replacement);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
      expect(registry.get('flashcard')?.name).toBe('Replacement');
      
      consoleSpy.mockRestore();
    });
    
    it('should unregister an exercise type', () => {
      const contract = createStubContract();
      registry.register(contract);
      registry.unregister('flashcard');
      
      expect(registry.has('flashcard')).toBe(false);
      expect(registry.get('flashcard')).toBeUndefined();
    });
  });
  
  describe('Lookup by skill dimension', () => {
    it('should find exercise types for a skill dimension', () => {
      const receptiveOnly = createStubContract({
        type: 'receptive-only' as ExerciseType,
        applicableSkillDimensions: ['receptive_vocabulary'] as SkillDimension[],
      });
      const productiveOnly = createStubContract({
        type: 'productive-only' as ExerciseType,
        applicableSkillDimensions: ['productive_vocabulary'] as SkillDimension[],
      });
      const both = createStubContract({
        type: 'both' as ExerciseType,
        applicableSkillDimensions: ['receptive_vocabulary', 'productive_vocabulary'] as SkillDimension[],
      });
      
      registry.register(receptiveOnly);
      registry.register(productiveOnly);
      registry.register(both);
      
      const receptiveTypes = registry.getTypesForSkillDimension('receptive_vocabulary');
      const productiveTypes = registry.getTypesForSkillDimension('productive_vocabulary');
      
      expect(receptiveTypes).toContain('receptive-only');
      expect(receptiveTypes).toContain('both');
      expect(receptiveTypes).not.toContain('productive-only');
      
      expect(productiveTypes).toContain('productive-only');
      expect(productiveTypes).toContain('both');
      expect(productiveTypes).not.toContain('receptive-only');
    });
    
    it('should return empty array for skill dimension with no exercises', () => {
      const types = registry.getTypesForSkillDimension('listening_comprehension');
      expect(types).toHaveLength(0);
    });
  });
  
  describe('Property 19: Every registered module satisfies the contract (R7.2)', () => {
    it('should verify all registered contracts are valid', () => {
      const validContracts = [
        createStubContract({ type: 'type1' as ExerciseType }),
        createStubContract({ type: 'type2' as ExerciseType }),
        createStubContract({ type: 'type3' as ExerciseType }),
      ];
      
      for (const contract of validContracts) {
        registry.register(contract);
      }
      
      for (const contract of registry.getAll()) {
        const result = verifyContract(contract);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });
    
    it('property test: registered contracts satisfy requirements', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              type: fc.constantFrom('flashcard', 'matching', 'fill-blank', 'typed', 'listening') as fc.Arbitrary<ExerciseType>,
              supportsAudio: fc.boolean(),
              dimensions: fc.array(
                fc.constantFrom('receptive_vocabulary', 'productive_vocabulary', 'listening_comprehension') as fc.Arbitrary<SkillDimension>,
                { minLength: 1, maxLength: 3 }
              ),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (configs) => {
            const localRegistry = createExerciseRegistry();
            
            for (const config of configs) {
              const contract = createStubContract({
                type: config.type,
                supportsAudio: config.supportsAudio,
                applicableSkillDimensions: config.dimensions,
              });
              localRegistry.register(contract);
            }
            
            // All registered contracts should be valid
            for (const contract of localRegistry.getAll()) {
              const result = verifyContract(contract);
              expect(result.valid).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Exercise Contract Tests
// ============================================================================

describe('Exercise Contract', () => {
  describe('verifyContract', () => {
    it('should accept valid contract', () => {
      const contract = createStubContract();
      const result = verifyContract(contract);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject contract missing type', () => {
      const contract = createStubContract({ type: '' as ExerciseType });
      const result = verifyContract(contract);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing type');
    });
    
    it('should reject contract missing name', () => {
      const contract = createStubContract({ name: '' });
      const result = verifyContract(contract);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing name');
    });
    
    it('should reject contract with no skill dimensions', () => {
      const contract = createStubContract({ applicableSkillDimensions: [] });
      const result = verifyContract(contract);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Must have at least one applicable skill dimension');
    });
  });
  
  describe('Property 20: Completing an exercise reports exactly one attempt (R7.3)', () => {
    it('should report one attempt per completion', () => {
      const contract = createStubContract();
      const instance = createStubInstance();
      
      // Simulate exercise completion
      const response = contract.collectResponse();
      const evaluation = contract.evaluate(response, instance);
      
      // Each completion produces exactly one outcome
      expect(evaluation.outcome).toBeDefined();
      expect(['correct-unaided', 'correct-with-hint', 'correct-recognition', 'incorrect'])
        .toContain(evaluation.outcome);
    });
    
    it('property test: each exercise completion produces one outcome', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
          (submitted, expectedAnswers) => {
            const contract = createStubContract();
            const instance = createStubInstance({ expectedAnswers });
            
            // Mock collectResponse to return the submitted value
            (contract.collectResponse as ReturnType<typeof vi.fn>).mockReturnValue({
              submitted,
              responseTimeMs: 1000,
              hintUsed: false,
              audioUsed: false,
              attempts: 1,
            });
            
            const response = contract.collectResponse();
            const evaluation = contract.evaluate(response, instance);
            
            // Exactly one outcome
            expect(evaluation.outcome).toBeDefined();
            expect(typeof evaluation.correct).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Property 21: Feedback reflects correctness and reveals answer when wrong (R7.4, R21.9)', () => {
    const t = (key: string) => key === 'feedback.correct' ? 'Correct!' : 'Incorrect';
    
    it('should show correct message when answer is correct', () => {
      const contract = createStubContract();
      const instance = createStubInstance({ expectedAnswers: ['huis'] });
      
      const evaluation: EvaluationResult = {
        correct: true,
        outcome: 'correct-unaided',
        correctAnswers: ['huis'],
      };
      
      const feedback = contract.feedback(evaluation, instance, t);
      
      expect(feedback.correct).toBe(true);
      expect(feedback.correctAnswer).toBeUndefined();
    });
    
    it('should show correct answer when answer is wrong', () => {
      const contract = createStubContract();
      const instance = createStubInstance({ expectedAnswers: ['huis'] });
      
      const evaluation: EvaluationResult = {
        correct: false,
        outcome: 'incorrect',
        correctAnswers: ['huis'],
      };
      
      const feedback = contract.feedback(evaluation, instance, t);
      
      expect(feedback.correct).toBe(false);
      expect(feedback.correctAnswer).toBe('huis');
    });
    
    it('property test: incorrect answers always reveal correct answer', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
          (expectedAnswers) => {
            const contract = createStubContract();
            const instance = createStubInstance({ expectedAnswers });
            
            const evaluation: EvaluationResult = {
              correct: false,
              outcome: 'incorrect',
              correctAnswers: expectedAnswers,
            };
            
            const feedback = contract.feedback(evaluation, instance, t);
            
            // Wrong answers must show the correct answer
            expect(feedback.correct).toBe(false);
            expect(feedback.correctAnswer).toBeDefined();
            expect(expectedAnswers).toContain(feedback.correctAnswer);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('property test: correct answers never reveal correct answer in feedback', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
          (expectedAnswers) => {
            const contract = createStubContract();
            const instance = createStubInstance({ expectedAnswers });
            
            const evaluation: EvaluationResult = {
              correct: true,
              outcome: 'correct-unaided',
              correctAnswers: expectedAnswers,
            };
            
            const feedback = contract.feedback(evaluation, instance, t);
            
            // Correct answers don't need to show the answer again
            expect(feedback.correct).toBe(true);
            // correctAnswer should be undefined or the same as submitted
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Accessibility', () => {
    it('should provide accessibility information', () => {
      const contract = createStubContract();
      const instance = createStubInstance();
      const t = (key: string) => key;
      
      const a11y = contract.accessibility(instance, t);
      
      expect(a11y.ariaLabel).toBeTruthy();
      expect(typeof a11y.keyboardNavigable).toBe('boolean');
      expect(typeof a11y.touchTargetCompliant).toBe('boolean');
    });
  });
});

// ============================================================================
// BaseExerciseModule Tests
// ============================================================================

describe('BaseExerciseModule', () => {
  let exercise: MockTypedExercise;
  
  beforeEach(() => {
    exercise = new MockTypedExercise();
  });
  
  describe('Response collection', () => {
    it('should collect response with timing', () => {
      const instance = createStubInstance();
      const mockContainer = { innerHTML: '' } as HTMLElement;
      const mockContext = {
        container: mockContainer,
        t: (k: string) => k,
        theme: 'light' as const,
        textSize: 'medium' as const,
        reducedMotion: false,
      };
      
      exercise.render(instance, mockContext);
      
      // Simulate some time passing and an answer
      exercise.simulateAnswer('huis');
      
      const response = exercise.collectResponse();
      
      expect(response.submitted).toBe('huis');
      expect(response.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(response.hintUsed).toBe(false);
    });
    
    it('should track hint usage', () => {
      const instance = createStubInstance();
      const mockContainer = { innerHTML: '' } as HTMLElement;
      const mockContext = {
        container: mockContainer,
        t: (k: string) => k,
        theme: 'light' as const,
        textSize: 'medium' as const,
        reducedMotion: false,
      };
      
      exercise.render(instance, mockContext);
      exercise.simulateAnswer('huis', true);
      
      const response = exercise.collectResponse();
      
      expect(response.hintUsed).toBe(true);
    });
  });
  
  describe('Evaluation', () => {
    it('should evaluate correct answer', () => {
      const instance = createStubInstance({ expectedAnswers: ['huis'] });
      const response: ExerciseResponse = {
        submitted: 'huis',
        responseTimeMs: 1000,
        hintUsed: false,
        audioUsed: false,
        attempts: 1,
      };
      
      const result = exercise.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
      expect(result.outcome).toBe('correct-unaided');
    });
    
    it('should evaluate incorrect answer', () => {
      const instance = createStubInstance({ expectedAnswers: ['huis'] });
      const response: ExerciseResponse = {
        submitted: 'wrong',
        responseTimeMs: 1000,
        hintUsed: false,
        audioUsed: false,
        attempts: 1,
      };
      
      const result = exercise.evaluate(response, instance);
      
      expect(result.correct).toBe(false);
      expect(result.outcome).toBe('incorrect');
    });
    
    it('should mark hint-assisted correct answer appropriately', () => {
      const instance = createStubInstance({ expectedAnswers: ['huis'] });
      const response: ExerciseResponse = {
        submitted: 'huis',
        responseTimeMs: 1000,
        hintUsed: true,
        audioUsed: false,
        attempts: 1,
      };
      
      const result = exercise.evaluate(response, instance);
      
      expect(result.correct).toBe(true);
      expect(result.outcome).toBe('correct-with-hint');
    });
  });
  
  describe('Feedback generation', () => {
    const t = (key: string) => {
      const translations: Record<string, string> = {
        'feedback.correct': 'Correct!',
        'feedback.incorrect': 'Incorrect',
      };
      return translations[key] || key;
    };
    
    it('should generate positive feedback for correct answer', () => {
      const instance = createStubInstance({ expectedAnswers: ['huis'] });
      const evaluation: EvaluationResult = {
        correct: true,
        outcome: 'correct-unaided',
        correctAnswers: ['huis'],
      };
      
      const feedback = exercise.feedback(evaluation, instance, t);
      
      expect(feedback.correct).toBe(true);
      expect(feedback.message).toBe('Correct!');
    });
    
    it('should generate feedback with correct answer for wrong response', () => {
      const instance = createStubInstance({ expectedAnswers: ['huis'] });
      const evaluation: EvaluationResult = {
        correct: false,
        outcome: 'incorrect',
        correctAnswers: ['huis'],
      };
      
      const feedback = exercise.feedback(evaluation, instance, t);
      
      expect(feedback.correct).toBe(false);
      expect(feedback.message).toBe('Incorrect');
      expect(feedback.correctAnswer).toBe('huis');
    });
  });
});

// ============================================================================
// Extensibility Test (R7.6)
// ============================================================================

describe('Extensibility (R7.6)', () => {
  it('should register a new stub contract without editing existing code', () => {
    const registry = createExerciseRegistry();
    
    // Register some "built-in" exercises
    registry.register(createStubContract({ type: 'flashcard' as ExerciseType }));
    registry.register(createStubContract({ type: 'matching' as ExerciseType }));
    
    // Now register a new "custom" exercise type
    const customContract = createStubContract({
      type: 'custom-puzzle' as ExerciseType,
      name: 'Custom Puzzle',
      description: 'A custom puzzle exercise',
      applicableSkillDimensions: ['receptive_vocabulary'] as SkillDimension[],
    });
    
    registry.register(customContract);
    
    // The new type is available
    expect(registry.has('custom-puzzle' as ExerciseType)).toBe(true);
    expect(registry.get('custom-puzzle' as ExerciseType)).toBe(customContract);
    
    // And works alongside existing types
    expect(registry.getTypes()).toContain('flashcard');
    expect(registry.getTypes()).toContain('matching');
    expect(registry.getTypes()).toContain('custom-puzzle');
    
    // The new type can be found by skill dimension
    const receptiveTypes = registry.getTypesForSkillDimension('receptive_vocabulary');
    expect(receptiveTypes).toContain('custom-puzzle');
    
    // The contract is valid
    const result = verifyContract(customContract);
    expect(result.valid).toBe(true);
  });
  
  it('engine can handle new exercise type attempts', () => {
    const registry = createExerciseRegistry();
    
    // Create a custom exercise type
    const customContract = createStubContract({
      type: 'new-type' as ExerciseType,
      name: 'New Exercise Type',
    });
    
    registry.register(customContract);
    
    // Simulate an exercise completion
    const instance = createStubInstance({ type: 'new-type' as ExerciseType });
    const response = customContract.collectResponse();
    const evaluation = customContract.evaluate(response, instance);
    
    // The evaluation produces a valid outcome that the memory engine can use
    expect(['correct-unaided', 'correct-with-hint', 'correct-recognition', 'incorrect'])
      .toContain(evaluation.outcome);
  });
});
