/**
 * Knowledge Level Classifier Tests
 */

import { describe, it, expect } from 'vitest';
import {
  classifyKnowledgeLevel,
  summarizeKnowledge,
  DEFAULT_KNOWLEDGE_THRESHOLDS,
} from './knowledge-level';

describe('classifyKnowledgeLevel', () => {
  it('classifies high confidence as known', () => {
    expect(classifyKnowledgeLevel({ confidence: 0.9, repeatedlyForgotten: false })).toBe('known');
    expect(classifyKnowledgeLevel({ confidence: 0.8, repeatedlyForgotten: false })).toBe('known');
  });

  it('classifies mid confidence as familiar', () => {
    expect(classifyKnowledgeLevel({ confidence: 0.5, repeatedlyForgotten: false })).toBe('familiar');
    expect(classifyKnowledgeLevel({ confidence: 0.7, repeatedlyForgotten: false })).toBe('familiar');
  });

  it('classifies low confidence as learning', () => {
    expect(classifyKnowledgeLevel({ confidence: 0.4, repeatedlyForgotten: false })).toBe('learning');
    expect(classifyKnowledgeLevel({ confidence: 0, repeatedlyForgotten: false })).toBe('learning');
  });

  it('always classifies repeatedly-forgotten items as learning, even at high confidence', () => {
    expect(classifyKnowledgeLevel({ confidence: 0.95, repeatedlyForgotten: true })).toBe('learning');
  });

  it('respects the exact threshold boundaries', () => {
    const { knownThreshold, familiarThreshold } = DEFAULT_KNOWLEDGE_THRESHOLDS;
    // Just below known -> familiar
    expect(classifyKnowledgeLevel({ confidence: knownThreshold - 0.001, repeatedlyForgotten: false })).toBe('familiar');
    // Just below familiar -> learning
    expect(classifyKnowledgeLevel({ confidence: familiarThreshold - 0.001, repeatedlyForgotten: false })).toBe('learning');
  });

  it('supports custom thresholds', () => {
    const level = classifyKnowledgeLevel(
      { confidence: 0.6, repeatedlyForgotten: false },
      { familiarThreshold: 0.3, knownThreshold: 0.6 }
    );
    expect(level).toBe('known');
  });
});

describe('summarizeKnowledge', () => {
  it('returns all zeros for no items', () => {
    expect(summarizeKnowledge([])).toEqual({
      learning: 0,
      familiar: 0,
      known: 0,
      neverStudied: 0,
      total: 0,
    });
  });

  it('counts never-studied items separately and excludes them from buckets', () => {
    const result = summarizeKnowledge([
      { confidence: 0, repeatedlyForgotten: false, attemptCount: 0 },
      { confidence: 0, repeatedlyForgotten: false, attemptCount: 0 },
    ]);
    expect(result.neverStudied).toBe(2);
    expect(result.total).toBe(0);
    expect(result.learning).toBe(0);
  });

  it('buckets a mix of items correctly', () => {
    const result = summarizeKnowledge([
      { confidence: 0.9, repeatedlyForgotten: false, attemptCount: 5 }, // known
      { confidence: 0.85, repeatedlyForgotten: false, attemptCount: 3 }, // known
      { confidence: 0.6, repeatedlyForgotten: false, attemptCount: 2 }, // familiar
      { confidence: 0.2, repeatedlyForgotten: false, attemptCount: 1 }, // learning
      { confidence: 0.95, repeatedlyForgotten: true, attemptCount: 4 }, // learning (recovery)
      { confidence: 0, repeatedlyForgotten: false, attemptCount: 0 }, // never studied
    ]);
    expect(result).toEqual({
      learning: 2,
      familiar: 1,
      known: 2,
      neverStudied: 1,
      total: 5,
    });
  });
});
