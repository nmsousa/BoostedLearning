/**
 * Word Order / Sentence Construction Exercise Module
 * 
 * Arrange words in the correct order to form a sentence.
 * Uses freeWordOrder tolerance where applicable.
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

export interface WordOrderOptions {
  words: string[];
  allowFreeOrder?: boolean;
}

export class WordOrderExercise extends BaseExerciseModule {
  readonly type: ExerciseType = 'word-order';
  readonly name = 'Word Order';
  readonly description = 'Arrange words in the correct order to form a sentence';
  readonly objective = 'grammar';
  readonly applicableSkillDimensions: readonly SkillDimension[] = [
    'productive_vocabulary',
    'grammar',
  ];
  readonly supportsAudio = false;
  
  private wordOrder: number[] = [];
  private options: WordOrderOptions | null = null;
  
  render(instance: ExerciseInstance, context: RenderContext): () => void {
    this.reset();
    this.startTimer();
    this.wordOrder = [];
    this.options = instance.options as unknown as WordOrderOptions | null;
    
    return () => {
      this.reset();
      this.options = null;
    };
  }
  
  evaluate(response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult {
    const options = instance.options as WordOrderOptions | undefined;
    
    if (!options) {
      // Fall back to string matching
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
      
      return {
        correct: result.correct,
        outcome: result.correct ? 'correct-unaided' : 'incorrect',
        correctAnswers: instance.expectedAnswers,
      };
    }
    
    // Build constructed sentence from word order
    const constructedSentence = this.wordOrder
      .map(i => options.words[i])
      .join(' ');
    
    const validator = createAnswerValidator();
    
    const allAnswers = [
      ...instance.expectedAnswers,
      ...(instance.alternatives ?? []),
    ];
    
    const result = validator.validate({
      submitted: constructedSentence,
      acceptedAnswers: allAnswers,
      policy: {
        ignoreCase: true,
        ignoreAccents: true,
        ignorePunctuationWhitespace: true,
        freeWordOrder: options.allowFreeOrder ?? false,
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
  
  // Add a word to the end of the constructed sentence
  addWord(wordIndex: number): void {
    this.wordOrder.push(wordIndex);
    this.updateSubmitted();
  }
  
  // Remove the last word
  removeLastWord(): void {
    this.wordOrder.pop();
    this.updateSubmitted();
  }
  
  // Clear all words
  clearWords(): void {
    this.wordOrder = [];
    this.updateSubmitted();
  }
  
  // Get current word order
  getWordOrder(): number[] {
    return [...this.wordOrder];
  }
  
  private updateSubmitted(): void {
    if (this.options) {
      const sentence = this.wordOrder
        .map(i => this.options!.words[i])
        .join(' ');
      this.setSubmitted(sentence);
    }
  }
  
  override accessibility(
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseAccessibility {
    const options = instance.options as WordOrderOptions | undefined;
    const wordCount = options?.words.length ?? 0;
    
    return {
      ariaLabel: `Word order: ${instance.prompt}`,
      ariaDescription: `Arrange ${wordCount} words in the correct order`,
      keyboardNavigable: true,
      touchTargetCompliant: true,
      screenReaderInstructions: 'Select words in order to construct the sentence. Use backspace to remove the last word.',
    };
  }
}

export function createWordOrderExercise(): WordOrderExercise {
  return new WordOrderExercise();
}
