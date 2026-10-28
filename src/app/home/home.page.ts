/**
 * Home Page
 * 
 * Fast access to the next Session from the entry point (R21.1).
 * 
 * @module app/home
 */

import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ContentService } from '../services/content.service';
import { MemoryEngineService } from '../services/memory-engine.service';
import { SessionService } from '../services/session.service';
import { SettingsService } from '../services/settings.service';
import { I18nAngularService } from '../services/i18n.service';

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  count?: number;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  private content = inject(ContentService);
  private memory = inject(MemoryEngineService);
  private session = inject(SessionService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private router = inject(Router);

  quickActions: QuickAction[] = [];
  courseLanguages: { code: string; name: string }[] = [];
  dueCount = 0;
  recoveringCount = 0;
  isLoading = false; // Start as false since load is synchronous

  // Languages the user can learn (flag image + name). Extend as more added.
  // flagUrl uses flagcdn (SVG) so flags render on every platform, unlike
  // emoji flags which Windows doesn't display.
  readonly availableLanguages: { code: string; name: string; flagUrl: string }[] = [
    { code: 'nl', name: 'Dutch', flagUrl: 'https://flagcdn.com/nl.svg' },
  ];

  /** Currently selected learning language code (persisted in settings). */
  get learningLanguage(): string {
    return this.settings.learningLanguage();
  }

  get currentLanguage(): { code: string; name: string; flagUrl: string } {
    return (
      this.availableLanguages.find(l => l.code === this.learningLanguage) ??
      this.availableLanguages[0]
    );
  }

  selectLanguage(code: string): void {
    this.settings.updateSetting('learningLanguage', code);
  }

  constructor() {
    // Initialize content immediately in constructor
    this.content.initialize();
  }

  ngOnInit() {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    // Get course languages
    this.courseLanguages = this.content.getCourseLanguages().map(lang => ({
      code: lang.code,
      name: lang.name,
    }));

    // Get due items count
    const dueItems = this.memory.getDueItems();
    this.dueCount = dueItems.length;

    // Get recovering items count
    this.recoveringCount = this.memory.getRecoveringItems().length;

    // Build quick actions
    this.quickActions = this.buildQuickActions();
  }

  private buildQuickActions(): QuickAction[] {
    const actions: QuickAction[] = [];

    // Primary action: Continue learning or start review
    if (this.dueCount > 0) {
      actions.push({
        id: 'review',
        title: this.i18n.t('session.start'),
        subtitle: this.i18n.t('progress.dueToday'),
        icon: 'play-circle',
        color: 'primary',
        count: this.dueCount,
      });
    }

    // Learning new content
    for (const lang of this.courseLanguages) {
      actions.push({
        id: `learn-${lang.code}`,
        title: lang.name,
        subtitle: 'Continue learning',
        icon: 'book',
        color: 'secondary',
      });
    }

    // Progress dashboard
    actions.push({
      id: 'progress',
      title: this.i18n.t('progress.title'),
      subtitle: 'View your stats',
      icon: 'stats-chart',
      color: 'tertiary',
    });

    return actions;
  }

  onQuickAction(action: QuickAction): void {
    if (action.id === 'review') {
      this.startReviewSession();
    } else if (action.id === 'progress') {
      this.router.navigate(['/progress']);
    } else if (action.id.startsWith('learn-')) {
      const langCode = action.id.replace('learn-', '');
      this.navigateToLanguage(langCode);
    }
  }

  startReviewSession(): void {
    this.session.startReviewSession(this.settings.sessionLength());
    this.router.navigate(['/session']);
  }

  navigateToLanguage(langCode: string): void {
    this.router.navigate(['/course', langCode]);
  }

  navigateToSettings(): void {
    this.router.navigate(['/settings']);
  }

  navigateToFlashcards(): void {
    this.router.navigate(['/flashcards']);
  }

  /**
   * Open the deck/level list for a chosen practice mode. The flashcards page
   * reads the mode and launches each level directly in that mode.
   */
  startMode(mode: 'flip' | 'write' | 'match' | 'quiz'): void {
    this.router.navigate(['/flashcards'], { queryParams: { mode } });
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
