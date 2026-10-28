/**
 * Progress Page
 * 
 * Displays learning progress analytics and statistics.
 * Shows overall progress, due items, recovering items, and recent activity.
 * 
 * @module app/progress
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { MemoryEngineService } from '../services/memory-engine.service';
import { ContentService } from '../services/content.service';
import { AnalyticsService } from '../services/analytics.service';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import type { ProgressAnalytics, SkillProgress } from '../../services/analytics';

interface ProgressStats {
  totalItems: number;
  learnedItems: number;
  dueItems: number;
  recoveringItems: number;
  newItems: number;
  masteredItems: number;
}

interface ModuleProgress {
  moduleId: string;
  moduleName: string;
  totalLessons: number;
  completedLessons: number;
  progress: number;
}

@Component({
  selector: 'app-progress',
  templateUrl: './progress.page.html',
  styleUrls: ['./progress.page.scss'],
  standalone: false,
})
export class ProgressPage implements OnInit, OnDestroy {
  stats: ProgressStats = {
    totalItems: 0,
    learnedItems: 0,
    dueItems: 0,
    recoveringItems: 0,
    newItems: 0,
    masteredItems: 0,
  };

  moduleProgress: ModuleProgress[] = [];
  skillProgress: SkillProgress[] = [];
  currentStreak = 0;
  longestStreak = 0;
  totalReviews = 0;
  selectedLanguage = 'nl';
  recommendation = '';

  private destroy$ = new Subject<void>();

  constructor(
    private memoryEngine: MemoryEngineService,
    private contentService: ContentService,
    private analyticsService: AnalyticsService
  ) {}

  async ngOnInit() {
    this.contentService.initialize();
    await this.loadProgress();

    // Refresh stats every minute
    interval(60000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadProgress());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadProgress() {
    await this.loadStats();
    await this.loadModuleProgress();
    await this.loadAnalytics();
  }

  private async loadAnalytics() {
    try {
      const analytics = await this.analyticsService.calculateProgress();
      this.skillProgress = analytics.skillProgress;
      this.recommendation = analytics.nextPracticeRecommendation;
    } catch (e) {
      // Fallback if analytics fail
      this.skillProgress = [];
      this.recommendation = 'Start practicing to see recommendations';
    }
  }

  private async loadStats() {
    const modules = this.contentService.getModulesForLanguage(this.selectedLanguage);
    const allItemIds = new Set<string>();
    let learnedCount = 0;
    let masteredCount = 0;

    // Collect all items across modules
    for (const module of modules) {
      const lessons = this.contentService.getLessonsForModule(module.id);
      for (const lesson of lessons) {
        const items = this.contentService.getAvailableItemsForLesson(lesson.id);
        for (const item of items) {
          allItemIds.add(item.id);

          const history = this.memoryEngine.getAttemptHistory(item.id);
          if (history.length > 0) {
            learnedCount++;
            this.totalReviews += history.length;

            // Consider mastered if confidence > 0.9 and not recovering
            const state = this.memoryEngine.getReviewState(item.id);
            if (state && state.confidence > 0.9 && !this.memoryEngine.isRecovering(item.id)) {
              masteredCount++;
            }
          }
        }
      }
    }

    const dueItems = this.memoryEngine.getDueItems();
    const recoveringItems = this.memoryEngine.getRecoveringItems();

    this.stats = {
      totalItems: allItemIds.size,
      learnedItems: learnedCount,
      dueItems: dueItems.length,
      recoveringItems: recoveringItems.length,
      newItems: allItemIds.size - learnedCount,
      masteredItems: masteredCount,
    };
  }

  private async loadModuleProgress() {
    const modules = this.contentService.getModulesForLanguage(this.selectedLanguage);
    this.moduleProgress = [];

    for (const module of modules) {
      const lessons = this.contentService.getLessonsForModule(module.id);
      let completedLessons = 0;

      for (const lesson of lessons) {
        const items = this.contentService.getAvailableItemsForLesson(lesson.id);
        if (items.length === 0) continue;

        // Lesson is complete if all items have been reviewed at least once
        const allReviewed = items.every(item => {
          const history = this.memoryEngine.getAttemptHistory(item.id);
          return history.length > 0;
        });

        if (allReviewed) {
          completedLessons++;
        }
      }

      const totalLessons = lessons.length;
      this.moduleProgress.push({
        moduleId: module.id,
        moduleName: module.title,
        totalLessons,
        completedLessons,
        progress: totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
      });
    }
  }

  getOverallProgress(): number {
    if (this.stats.totalItems === 0) return 0;
    return (this.stats.learnedItems / this.stats.totalItems) * 100;
  }

  getMasteryProgress(): number {
    if (this.stats.totalItems === 0) return 0;
    return (this.stats.masteredItems / this.stats.totalItems) * 100;
  }

  async doRefresh(event: any) {
    await this.loadProgress();
    event.target.complete();
  }
}
