/**
 * Multiple Choice Exercise Module
 * 
 * Select the correct answer from multiple options.
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
} from '../exercise-contract';
import { SkillDimension, ExerciseType, AttemptOutcomeResult } from '../../core/types';

export interface MultipleChoiceOptions {
  choices: string[];
  correctIndex: number;
}

export class MultipleChoiceExercise extends BaseExerciseModule {
  readonly type: ExerciseType = 'multiple-choice';
  readonly name = 'Multiple Choice';
  readonly description = 'Select the correct answer from multiple options';
  readonly objective = 'vocabulary';
  readonly applicableSkillDimensions: readonly SkillDimension[] = [
    'receptive_vocabulary',
    'productive_vocabulary',
    'grammar',
  ];
  readonly supportsAudio = true;
  
  private selectedIndex: number | null = null;
  private options: MultipleChoiceOptions | null = null;
  
  render(instance: ExerciseInstance, context: RenderContext): () => void {
    this.reset();
    this.startTimer();
    this.selectedIndex = null;
    this.options = instance.options as unknown as MultipleChoiceOptions | null;
    
    return () => {
      this.reset();
      this.options = null;
    };
  }
  
  evaluate(response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult {
    const options = instance.options as MultipleChoiceOptions | undefined;
    
    if (!options || this.selectedIndex === null) {
      return {
        correct: false,
        outcome: 'incorrect',
        correctAnswers: instance.expectedAnswers,
      };
    }
    
    const isCorrect = this.selectedIndex === options.correctIndex;
    
    // Multiple choice is recognition-based
    const outcome: AttemptOutcomeResult = isCorrect
      ? (response.hintUsed ? 'correct-with-hint' : 'correct-recognition')
      : 'incorrect';
    
    return {
      correct: isCorrect,
      outcome,
      correctAnswers: [options.choices[options.correctIndex]],
    };
  }
  
  selectOption(index: number): void {
    this.selectedIndex = index;
    if (this.options && index >= 0 && index < this.options.choices.length) {
      this.setSubmitted(this.options.choices[index]);
    }
  }
  
  getSelectedIndex(): number | null {
    return this.selectedIndex;
  }
  
  override accessibility(
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseAccessibility {
    const options = instance.options as MultipleChoiceOptions | undefined;
    const choiceCount = options?.choices.length ?? 0;
    
    return {
      ariaLabel: `Multiple choice: ${instance.prompt}`,
      ariaDescription: `Select the correct answer from ${choiceCount} options`,
      keyboardNavigable: true,
      touchTargetCompliant: true,
      screenReaderInstructions: 'Use arrow keys to navigate options, Enter to select',
    };
  }
}

export function createMultipleChoiceExercise(): MultipleChoiceExercise {
  return new MultipleChoiceExercise();
}
