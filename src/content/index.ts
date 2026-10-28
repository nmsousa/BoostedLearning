/**
 * Content Module
 * 
 * Provides content management with state machine, validation, and data access.
 * 
 * @module content
 */

// State Machine
export {
  transitionContentState,
  canPresentToLearners,
  requiresHumanApproval,
  type ContentSource,
  type ValidationIssue,
  type ContentValidationResult,
  type StateTransitionResult,
  type TransitionOptions,
} from './content-state-machine';

// Content Validation
export {
  validateVocabulary,
  validateGrammarInfo,
  validateExamples,
  validateExercises,
  validateLesson,
  validateModule,
  validateContent,
  validateLessonContent,
  validateModuleContent,
  type ContentForValidation,
  type LessonForValidation,
  type ModuleForValidation,
} from './content-validation';

// Content Store
export {
  ContentStore,
  createContentStore,
  type ContentGapEvent,
  type EnrichedLearningItem,
  type ItemSelectionCriteria,
} from './content-store';

// Content Seeder
export {
  seedDutchA1Content,
  seedFrenchB2ValidationContent,
  seedAllContent,
  isContentSeeded,
} from './content-seeder';

// Content Data
export { dutchA1Content } from './data/dutch-a1-content';
export { frenchB2ValidationContent } from './data/french-b2-validation';
