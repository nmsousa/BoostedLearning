/**
 * Gamification Service
 * 
 * Provides gamification mechanics: daily goals, XP, streaks, achievements.
 * Rewards meaningful recall/consistency, not speed/volume.
 * No manipulative mechanics, urgency, or pay-to-progress.
 * 
 * Requirements: 19.1-19.8
 * 
 * @module services/gamification
 */

import { Attempt, ReviewState } from '../../core/types';

/**
 * Daily goal progress
 */
export interface DailyGoal {
  /** Target number of items to review */
  targetItems: number;
  /** Items completed today */
  completedItems: number;
  /** Whether goal is met */
  isComplete: boolean;
  /** Progress percentage (0-100) */
  progress: number;
}

/**
 * XP and level information
 */
export interface XpInfo {
  /** Total XP earned */
  totalXp: number;
  /** Current level */
  level: number;
  /** XP needed for next level */
  xpForNextLevel: number;
  /** XP earned today */
  todayXp: number;
}

/**
 * Streak information
 */
export interface StreakInfo {
  /** Current consecutive days */
  currentStreak: number;
  /** Longest streak achieved */
  longestStreak: number;
  /** Whether today has activity */
  todayActive: boolean;
  /** Last active date (ISO string) */
  lastActiveDate: string | null;
}

/**
 * Achievement definition
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'milestone' | 'mastery' | 'consistency';
  /** Whether earned */
  earned: boolean;
  /** Date earned (ISO) */
  earnedAt: string | null;
  /** Progress toward achievement (0-100) */
  progress: number;
  /** Target value for progress */
  targetValue: number;
  /** Current value */
  currentValue: number;
}

/**
 * Weekly summary
 */
export interface WeeklySummary {
  /** Days active this week */
  daysActive: number;
  /** Items reviewed this week */
  itemsReviewed: number;
  /** Accuracy this week */
  accuracy: number;
  /** XP earned this week */
  xpEarned: number;
  /** New items learned */
  newItemsLearned: number;
  /** Compare to last week */
  compareToLastWeek: {
    daysActive: number;
    itemsReviewed: number;
    accuracy: number;
  };
}

/**
 * Gamification state persisted to storage
 */
export interface GamificationState {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  achievements: Achievement[];
  dailyGoalTarget: number;
  preferredSessionLength: number;
  remindersEnabled: boolean;
  reducedDistraction: boolean;
  /** Dates when the user studied (ISO date strings) */
  activeDates: string[];
}

/**
 * XP awards per action (rewards meaningful recall)
 */
const XP_AWARDS = {
  /** Correct unaided answer */
  correctUnaided: 10,
  /** Correct with hint */
  correctWithHint: 3,
  /** Review item (any) */
  reviewItem: 1,
  /** Complete daily goal */
  dailyGoalComplete: 50,
  /** Streak day maintained */
  streakDay: 25,
  /** Master an item (high confidence) */
  masterItem: 20,
  /** Exit recovery successfully */
  exitRecovery: 30,
};

/**
 * Level thresholds
 */
const LEVEL_THRESHOLDS = [
  0,     // Level 1
  100,   // Level 2
  300,   // Level 3
  600,   // Level 4
  1000,  // Level 5
  1500,  // Level 6
  2200,  // Level 7
  3000,  // Level 8
  4000,  // Level 9
  5000,  // Level 10+
];

/**
 * Achievement definitions
 */
const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'earned' | 'earnedAt' | 'currentValue'>[] = [
  // Streak achievements
  {
    id: 'streak-3',
    name: 'Getting Started',
    description: 'Study 3 days in a row',
    icon: 'flame-outline',
    category: 'streak',
    progress: 0,
    targetValue: 3,
  },
  {
    id: 'streak-7',
    name: 'Week Warrior',
    description: 'Study 7 days in a row',
    icon: 'flame',
    category: 'streak',
    progress: 0,
    targetValue: 7,
  },
  {
    id: 'streak-30',
    name: 'Monthly Master',
    description: 'Study 30 days in a row',
    icon: 'trophy',
    category: 'streak',
    progress: 0,
    targetValue: 30,
  },
  // Milestone achievements
  {
    id: 'items-10',
    name: 'First Steps',
    description: 'Learn 10 items',
    icon: 'footsteps-outline',
    category: 'milestone',
    progress: 0,
    targetValue: 10,
  },
  {
    id: 'items-50',
    name: 'Growing Vocabulary',
    description: 'Learn 50 items',
    icon: 'book-outline',
    category: 'milestone',
    progress: 0,
    targetValue: 50,
  },
  {
    id: 'items-100',
    name: 'Centurion',
    description: 'Learn 100 items',
    icon: 'book',
    category: 'milestone',
    progress: 0,
    targetValue: 100,
  },
  // Mastery achievements
  {
    id: 'master-10',
    name: 'Emerging Expert',
    description: 'Master 10 items',
    icon: 'star-outline',
    category: 'mastery',
    progress: 0,
    targetValue: 10,
  },
  {
    id: 'master-25',
    name: 'Knowledge Builder',
    description: 'Master 25 items',
    icon: 'star-half-outline',
    category: 'mastery',
    progress: 0,
    targetValue: 25,
  },
  {
    id: 'master-50',
    name: 'Memory Champion',
    description: 'Master 50 items',
    icon: 'star',
    category: 'mastery',
    progress: 0,
    targetValue: 50,
  },
  // Consistency achievements
  {
    id: 'goals-7',
    name: 'Goal Getter',
    description: 'Complete daily goal 7 times',
    icon: 'checkmark-circle-outline',
    category: 'consistency',
    progress: 0,
    targetValue: 7,
  },
  {
    id: 'recovery-1',
    name: 'Never Give Up',
    description: 'Successfully recover a forgotten item',
    icon: 'refresh',
    category: 'consistency',
    progress: 0,
    targetValue: 1,
  },
];

/**
 * Create initial gamification state
 */
export function createInitialGamificationState(): GamificationState {
  return {
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    achievements: ACHIEVEMENT_DEFINITIONS.map(def => ({
      ...def,
      earned: false,
      earnedAt: null,
      currentValue: 0,
    })),
    dailyGoalTarget: 20,
    preferredSessionLength: 10,
    remindersEnabled: false,
    reducedDistraction: false,
    activeDates: [],
  };
}

/**
 * Calculate level from XP
 */
export function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Get XP needed for next level
 */
export function getXpForNextLevel(xp: number): number {
  const level = calculateLevel(xp);
  if (level >= LEVEL_THRESHOLDS.length) {
    // After max level, need 1000 XP per level
    const baseXp = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    const levelsAboveMax = level - LEVEL_THRESHOLDS.length;
    return baseXp + (levelsAboveMax + 1) * 1000;
  }
  return LEVEL_THRESHOLDS[level];
}

/**
 * Calculate XP for an attempt outcome
 */
export function calculateAttemptXp(outcome: Attempt['outcome']): number {
  let xp = XP_AWARDS.reviewItem;
  
  if (outcome.correct) {
    if (outcome.usedHint) {
      xp += XP_AWARDS.correctWithHint;
    } else {
      xp += XP_AWARDS.correctUnaided;
    }
  }
  
  return xp;
}

/**
 * Update streak based on activity
 * Returns new state without modifying original
 */
export function updateStreak(
  state: GamificationState,
  today: string // ISO date string (YYYY-MM-DD)
): GamificationState {
  const lastActive = state.lastActiveDate;
  
  // If already active today, no change
  if (lastActive === today) {
    return state;
  }
  
  const todayDate = new Date(today);
  const newState = { ...state, lastActiveDate: today };
  
  if (!lastActive) {
    // First activity ever
    newState.currentStreak = 1;
    newState.longestStreak = Math.max(1, state.longestStreak);
    newState.activeDates = [today];
    return newState;
  }
  
  const lastDate = new Date(lastActive);
  const daysDiff = Math.floor(
    (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysDiff === 1) {
    // Consecutive day - extend streak
    newState.currentStreak = state.currentStreak + 1;
    newState.longestStreak = Math.max(newState.currentStreak, state.longestStreak);
  } else if (daysDiff > 1) {
    // Missed days - but keep achievements and no penalty (R19.4)
    // Just reset current streak to 1
    newState.currentStreak = 1;
  }
  // daysDiff === 0 is handled above (same day)
  
  // Track active date
  if (!state.activeDates.includes(today)) {
    newState.activeDates = [...state.activeDates, today];
  }
  
  return newState;
}

/**
 * Check and award achievements
 * Returns updated state with newly earned achievements
 */
export function checkAchievements(
  state: GamificationState,
  context: {
    itemsLearned: number;
    itemsMastered: number;
    goalsCompleted: number;
    recoveredItems: number;
  },
  now: string // ISO timestamp
): { state: GamificationState; newAchievements: Achievement[] } {
  const newAchievements: Achievement[] = [];
  const achievements = state.achievements.map(achievement => {
    if (achievement.earned) {
      return achievement;
    }
    
    let currentValue = achievement.currentValue;
    
    // Update current value based on category
    switch (achievement.id) {
      case 'streak-3':
      case 'streak-7':
      case 'streak-30':
        currentValue = state.currentStreak;
        break;
      case 'items-10':
      case 'items-50':
      case 'items-100':
        currentValue = context.itemsLearned;
        break;
      case 'master-10':
      case 'master-25':
      case 'master-50':
        currentValue = context.itemsMastered;
        break;
      case 'goals-7':
        currentValue = context.goalsCompleted;
        break;
      case 'recovery-1':
        currentValue = context.recoveredItems;
        break;
    }
    
    const progress = Math.min(100, (currentValue / achievement.targetValue) * 100);
    const earned = currentValue >= achievement.targetValue;
    
    const updated = {
      ...achievement,
      currentValue,
      progress,
      earned,
      earnedAt: earned ? now : null,
    };
    
    if (earned && !achievement.earned) {
      newAchievements.push(updated);
    }
    
    return updated;
  });
  
  return {
    state: { ...state, achievements },
    newAchievements,
  };
}

/**
 * Calculate daily goal progress
 */
export function calculateDailyGoal(
  attempts: Attempt[],
  targetItems: number,
  today: string // ISO date string (YYYY-MM-DD)
): DailyGoal {
  // Count unique items reviewed today
  const todayAttempts = attempts.filter(a => a.time.startsWith(today));
  const uniqueItems = new Set(todayAttempts.map(a => a.learningItemId));
  const completedItems = uniqueItems.size;
  
  return {
    targetItems,
    completedItems,
    isComplete: completedItems >= targetItems,
    progress: Math.min(100, (completedItems / targetItems) * 100),
  };
}

/**
 * Calculate XP info from state
 */
export function calculateXpInfo(
  state: GamificationState,
  todayAttempts: Attempt[]
): XpInfo {
  const todayXp = todayAttempts.reduce((sum, a) => sum + calculateAttemptXp(a.outcome), 0);
  
  return {
    totalXp: state.totalXp,
    level: calculateLevel(state.totalXp),
    xpForNextLevel: getXpForNextLevel(state.totalXp),
    todayXp,
  };
}

/**
 * Calculate streak info from state
 */
export function calculateStreakInfo(
  state: GamificationState,
  today: string
): StreakInfo {
  return {
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    todayActive: state.lastActiveDate === today,
    lastActiveDate: state.lastActiveDate,
  };
}

/**
 * Calculate weekly summary
 */
export function calculateWeeklySummary(
  attempts: Attempt[],
  state: GamificationState
): WeeklySummary {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartIso = weekStart.toISOString().split('T')[0];
  
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekStartIso = lastWeekStart.toISOString().split('T')[0];
  
  // This week's attempts
  const thisWeekAttempts = attempts.filter(a => a.time >= weekStartIso);
  const thisWeekCorrect = thisWeekAttempts.filter(a => a.outcome.correct).length;
  const thisWeekDays = new Set(
    thisWeekAttempts.map(a => a.time.split('T')[0])
  ).size;
  
  // Last week's attempts
  const lastWeekAttempts = attempts.filter(
    a => a.time >= lastWeekStartIso && a.time < weekStartIso
  );
  const lastWeekCorrect = lastWeekAttempts.filter(a => a.outcome.correct).length;
  const lastWeekDays = new Set(
    lastWeekAttempts.map(a => a.time.split('T')[0])
  ).size;
  
  // New items (first attempt in this week)
  const itemFirstAttempts = new Map<string, string>();
  for (const attempt of attempts) {
    if (!itemFirstAttempts.has(attempt.learningItemId)) {
      itemFirstAttempts.set(attempt.learningItemId, attempt.time);
    }
  }
  const newItems = Array.from(itemFirstAttempts.entries())
    .filter(([_, time]) => time >= weekStartIso)
    .length;
  
  return {
    daysActive: thisWeekDays,
    itemsReviewed: new Set(thisWeekAttempts.map(a => a.learningItemId)).size,
    accuracy: thisWeekAttempts.length > 0 
      ? thisWeekCorrect / thisWeekAttempts.length 
      : 0,
    xpEarned: thisWeekAttempts.reduce((sum, a) => sum + calculateAttemptXp(a.outcome), 0),
    newItemsLearned: newItems,
    compareToLastWeek: {
      daysActive: thisWeekDays - lastWeekDays,
      itemsReviewed: new Set(thisWeekAttempts.map(a => a.learningItemId)).size -
                     new Set(lastWeekAttempts.map(a => a.learningItemId)).size,
      accuracy: lastWeekAttempts.length > 0
        ? (thisWeekCorrect / Math.max(1, thisWeekAttempts.length)) -
          (lastWeekCorrect / lastWeekAttempts.length)
        : 0,
    },
  };
}

export { XP_AWARDS, LEVEL_THRESHOLDS, ACHIEVEMENT_DEFINITIONS };
