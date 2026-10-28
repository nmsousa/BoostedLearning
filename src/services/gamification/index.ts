/**
 * Gamification module exports
 * 
 * @module services/gamification
 */

export {
  createInitialGamificationState,
  calculateLevel,
  getXpForNextLevel,
  calculateAttemptXp,
  updateStreak,
  checkAchievements,
  calculateDailyGoal,
  calculateXpInfo,
  calculateStreakInfo,
  calculateWeeklySummary,
  XP_AWARDS,
  LEVEL_THRESHOLDS,
  ACHIEVEMENT_DEFINITIONS,
} from './gamification-service';

export type {
  DailyGoal,
  XpInfo,
  StreakInfo,
  Achievement,
  WeeklySummary,
  GamificationState,
} from './gamification-service';
