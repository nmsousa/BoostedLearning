/**
 * Matching Exercise Module
 * 
 * Match words with their translations, images, or descriptions.
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

export interface MatchingPair {
  left: string;
  right: string;
}

export interface MatchingOptions {
  pairs: MatchingPair[];
}

export class MatchingExercise extends BaseExerciseModule {
  readonly type: ExerciseType = 'matching';
  readonly name = 'Matching';
  readonly description = 'Match words with their translations or meanings';
  readonly objective = 'vocabulary';
  readonly applicableSkillDimensions: readonly SkillDimension[] = [
    'receptive_vocabulary',
  ];
  readonly supportsAudio = false;
  
  private matches: Map<number, number> = new Map();
  private options: MatchingOptions | null = null;
  
  render(instance: ExerciseInstance, context: RenderContext): () => void {
    this.reset();
    this.startTimer();
    this.matches = new Map();
    this.options = instance.options as unknown as MatchingOptions | null;
    
    return () => {
      this.reset();
      this.matches.clear();
      this.options = null;
    };
  }
  
  evaluate(response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult {
    const options = instance.options as MatchingOptions | undefined;
    
    if (!options) {
      return {
        correct: false,
        outcome: 'incorrect',
        correctAnswers: instance.expectedAnswers,
      };
    }
    
    // Check all pairs are correctly matched
    let correctCount = 0;
    const totalPairs = options.pairs.length;
    
    for (let i = 0; i < totalPairs; i++) {
      if (this.matches.get(i) === i) {
        correctCount++;
      }
    }
    
    const isFullyCorrect = correctCount === totalPairs;
    const score = totalPairs > 0 ? correctCount / totalPairs : 0;
    
    // Matching is recognition-based
    const outcome: AttemptOutcomeResult = isFullyCorrect
      ? (response.hintUsed ? 'correct-with-hint' : 'correct-recognition')
      : 'incorrect';
    
    return {
      correct: isFullyCorrect,
      outcome,
      correctAnswers: options.pairs.map(p => `${p.left} → ${p.right}`),
      matchScore: score,
    };
  }
  
  makeMatch(leftIndex: number, rightIndex: number): void {
    this.matches.set(leftIndex, rightIndex);
    
    // Serialize matches for response
    const matchStr = Array.from(this.matches.entries())
      .map(([l, r]) => `${l}:${r}`)
      .join(',');
    this.setSubmitted(matchStr);
  }
  
  clearMatch(leftIndex: number): void {
    this.matches.delete(leftIndex);
  }
  
  getMatches(): Map<number, number> {
    return new Map(this.matches);
  }
  
  override accessibility(
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseAccessibility {
    const options = instance.options as MatchingOptions | undefined;
    const pairCount = options?.pairs.length ?? 0;
    
    return {
      ariaLabel: `Matching exercise: ${instance.prompt}`,
      ariaDescription: `Match ${pairCount} pairs of words`,
      keyboardNavigable: true,
      touchTargetCompliant: true,
      screenReaderInstructions: 'Select items from the left column and match them to items in the right column',
    };
  }
}

export function createMatchingExercise(): MatchingExercise {
  return new MatchingExercise();
}
