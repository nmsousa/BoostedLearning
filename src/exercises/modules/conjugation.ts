/**
 * Conjugation Exercise Module
 * 
 * Practice verb conjugations for different pronouns/tenses.
 * Validates against recorded Dutch GRAMMAR_INFO.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 9.4, 9.5
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
import { SkillDimension, ExerciseType, AttemptOutcomeResult } from '../../core/types';
import { createAnswerValidator } from '../../core/answer-validator';

export interface ConjugationOptions {
  infinitive: string;
  pronoun: string;
  expectedConjugation: string;
  tense?: 'present' | 'past' | 'future';
}

export class ConjugationExercise extends BaseExerciseModule {
  readonly type: ExerciseType = 'conjugation';
  readonly name = 'Verb Conjugation';
  readonly description = 'Conjugate verbs for different pronouns and tenses';
  readonly objective = 'grammar';
  readonly applicableSkillDimensions: readonly SkillDimension[] = [
    'grammar',
  ];
  readonly supportsAudio = false;
  
  render(instance: ExerciseInstance, context: RenderContext): () => void {
    this.reset();
    this.startTimer();
    
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
        ignoreCase: true,
        ignoreAccents: true,
        ignorePunctuationWhitespace: true,
        freeWordOrder: false,
        acceptInflectionsContractions: true,
      },
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
    const options = instance.options as ConjugationOptions | undefined;
    const pronoun = options?.pronoun ?? 'unknown';
    
    return {
      ariaLabel: `Conjugation: ${instance.prompt}`,
      ariaDescription: `Conjugate the verb for "${pronoun}"`,
      keyboardNavigable: true,
      touchTargetCompliant: true,
      screenReaderInstructions: 'Type the correct conjugation of the verb',
    };
  }
}

export function createConjugationExercise(): ConjugationExercise {
  return new ConjugationExercise();
}
