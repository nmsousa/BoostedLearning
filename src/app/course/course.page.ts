/**
 * Course Page
 * 
 * Displays course modules and lessons for a specific language.
 * Provides navigation to individual lessons and tracks progress.
 * 
 * @module app/course
 */

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ContentService } from '../services/content.service';
import { MemoryEngineService } from '../services/memory-engine.service';
import { SessionService } from '../services/session.service';

interface LessonView {
  id: string;
  name: string;
  itemCount: number;
  dueItems: number;
  progress: number;
}

interface ModuleView {
  id: string;
  name: string;
  lessonCount: number;
  itemCount: number;
  progress: number;
  lessons: LessonView[];
}

interface CourseOverview {
  totalModules: number;
  totalLessons: number;
  totalItems: number;
  progress: number;
}

@Component({
  selector: 'app-course',
  templateUrl: './course.page.html',
  styleUrls: ['./course.page.scss'],
  standalone: false,
})
export class CoursePage implements OnInit {
  languageCode = 'nl';
  courseName = 'Dutch A1';
  modules: ModuleView[] = [];
  courseOverview: CourseOverview | null = null;
  expandedModule: string | null = null;

  private languageNames: Record<string, string> = {
    nl: 'Dutch A1',
    fr: 'French B2',
    de: 'German A1',
    es: 'Spanish A1',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private contentService: ContentService,
    private memoryEngine: MemoryEngineService,
    private sessionService: SessionService
  ) {}

  async ngOnInit() {
    // Get language from route params
    this.route.paramMap.subscribe(params => {
      const langCode = params.get('langCode');
      if (langCode) {
        this.languageCode = langCode;
        this.courseName = this.languageNames[langCode] || `${langCode.toUpperCase()} Course`;
      }
      
      this.contentService.initialize();
      this.loadCourse();
    });
  }

  loadCourse() {
    const rawModules = this.contentService.getModulesForLanguage(this.languageCode);
    
    let totalLessons = 0;
    let totalItems = 0;
    let learnedItems = 0;

    this.modules = [];

    for (const module of rawModules) {
      const rawLessons = this.contentService.getLessonsForModule(module.id);
      let moduleItemCount = 0;
      let moduleLearned = 0;

      const lessons: LessonView[] = [];

      for (const lesson of rawLessons) {
        const items = this.contentService.getAvailableItemsForLesson(lesson.id);
        const itemCount = items.length;
        totalItems += itemCount;
        moduleItemCount += itemCount;

        let lessonLearned = 0;
        let dueItems = 0;
        const now = new Date();
        const dueItemIds = this.memoryEngine.getDueItems(now);
        const dueSet = new Set(dueItemIds);

        for (const item of items) {
          const history = this.memoryEngine.getAttemptHistory(item.id);
          if (history.length > 0) {
            lessonLearned++;
            learnedItems++;
            moduleLearned++;
          }
          if (dueSet.has(item.id)) {
            dueItems++;
          }
        }

        lessons.push({
          id: lesson.id,
          name: lesson.title,
          itemCount,
          dueItems,
          progress: itemCount > 0 ? (lessonLearned / itemCount) * 100 : 0,
        });
      }

      totalLessons += rawLessons.length;

      this.modules.push({
        id: module.id,
        name: module.title,
        lessonCount: rawLessons.length,
        itemCount: moduleItemCount,
        progress: moduleItemCount > 0 ? (moduleLearned / moduleItemCount) * 100 : 0,
        lessons,
      });
    }

    this.courseOverview = {
      totalModules: this.modules.length,
      totalLessons,
      totalItems,
      progress: totalItems > 0 ? (learnedItems / totalItems) * 100 : 0,
    };

    // Expand first incomplete module by default
    if (this.expandedModule === null) {
      const firstIncomplete = this.modules.find(m => m.progress < 100);
      if (firstIncomplete) {
        this.expandedModule = firstIncomplete.id;
      } else if (this.modules.length > 0) {
        this.expandedModule = this.modules[0].id;
      }
    }
  }

  toggleModule(moduleId: string) {
    this.expandedModule = this.expandedModule === moduleId ? null : moduleId;
  }

  async startLesson(lessonId: string) {
    // Start session for this lesson
    this.sessionService.startLessonSession(lessonId);
    this.router.navigate(['/session']);
  }

  async startReviewSession() {
    // If there are due items, do a review session
    const dueItems = this.memoryEngine.getDueItems();
    if (dueItems.length > 0) {
      this.sessionService.startReviewSession();
      this.router.navigate(['/session']);
      return;
    }
    
    // Otherwise, start with the first available lesson that has items
    for (const module of this.modules) {
      for (const lesson of module.lessons) {
        if (lesson.itemCount > 0) {
          this.sessionService.startLessonSession(lesson.id);
          this.router.navigate(['/session']);
          return;
        }
      }
    }
    
    // No lessons available - this shouldn't happen but handle gracefully
    console.warn('No lessons with items available');
  }
}
