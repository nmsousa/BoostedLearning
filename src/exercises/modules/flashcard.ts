/**
 * Flashcard Exercise Module
 * 
 * Basic flashcard with configurable reveal and hints.
 * Shows a prompt and expects the user to recall the answer.
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
import { createAnswerValidator } from '../../core/answer-validator';

export class FlashcardExercise extends BaseExerciseModule {
  readonly type: ExerciseType = 'flashcard';
  readonly name = 'Flashcard';
  readonly description = 'Show a word or phrase and recall its meaning';
  readonly objective = 'vocabulary';
  readonly applicableSkillDimensions: readonly SkillDimension[] = [
    'receptive_vocabulary',
    'productive_vocabulary',
  ];
  readonly supportsAudio = true;
  
  private revealed = false;
  private selfAssessedCorrect: boolean | null = null;
  
  render(instance: ExerciseInstance, context: RenderContext): () => void {
    this.reset();
    this.startTimer();
    this.revealed = false;
    this.selfAssessedCorrect = null;
    
    // In a real implementation, this would create DOM elements
    // For now, we track state that would be populated by UI interactions
    
    return () => {
      // Cleanup
      this.reset();
    };
  }
  
  evaluate(response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult {
    // Flashcards use self-assessment in recognition mode
    if (this.selfAssessedCorrect !== null) {
      return {
        correct: this.selfAssessedCorrect,
        outcome: this.selfAssessedCorrect ? 'correct-recognition' : 'incorrect',
        correctAnswers: instance.expectedAnswers,
      };
    }
    
    // If user typed an answer, validate it
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
  
  // For UI interaction - reveal the answer
  reveal(): void {
    this.revealed = true;
  }
  
  isRevealed(): boolean {
    return this.revealed;
  }
  
  // For self-assessment mode
  markCorrect(): void {
    this.selfAssessedCorrect = true;
  }
  
  markIncorrect(): void {
    this.selfAssessedCorrect = false;
  }
  
  // For typed response
  submitAnswer(answer: string): void {
    this.setSubmitted(answer);
  }
  
  override accessibility(
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseAccessibility {
    return {
      ariaLabel: `Flashcard: ${instance.prompt}`,
      ariaDescription: 'Press space to reveal the answer, then indicate if you knew it',
      keyboardNavigable: true,
      touchTargetCompliant: true,
      screenReaderInstructions: 'A flashcard will be shown. Try to recall the answer before revealing it.',
    };
  }
}

export function createFlashcardExercise(): FlashcardExercise {
  return new FlashcardExercise();
}
