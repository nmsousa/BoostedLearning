/**
 * Exercise Modules
 * 
 * Contains exercise type implementations and the registry.
 * Each exercise type implements the ExerciseContract.
 * 
 * @module exercises
 */

export {
  createExerciseRegistry,
  verifyContract,
  BaseExerciseModule,
  type ExerciseContract,
  type ExerciseRegistry,
  type ExerciseInstance,
  type ExerciseResponse,
  type EvaluationResult,
  type ExerciseFeedback,
  type ExerciseAccessibility,
  type RenderContext,
  type AttemptReporter,
} from './exercise-contract';

export * from './modules';
