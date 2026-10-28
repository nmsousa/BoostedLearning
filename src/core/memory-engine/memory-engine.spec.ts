/**
 * Tests for Memory Engine
 * 
 * Feature: language-learning-app
 * 
 * Tests cover:
 * - Property 1: Attempt history is faithfully recorded (R1.1, R1.2, R1.3)
 * - Property 2: Per-item counts and confidence are consistent with history (R1.4)
 * - Property 3: Skill dimensions are tracked independently (R1.5)
 * - Property 4: The engine and scheduler are language-agnostic (R1.6, R2.6)
 * - Property 9: Repeated forgetting both classifies and activates recovery (R4.1, R4.2)
 * - Property 10: The recovery clear condition is exact (R4.3)
 * - Property 17: Every reviewed item has a defined review reason (R6.1)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MemoryEngine, type ReviewStateRepository } from './memory-engine';
import { FsrsAdapter } from '../scheduler/fsrs-adapter';
import type {
  AttemptOutcome,
  Attempt,
  ReviewState,
  SkillDimension,
  AttemptMode,
  ExerciseType,
} from '../types';

// In-memory repository for testing
class InMemoryReviewStateRepository implements ReviewStateRepository {
  private reviewStates = new Map<string, ReviewState>();
  private attempts = new Map<string, Attempt[]>();

  async getReviewState(itemId: string): Promise<ReviewState | null> {
    return this.reviewStates.get(itemId) ?? null;
  }

  async saveReviewState(state: ReviewState): Promise<void> {
    this.reviewStates.set(state.learningItemId, state);
  }

  async getAttempts(itemId: string, since?: string): Promise<Attempt[]> {
    const all = [...(this.attempts.get(itemId) ?? [])];
    if (since) {
      return all.filter(a => a.time >= since);
    }
    return all;
  }

  async saveAttempt(attempt: Attempt): Promise<void> {
    const existing = this.attempts.get(attempt.learningItemId) ?? [];
    existing.push(attempt);
    this.attempts.set(attempt.learningItemId, existing);
  }

  getAllAttempts(itemId: string): Attempt[] {
    return [...(this.attempts.get(itemId) ?? [])];
  }
}

// Factory function to create fresh instances for each test
function createTestEngine(): { 
  repository: InMemoryReviewStateRepository; 
  engine: MemoryEngine;
} {
  const repository = new InMemoryReviewStateRepository();
  const scheduler = new FsrsAdapter();
  const engine = new MemoryEngine(repository, scheduler);
  return { repository, engine };
}

// Arbitrary generators
const skillDimensionArb: fc.Arbitrary<SkillDimension> = fc.constantFrom(
  'spelling',
  'meaning',
  'listening-recognition',
  'productive-recall'
);

const attemptModeArb: fc.Arbitrary<AttemptMode> = fc.constantFrom('recognition', 'unaided');

const exerciseTypeArb: fc.Arbitrary<ExerciseType> = fc.constantFrom(
  'flashcard',
  'multiple-choice',
  'typed-translation',
  'fill-blank'
);

const attemptOutcomeArb: fc.Arbitrary<AttemptOutcome> = fc.record({
  correct: fc.boolean(),
  mode: attemptModeArb,
  usedHint: fc.boolean(),
  skillDimension: skillDimensionArb,
});

const itemIdArb = fc.uuid();

describe('MemoryEngine', () => {
  describe('Property 1: Attempt history is faithfully recorded (R1.1, R1.2, R1.3)', () => {
    it('should record attempt with correct outcome, mode, and hint flag', async () => {
      const { repository, engine } = createTestEngine();
      const itemId = 'test-item-1';
      const now = new Date().toISOString();
      const outcome: AttemptOutcome = {
        correct: true,
        mode: 'unaided',
        usedHint: false,
        skillDimension: 'meaning',
      };

      await engine.recordAttempt(itemId, outcome, now, 'flashcard', 'ex-1', 'session-1');

      const attempts = repository.getAllAttempts(itemId);
      expect(attempts).toHaveLength(1);
      expect(attempts[0].outcome.correct).toBe(true);
      expect(attempts[0].outcome.mode).toBe('unaided');
      expect(attempts[0].outcome.usedHint).toBe(false);
      expect(attempts[0].outcome.skillDimension).toBe('meaning');
      expect(attempts[0].time).toBe(now);
    });

    it('should faithfully record any attempt outcome', async () => {
      await fc.assert(
        fc.asyncProperty(
          itemIdArb,
          attemptOutcomeArb,
          exerciseTypeArb,
          async (itemId, outcome, exerciseType) => {
            const { repository, engine } = createTestEngine();
            const now = new Date().toISOString();

            await engine.recordAttempt(itemId, outcome, now, exerciseType);

            const attempts = repository.getAllAttempts(itemId);
            expect(attempts).toHaveLength(1);
            expect(attempts[0].outcome.correct).toBe(outcome.correct);
            expect(attempts[0].outcome.mode).toBe(outcome.mode);
            expect(attempts[0].outcome.usedHint).toBe(outcome.usedHint);
            expect(attempts[0].outcome.skillDimension).toBe(outcome.skillDimension);
            expect(attempts[0].exerciseType).toBe(exerciseType);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2: Per-item counts and confidence are consistent with history (R1.4)', () => {
    it('should increment attempt count on each attempt', async () => {
      const { engine } = createTestEngine();
      const itemId = 'test-item-2';
      const outcome: AttemptOutcome = {
        correct: true,
        mode: 'unaided',
        usedHint: false,
        skillDimension: 'meaning',
      };

      for (let i = 1; i <= 5; i++) {
        const result = await engine.recordAttempt(
          itemId,
          outcome,
          new Date(Date.now() + i * 1000).toISOString()
        );
        expect(result.reviewState.attemptCount).toBe(i);
      }
    });

    it('should increment mistake count only for incorrect attempts', async () => {
      const { engine } = createTestEngine();
      const itemId = 'test-item-3';
      
      // 2 correct, 3 incorrect
      const outcomes: AttemptOutcome[] = [
        { correct: true, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        { correct: true, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
      ];

      let result;
      for (let i = 0; i < outcomes.length; i++) {
        result = await engine.recordAttempt(
          itemId,
          outcomes[i],
          new Date(Date.now() + i * 1000).toISOString()
        );
      }

      expect(result!.reviewState.attemptCount).toBe(5);
      expect(result!.reviewState.mistakeCount).toBe(3);
    });

    it('should calculate confidence based on recent success rate', async () => {
      const { engine } = createTestEngine();
      const itemId = 'test-item-4';
      
      // 8 correct, 2 incorrect = 80% confidence
      const outcomes: boolean[] = [true, true, false, true, true, true, true, false, true, true];

      let result;
      for (let i = 0; i < outcomes.length; i++) {
        result = await engine.recordAttempt(
          itemId,
          {
            correct: outcomes[i],
            mode: 'unaided',
            usedHint: false,
            skillDimension: 'meaning',
          },
          new Date(Date.now() + i * 1000).toISOString()
        );
      }

      expect(result!.reviewState.confidence).toBe(0.8);
    });
  });

  describe('Property 3: Skill dimensions are tracked independently (R1.5)', () => {
    it('should track attempts per skill dimension', async () => {
      const { engine } = createTestEngine();
      const itemId = 'test-item-5';
      const now = Date.now();

      // 2 meaning attempts (1 correct), 3 spelling attempts (2 correct)
      const attempts: { skill: SkillDimension; correct: boolean }[] = [
        { skill: 'meaning', correct: true },
        { skill: 'spelling', correct: true },
        { skill: 'meaning', correct: false },
        { skill: 'spelling', correct: false },
        { skill: 'spelling', correct: true },
      ];

      let result;
      for (let i = 0; i < attempts.length; i++) {
        result = await engine.recordAttempt(
          itemId,
          {
            correct: attempts[i].correct,
            mode: 'unaided',
            usedHint: false,
            skillDimension: attempts[i].skill,
          },
          new Date(now + i * 1000).toISOString()
        );
      }

      const state = result!.reviewState;
      expect(state.perSkillState['meaning']!.attemptCount).toBe(2);
      expect(state.perSkillState['meaning']!.mistakeCount).toBe(1);
      expect(state.perSkillState['spelling']!.attemptCount).toBe(3);
      expect(state.perSkillState['spelling']!.mistakeCount).toBe(1);
      expect(state.perSkillState['listening-recognition']!.attemptCount).toBe(0);
      expect(state.perSkillState['productive-recall']!.attemptCount).toBe(0);
    });
  });

  describe('Property 4: The engine and scheduler are language-agnostic (R1.6, R2.6)', () => {
    it('should handle items with any language ID identically', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 2, maxLength: 10 }), // languageId
          itemIdArb,
          attemptOutcomeArb,
          async (languageId, itemId, outcome) => {
            const { engine } = createTestEngine();
            // The engine doesn't even see languageId - it operates purely on itemId
            // This test confirms the interface doesn't require language info
            const now = new Date().toISOString();

            const result = await engine.recordAttempt(itemId, outcome, now);

            // Engine produces valid results regardless of what "language" the item is
            expect(result.reviewState).toBeDefined();
            expect(result.nextDue).toBeDefined();
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 17: Every reviewed item has a defined review reason (R6.1)', () => {
    it('should return "new" for items with no history', async () => {
      const { engine } = createTestEngine();
      const itemId = 'new-item';
      const now = new Date().toISOString();

      const reason = await engine.reviewReasonFor(itemId, now);
      expect(reason).toBe('new');
    });

    it('should return "due" for normal reviewed items', async () => {
      const { engine } = createTestEngine();
      const itemId = 'reviewed-item';
      const now = new Date().toISOString();

      await engine.recordAttempt(
        itemId,
        { correct: true, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        now
      );

      const reason = await engine.reviewReasonFor(itemId, now);
      expect(reason).toBe('due');
    });

    it('should return "recovery" for repeatedly-forgotten items', async () => {
      const { engine } = createTestEngine();
      const itemId = 'struggling-item';
      const baseTime = Date.now();

      // Trigger recovery with 3 failures
      for (let i = 0; i < 3; i++) {
        await engine.recordAttempt(
          itemId,
          { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
          new Date(baseTime + i * 1000).toISOString()
        );
      }

      const reason = await engine.reviewReasonFor(
        itemId,
        new Date(baseTime + 4000).toISOString()
      );
      expect(reason).toBe('recovery');
    });

    it('should always return a valid reason', async () => {
      await fc.assert(
        fc.asyncProperty(
          itemIdArb,
          fc.array(attemptOutcomeArb, { minLength: 0, maxLength: 5 }),
          async (itemId, outcomes) => {
            const { engine } = createTestEngine();
            const baseTime = Date.now();

            for (let i = 0; i < outcomes.length; i++) {
              await engine.recordAttempt(
                itemId,
                outcomes[i],
                new Date(baseTime + i * 1000).toISOString()
              );
            }

            const now = new Date(baseTime + outcomes.length * 1000).toISOString();
            const reason = await engine.reviewReasonFor(itemId, now);

            expect(['new', 'due', 'recovery']).toContain(reason);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 9: Repeated forgetting both classifies and activates recovery (R4.1, R4.2)', () => {
    it('should enter recovery after 3 failures within 7 days', async () => {
      const { engine } = createTestEngine();
      const itemId = 'failing-item';
      const baseTime = Date.now();

      // 2 failures - should not trigger recovery
      for (let i = 0; i < 2; i++) {
        const result = await engine.recordAttempt(
          itemId,
          { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
          new Date(baseTime + i * 1000).toISOString()
        );
        expect(result.reviewState.repeatedlyForgotten).toBe(false);
      }

      // 3rd failure - should trigger recovery
      const result = await engine.recordAttempt(
        itemId,
        { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        new Date(baseTime + 2000).toISOString()
      );
      expect(result.reviewState.repeatedlyForgotten).toBe(true);
      expect(result.recoveryChanged).toBe(true);
    });

    it('should count correct-with-hint as a failure for recovery', async () => {
      const { engine } = createTestEngine();
      const itemId = 'hinted-item';
      const baseTime = Date.now();

      // 3 correct-with-hint attempts
      for (let i = 0; i < 3; i++) {
        await engine.recordAttempt(
          itemId,
          { correct: true, mode: 'unaided', usedHint: true, skillDimension: 'meaning' },
          new Date(baseTime + i * 1000).toISOString()
        );
      }

      const isRecovering = await engine.isRepeatedlyForgotten(
        itemId,
        new Date(baseTime + 3000).toISOString()
      );
      expect(isRecovering).toBe(true);
    });

    it('should not trigger recovery for failures outside the window', async () => {
      const { engine } = createTestEngine();
      const itemId = 'old-failures';
      const now = Date.now();
      const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;

      // 3 failures 8 days ago
      for (let i = 0; i < 3; i++) {
        await engine.recordAttempt(
          itemId,
          { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
          new Date(eightDaysAgo + i * 1000).toISOString()
        );
      }

      const isRecovering = await engine.isRepeatedlyForgotten(
        itemId,
        new Date(now).toISOString()
      );
      expect(isRecovering).toBe(false);
    });
  });

  describe('Property 10: The recovery clear condition is exact (R4.3)', () => {
    it('should clear recovery after 2 consecutive correct-unaided attempts 1+ days apart', async () => {
      const { engine } = createTestEngine();
      const itemId = 'recovering-item';
      const baseTime = Date.now();

      // Enter recovery with 3 failures
      for (let i = 0; i < 3; i++) {
        await engine.recordAttempt(
          itemId,
          { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
          new Date(baseTime + i * 1000).toISOString()
        );
      }

      // Verify in recovery
      expect(await engine.isRepeatedlyForgotten(itemId, new Date(baseTime + 3000).toISOString())).toBe(true);

      // First correct-unaided
      const oneDayLater = baseTime + 24 * 60 * 60 * 1000;
      await engine.recordAttempt(
        itemId,
        { correct: true, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        new Date(oneDayLater).toISOString()
      );

      // Still in recovery after just 1
      expect(await engine.isRepeatedlyForgotten(itemId, new Date(oneDayLater + 1000).toISOString())).toBe(true);

      // Second correct-unaided, 1+ days after the first
      const twoDaysLater = oneDayLater + 24 * 60 * 60 * 1000;
      const result = await engine.recordAttempt(
        itemId,
        { correct: true, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        new Date(twoDaysLater).toISOString()
      );

      // Should be cleared now
      expect(result.reviewState.repeatedlyForgotten).toBe(false);
      expect(result.recoveryChanged).toBe(true);
    });

    it('should not clear recovery if attempts are less than 1 day apart', async () => {
      const { engine } = createTestEngine();
      const itemId = 'quick-recovery-attempt';
      const baseTime = Date.now();

      // Enter recovery
      for (let i = 0; i < 3; i++) {
        await engine.recordAttempt(
          itemId,
          { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
          new Date(baseTime + i * 1000).toISOString()
        );
      }

      // Two correct attempts same day (just minutes apart)
      const laterSameDay = baseTime + 60 * 60 * 1000; // 1 hour later
      await engine.recordAttempt(
        itemId,
        { correct: true, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        new Date(laterSameDay).toISOString()
      );

      const result = await engine.recordAttempt(
        itemId,
        { correct: true, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        new Date(laterSameDay + 60000).toISOString() // 1 minute later
      );

      // Should still be in recovery - attempts not 1 day apart
      expect(result.reviewState.repeatedlyForgotten).toBe(true);
    });

    it('should reset consecutive count on failure', async () => {
      const { engine } = createTestEngine();
      const itemId = 'reset-item';
      const baseTime = Date.now();

      // Enter recovery
      for (let i = 0; i < 3; i++) {
        await engine.recordAttempt(
          itemId,
          { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
          new Date(baseTime + i * 1000).toISOString()
        );
      }

      // One correct-unaided
      const oneDayLater = baseTime + 24 * 60 * 60 * 1000;
      await engine.recordAttempt(
        itemId,
        { correct: true, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        new Date(oneDayLater).toISOString()
      );

      // Then a failure - should reset the consecutive count
      await engine.recordAttempt(
        itemId,
        { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        new Date(oneDayLater + 1000).toISOString()
      );

      // Now need 2 more consecutive correct-unaided
      const twoDaysLater = oneDayLater + 24 * 60 * 60 * 1000;
      await engine.recordAttempt(
        itemId,
        { correct: true, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
        new Date(twoDaysLater).toISOString()
      );

      // Still in recovery - only 1 consecutive after the reset
      expect(await engine.isRepeatedlyForgotten(itemId, new Date(twoDaysLater + 1000).toISOString())).toBe(true);
    });
  });

  describe('Recovery workflow helpers (R5)', () => {
    it('should suggest different exercise types during recovery', async () => {
      const { repository, engine } = createTestEngine();
      const itemId = 'varied-item';
      const baseTime = Date.now();

      // Enter recovery
      for (let i = 0; i < 3; i++) {
        await engine.recordAttempt(
          itemId,
          { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
          new Date(baseTime + i * 1000).toISOString(),
          'flashcard'
        );
      }

      const state = await repository.getReviewState(itemId);
      expect(state).not.toBeNull();
      expect(state!.repeatedlyForgotten).toBe(true);

      // Should suggest a different type than the last used
      const applicableTypes: ExerciseType[] = ['flashcard', 'multiple-choice', 'typed-translation'];
      const suggestion = engine.getNextExerciseTypeForRecovery(state!, applicableTypes);

      expect(suggestion).not.toBe('flashcard'); // Should avoid last used
      expect(applicableTypes).toContain(suggestion);
    });

    it('should enforce minimum delay for recovering items', async () => {
      const { repository, engine } = createTestEngine();
      const itemId = 'delayed-item';
      const baseTime = Date.now();

      // Enter recovery
      for (let i = 0; i < 3; i++) {
        await engine.recordAttempt(
          itemId,
          { correct: false, mode: 'unaided', usedHint: false, skillDimension: 'meaning' },
          new Date(baseTime + i * 1000).toISOString()
        );
      }

      const state = await repository.getReviewState(itemId);

      // Immediately after - should not be allowed
      const canReviewImmediately = engine.canReviewRecoveringItem(
        state!,
        new Date(baseTime + 5000).toISOString()
      );
      expect(canReviewImmediately).toBe(false);

      // After 10 minutes - should be allowed
      const canReviewLater = engine.canReviewRecoveringItem(
        state!,
        new Date(baseTime + 11 * 60 * 1000).toISOString()
      );
      expect(canReviewLater).toBe(true);
    });
  });
});
