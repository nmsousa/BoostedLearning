/**
 * Practice launcher — the home "Practice" card opens here.
 *
 * Pick a SOURCE of words (a saved per-language list, your common mistakes, or
 * all your words) and a MODE (default Mix), then it builds a transient practice
 * deck from those words and launches the chosen exercise against it.
 *
 * @module app/practice
 */
import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, NavController, ToastController, ViewWillEnter } from '@ionic/angular';
import { FlashcardService } from '../services/flashcard.service';
import { SettingsService } from '../services/settings.service';
import { I18nAngularService } from '../services/i18n.service';
import { PracticeListService, type PracticeList } from '../services/practice-list.service';

/** A chosen word source. */
type Source =
  | { kind: 'list'; id: string; name: string; count: number }
  | { kind: 'mistakes'; count: number }
  | { kind: 'all'; count: number };

/** Mode options. 'mix' is the default. Routes are the standalone exercise ones. */
interface ModeOption { id: string; labelKey: string; icon: string; route: string; }

@Component({
  selector: 'app-practice',
  templateUrl: './practice.page.html',
  styleUrls: ['./practice.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PracticePage implements OnInit, ViewWillEnter {
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private practiceLists = inject(PracticeListService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;
  sources: Source[] = [];
  selectedSource: Source | null = null;
  selectedModeId = 'mix';

  readonly modes: ModeOption[] = [
    { id: 'mix', labelKey: 'home.mode.mix', icon: 'shuffle-outline', route: '/practice/mix' },
    { id: 'quiz', labelKey: 'journey.node.quiz', icon: 'help', route: '/practice/quiz' },
    { id: 'write', labelKey: 'journey.node.write', icon: 'create-outline', route: '/practice/write' },
    { id: 'match', labelKey: 'journey.node.match', icon: 'git-compare-outline', route: '/practice/match' },
    { id: 'flip', labelKey: 'journey.node.flip', icon: 'albums-outline', route: '/practice/flip' },
  ];

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.t(key, params); }

  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    await this.practiceLists.init();
    await this.buildSources();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.practiceLists.init();
    await this.buildSources();
  }

  private get lang(): string { return this.settings.learningLanguage(); }

  private async buildSources(): Promise<void> {
    const studied = this.flashcards.getStudiedWords(this.lang);
    const mistakes = studied.filter(w => w.mastery === 'red' || w.mastery === 'yellow');

    const lists: Source[] = this.practiceLists.listsFor(this.lang)
      .map(l => ({ kind: 'list' as const, id: l.id, name: l.name, count: l.words.length }));

    this.sources = [
      ...lists,
      { kind: 'mistakes', count: mistakes.length },
      { kind: 'all', count: studied.length },
    ];

    // Default selection: the first list, else mistakes (if any), else all.
    this.selectedSource =
      lists[0] ??
      (mistakes.length ? { kind: 'mistakes', count: mistakes.length } : null) ??
      { kind: 'all', count: studied.length };

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  /** True when the user has at least one saved list (vs only mistakes/all). */
  get hasLists(): boolean { return this.sources.some(s => s.kind === 'list'); }

  /** Open "Your words" directly in select mode to build a new practice list. */
  createListFromWords(): void {
    this.router.navigate(['/words'], { queryParams: { select: 1, from: 'practice' } });
  }

  sourceKey(s: Source): string { return s.kind === 'list' ? `list:${s.id}` : s.kind; }
  isSourceSelected(s: Source): boolean {
    return !!this.selectedSource && this.sourceKey(this.selectedSource) === this.sourceKey(s);
  }
  selectSource(s: Source): void { this.selectedSource = s; this.cdr.detectChanges(); }
  selectMode(id: string): void { this.selectedModeId = id; this.cdr.detectChanges(); }

  sourceLabel(s: Source): string {
    if (s.kind === 'list') return s.name;
    if (s.kind === 'mistakes') return this.t('practice.sourceMistakes');
    return this.t('practice.sourceAll');
  }

  /** Resolve the chosen source to its word surface forms. */
  private async resolveWords(s: Source): Promise<string[]> {
    if (s.kind === 'list') {
      const list = await this.practiceLists.getList(s.id);
      return list?.words ?? [];
    }
    const studied = this.flashcards.getStudiedWords(this.lang);
    if (s.kind === 'mistakes') {
      return studied.filter(w => w.mastery === 'red' || w.mastery === 'yellow').map(w => w.text);
    }
    return studied.map(w => w.text);
  }

  async start(): Promise<void> {
    if (!this.selectedSource) return;
    const words = await this.resolveWords(this.selectedSource);
    if (!words.length) {
      const t = await this.toastCtrl.create({ message: this.t('practice.empty'), duration: 2000, position: 'bottom' });
      await t.present();
      return;
    }
    const deckId = this.flashcards.registerPracticeDeck(this.lang, words);
    if (!deckId) {
      const t = await this.toastCtrl.create({ message: this.t('practice.empty'), duration: 2000, position: 'bottom' });
      await t.present();
      return;
    }
    const mode = this.modes.find(m => m.id === this.selectedModeId) ?? this.modes[0];
    // All practice words live in level 1 of the single-skill transient deck.
    this.navCtrl.navigateForward([mode.route, deckId], {
      queryParams: { level: 1, from: 'practice' },
    });
  }

  /** Delete a saved list (with confirm). */
  async deleteList(s: Source, ev: Event): Promise<void> {
    ev.stopPropagation();
    if (s.kind !== 'list') return;
    const alert = await this.alertCtrl.create({
      header: this.t('practice.deleteListTitle'),
      message: this.t('practice.deleteListBody', { name: s.name }),
      buttons: [
        { text: this.t('common.cancel'), role: 'cancel' },
        {
          text: this.t('practice.deleteListYes'), role: 'destructive',
          handler: () => { void this.practiceLists.deleteList(s.id).then(() => this.buildSources()); },
        },
      ],
    });
    await alert.present();
  }

  close(): void { this.router.navigate(['/home']); }
  trackSource = (_i: number, s: Source): string => this.sourceKey(s);
  trackMode(_i: number, m: ModeOption): string { return m.id; }
}
