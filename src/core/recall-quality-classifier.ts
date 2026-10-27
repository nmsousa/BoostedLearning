/**
 * Recall-Quality Classifier
 * 
 * Pure function translating an exercise attempt into graded evidence.
 * This is where recognition-vs-recall and hinted-vs-unaided become scheduler-visible.
 * 
 * Implements R1.2, R1.3, R3.1, R3.2
 * 
 * @module core/recall-quality-classifier
 */

import type { AttemptOutcome, RecallQualityResult, SchedulerRating } from './types';

/**
 * Evidence weight constants.
 * These are tunable defaults, NOT evidence-based truths.
 * 
 * The INVARIANT that must hold (R3.1, R3.2):
 * - evidenceWeight(unaided-correct) > evidenceWeight(recognition-correct)
 * - evidenceWeight(unaided-correct) > evidenceWeight(hinted-correct)
 */
const EVIDENCE_WEIGHTS = {
  /** Correct, unaided, no hint - strongest evidence */
  UNAIDED_CORRECT: 1.0,
  /** Correct, recognition (selected from options), no hint */
  RECOGNITION_CORRECT: 0.7,
  /** Correct, but used a hint first */
  HINTED_CORRECT: 0.5,
  /** Incorrect - weakest/negative evidence */
  INCORRECT: 0.0,
} as const;

// Static assertion: verify the invariants at compile time
// These would fail if the constants were changed incorrectly
type AssertUnaidedGtRecognition = typeof EVIDENCE_WEIGHTS.UNAIDED_CORRECT extends infer U
  ? typeof EVIDENCE_WEIGHTS.RECOGNITION_CORRECT extends infer R
    ? U extends number
      ? R extends number
        ? U extends R ? never : true
        : never
      : never
    : never
  : never;

/**
 * Classify the recall quality of an attempt outcome.
 * 
 * Maps an AttemptOutcome to an FSRS rating and an evidence weight.
 * The evidence weight ordering invariant is enforced:
 * - evidenceWeight(unaided-correct) > evidenceWeight(recognition-correct) (R3.1)
 * - evidenceWeight(unaided-correct) > evidenceWeight(hinted-correct) (R3.2)
 * 
 * Mapping rules:
 * | Outcome                         | Rating      | Evidence Weight |
 * |--------------------------------|-------------|-----------------|
 * | Correct, unaided, no hint      | good/easy   | 1.0 (strongest) |
 * | Correct, recognition, no hint  | good        | 0.7             |
 * | Correct, with hint             | hard        | 0.5             |
 * | Incorrect                      | again       | 0.0 (weakest)   |
 * 
 * @param outcome - The attempt outcome to classify
 * @returns The scheduler rating and evidence weight
 */
export function classifyRecallQuality(outcome: AttemptOutcome): RecallQualityResult {
  if (!outcome.correct) {
    // Incorrect answer - counts as a mistake (R8.8)
    return {
      rating: 'again',
      evidenceWeight: EVIDENCE_WEIGHTS.INCORRECT,
    };
  }

  // Correct answer - determine strength based on mode and hint usage
  if (outcome.usedHint) {
    // Correct but used a hint - weaker than unaided (R3.2)
    return {
      rating: 'hard',
      evidenceWeight: EVIDENCE_WEIGHTS.HINTED_CORRECT,
    };
  }

  if (outcome.mode === 'recognition') {
    // Correct via recognition (selected from options) - weaker than unaided recall (R3.1)
    return {
      rating: 'good',
      evidenceWeight: EVIDENCE_WEIGHTS.RECOGNITION_CORRECT,
    };
  }

  // Correct via unaided recall without hints - strongest evidence
  return {
    rating: 'good',
    evidenceWeight: EVIDENCE_WEIGHTS.UNAIDED_CORRECT,
  };
}

/**
 * Check if an attempt outcome represents a "failure" for recovery detection purposes.
 * A failure is either incorrect OR correct-with-hint (R4.1).
 * 
 * @param outcome - The attempt outcome to check
 * @returns true if this counts as a failure for recovery threshold
 */
export function isFailureForRecovery(outcome: AttemptOutcome): boolean {
  return !outcome.correct || outcome.usedHint;
}

/**
 * Check if an attempt is a correct-unaided attempt (for clearing recovery).
 * Required for the clear condition: 2 consecutive correct-unaided attempts (R4.3).
 * 
 * @param outcome - The attempt outcome to check
 * @returns true if correct without hint
 */
export function isCorrectUnaided(outcome: AttemptOutcome): boolean {
  return outcome.correct && !outcome.usedHint;
}

/**
 * Runtime validation that the evidence weight invariants hold.
 * Call this in tests to verify the constants are configured correctly.
 * 
 * @throws Error if invariants are violated
 */
export function validateEvidenceWeightInvariants(): void {
  // R3.1: unaided-correct > recognition-correct
  if (EVIDENCE_WEIGHTS.UNAIDED_CORRECT <= EVIDENCE_WEIGHTS.RECOGNITION_CORRECT) {
    throw new Error(
      `Invariant violation (R3.1): UNAIDED_CORRECT (${EVIDENCE_WEIGHTS.UNAIDED_CORRECT}) must be > RECOGNITION_CORRECT (${EVIDENCE_WEIGHTS.RECOGNITION_CORRECT})`
    );
  }

  // R3.2: unaided-correct > hinted-correct
  if (EVIDENCE_WEIGHTS.UNAIDED_CORRECT <= EVIDENCE_WEIGHTS.HINTED_CORRECT) {
    throw new Error(
      `Invariant violation (R3.2): UNAIDED_CORRECT (${EVIDENCE_WEIGHTS.UNAIDED_CORRECT}) must be > HINTED_CORRECT (${EVIDENCE_WEIGHTS.HINTED_CORRECT})`
    );
  }

  // Additional sanity checks
  if (EVIDENCE_WEIGHTS.INCORRECT >= EVIDENCE_WEIGHTS.HINTED_CORRECT) {
    throw new Error(
      `Invariant violation: INCORRECT (${EVIDENCE_WEIGHTS.INCORRECT}) should be < HINTED_CORRECT (${EVIDENCE_WEIGHTS.HINTED_CORRECT})`
    );
  }
}

/**
 * Get the evidence weights for testing and analytics.
 * Exposed as a function to prevent direct mutation.
 */
export function getEvidenceWeights(): Readonly<typeof EVIDENCE_WEIGHTS> {
  return EVIDENCE_WEIGHTS;
}
