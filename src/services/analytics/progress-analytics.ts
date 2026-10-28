/**
 * Progress Analytics Service
 * 
 * Derives metrics from learning history for the Progress Dashboard.
 * Reports unaided vs recognition retention separately.
 * 
 * Requirements: 3.3, 4.4, 6.2, 20.1-20.10
 * 
 * @module services/analytics
 */

import {
  Attempt,
  ReviewState,
  ExerciseType,
  SkillDimension,
  AttemptOutcome,
} from '../../core/types';

/**
 * Retention metrics with stated delay interval
 */
export interface RetentionMetrics {
  /** Retention rate after the stated interval (0-1) */
  rate: number;
  /** The delay interval in days */
  intervalDays: number;
  /** Sample size for the calculation */
  sampleSize: number;
}

/**
 * Per-skill progress breakdown
 */
export interface SkillProgress {
  dimension: SkillDimension;
  attemptCount: number;
  correctCount: number;
  accuracy: number;
  /** Items with low confidence in this dimension */
  needsAttention: number;
}

/**
 * Grammar topic needing attention
 */
export interface GrammarAttentionTopic {
  topic: string;
  mistakeRate: number;
  recentMistakes: number;
}

/**
 * Time-based progress data point
 */
export interface ProgressDataPoint {
  date: string;
  itemsStudied: number;
  itemsLearned: number;
  minutesStudied: number;
  accuracy: number;
}

/**
 * Complete progress analytics result
 */
export interface ProgressAnalytics {
  /** Total unique items studied at least once */
  itemsStudied: number;
  /** Items reliably recalled (high confidence, not recovering) */
  itemsReliablyRecalled: number;
  /** Items flagged as repeatedly forgotten */
  itemsRepeatedlyForgotten: string[];
  /** Items due for review now */
  itemsDueNow: number;
  /** Retention metrics with stated interval */
  retentionAfterDelay: RetentionMetrics;
  /** Unaided recall retention (typed, productive) */
  unaidedRetention: RetentionMetrics;
  /** Recognition retention (multiple choice, matching) */
  recognitionRetention: RetentionMetrics;
  /** Per-skill dimension progress */
  skillProgress: SkillProgress[];
  /** Exercise types that have produced correct-unaided attempts */
  winningExerciseTypes: ExerciseType[];
  /** Grammar topics needing attention */
  grammarTopicsNeedingAttention: GrammarAttentionTopic[];
  /** Total time studied in minutes */
  totalMinutesStudied: number;
  /** Progress over time */
  progressOverTime: ProgressDataPoint[];
  /** Next practice recommendation */
  nextPracticeRecommendation: string;
}

/**
 * Configuration for analytics calculation
 */
export interface AnalyticsConfig {
  /** Retention interval in days (default: 7) */
  retentionIntervalDays: number;
  /** Confidence threshold for "reliably recalled" (default: 0.8) */
  reliableRecallThreshold: number;
  /** Minimum attempts to consider for retention (default: 2) */
  minAttemptsForRetention: number;
  /** Days to look back for progress over time (default: 30) */
  progressWindowDays: number;
}

const DEFAULT_CONFIG: AnalyticsConfig = {
  retentionIntervalDays: 7,
  reliableRecallThreshold: 0.8,
  minAttemptsForRetention: 2,
  progressWindowDays: 30,
};

/**
 * Exercise types considered "recognition" based (not productive recall)
 */
const RECOGNITION_EXERCISE_TYPES: ExerciseType[] = [
  'multiple-choice',
  'matching',
];

/**
 * Exercise types considered "unaided" (productive recall)
 */
const UNAIDED_EXERCISE_TYPES: ExerciseType[] = [
  'typed-translation',
  'fill-blank',
  'word-order',
  'conjugation',
  'flashcard', // When requiring typed response
];

/**
 * Check if an attempt is unaided (productive recall)
 */
function isUnaidedAttempt(attempt: Attempt): boolean {
  return UNAIDED_EXERCISE_TYPES.includes(attempt.exerciseType) && 
         attempt.outcome.correct && 
         !attempt.outcome.usedHint;
}

/**
 * Check if an attempt is recognition-based
 */
function isRecognitionAttempt(attempt: Attempt): boolean {
  return RECOGNITION_EXERCISE_TYPES.includes(attempt.exerciseType);
}

/**
 * Calculate retention rate for a set of attempts with a delay
 */
function calculateRetentionWithDelay(
  attempts: Attempt[],
  intervalDays: number,
  filterFn?: (a: Attempt) => boolean
): RetentionMetrics {
  // Filter attempts if a filter function is provided
  const filtered = filterFn ? attempts.filter(filterFn) : attempts;
  
  // Group by item
  const byItem = new Map<string, Attempt[]>();
  for (const attempt of filtered) {
    const existing = byItem.get(attempt.learningItemId) || [];
    existing.push(attempt);
    byItem.set(attempt.learningItemId, existing);
  }
  
  let successCount = 0;
  let totalCount = 0;
  
  // For each item, check if there are attempts separated by the interval
  for (const [_, itemAttempts] of byItem) {
    const sorted = [...itemAttempts].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
    
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const daysDiff = (new Date(curr.time).getTime() - new Date(prev.time).getTime()) 
                       / (1000 * 60 * 60 * 24);
      
      // Check if this gap is close to our target interval (within 50%)
      if (daysDiff >= intervalDays * 0.5 && daysDiff <= intervalDays * 1.5) {
        totalCount++;
        if (curr.outcome.correct) {
          successCount++;
        }
      }
    }
  }
  
  return {
    rate: totalCount > 0 ? successCount / totalCount : 0,
    intervalDays,
    sampleSize: totalCount,
  };
}

/**
 * Calculate progress analytics from learning history
 */
export function calculateProgressAnalytics(
  reviewStates: ReviewState[],
  attempts: Attempt[],
  dueItemIds: string[],
  config: Partial<AnalyticsConfig> = {}
): ProgressAnalytics {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Items studied (have at least one attempt)
  const studiedItemIds = new Set(attempts.map(a => a.learningItemId));
  const itemsStudied = studiedItemIds.size;
  
  // Items reliably recalled (high confidence, not recovering)
  const itemsReliablyRecalled = reviewStates.filter(
    rs => rs.confidence >= cfg.reliableRecallThreshold && !rs.repeatedlyForgotten
  ).length;
  
  // Items repeatedly forgotten
  const itemsRepeatedlyForgotten = reviewStates
    .filter(rs => rs.repeatedlyForgotten)
    .map(rs => rs.learningItemId);
  
  // Retention after delay
  const retentionAfterDelay = calculateRetentionWithDelay(
    attempts,
    cfg.retentionIntervalDays
  );
  
  // Unaided retention (Property 6: partitioned separately)
  const unaidedRetention = calculateRetentionWithDelay(
    attempts,
    cfg.retentionIntervalDays,
    isUnaidedAttempt
  );
  
  // Recognition retention (Property 6: partitioned separately)
  const recognitionRetention = calculateRetentionWithDelay(
    attempts,
    cfg.retentionIntervalDays,
    isRecognitionAttempt
  );
  
  // Per-skill progress
  const skillProgress = calculateSkillProgress(attempts, reviewStates);
  
  // Winning exercise types (from recovery states)
  const winningExerciseTypes = extractWinningExerciseTypes(reviewStates);
  
  // Grammar topics needing attention
  const grammarTopicsNeedingAttention = findGrammarTopicsNeedingAttention(attempts);
  
  // Time studied (estimate from attempt timestamps)
  const totalMinutesStudied = estimateTotalStudyTime(attempts);
  
  // Progress over time
  const progressOverTime = calculateProgressOverTime(attempts, cfg.progressWindowDays);
  
  // Next practice recommendation
  const nextPracticeRecommendation = generateRecommendation(
    dueItemIds,
    itemsRepeatedlyForgotten,
    skillProgress,
    grammarTopicsNeedingAttention
  );
  
  return {
    itemsStudied,
    itemsReliablyRecalled,
    itemsRepeatedlyForgotten,
    itemsDueNow: dueItemIds.length,
    retentionAfterDelay,
    unaidedRetention,
    recognitionRetention,
    skillProgress,
    winningExerciseTypes,
    grammarTopicsNeedingAttention,
    totalMinutesStudied,
    progressOverTime,
    nextPracticeRecommendation,
  };
}

/**
 * Calculate per-skill dimension progress
 */
function calculateSkillProgress(
  attempts: Attempt[],
  reviewStates: ReviewState[]
): SkillProgress[] {
  const dimensions: SkillDimension[] = [
    'spelling',
    'meaning',
    'listening-recognition',
    'productive-recall',
  ];
  
  const result: SkillProgress[] = [];
  
  for (const dimension of dimensions) {
    const dimAttempts = attempts.filter(a => a.outcome.skillDimension === dimension);
    const correctCount = dimAttempts.filter(a => a.outcome.correct).length;
    
    // Count items needing attention in this dimension
    const needsAttention = reviewStates.filter(rs => {
      const skillState = rs.perSkillState[dimension];
      if (!skillState) return false;
      // Needs attention if low accuracy or high mistake rate
      const accuracy = skillState.attemptCount > 0 
        ? 1 - (skillState.mistakeCount / skillState.attemptCount)
        : 0;
      return accuracy < 0.7 && skillState.attemptCount >= 2;
    }).length;
    
    result.push({
      dimension,
      attemptCount: dimAttempts.length,
      correctCount,
      accuracy: dimAttempts.length > 0 ? correctCount / dimAttempts.length : 0,
      needsAttention,
    });
  }
  
  return result;
}

/**
 * Extract winning exercise types from recovery states
 */
function extractWinningExerciseTypes(reviewStates: ReviewState[]): ExerciseType[] {
  const winners = new Set<ExerciseType>();
  
  for (const rs of reviewStates) {
    if (rs.recoveryState?.winningExerciseTypes) {
      for (const type of rs.recoveryState.winningExerciseTypes) {
        winners.add(type);
      }
    }
  }
  
  return Array.from(winners);
}

/**
 * Find grammar topics needing attention based on mistake patterns
 */
function findGrammarTopicsNeedingAttention(attempts: Attempt[]): GrammarAttentionTopic[] {
  // Group by exercise type for grammar-related exercises
  const grammarTypes: ExerciseType[] = ['article-selection', 'conjugation'];
  const grammarAttempts = attempts.filter(a => grammarTypes.includes(a.exerciseType));
  
  const byType = new Map<ExerciseType, Attempt[]>();
  for (const attempt of grammarAttempts) {
    const existing = byType.get(attempt.exerciseType) || [];
    existing.push(attempt);
    byType.set(attempt.exerciseType, existing);
  }
  
  const topics: GrammarAttentionTopic[] = [];
  const topicNames: Record<ExerciseType, string> = {
    'article-selection': 'Articles (de/het)',
    'conjugation': 'Verb Conjugation',
    'flashcard': 'Flashcards',
    'matching': 'Matching',
    'typed-translation': 'Typed Translation',
    'multiple-choice': 'Multiple Choice',
    'fill-blank': 'Fill in the Blank',
    'word-order': 'Word Order',
    'listening': 'Listening',
    'mixed-review': 'Mixed Review',
  };
  
  for (const [type, typeAttempts] of byType) {
    const recentAttempts = typeAttempts.slice(-20); // Last 20 attempts
    const mistakes = recentAttempts.filter(a => !a.outcome.correct).length;
    const mistakeRate = mistakes / recentAttempts.length;
    
    if (mistakeRate > 0.3 && recentAttempts.length >= 5) {
      topics.push({
        topic: topicNames[type] || type,
        mistakeRate,
        recentMistakes: mistakes,
      });
    }
  }
  
  // Sort by mistake rate descending
  return topics.sort((a, b) => b.mistakeRate - a.mistakeRate);
}

/**
 * Estimate total study time from attempt timestamps
 */
function estimateTotalStudyTime(attempts: Attempt[]): number {
  if (attempts.length === 0) return 0;
  
  // Sort by time
  const sorted = [...attempts].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
  
  let totalMinutes = 0;
  const sessionGapMinutes = 30; // Assume new session if > 30 min gap
  const avgMinutesPerAttempt = 0.5; // Estimate 30 seconds per attempt
  
  let sessionAttempts = 1;
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].time);
    const curr = new Date(sorted[i].time);
    const gapMinutes = (curr.getTime() - prev.getTime()) / (1000 * 60);
    
    if (gapMinutes > sessionGapMinutes) {
      // End of session - add estimated time
      totalMinutes += sessionAttempts * avgMinutesPerAttempt;
      sessionAttempts = 1;
    } else {
      sessionAttempts++;
    }
  }
  
  // Add last session
  totalMinutes += sessionAttempts * avgMinutesPerAttempt;
  
  return Math.round(totalMinutes);
}

/**
 * Calculate progress over time
 */
function calculateProgressOverTime(
  attempts: Attempt[],
  windowDays: number
): ProgressDataPoint[] {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - windowDays);
  
  // Group attempts by date
  const byDate = new Map<string, Attempt[]>();
  
  for (const attempt of attempts) {
    const attemptDate = new Date(attempt.time);
    if (attemptDate < startDate) continue;
    
    const dateKey = attemptDate.toISOString().split('T')[0];
    const existing = byDate.get(dateKey) || [];
    existing.push(attempt);
    byDate.set(dateKey, existing);
  }
  
  // Build data points
  const dataPoints: ProgressDataPoint[] = [];
  const studiedItems = new Set<string>();
  
  for (let i = 0; i < windowDays; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    
    const dayAttempts = byDate.get(dateKey) || [];
    const correctAttempts = dayAttempts.filter(a => a.outcome.correct).length;
    
    // Track newly learned items
    for (const attempt of dayAttempts) {
      studiedItems.add(attempt.learningItemId);
    }
    
    dataPoints.push({
      date: dateKey,
      itemsStudied: dayAttempts.length > 0 
        ? new Set(dayAttempts.map(a => a.learningItemId)).size 
        : 0,
      itemsLearned: studiedItems.size,
      minutesStudied: Math.round(dayAttempts.length * 0.5),
      accuracy: dayAttempts.length > 0 ? correctAttempts / dayAttempts.length : 0,
    });
  }
  
  return dataPoints;
}

/**
 * Generate a practice recommendation based on current state
 */
function generateRecommendation(
  dueItemIds: string[],
  repeatedlyForgotten: string[],
  skillProgress: SkillProgress[],
  grammarTopics: GrammarAttentionTopic[]
): string {
  // Priority 1: Recovering items
  if (repeatedlyForgotten.length > 0) {
    return `Focus on ${repeatedlyForgotten.length} item(s) that need extra practice`;
  }
  
  // Priority 2: Due items
  if (dueItemIds.length > 0) {
    return `Review ${Math.min(dueItemIds.length, 20)} due item(s)`;
  }
  
  // Priority 3: Weak grammar topics
  if (grammarTopics.length > 0) {
    return `Practice ${grammarTopics[0].topic} to improve accuracy`;
  }
  
  // Priority 4: Weak skill dimensions
  const weakSkill = skillProgress.find(s => s.accuracy < 0.7 && s.attemptCount >= 5);
  if (weakSkill) {
    const skillNames: Record<SkillDimension, string> = {
      'spelling': 'spelling',
      'meaning': 'vocabulary meaning',
      'listening-recognition': 'listening comprehension',
      'productive-recall': 'productive recall',
      'receptive_vocabulary': 'receptive vocabulary',
      'productive_vocabulary': 'productive vocabulary',
      'grammar': 'grammar',
      'listening_comprehension': 'listening',
    };
    return `Focus on ${skillNames[weakSkill.dimension]} exercises`;
  }
  
  // Default: Learn new items
  return 'Learn new items to expand your vocabulary';
}

export { DEFAULT_CONFIG, RECOGNITION_EXERCISE_TYPES, UNAIDED_EXERCISE_TYPES };
