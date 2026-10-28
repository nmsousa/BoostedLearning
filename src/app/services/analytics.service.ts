/**
 * Analytics Angular Service
 * 
 * Wraps the core Progress Analytics for Angular DI.
 * Provides progress metrics to the Progress Dashboard.
 * 
 * Requirements: 20.1-20.10
 * 
 * @module app/services
 */

import { Injectable } from '@angular/core';
import { MemoryEngineService } from './memory-engine.service';
import { ContentService } from './content.service';
import {
  calculateProgressAnalytics,
  ProgressAnalytics,
  AnalyticsConfig,
} from '../../services/analytics';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  constructor(
    private memoryEngine: MemoryEngineService,
    private contentService: ContentService
  ) {}

  /**
   * Calculate progress analytics for the current user
   */
  async calculateProgress(config?: Partial<AnalyticsConfig>): Promise<ProgressAnalytics> {
    // Get all review states and attempts from memory engine
    const reviewStates = this.getAllReviewStates();
    const attempts = this.getAllAttempts();
    const dueItemIds = this.memoryEngine.getDueItems();

    return calculateProgressAnalytics(reviewStates, attempts, dueItemIds, config);
  }

  /**
   * Get all review states from the memory engine
   */
  private getAllReviewStates() {
    // Get all items from content and check their review state
    const modules = this.contentService.getModulesForLanguage('nl');
    const reviewStates: any[] = [];
    
    for (const module of modules) {
      const lessons = this.contentService.getLessonsForModule(module.id);
      for (const lesson of lessons) {
        const items = this.contentService.getAvailableItemsForLesson(lesson.id);
        for (const item of items) {
          const state = this.memoryEngine.getReviewState(item.id);
          if (state) {
            reviewStates.push(state);
          }
        }
      }
    }
    
    return reviewStates;
  }

  /**
   * Get all attempts from the memory engine
   */
  private getAllAttempts() {
    // Get all items from content and their attempt history
    const modules = this.contentService.getModulesForLanguage('nl');
    const allAttempts: any[] = [];
    
    for (const module of modules) {
      const lessons = this.contentService.getLessonsForModule(module.id);
      for (const lesson of lessons) {
        const items = this.contentService.getAvailableItemsForLesson(lesson.id);
        for (const item of items) {
          const history = this.memoryEngine.getAttemptHistory(item.id);
          allAttempts.push(...history);
        }
      }
    }
    
    return allAttempts;
  }

  /**
   * Get items that need extra practice (recovering)
   */
  getRecoveringItems(): string[] {
    return this.memoryEngine.getRecoveringItems();
  }

  /**
   * Get items due for review
   */
  getDueItems(): string[] {
    return this.memoryEngine.getDueItems();
  }

  /**
   * Get study streak (consecutive days studied)
   */
  getStudyStreak(): number {
    // This would require persisted session data
    // For now, return 0 (to be implemented with gamification)
    return 0;
  }

  /**
   * Get today's study minutes
   */
  getTodayStudyMinutes(): number {
    const allAttempts = this.getAllAttempts();
    const today = new Date().toISOString().split('T')[0];
    
    const todayAttempts = allAttempts.filter(a => 
      a.time && a.time.startsWith(today)
    );
    
    // Estimate 30 seconds per attempt
    return Math.round(todayAttempts.length * 0.5);
  }
}
