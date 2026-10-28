/**
 * Tests for FSRS Adapter
 * 
 * Feature: language-learning-app
 * 
 * Tests cover:
 * - Property 7: New items receive a valid default schedule (R2.3)
 * - Property 8: Reviews produce a valid updated schedule from history (R2.4)
 * - Unit tests for rating/state mapping
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { FsrsAdapter, createFsrsAdapter } from './fsrs-adapter';
import type { SchedulerInterface, SchedulerRating, ScheduleInput } from '../types';

// Arbitrary generators
const schedulerRatingArb: fc.Arbitrary<SchedulerRating> = fc.constantFrom(
  'again',
  'hard',
  'good',
  'easy'
);

const isoTimestampArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
  noInvalidDate: true,
}).map(d => d.toISOString());

describe('FsrsAdapter', () => {
  let scheduler: SchedulerInterface;

  beforeEach(() => {
    scheduler = new FsrsAdapter();
  });

  describe('createFsrsAdapter factory', () => {
    it('should create a valid scheduler instance', () => {
      const instance = createFsrsAdapter();
      expect(instance).toBeDefined();
      expect(typeof instance.schedule).toBe('function');
      expect(typeof instance.initialState).toBe('function');
    });
  });

  describe('initialState', () => {
    it('should create valid initial state', () => {
      const now = new Date().toISOString();
      const state = scheduler.initialState(now);

      expect(state).toBeDefined();
      expect(typeof state.stability).toBe('number');
      expect(typeof state.difficulty).toBe('number');
      expect(typeof state.due).toBe('string');
      expect(state.reps).toBe(0);
      expect(state.lapses).toBe(0);
    });

    it('should set due date to the provided time', () => {
      const now = '2024-06-15T10:00:00.000Z';
      const state = scheduler.initialState(now);

      // The due date should be at or after now (new cards are due immediately)
      expect(new Date(state.due).getTime()).toBeGreaterThanOrEqual(new Date(now).getTime() - 1000);
    });
  });

  describe('Property 7: New items receive a valid default schedule (R2.3)', () => {
    it('should always produce valid state for new items', () => {
      fc.assert(
        fc.property(isoTimestampArb, schedulerRatingArb, (now, rating) => {
          const input: ScheduleInput = {
            state: null, // New item
            rating,
            now,
          };

          const result = scheduler.schedule(input);

          // Must have valid state
          expect(result.state).toBeDefined();
          expect(typeof result.state.stability).toBe('number');
          expect(typeof result.state.difficulty).toBe('number');
          expect(typeof result.due).toBe('string');

          // Due must be a valid ISO timestamp
          expect(() => new Date(result.due)).not.toThrow();
          expect(new Date(result.due).toISOString()).toBe(result.due);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should use default FSRS parameters for new items', () => {
      fc.assert(
        fc.property(isoTimestampArb, (now) => {
          const input: ScheduleInput = {
            state: null,
            rating: 'good',
            now,
          };

          const result = scheduler.schedule(input);

          // Stability and difficulty should be reasonable initial values
          expect(result.state.stability).toBeGreaterThan(0);
          expect(result.state.difficulty).toBeGreaterThanOrEqual(0);
          expect(result.state.difficulty).toBeLessThanOrEqual(10);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Reviews produce a valid updated schedule from history (R2.4)', () => {
    it('should update schedule based on rating and history', () => {
      fc.assert(
        fc.property(
          isoTimestampArb,
          schedulerRatingArb,
          schedulerRatingArb,
          (initialNow, firstRating, secondRating) => {
            // First review (new item)
            const firstInput: ScheduleInput = {
              state: null,
              rating: firstRating,
              now: initialNow,
            };
            const firstResult = scheduler.schedule(firstInput);

            // Second review (with history)
            const secondNow = new Date(
              new Date(initialNow).getTime() + 24 * 60 * 60 * 1000
            ).toISOString();
            const secondInput: ScheduleInput = {
              state: firstResult.state,
              rating: secondRating,
              now: secondNow,
            };
            const secondResult = scheduler.schedule(secondInput);

            // Must produce valid state
            expect(secondResult.state).toBeDefined();
            expect(typeof secondResult.state.stability).toBe('number');
            expect(typeof secondResult.due).toBe('string');

            // Reps should increase for non-again ratings
            if (secondRating !== 'again') {
              expect(secondResult.state.reps).toBeGreaterThanOrEqual(firstResult.state.reps);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should schedule "again" ratings sooner than "good" ratings', () => {
      const now = new Date().toISOString();
      const state = scheduler.initialState(now);

      const againResult = scheduler.schedule({
        state,
        rating: 'again',
        now,
      });

      const goodResult = scheduler.schedule({
        state,
        rating: 'good',
        now,
      });

      const againDue = new Date(againResult.due).getTime();
      const goodDue = new Date(goodResult.due).getTime();

      expect(againDue).toBeLessThanOrEqual(goodDue);
    });

    it('should schedule "easy" ratings later than "good" ratings', () => {
      const now = new Date().toISOString();
      
      // Do a first review to get out of new state
      const firstResult = scheduler.schedule({
        state: null,
        rating: 'good',
        now,
      });

      // Now compare easy vs good on the next review
      const laterNow = new Date(
        new Date(now).getTime() + 24 * 60 * 60 * 1000
      ).toISOString();

      const goodResult = scheduler.schedule({
        state: firstResult.state,
        rating: 'good',
        now: laterNow,
      });

      const easyResult = scheduler.schedule({
        state: firstResult.state,
        rating: 'easy',
        now: laterNow,
      });

      const goodDue = new Date(goodResult.due).getTime();
      const easyDue = new Date(easyResult.due).getTime();

      expect(easyDue).toBeGreaterThanOrEqual(goodDue);
    });
  });

  describe('minIntervalMinutes enforcement (R5.4)', () => {
    it('should enforce minimum interval when specified', () => {
      const now = new Date().toISOString();
      const minIntervalMinutes = 10;

      const result = scheduler.schedule({
        state: null,
        rating: 'again', // Usually would have short interval
        now,
        minIntervalMinutes,
      });

      const nowTime = new Date(now).getTime();
      const dueTime = new Date(result.due).getTime();
      const actualMinutes = (dueTime - nowTime) / (60 * 1000);

      expect(actualMinutes).toBeGreaterThanOrEqual(minIntervalMinutes - 0.1); // Small tolerance for floating point
    });

    it('should not reduce interval below minimum', () => {
      fc.assert(
        fc.property(
          isoTimestampArb,
          schedulerRatingArb,
          fc.integer({ min: 1, max: 60 }),
          (now, rating, minMinutes) => {
            const result = scheduler.schedule({
              state: null,
              rating,
              now,
              minIntervalMinutes: minMinutes,
            });

            const nowTime = new Date(now).getTime();
            const dueTime = new Date(result.due).getTime();
            const actualMinutes = (dueTime - nowTime) / (60 * 1000);

            // Due should be at least minIntervalMinutes from now
            // Allow small tolerance for edge cases
            return actualMinutes >= minMinutes - 0.1;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Rating to grade mapping', () => {
    it('should map all ratings to valid FSRS grades', () => {
      const now = new Date().toISOString();
      const ratings: SchedulerRating[] = ['again', 'hard', 'good', 'easy'];

      for (const rating of ratings) {
        const result = scheduler.schedule({
          state: null,
          rating,
          now,
        });

        // All should produce valid results
        expect(result.state).toBeDefined();
        expect(result.due).toBeDefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle invalid date strings gracefully', () => {
      // The adapter logs the error and returns a fallback result
      // rather than throwing
      const result = scheduler.schedule({
        state: null,
        rating: 'good',
        now: 'invalid-date',
      });
      
      // Should return a fallback result, not throw
      expect(result.state).toBeDefined();
      expect(result.due).toBeDefined();
    });
  });
});
