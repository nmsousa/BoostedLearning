/**
 * Content State Machine
 * 
 * Implements the draft → validated → available state machine (R12).
 * Only `available` content is ever presented to learners.
 * AI/automated content cannot bypass human approval (R12.5).
 * 
 * @module content/content-state-machine
 */

import type { ContentState } from '../core/types';

/**
 * Source of content - used to enforce human approval gate for AI content.
 */
export type ContentSource = 'human' | 'ai' | 'automated';

/**
 * Validation issue found during content review.
 */
export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Result of a content validation check.
 */
export interface ContentValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Result of a state transition attempt.
 */
export interface StateTransitionResult {
  success: boolean;
  newState: ContentState;
  error?: string;
}

/**
 * Options for state transitions.
 */
export interface TransitionOptions {
  /** The source of the content */
  source?: ContentSource;
  /** Whether this is a human-approved transition */
  humanApproved?: boolean;
  /** Validation result (required for draft → validated) */
  validationResult?: ContentValidationResult;
}

/**
 * Valid state transitions in the content state machine.
 * 
 * State machine:
 * ```
 * [*] --> draft
 * draft --> validated: passes Content_Validation checklist (R12.2, R12.3)
 * validated --> available: published to Learners
 * draft --> draft: AI/automated content stays here until human approval (R12.5)
 * available --> draft: content edited (re-validation required)
 * ```
 */
const VALID_TRANSITIONS: Record<ContentState, ContentState[]> = {
  draft: ['validated'],
  validated: ['available', 'draft'],
  available: ['draft'],
};

/**
 * Attempt to transition content from one state to another.
 * 
 * Rules:
 * - draft → validated: requires passing validation AND human approval if source is AI/automated
 * - validated → available: can proceed (human already approved validation)
 * - available → draft: always allowed (for edits requiring re-validation)
 * - validated → draft: allowed (for reverting validation)
 * 
 * @param currentState - Current content state
 * @param targetState - Desired target state
 * @param options - Transition options
 * @returns Result of the transition attempt
 */
export function transitionContentState(
  currentState: ContentState,
  targetState: ContentState,
  options: TransitionOptions = {}
): StateTransitionResult {
  const { source = 'human', humanApproved = true, validationResult } = options;

  // Check if transition is valid
  const allowedTargets = VALID_TRANSITIONS[currentState];
  if (!allowedTargets.includes(targetState)) {
    return {
      success: false,
      newState: currentState,
      error: `Invalid transition: ${currentState} → ${targetState}. Allowed: ${allowedTargets.join(', ')}`,
    };
  }

  // Special rules for draft → validated
  if (currentState === 'draft' && targetState === 'validated') {
    // AI/automated content requires explicit human approval (R12.5)
    if ((source === 'ai' || source === 'automated') && !humanApproved) {
      return {
        success: false,
        newState: currentState,
        error: 'AI/automated content requires explicit human approval to transition to validated',
      };
    }

    // Validation must pass
    if (!validationResult || !validationResult.valid) {
      const issues = validationResult?.issues
        .filter(i => i.severity === 'error')
        .map(i => i.message)
        .join('; ') || 'No validation result provided';
      return {
        success: false,
        newState: currentState,
        error: `Content validation failed: ${issues}`,
      };
    }
  }

  return {
    success: true,
    newState: targetState,
  };
}

/**
 * Check if content can be presented to learners.
 * Only `available` content is ever presented (R12.1, R12.3, R12.4).
 */
export function canPresentToLearners(state: ContentState): boolean {
  return state === 'available';
}

/**
 * Check if content requires human approval before state change.
 */
export function requiresHumanApproval(source: ContentSource): boolean {
  return source === 'ai' || source === 'automated';
}
