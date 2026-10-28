/**
 * Exercise Angular Service
 * 
 * Manages exercise modules through Angular DI.
 * 
 * @module app/services
 */

import { Injectable } from '@angular/core';
import {
  createExerciseRegistry,
  ExerciseRegistry,
  ExerciseContract,
  ExerciseInstance,
  registerBuiltInExercises,
  buildMixedReviewSession,
  MixedReviewItem,
  MixedReviewConfig,
  MixedReviewSession,
} from '../../exercises';
import { ExerciseType, SkillDimension } from '../../core/types';

@Injectable({
  providedIn: 'root',
})
export class ExerciseService {
  private registry: ExerciseRegistry;

  constructor() {
    this.registry = createExerciseRegistry();
    registerBuiltInExercises(this.registry);
  }

  /**
   * Get an exercise module by type
   */
  getExercise(type: ExerciseType): ExerciseContract | undefined {
    return this.registry.get(type);
  }

  /**
   * Get all registered exercise types
   */
  getExerciseTypes(): ExerciseType[] {
    return this.registry.getTypes();
  }

  /**
   * Get exercise types for a skill dimension
   */
  getTypesForSkillDimension(dimension: SkillDimension): ExerciseType[] {
    return this.registry.getTypesForSkillDimension(dimension);
  }

  /**
   * Check if an exercise type is registered
   */
  hasExerciseType(type: ExerciseType): boolean {
    return this.registry.has(type);
  }

  /**
   * Build a mixed review session
   */
  buildMixedSession(
    newItems: MixedReviewItem[],
    reviewItems: MixedReviewItem[],
    config?: MixedReviewConfig
  ): MixedReviewSession {
    return buildMixedReviewSession(newItems, reviewItems, config);
  }

  /**
   * Register a custom exercise module
   */
  registerCustomExercise(contract: ExerciseContract): void {
    this.registry.register(contract);
  }
}
