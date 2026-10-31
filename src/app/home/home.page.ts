/**
 * Home Page
 * 
 * Fast access to the next Session from the entry point (R21.1).
 * 
 * @module app/home
 */

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { ContentService } from '../services/content.service';
import { SessionService } from '../services/session.service';
import { SettingsService } from '../services/settings.service';
import { I18nAngularService } from '../services/i18n.service';
import { FlashcardService } from '../services/flashcard.service';
import { KnowledgeBreakdown } from '../../core/knowledge-level';

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
  private session = inject(SessionService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private flashcards = inject(FlashcardService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  quickActions: QuickAction[] = [];
  courseLanguages: { code: string; name: string }[] = [];

  /** Three-bucket breakdown of how well the learner knows their words. */
  knowledge: KnowledgeBreakdown = {
    learning: 0,
    familiar: 0,
    known: 0,
    neverStudied: 0,
    total: 0,
  };

  isLoading = false; // Start as false since load is synchronous

  // Languages the user can learn, derived from available decks (bundled +
  // imported) so imported languages appear here too. Populated on load.
  availableLanguages: { code: string; name: string; flagUrl: string }[] = [];

  /** Flag image for a language code (maps language -> country where needed). */
  private flagUrl(code: string): string {
    // Map language/course codes to flag country codes where they differ
    // (incl. duome's non-standard codes like dn=Dutch, nb=Norwegian, zs=Chinese).
    const toCountry: Record<string, string> = {
      nl: 'nl', dn: 'nl', fr: 'fr', es: 'es', it: 'it', de: 'de', pt: 'pt',
      en: 'gb', da: 'dk', el: 'gr', ja: 'jp', ko: 'kr', zs: 'cn', uk: 'ua',
      nb: 'no', he: 'il', hi: 'in', vi: 'vn', cs: 'cz', sv: 'se', ga: 'ie',
      gd: 'gb', cy: 'gb', hw: 'us', ht: 'ht', zu: 'za', sw: 'ke',
    };
    return `https://flagcdn.com/${toCountry[code] ?? code}.svg`;
  }

  private refreshLanguages(): void {
    this.availableLanguages = this.flashcards
      .getAvailableLanguages()
      .map(l => ({ ...l, flagUrl: this.flagUrl(l.code) }));
  }

  /** Currently selected learning language code (persisted in settings). */
  get learningLanguage(): string {
    return this.settings.learningLanguage();
  }

  get currentLanguage(): { code: string; name: string; flagUrl: string } {
    return (
      this.availableLanguages.find(l => l.code === this.learningLanguage) ??
      this.availableLanguages[0] ?? {
        code: this.learningLanguage,
        name: this.learningLanguage.toUpperCase(),
        flagUrl: this.flagUrl(this.learningLanguage),
      }
    );
  }

  selectLanguage(code: string): void {
    this.settings.updateSetting('learningLanguage', code);
    // Refresh the breakdown so it reflects the newly-selected language.
    this.knowledge = this.flashcards.getKnowledgeBreakdown(code);
  }

  constructor() {
    // Initialize content immediately in constructor
    this.content.initialize();
  }

  async ngOnInit(): Promise<void> {
    // Flashcard data drives the "Your words" breakdown. Guard the whole thing
    // so a slow/failed DB init on a fresh install can't leave the dashboard
    // half-rendered (the "Your words" card was sometimes blank on first open).
    try {
      await this.flashcards.initialize();
    } catch (e) {
      console.error('[HomePage] flashcard init failed:', e);
    }
    this.refreshLanguages();
    this.loadDashboardData();
    this.cdr.detectChanges();
  }

  /** Recompute when returning to the home tab (e.g. after play or an import). */
  async ionViewWillEnter(): Promise<void> {
    try {
      await this.flashcards.initialize();
    } catch (e) {
      console.error('[HomePage] flashcard init failed:', e);
    }
    this.refreshLanguages();
    this.knowledge = this.flashcards.getKnowledgeBreakdown(this.settings.learningLanguage());
    this.cdr.detectChanges();
  }

  /**
   * Fires after the view has entered and the first render settled. Recompute
   * once more so the "Your words" card is populated on a cold first launch
   * even if the DB init resolved just after the initial change detection.
   */
  ionViewDidEnter(): void {
    this.knowledge = this.flashcards.getKnowledgeBreakdown(this.settings.learningLanguage());
    this.cdr.detectChanges();
  }

  private loadDashboardData(): void {
    // Get course languages
    this.courseLanguages = this.content.getCourseLanguages().map(lang => ({
      code: lang.code,
      name: lang.name,
    }));

    // Knowledge breakdown (Learning / Familiar / Known) for the selected language.
    this.knowledge = this.flashcards.getKnowledgeBreakdown(this.settings.learningLanguage());

    // Build quick actions
    this.quickActions = this.buildQuickActions();
  }

  private buildQuickActions(): QuickAction[] {
    const actions: QuickAction[] = [];

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

  /** Open the detailed "Your words" list (only when there are words). */
  openWords(): void {
    if (this.knowledge.total === 0) return;
    this.router.navigate(['/words']);
  }

  navigateToFlashcards(): void {
    this.router.navigate(['/practice']);
  }

  /**
   * Open the deck/level list for a chosen practice mode. The flashcards page
   * reads the mode and launches each level directly in that mode.
   */
  startMode(mode: 'flip' | 'write' | 'match' | 'quiz'): void {
    this.router.navigate(['/practice'], { queryParams: { mode } });
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
