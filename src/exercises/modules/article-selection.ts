/**
 * Article Selection Exercise Module
 * 
 * Select the correct article (de/het for Dutch) for a noun.
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

export interface ArticleSelectionOptions {
  noun: string;
  correctArticle: 'de' | 'het';
  articles?: string[]; // Default: ['de', 'het']
}

export class ArticleSelectionExercise extends BaseExerciseModule {
  readonly type: ExerciseType = 'article-selection';
  readonly name = 'Article Selection';
  readonly description = 'Select the correct article for a noun';
  readonly objective = 'grammar';
  readonly applicableSkillDimensions: readonly SkillDimension[] = [
    'grammar',
  ];
  readonly supportsAudio = false;
  
  private selectedArticle: string | null = null;
  private options: ArticleSelectionOptions | null = null;
  
  render(instance: ExerciseInstance, context: RenderContext): () => void {
    this.reset();
    this.startTimer();
    this.selectedArticle = null;
    this.options = instance.options as unknown as ArticleSelectionOptions | null;
    
    return () => {
      this.reset();
      this.options = null;
    };
  }
  
  evaluate(response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult {
    const options = instance.options as ArticleSelectionOptions | undefined;
    
    if (!options || this.selectedArticle === null) {
      return {
        correct: false,
        outcome: 'incorrect',
        correctAnswers: instance.expectedAnswers,
      };
    }
    
    const isCorrect = this.selectedArticle.toLowerCase() === options.correctArticle.toLowerCase();
    
    // Article selection is recognition-based
    const outcome: AttemptOutcomeResult = isCorrect
      ? (response.hintUsed ? 'correct-with-hint' : 'correct-recognition')
      : 'incorrect';
    
    return {
      correct: isCorrect,
      outcome,
      correctAnswers: [`${options.correctArticle} ${options.noun}`],
    };
  }
  
  selectArticle(article: string): void {
    this.selectedArticle = article;
    this.setSubmitted(article);
  }
  
  getSelectedArticle(): string | null {
    return this.selectedArticle;
  }
  
  override accessibility(
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseAccessibility {
    const options = instance.options as ArticleSelectionOptions | undefined;
    const articles = options?.articles ?? ['de', 'het'];
    
    return {
      ariaLabel: `Article selection: ${instance.prompt}`,
      ariaDescription: `Choose the correct article (${articles.join(' or ')})`,
      keyboardNavigable: true,
      touchTargetCompliant: true,
      screenReaderInstructions: `Select the correct article for the noun. Options are: ${articles.join(', ')}`,
    };
  }
}

export function createArticleSelectionExercise(): ArticleSelectionExercise {
  return new ArticleSelectionExercise();
}
