/**
 * Tests for Recall-Quality Classifier
 * 
 * Feature: language-learning-app
 * 
 * Tests cover:
 * - Property 5: Recall-quality evidence ordering holds (R3.1, R3.2)
 * - Unit tests for all outcome mappings
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import {
  classifyRecallQuality,
  isFailureForRecovery,
  isCorrectUnaided,
  validateEvidenceWeightInvariants,
  getEvidenceWeights,
} from './recall-quality-classifier';
import type { AttemptOutcome, SkillDimension, AttemptMode } from './types';

// Arbitrary generators for property-based testing
const skillDimensionArb: fc.Arbitrary<SkillDimension> = fc.constantFrom(
  'spelling',
  'meaning',
  'listening-recognition',
  'productive-recall'
);

const attemptModeArb: fc.Arbitrary<AttemptMode> = fc.constantFrom('recognition', 'unaided');

const attemptOutcomeArb: fc.Arbitrary<AttemptOutcome> = fc.record({
  correct: fc.boolean(),
  mode: attemptModeArb,
  usedHint: fc.boolean(),
  skillDimension: skillDimensionArb,
});

describe('Recall-Quality Classifier', () => {
  beforeAll(() => {
    // Verify invariants at test startup
    validateEvidenceWeightInvariants();
  });

  describe('validateEvidenceWeightInvariants', () => {
    it('should not throw when invariants hold', () => {
      expect(() => validateEvidenceWeightInvariants()).not.toThrow();
    });
  });

  describe('classifyRecallQuality', () => {
    describe('incorrect answers', () => {
      it('should return "again" rating for incorrect answers', () => {
        const outcome: AttemptOutcome = {
          correct: false,
          mode: 'unaided',
          usedHint: false,
          skillDimension: 'meaning',
        };
        const result = classifyRecallQuality(outcome);
        expect(result.rating).toBe('again');
      });

      it('should return lowest evidence weight for incorrect answers', () => {
        const outcome: AttemptOutcome = {
          correct: false,
          mode: 'recognition',
          usedHint: true,
          skillDimension: 'spelling',
        };
        const result = classifyRecallQuality(outcome);
        expect(result.evidenceWeight).toBe(0);
      });
    });

    describe('correct answers with hint', () => {
      it('should return "hard" rating for correct-with-hint', () => {
        const outcome: AttemptOutcome = {
          correct: true,
          mode: 'unaided',
          usedHint: true,
          skillDimension: 'meaning',
        };
        const result = classifyRecallQuality(outcome);
        expect(result.rating).toBe('hard');
      });

      it('should return intermediate evidence weight for hinted answers', () => {
        const weights = getEvidenceWeights();
        const outcome: AttemptOutcome = {
          correct: true,
          mode: 'unaided',
          usedHint: true,
          skillDimension: 'meaning',
        };
        const result = classifyRecallQuality(outcome);
        expect(result.evidenceWeight).toBe(weights.HINTED_CORRECT);
      });
    });

    describe('correct recognition answers (no hint)', () => {
      it('should return "good" rating for correct recognition', () => {
        const outcome: AttemptOutcome = {
          correct: true,
          mode: 'recognition',
          usedHint: false,
          skillDimension: 'listening-recognition',
        };
        const result = classifyRecallQuality(outcome);
        expect(result.rating).toBe('good');
      });

      it('should return recognition evidence weight', () => {
        const weights = getEvidenceWeights();
        const outcome: AttemptOutcome = {
          correct: true,
          mode: 'recognition',
          usedHint: false,
          skillDimension: 'meaning',
        };
        const result = classifyRecallQuality(outcome);
        expect(result.evidenceWeight).toBe(weights.RECOGNITION_CORRECT);
      });
    });

    describe('correct unaided answers (no hint)', () => {
      it('should return "good" rating for correct unaided recall', () => {
        const outcome: AttemptOutcome = {
          correct: true,
          mode: 'unaided',
          usedHint: false,
          skillDimension: 'productive-recall',
        };
        const result = classifyRecallQuality(outcome);
        expect(result.rating).toBe('good');
      });

      it('should return highest evidence weight for unaided correct', () => {
        const weights = getEvidenceWeights();
        const outcome: AttemptOutcome = {
          correct: true,
          mode: 'unaided',
          usedHint: false,
          skillDimension: 'meaning',
        };
        const result = classifyRecallQuality(outcome);
        expect(result.evidenceWeight).toBe(weights.UNAIDED_CORRECT);
      });
    });
  });

  describe('Property 5: Recall-quality evidence ordering holds', () => {
    it('should always have unaided-correct > recognition-correct (R3.1)', () => {
      fc.assert(
        fc.property(skillDimensionArb, (skillDimension) => {
          const unaidedCorrect: AttemptOutcome = {
            correct: true,
            mode: 'unaided',
            usedHint: false,
            skillDimension,
          };
          const recognitionCorrect: AttemptOutcome = {
            correct: true,
            mode: 'recognition',
            usedHint: false,
            skillDimension,
          };

          const unaidedResult = classifyRecallQuality(unaidedCorrect);
          const recognitionResult = classifyRecallQuality(recognitionCorrect);

          return unaidedResult.evidenceWeight > recognitionResult.evidenceWeight;
        }),
        { numRuns: 100 }
      );
    });

    it('should always have unaided-correct > hinted-correct (R3.2)', () => {
      fc.assert(
        fc.property(skillDimensionArb, attemptModeArb, (skillDimension, mode) => {
          const unaidedCorrect: AttemptOutcome = {
            correct: true,
            mode: 'unaided',
            usedHint: false,
            skillDimension,
          };
          const hintedCorrect: AttemptOutcome = {
            correct: true,
            mode,
            usedHint: true,
            skillDimension,
          };

          const unaidedResult = classifyRecallQuality(unaidedCorrect);
          const hintedResult = classifyRecallQuality(hintedCorrect);

          return unaidedResult.evidenceWeight > hintedResult.evidenceWeight;
        }),
        { numRuns: 100 }
      );
    });

    it('should always have any correct > incorrect', () => {
      fc.assert(
        fc.property(attemptOutcomeArb, (outcome) => {
          if (!outcome.correct) return true; // Skip incorrect for this test

          const correctResult = classifyRecallQuality(outcome);
          const incorrectOutcome: AttemptOutcome = {
            ...outcome,
            correct: false,
          };
          const incorrectResult = classifyRecallQuality(incorrectOutcome);

          return correctResult.evidenceWeight > incorrectResult.evidenceWeight;
        }),
        { numRuns: 100 }
      );
    });

    it('should always return a valid rating', () => {
      fc.assert(
        fc.property(attemptOutcomeArb, (outcome) => {
          const result = classifyRecallQuality(outcome);
          return ['again', 'hard', 'good', 'easy'].includes(result.rating);
        }),
        { numRuns: 100 }
      );
    });

    it('should always return evidence weight in [0, 1]', () => {
      fc.assert(
        fc.property(attemptOutcomeArb, (outcome) => {
          const result = classifyRecallQuality(outcome);
          return result.evidenceWeight >= 0 && result.evidenceWeight <= 1;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('isFailureForRecovery', () => {
    it('should return true for incorrect answers', () => {
      const outcome: AttemptOutcome = {
        correct: false,
        mode: 'unaided',
        usedHint: false,
        skillDimension: 'meaning',
      };
      expect(isFailureForRecovery(outcome)).toBe(true);
    });

    it('should return true for correct-with-hint', () => {
      const outcome: AttemptOutcome = {
        correct: true,
        mode: 'unaided',
        usedHint: true,
        skillDimension: 'meaning',
      };
      expect(isFailureForRecovery(outcome)).toBe(true);
    });

    it('should return false for correct without hint', () => {
      const outcome: AttemptOutcome = {
        correct: true,
        mode: 'unaided',
        usedHint: false,
        skillDimension: 'meaning',
      };
      expect(isFailureForRecovery(outcome)).toBe(false);
    });

    it('should count failures correctly for recovery detection (R4.1)', () => {
      fc.assert(
        fc.property(attemptOutcomeArb, (outcome) => {
          const isFailure = isFailureForRecovery(outcome);
          // A failure is either incorrect OR correct-with-hint
          const expected = !outcome.correct || outcome.usedHint;
          return isFailure === expected;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('isCorrectUnaided', () => {
    it('should return true for correct without hint', () => {
      const outcome: AttemptOutcome = {
        correct: true,
        mode: 'unaided',
        usedHint: false,
        skillDimension: 'meaning',
      };
      expect(isCorrectUnaided(outcome)).toBe(true);
    });

    it('should return false for correct with hint', () => {
      const outcome: AttemptOutcome = {
        correct: true,
        mode: 'unaided',
        usedHint: true,
        skillDimension: 'meaning',
      };
      expect(isCorrectUnaided(outcome)).toBe(false);
    });

    it('should return false for incorrect', () => {
      const outcome: AttemptOutcome = {
        correct: false,
        mode: 'unaided',
        usedHint: false,
        skillDimension: 'meaning',
      };
      expect(isCorrectUnaided(outcome)).toBe(false);
    });

    it('should correctly identify clearing attempts (R4.3)', () => {
      fc.assert(
        fc.property(attemptOutcomeArb, (outcome) => {
          const isUnaided = isCorrectUnaided(outcome);
          // Must be correct AND without hint
          const expected = outcome.correct && !outcome.usedHint;
          return isUnaided === expected;
        }),
        { numRuns: 100 }
      );
    });
  });
});
