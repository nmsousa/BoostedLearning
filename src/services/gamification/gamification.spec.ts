/**
 * Gamification Service Tests
 * 
 * Tests for gamification mechanics including Property 37.
 * 
 * @module services/gamification
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createInitialGamificationState,
  calculateLevel,
  getXpForNextLevel,
  calculateAttemptXp,
  updateStreak,
  checkAchievements,
  calculateDailyGoal,
  calculateXpInfo,
  calculateStreakInfo,
  XP_AWARDS,
  LEVEL_THRESHOLDS,
  GamificationState,
} from './gamification-service';
import { Attempt } from '../../core/types';

describe('Gamification Service', () => {
  describe('createInitialGamificationState', () => {
    it('should create state with zero XP', () => {
      const state = createInitialGamificationState();
      expect(state.totalXp).toBe(0);
    });
    
    it('should create state with zero streak', () => {
      const state = createInitialGamificationState();
      expect(state.currentStreak).toBe(0);
      expect(state.longestStreak).toBe(0);
    });
    
    it('should create state with unearned achievements', () => {
      const state = createInitialGamificationState();
      expect(state.achievements.every(a => !a.earned)).toBe(true);
    });
    
    it('should have default settings', () => {
      const state = createInitialGamificationState();
      expect(state.dailyGoalTarget).toBe(20);
      expect(state.preferredSessionLength).toBe(10);
      expect(state.remindersEnabled).toBe(false);
      expect(state.reducedDistraction).toBe(false);
    });
  });
  
  describe('calculateLevel', () => {
    it('should return level 1 for 0 XP', () => {
      expect(calculateLevel(0)).toBe(1);
    });
    
    it('should return level 2 for 100 XP', () => {
      expect(calculateLevel(100)).toBe(2);
    });
    
    it('should return level 5 for 1000 XP', () => {
      expect(calculateLevel(1000)).toBe(5);
    });
    
    it('should return max level for very high XP', () => {
      expect(calculateLevel(10000)).toBe(10);
    });
    
    it('property test: level increases monotonically with XP', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 1, max: 1000 }),
          (xp, delta) => {
            const level1 = calculateLevel(xp);
            const level2 = calculateLevel(xp + delta);
            return level2 >= level1;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('getXpForNextLevel', () => {
    it('should return correct threshold for level 1', () => {
      expect(getXpForNextLevel(0)).toBe(LEVEL_THRESHOLDS[1]); // 100
    });
    
    it('should return correct threshold for level 2', () => {
      expect(getXpForNextLevel(100)).toBe(LEVEL_THRESHOLDS[2]); // 300
    });
  });
  
  describe('calculateAttemptXp', () => {
    it('should award XP for correct unaided answer', () => {
      const xp = calculateAttemptXp({
        correct: true,
        usedHint: false,
        mode: 'unaided',
        skillDimension: 'meaning',
      });
      expect(xp).toBe(XP_AWARDS.reviewItem + XP_AWARDS.correctUnaided);
    });
    
    it('should award less XP for correct with hint', () => {
      const xp = calculateAttemptXp({
        correct: true,
        usedHint: true,
        mode: 'unaided',
        skillDimension: 'meaning',
      });
      expect(xp).toBe(XP_AWARDS.reviewItem + XP_AWARDS.correctWithHint);
    });
    
    it('should award minimal XP for incorrect', () => {
      const xp = calculateAttemptXp({
        correct: false,
        usedHint: false,
        mode: 'unaided',
        skillDimension: 'meaning',
      });
      expect(xp).toBe(XP_AWARDS.reviewItem);
    });
    
    it('property test: unaided correct always awards more than hinted', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('spelling', 'meaning', 'listening-recognition', 'productive-recall'),
          (skillDimension) => {
            const unaidedXp = calculateAttemptXp({
              correct: true,
              usedHint: false,
              mode: 'unaided',
              skillDimension: skillDimension as any,
            });
            const hintedXp = calculateAttemptXp({
              correct: true,
              usedHint: true,
              mode: 'unaided',
              skillDimension: skillDimension as any,
            });
            return unaidedXp > hintedXp;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('updateStreak', () => {
    it('should start streak at 1 for first activity', () => {
      const state = createInitialGamificationState();
      const updated = updateStreak(state, '2024-01-15');
      
      expect(updated.currentStreak).toBe(1);
      expect(updated.longestStreak).toBe(1);
      expect(updated.lastActiveDate).toBe('2024-01-15');
    });
    
    it('should extend streak for consecutive days', () => {
      let state = createInitialGamificationState();
      state = updateStreak(state, '2024-01-15');
      state = updateStreak(state, '2024-01-16');
      
      expect(state.currentStreak).toBe(2);
      expect(state.longestStreak).toBe(2);
    });
    
    it('should not change streak for same day activity', () => {
      let state = createInitialGamificationState();
      state = updateStreak(state, '2024-01-15');
      const updated = updateStreak(state, '2024-01-15');
      
      expect(updated.currentStreak).toBe(1);
    });
    
    it('should reset streak after missed days but keep longest', () => {
      let state = createInitialGamificationState();
      state = updateStreak(state, '2024-01-15');
      state = updateStreak(state, '2024-01-16');
      state = updateStreak(state, '2024-01-17'); // 3 day streak
      state = updateStreak(state, '2024-01-20'); // Missed 2 days
      
      expect(state.currentStreak).toBe(1);
      expect(state.longestStreak).toBe(3);
    });
    
    it('should track active dates', () => {
      let state = createInitialGamificationState();
      state = updateStreak(state, '2024-01-15');
      state = updateStreak(state, '2024-01-16');
      
      expect(state.activeDates).toContain('2024-01-15');
      expect(state.activeDates).toContain('2024-01-16');
    });
  });
  
  describe('Property 37: Resuming after missed days keeps achievements and applies no penalty', () => {
    it('property test: missed days preserve achievements', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 30 }), { minLength: 3, maxLength: 10 }),
          (daysSequence) => {
            let state = createInitialGamificationState();
            
            // Simulate activity pattern
            let currentDate = new Date('2024-01-01');
            for (const dayGap of daysSequence) {
              currentDate = new Date(currentDate.getTime() + dayGap * 24 * 60 * 60 * 1000);
              const dateStr = currentDate.toISOString().split('T')[0];
              state = updateStreak(state, dateStr);
            }
            
            // Award some achievements
            const result = checkAchievements(state, {
              itemsLearned: 15,
              itemsMastered: 5,
              goalsCompleted: 3,
              recoveredItems: 1,
            }, currentDate.toISOString());
            state = result.state;
            
            // Earned achievements before gap
            const earnedBefore = state.achievements.filter(a => a.earned);
            const longestStreakBefore = state.longestStreak;
            
            // Miss 10 days
            currentDate = new Date(currentDate.getTime() + 10 * 24 * 60 * 60 * 1000);
            const newDateStr = currentDate.toISOString().split('T')[0];
            state = updateStreak(state, newDateStr);
            
            // Check achievements are preserved (no penalty)
            const earnedAfter = state.achievements.filter(a => a.earned);
            
            // All earned achievements should still be earned
            for (const before of earnedBefore) {
              const after = earnedAfter.find(a => a.id === before.id);
              if (!after?.earned) {
                return false;
              }
            }
            
            // Longest streak should be preserved
            if (state.longestStreak < longestStreakBefore) {
              return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should preserve longest streak after missed days', () => {
      let state = createInitialGamificationState();
      
      // Build up a 5-day streak
      state = updateStreak(state, '2024-01-01');
      state = updateStreak(state, '2024-01-02');
      state = updateStreak(state, '2024-01-03');
      state = updateStreak(state, '2024-01-04');
      state = updateStreak(state, '2024-01-05');
      
      expect(state.currentStreak).toBe(5);
      expect(state.longestStreak).toBe(5);
      
      // Miss a week
      state = updateStreak(state, '2024-01-12');
      
      // Current streak resets, but longest is preserved
      expect(state.currentStreak).toBe(1);
      expect(state.longestStreak).toBe(5);
    });
    
    it('should preserve earned achievements after missed days', () => {
      let state = createInitialGamificationState();
      
      // Simulate earning streak achievement
      state = updateStreak(state, '2024-01-01');
      state = updateStreak(state, '2024-01-02');
      state = updateStreak(state, '2024-01-03');
      
      // Check achievements
      const result = checkAchievements(state, {
        itemsLearned: 10,
        itemsMastered: 0,
        goalsCompleted: 0,
        recoveredItems: 0,
      }, '2024-01-03T12:00:00Z');
      state = result.state;
      
      // Should have earned streak-3
      const streakAchievement = state.achievements.find(a => a.id === 'streak-3');
      expect(streakAchievement?.earned).toBe(true);
      
      // Miss 10 days
      state = updateStreak(state, '2024-01-13');
      
      // Achievement should still be earned (no penalty for missed days)
      const afterAchievement = state.achievements.find(a => a.id === 'streak-3');
      expect(afterAchievement?.earned).toBe(true);
    });
  });
  
  describe('checkAchievements', () => {
    it('should award streak achievement when target reached', () => {
      let state = createInitialGamificationState();
      state = updateStreak(state, '2024-01-01');
      state = updateStreak(state, '2024-01-02');
      state = updateStreak(state, '2024-01-03');
      
      const result = checkAchievements(state, {
        itemsLearned: 0,
        itemsMastered: 0,
        goalsCompleted: 0,
        recoveredItems: 0,
      }, '2024-01-03T12:00:00Z');
      
      const streak3 = result.state.achievements.find(a => a.id === 'streak-3');
      expect(streak3?.earned).toBe(true);
      expect(result.newAchievements.map(a => a.id)).toContain('streak-3');
    });
    
    it('should award items milestone when target reached', () => {
      const state = createInitialGamificationState();
      
      const result = checkAchievements(state, {
        itemsLearned: 10,
        itemsMastered: 0,
        goalsCompleted: 0,
        recoveredItems: 0,
      }, '2024-01-03T12:00:00Z');
      
      const items10 = result.state.achievements.find(a => a.id === 'items-10');
      expect(items10?.earned).toBe(true);
    });
    
    it('should not re-award already earned achievements', () => {
      let state = createInitialGamificationState();
      
      // Award first time
      let result = checkAchievements(state, {
        itemsLearned: 10,
        itemsMastered: 0,
        goalsCompleted: 0,
        recoveredItems: 0,
      }, '2024-01-01T12:00:00Z');
      state = result.state;
      
      expect(result.newAchievements.length).toBe(1);
      
      // Check again - no new achievements
      result = checkAchievements(state, {
        itemsLearned: 15,
        itemsMastered: 0,
        goalsCompleted: 0,
        recoveredItems: 0,
      }, '2024-01-02T12:00:00Z');
      
      expect(result.newAchievements.filter(a => a.id === 'items-10')).toHaveLength(0);
    });
  });
  
  describe('calculateDailyGoal', () => {
    it('should count unique items reviewed today', () => {
      const attempts: Attempt[] = [
        createAttempt('item-1', '2024-01-15T10:00:00Z'),
        createAttempt('item-1', '2024-01-15T11:00:00Z'), // Same item
        createAttempt('item-2', '2024-01-15T12:00:00Z'),
        createAttempt('item-3', '2024-01-14T10:00:00Z'), // Yesterday
      ];
      
      const goal = calculateDailyGoal(attempts, 10, '2024-01-15');
      
      expect(goal.completedItems).toBe(2);
      expect(goal.targetItems).toBe(10);
      expect(goal.progress).toBe(20);
      expect(goal.isComplete).toBe(false);
    });
    
    it('should mark complete when target reached', () => {
      const attempts: Attempt[] = Array.from({ length: 10 }, (_, i) => 
        createAttempt(`item-${i}`, '2024-01-15T10:00:00Z')
      );
      
      const goal = calculateDailyGoal(attempts, 10, '2024-01-15');
      
      expect(goal.isComplete).toBe(true);
      expect(goal.progress).toBe(100);
    });
  });
  
  describe('calculateStreakInfo', () => {
    it('should indicate today is active when active today', () => {
      let state = createInitialGamificationState();
      state = updateStreak(state, '2024-01-15');
      
      const info = calculateStreakInfo(state, '2024-01-15');
      
      expect(info.todayActive).toBe(true);
    });
    
    it('should indicate today is not active when not active today', () => {
      let state = createInitialGamificationState();
      state = updateStreak(state, '2024-01-14');
      
      const info = calculateStreakInfo(state, '2024-01-15');
      
      expect(info.todayActive).toBe(false);
    });
  });
});

// Helper function
function createAttempt(learningItemId: string, time: string): Attempt {
  return {
    id: `attempt-${Math.random().toString(36).slice(2)}`,
    learningItemId,
    exerciseId: 'ex-1',
    sessionId: 'session-1',
    time,
    outcome: {
      correct: true,
      usedHint: false,
      mode: 'unaided',
      skillDimension: 'meaning',
    },
    exerciseType: 'flashcard',
    updatedAt: time,
  };
}
