/**
 * Analytics module exports
 * 
 * @module services/analytics
 */

export {
  calculateProgressAnalytics,
  DEFAULT_CONFIG,
  RECOGNITION_EXERCISE_TYPES,
  UNAIDED_EXERCISE_TYPES,
} from './progress-analytics';

export type {
  ProgressAnalytics,
  RetentionMetrics,
  SkillProgress,
  GrammarAttentionTopic,
  ProgressDataPoint,
  AnalyticsConfig,
} from './progress-analytics';
