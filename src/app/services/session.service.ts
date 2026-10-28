/**
 * Session Angular Service
 * 
 * Manages learning sessions and exercise flow.
 * 
 * Requirements: 21.1, 21.2
 * 
 * @module app/services
 */

import { Injectable, signal, computed } from '@angular/core';
import { ExerciseService } from './exercise.service';
import { ContentService } from './content.service';
import { MemoryEngineService } from './memory-engine.service';
import {
  ExerciseInstance,
  ExerciseContract,
  MixedReviewItem,
} from '../../exercises';
import { ExerciseType, SkillDimension, AttemptOutcomeResult } from '../../core/types';

export interface SessionItem {
  id: string;
  learningItemId: string;
  exerciseType: ExerciseType;
  skillDimension: SkillDimension;
  completed: boolean;
  correct: boolean | null;
  isNew: boolean;
}

export type SessionType = 'new' | 'review' | 'mixed';

export interface SessionState {
  active: boolean;
  items: SessionItem[];
  currentIndex: number;
  startTime: Date | null;
  endTime: Date | null;
  correctCount: number;
  incorrectCount: number;
}

export interface SessionConfig {
  lessonId: string | null;
  sessionType: SessionType;
}

const INITIAL_STATE: SessionState = {
  active: false,
  items: [],
  currentIndex: 0,
  startTime: null,
  endTime: null,
  correctCount: 0,
  incorrectCount: 0,
};

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private stateSignal = signal<SessionState>({ ...INITIAL_STATE });
  private configSignal = signal<SessionConfig>({ lessonId: null, sessionType: 'mixed' });

  // Computed values
  readonly isActive = computed(() => this.stateSignal().active);
  readonly currentIndex = computed(() => this.stateSignal().currentIndex);
  readonly totalItems = computed(() => this.stateSignal().items.length);
  readonly completedCount = computed(() => 
    this.stateSignal().items.filter(i => i.completed).length
  );
  readonly correctCount = computed(() => this.stateSignal().correctCount);
  readonly incorrectCount = computed(() => this.stateSignal().incorrectCount);
  readonly progress = computed(() => {
    const total = this.totalItems();
    if (total === 0) return 0;
    return Math.round((this.completedCount() / total) * 100);
  });
  readonly currentItem = computed(() => {
    const state = this.stateSignal();
    if (!state.active || state.currentIndex >= state.items.length) {
      return null;
    }
    return state.items[state.currentIndex];
  });
  readonly isComplete = computed(() => {
    const state = this.stateSignal();
    return state.active && state.currentIndex >= state.items.length;
  });

  constructor(
    private exerciseService: ExerciseService,
    private contentService: ContentService,
    private memoryEngine: MemoryEngineService
  ) {}

  /**
   * Start a new session with items from a lesson
   */
  startLessonSession(lessonId: string, maxItems: number = 20): void {
    const availableItems = this.contentService.getAvailableItemsForLesson(lessonId);
    const now = new Date();
    
    // Classify items as new or review
    const newItems: MixedReviewItem[] = [];
    const reviewItems: MixedReviewItem[] = [];
    
    for (const item of availableItems) {
      const reason = this.memoryEngine.getReviewReason(item.id);
      const isNew = reason === 'new';
      const isRecovering = this.memoryEngine.isRecovering(item.id);
      
      const reviewItem: MixedReviewItem = {
        instance: this.createExerciseInstance(item),
        isNew,
        priority: isRecovering ? 10 : (isNew ? 5 : 1),
      };
      
      if (isNew) {
        newItems.push(reviewItem);
      } else {
        reviewItems.push(reviewItem);
      }
    }
    
    // Build mixed session
    const session = this.exerciseService.buildMixedSession(newItems, reviewItems, {
      maxItems,
    });
    
    // Convert to session items
    const sessionItems: SessionItem[] = session.items.map((item, index) => ({
      id: `session-${Date.now()}-${index}`,
      learningItemId: item.instance.learningItemId,
      exerciseType: item.instance.type,
      skillDimension: item.instance.skillDimension,
      completed: false,
      correct: null,
      isNew: item.isNew,
    }));
    
    this.stateSignal.set({
      active: true,
      items: sessionItems,
      currentIndex: 0,
      startTime: now,
      endTime: null,
      correctCount: 0,
      incorrectCount: 0,
    });
  }

  /**
   * Start a review session with due items
   */
  startReviewSession(maxItems: number = 20): void {
    const now = new Date();
    const dueItemIds = this.memoryEngine.getDueItems(now);
    
    const reviewItems: MixedReviewItem[] = [];
    
    for (const itemId of dueItemIds.slice(0, maxItems * 2)) {
      const enriched = this.contentService.getEnrichedItem(itemId);
      if (!enriched) continue;
      
      const isRecovering = this.memoryEngine.isRecovering(itemId);
      
      reviewItems.push({
        instance: this.createExerciseInstance(enriched.item),
        isNew: false,
        priority: isRecovering ? 10 : 1,
      });
    }
    
    const session = this.exerciseService.buildMixedSession([], reviewItems, {
      maxItems,
      minNewItems: 0,
      maxNewItems: 0,
    });
    
    const sessionItems: SessionItem[] = session.items.map((item, index) => ({
      id: `review-${Date.now()}-${index}`,
      learningItemId: item.instance.learningItemId,
      exerciseType: item.instance.type,
      skillDimension: item.instance.skillDimension,
      completed: false,
      correct: null,
      isNew: false,
    }));
    
    this.stateSignal.set({
      active: true,
      items: sessionItems,
      currentIndex: 0,
      startTime: now,
      endTime: null,
      correctCount: 0,
      incorrectCount: 0,
    });
  }

  /**
   * Record the result of the current exercise
   */
  recordResult(correct: boolean, outcome: AttemptOutcomeResult, hintUsed: boolean): void {
    const state = this.stateSignal();
    const current = state.items[state.currentIndex];
    
    if (!current) return;
    
    // Record with memory engine
    this.memoryEngine.recordAttempt(
      current.learningItemId,
      outcome,
      current.exerciseType,
      current.skillDimension,
      hintUsed
    );
    
    // Update session state
    this.stateSignal.update(s => {
      const items = [...s.items];
      items[s.currentIndex] = { ...current, completed: true, correct };
      
      return {
        ...s,
        items,
        correctCount: s.correctCount + (correct ? 1 : 0),
        incorrectCount: s.incorrectCount + (correct ? 0 : 1),
      };
    });
  }

  /**
   * Move to the next item
   */
  nextItem(): void {
    const state = this.stateSignal();
    
    if (state.currentIndex < state.items.length) {
      this.stateSignal.update(s => ({
        ...s,
        currentIndex: s.currentIndex + 1,
      }));
    }
    
    // Check if session complete
    if (state.currentIndex + 1 >= state.items.length) {
      this.stateSignal.update(s => ({
        ...s,
        endTime: new Date(),
      }));
    }
  }

  /**
   * End the current session
   */
  endSession(): void {
    this.stateSignal.update(s => ({
      ...s,
      active: false,
      endTime: s.endTime ?? new Date(),
    }));
  }

  /**
   * Get session summary
   */
  getSessionSummary() {
    const state = this.stateSignal();
    const duration = state.startTime && state.endTime
      ? Math.round((state.endTime.getTime() - state.startTime.getTime()) / 1000 / 60)
      : 0;
    
    return {
      totalItems: state.items.length,
      completedItems: state.items.filter(i => i.completed).length,
      correctCount: state.correctCount,
      incorrectCount: state.incorrectCount,
      accuracy: state.items.length > 0 
        ? Math.round((state.correctCount / state.items.filter(i => i.completed).length) * 100)
        : 0,
      durationMinutes: duration,
      newItemsCount: state.items.filter(i => i.isNew).length,
      reviewItemsCount: state.items.filter(i => !i.isNew).length,
    };
  }

  /**
   * Reset session state
   */
  reset(): void {
    this.stateSignal.set({ ...INITIAL_STATE });
  }

  /**
   * Set the lesson ID for the next session
   */
  setLessonId(lessonId: string | null): void {
    this.configSignal.update(c => ({ ...c, lessonId }));
  }

  /**
   * Set the session type for the next session
   */
  setSessionType(sessionType: SessionType): void {
    this.configSignal.update(c => ({ ...c, sessionType }));
  }

  /**
   * Get the current session configuration
   */
  getConfig(): SessionConfig {
    return this.configSignal();
  }

  /**
   * Start session based on current configuration
   */
  startConfiguredSession(maxItems: number = 20): void {
    const config = this.configSignal();
    
    if (config.lessonId) {
      this.startLessonSession(config.lessonId, maxItems);
    } else if (config.sessionType === 'review') {
      this.startReviewSession(maxItems);
    } else {
      // Mixed session - get items from all lessons
      this.startReviewSession(maxItems);
    }
  }

  private createExerciseInstance(item: any): ExerciseInstance {
    // Determine best exercise type for item
    const types = this.exerciseService.getTypesForSkillDimension(
      item.skillDimension ?? 'receptive_vocabulary'
    );
    const type = types[0] ?? 'flashcard';
    
    return {
      id: `inst-${item.id}-${Date.now()}`,
      learningItemId: item.id,
      type,
      skillDimension: item.skillDimension ?? 'receptive_vocabulary',
      prompt: item.prompt ?? item.text ?? 'Practice',
      expectedAnswers: item.acceptedAnswers ?? [item.translation ?? ''],
      alternatives: item.alternativeTranslations,
      hint: item.hint,
      context: item.exampleSentence,
      audioText: item.text,
      targetLanguage: item.languageCode ?? 'nl',
    };
  }
}
