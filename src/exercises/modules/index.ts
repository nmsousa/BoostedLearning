/**
 * Exercise Modules
 * 
 * Collection of exercise type implementations.
 * 
 * @module exercises/modules
 */

export {
  FlashcardExercise,
  createFlashcardExercise,
} from './flashcard';

export {
  MatchingExercise,
  createMatchingExercise,
  type MatchingPair,
  type MatchingOptions,
} from './matching';

export {
  TypedTranslationExercise,
  createTypedTranslationExercise,
} from './typed-translation';

export {
  MultipleChoiceExercise,
  createMultipleChoiceExercise,
  type MultipleChoiceOptions,
} from './multiple-choice';

export {
  FillBlankExercise,
  createFillBlankExercise,
} from './fill-blank';

export {
  ArticleSelectionExercise,
  createArticleSelectionExercise,
  type ArticleSelectionOptions,
} from './article-selection';

export {
  WordOrderExercise,
  createWordOrderExercise,
  type WordOrderOptions,
} from './word-order';

export {
  ListeningExercise,
  createListeningExercise,
} from './listening';

export {
  ConjugationExercise,
  createConjugationExercise,
  type ConjugationOptions,
} from './conjugation';

export {
  buildMixedReviewSession,
  validateMixedSession,
  selectExerciseTypesForItem,
  type MixedReviewItem,
  type MixedReviewConfig,
  type MixedReviewSession,
} from './mixed-review';

import { ExerciseRegistry } from '../exercise-contract';
import { createFlashcardExercise } from './flashcard';
import { createMatchingExercise } from './matching';
import { createTypedTranslationExercise } from './typed-translation';
import { createMultipleChoiceExercise } from './multiple-choice';
import { createFillBlankExercise } from './fill-blank';
import { createArticleSelectionExercise } from './article-selection';
import { createWordOrderExercise } from './word-order';
import { createListeningExercise } from './listening';
import { createConjugationExercise } from './conjugation';

/**
 * Register all built-in exercise modules with a registry.
 */
export function registerBuiltInExercises(registry: ExerciseRegistry): void {
  registry.register(createFlashcardExercise());
  registry.register(createMatchingExercise());
  registry.register(createTypedTranslationExercise());
  registry.register(createMultipleChoiceExercise());
  registry.register(createFillBlankExercise());
  registry.register(createArticleSelectionExercise());
  registry.register(createWordOrderExercise());
  registry.register(createListeningExercise());
  registry.register(createConjugationExercise());
}
