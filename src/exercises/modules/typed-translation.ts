/**
 * Typed Translation Exercise Module
 * 
 * User types the translation of a word or phrase.
 * Supports target→native and native→target directions.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6
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
  ExerciseFeedback,
} from '../exercise-contract';
import { SkillDimension, ExerciseType, AttemptOutcomeResult, TolerancePolicy } from '../../core/types';
import { createAnswerValidator } from '../../core/answer-validator';

export class TypedTranslationExercise extends BaseExerciseModule {
  readonly type: ExerciseType = 'typed-translation';
  readonly name = 'Typed Translation';
  readonly description = 'Type the translation of a word or phrase';
  readonly objective = 'vocabulary';
  readonly applicableSkillDimensions: readonly SkillDimension[] = [
    'productive_vocabulary',
    'receptive_vocabulary',
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
      ariaLabel: `Translation: ${instance.prompt}`,
      ariaDescription: 'Type your translation in the input field',
      keyboardNavigable: true,
      touchTargetCompliant: true,
      screenReaderInstructions: 'Type the translation of the word or phrase shown',
    };
  }
}

export function createTypedTranslationExercise(): TypedTranslationExercise {
  return new TypedTranslationExercise();
}
