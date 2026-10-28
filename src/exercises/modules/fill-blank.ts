/**
 * Fill-in-the-blank Exercise Module
 * 
 * Complete sentences with missing words.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 8.4
 * Design: Exercise module contract
 * 
 * @module exercises/modules
 */

import {
  BaseExerciseModule,
  ExerciseInstance,
  ExerciseResponse,
  EvaluationResult,
  RenderContext,
  ExerciseAccessibility,
} from '../exercise-contract';
import { SkillDimension, ExerciseType, AttemptOutcomeResult, TolerancePolicy } from '../../core/types';
import { createAnswerValidator } from '../../core/answer-validator';

export class FillBlankExercise extends BaseExerciseModule {
  readonly type: ExerciseType = 'fill-blank';
  readonly name = 'Fill in the Blank';
  readonly description = 'Complete sentences with the missing word or phrase';
  readonly objective = 'grammar';
  readonly applicableSkillDimensions: readonly SkillDimension[] = [
    'productive_vocabulary',
    'grammar',
  ];
  readonly supportsAudio = false;
  
  private tolerancePolicy: Partial<TolerancePolicy> = {};
  
  render(instance: ExerciseInstance, context: RenderContext): () => void {
    this.reset();
    this.startTimer();
    
    // Adjust tolerance based on graded objective
    this.tolerancePolicy = {};
    if (instance.gradedObjective === 'spelling') {
      this.tolerancePolicy.ignoreCase = false;
    }
    if (instance.gradedObjective === 'accents') {
      this.tolerancePolicy.ignoreAccents = false;
    }
    
    return () => {
      this.reset();
    };
  }
  
  evaluate(response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult {
    const validator = createAnswerValidator();
    
    const allAnswers = [
      ...instance.expectedAnswers,
      ...(instance.alternatives ?? []),
    ];
    
    const result = validator.validate({
      submitted: response.submitted,
      acceptedAnswers: allAnswers,
      policy: {
        ignoreCase: this.tolerancePolicy.ignoreCase ?? true,
        ignoreAccents: this.tolerancePolicy.ignoreAccents ?? true,
        ignorePunctuationWhitespace: true,
        freeWordOrder: false,
        acceptInflectionsContractions: true,
      },
      gradedObjective: instance.gradedObjective,
    });
    
    let outcome: AttemptOutcomeResult;
    if (result.correct) {
      outcome = response.hintUsed ? 'correct-with-hint' : 'correct-unaided';
    } else {
      outcome = 'incorrect';
    }
    
    return {
      correct: result.correct,
      outcome,
      correctAnswers: instance.expectedAnswers,
      matchScore: result.correct ? 1.0 : 0,
    };
  }
  
  submitAnswer(answer: string): void {
    this.setSubmitted(answer);
  }
  
  useHint(): void {
    this.setHintUsed(true);
  }
  
  override accessibility(
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseAccessibility {
    return {
      ariaLabel: `Fill in the blank: ${instance.prompt}`,
      ariaDescription: 'Type the missing word in the blank',
      keyboardNavigable: true,
      touchTargetCompliant: true,
      screenReaderInstructions: 'Read the sentence and type the missing word or phrase',
    };
  }
}

export function createFillBlankExercise(): FillBlankExercise {
  return new FillBlankExercise();
}
