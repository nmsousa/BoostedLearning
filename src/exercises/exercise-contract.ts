/**
 * Exercise Contract and Module Registry
 * 
 * Defines the contract that all exercise modules must implement.
 * New exercise types register without editing existing modules or the engine.
 * 
 * Requirements: 7.2, 7.3, 7.4, 7.6, 21.9
 * Design: Exercise module contract
 * 
 * @module exercises
 */

import { SkillDimension, ExerciseType, AttemptOutcome, AttemptOutcomeResult, LearningItem } from '../core/types';

/**
 * Result from collecting a user's response
 */
export interface ExerciseResponse {
  /** The user's submitted answer */
  submitted: string;
  /** Time taken to respond in milliseconds */
  responseTimeMs: number;
  /** Whether a hint was used */
  hintUsed: boolean;
  /** Whether audio was used */
  audioUsed: boolean;
  /** Number of attempts before final submission (for retry-enabled exercises) */
  attempts: number;
}

/**
 * Result from evaluating an exercise
 */
export interface EvaluationResult {
  /** Whether the answer was correct */
  correct: boolean;
  /** The specific outcome for the memory engine */
  outcome: AttemptOutcomeResult;
  /** The correct answer(s) to show in feedback */
  correctAnswers: string[];
  /** Optional explanation of the error */
  errorExplanation?: string;
  /** Match score (0-1) for partial credit exercises */
  matchScore?: number;
}

/**
 * Feedback to display to the user after evaluation
 */
export interface ExerciseFeedback {
  /** Whether the response was correct */
  correct: boolean;
  /** Primary feedback message (e.g., "Correct!" or "Incorrect") */
  message: string;
  /** The correct answer to show when incorrect (R7.4, R21.9) */
  correctAnswer?: string;
  /** Additional explanation */
  explanation?: string;
  /** Suggestion for improvement */
  suggestion?: string;
}

/**
 * Accessibility information for an exercise
 */
export interface ExerciseAccessibility {
  /** ARIA label for the exercise container */
  ariaLabel: string;
  /** ARIA description for screen readers */
  ariaDescription?: string;
  /** Whether the exercise supports keyboard-only navigation */
  keyboardNavigable: boolean;
  /** Minimum touch target size requirement met */
  touchTargetCompliant: boolean;
  /** Instructions for screen readers */
  screenReaderInstructions?: string;
}

/**
 * Exercise instance data - the specific content for one exercise
 */
export interface ExerciseInstance {
  /** Unique ID for this instance */
  id: string;
  /** The learning item this exercise is for */
  learningItemId: string;
  /** The exercise type */
  type: ExerciseType;
  /** The skill dimension being practiced */
  skillDimension: SkillDimension;
  /** Prompt to show the user */
  prompt: string;
  /** Expected answer(s) */
  expectedAnswers: string[];
  /** Alternative accepted answers */
  alternatives?: string[];
  /** Hint text (if available) */
  hint?: string;
  /** Context sentence or example */
  context?: string;
  /** Audio text to speak (if applicable) */
  audioText?: string;
  /** Target language code for TTS */
  targetLanguage?: string;
  /** Graded objective (affects tolerance) */
  gradedObjective?: 'spelling' | 'accents' | 'grammar' | 'vocabulary';
  /** Additional type-specific options */
  options?: Record<string, unknown>;
}

/**
 * Render context provided to exercise modules
 */
export interface RenderContext {
  /** Container element to render into */
  container: HTMLElement;
  /** i18n translate function */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Current theme */
  theme: 'light' | 'dark';
  /** Text size preference */
  textSize: 'small' | 'medium' | 'large';
  /** Reduced motion preference */
  reducedMotion: boolean;
}

/**
 * Exercise Contract
 * 
 * All exercise modules must implement this contract.
 * The contract ensures consistent behavior across exercise types.
 */
export interface ExerciseContract {
  /** Unique identifier for this exercise type */
  readonly type: ExerciseType;
  
  /** Human-readable name for the exercise type */
  readonly name: string;
  
  /** Description of what this exercise type tests */
  readonly description: string;
  
  /** The graded objective for this exercise type */
  readonly objective: string;
  
  /** Skill dimensions this exercise applies to */
  readonly applicableSkillDimensions: readonly SkillDimension[];
  
  /** Whether this exercise type supports audio */
  readonly supportsAudio: boolean;
  
  /**
   * Render the exercise UI.
   * @param instance - The specific exercise instance
   * @param context - Rendering context with container and utilities
   * @returns Cleanup function to call when exercise is removed
   */
  render(instance: ExerciseInstance, context: RenderContext): () => void;
  
  /**
   * Collect the user's response.
   * Called when the user submits their answer.
   * @returns The collected response
   */
  collectResponse(): ExerciseResponse;
  
  /**
   * Evaluate the user's response against expected answers.
   * Uses the Answer_Validator for validation.
   * @param response - The user's collected response
   * @param instance - The exercise instance with expected answers
   * @returns Evaluation result
   */
  evaluate(response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult;
  
  /**
   * Generate feedback for the user based on evaluation.
   * Feedback always includes the correct answer when incorrect (R7.4, R21.9).
   * @param evaluation - The evaluation result
   * @param instance - The exercise instance
   * @param t - Translation function
   * @returns Feedback to display
   */
  feedback(
    evaluation: EvaluationResult,
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseFeedback;
  
  /**
   * Get accessibility information for this exercise.
   * @param instance - The exercise instance
   * @param t - Translation function
   * @returns Accessibility metadata
   */
  accessibility(
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseAccessibility;
}

/**
 * Callback for reporting attempts to the Memory Engine
 */
export type AttemptReporter = (
  itemId: string,
  outcome: AttemptOutcomeResult,
  exerciseType: ExerciseType,
  skillDimension: SkillDimension,
  hintUsed: boolean
) => void;

/**
 * Exercise Module Registry
 * 
 * Manages registration and lookup of exercise modules.
 * New types register without editing existing code (R7.6).
 */
export interface ExerciseRegistry {
  /**
   * Register an exercise module
   */
  register(contract: ExerciseContract): void;
  
  /**
   * Unregister an exercise module
   */
  unregister(type: ExerciseType): void;
  
  /**
   * Get an exercise module by type
   */
  get(type: ExerciseType): ExerciseContract | undefined;
  
  /**
   * Get all registered exercise types
   */
  getTypes(): ExerciseType[];
  
  /**
   * Get all exercise types applicable to a skill dimension
   */
  getTypesForSkillDimension(dimension: SkillDimension): ExerciseType[];
  
  /**
   * Check if an exercise type is registered
   */
  has(type: ExerciseType): boolean;
  
  /**
   * Get all registered contracts
   */
  getAll(): ExerciseContract[];
}

/**
 * Create an exercise registry instance
 */
export function createExerciseRegistry(): ExerciseRegistry {
  const contracts = new Map<ExerciseType, ExerciseContract>();
  
  return {
    register(contract: ExerciseContract): void {
      if (contracts.has(contract.type)) {
        console.warn(`Exercise type '${contract.type}' is already registered. Replacing.`);
      }
      contracts.set(contract.type, contract);
    },
    
    unregister(type: ExerciseType): void {
      contracts.delete(type);
    },
    
    get(type: ExerciseType): ExerciseContract | undefined {
      return contracts.get(type);
    },
    
    getTypes(): ExerciseType[] {
      return Array.from(contracts.keys());
    },
    
    getTypesForSkillDimension(dimension: SkillDimension): ExerciseType[] {
      return Array.from(contracts.values())
        .filter(contract => contract.applicableSkillDimensions.includes(dimension))
        .map(contract => contract.type);
    },
    
    has(type: ExerciseType): boolean {
      return contracts.has(type);
    },
    
    getAll(): ExerciseContract[] {
      return Array.from(contracts.values());
    },
  };
}

/**
 * Base exercise implementation helper.
 * Provides common functionality for exercise modules.
 */
export abstract class BaseExerciseModule implements ExerciseContract {
  abstract readonly type: ExerciseType;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly objective: string;
  abstract readonly applicableSkillDimensions: readonly SkillDimension[];
  abstract readonly supportsAudio: boolean;
  
  // Store collected response data
  protected currentResponse: Partial<ExerciseResponse> = {};
  protected startTime: number = 0;
  
  abstract render(instance: ExerciseInstance, context: RenderContext): () => void;
  
  collectResponse(): ExerciseResponse {
    const responseTime = Date.now() - this.startTime;
    return {
      submitted: this.currentResponse.submitted ?? '',
      responseTimeMs: responseTime,
      hintUsed: this.currentResponse.hintUsed ?? false,
      audioUsed: this.currentResponse.audioUsed ?? false,
      attempts: this.currentResponse.attempts ?? 1,
    };
  }
  
  abstract evaluate(response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult;
  
  feedback(
    evaluation: EvaluationResult,
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseFeedback {
    if (evaluation.correct) {
      return {
        correct: true,
        message: t('feedback.correct'),
      };
    }
    
    // Always show correct answer when wrong (R7.4, R21.9)
    const correctAnswer = evaluation.correctAnswers[0] ?? instance.expectedAnswers[0];
    return {
      correct: false,
      message: t('feedback.incorrect'),
      correctAnswer,
      explanation: evaluation.errorExplanation,
    };
  }
  
  accessibility(
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseAccessibility {
    return {
      ariaLabel: `${this.name}: ${instance.prompt}`,
      keyboardNavigable: true,
      touchTargetCompliant: true,
    };
  }
  
  protected startTimer(): void {
    this.startTime = Date.now();
  }
  
  protected setSubmitted(value: string): void {
    this.currentResponse.submitted = value;
  }
  
  protected setHintUsed(used: boolean): void {
    this.currentResponse.hintUsed = used;
  }
  
  protected setAudioUsed(used: boolean): void {
    this.currentResponse.audioUsed = used;
  }
  
  protected incrementAttempts(): void {
    this.currentResponse.attempts = (this.currentResponse.attempts ?? 0) + 1;
  }
  
  protected reset(): void {
    this.currentResponse = {};
    this.startTime = 0;
  }
}

/**
 * Verify that a contract satisfies all requirements.
 * Useful for testing custom exercise modules.
 */
export function verifyContract(contract: ExerciseContract): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required properties
  if (!contract.type) errors.push('Missing type');
  if (!contract.name) errors.push('Missing name');
  if (!contract.description) errors.push('Missing description');
  if (!contract.objective) errors.push('Missing objective');
  if (!contract.applicableSkillDimensions || contract.applicableSkillDimensions.length === 0) {
    errors.push('Must have at least one applicable skill dimension');
  }
  if (typeof contract.supportsAudio !== 'boolean') {
    errors.push('supportsAudio must be a boolean');
  }
  
  // Check required methods
  if (typeof contract.render !== 'function') errors.push('Missing render method');
  if (typeof contract.collectResponse !== 'function') errors.push('Missing collectResponse method');
  if (typeof contract.evaluate !== 'function') errors.push('Missing evaluate method');
  if (typeof contract.feedback !== 'function') errors.push('Missing feedback method');
  if (typeof contract.accessibility !== 'function') errors.push('Missing accessibility method');
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
