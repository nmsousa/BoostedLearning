/**
 * Your Words Page
 *
 * Detailed list of practiced words for the selected language, with per-word
 * correct / incorrect / so-so counts. Supports:
 *  - text search (word or translation),
 *  - filtering by knowledge level (all / learning / familiar / known),
 *  - sorting (needs practice, most/least seen, accuracy, A-Z),
 *  - per-word priority overrides (boost / normal / hide) that affect how
 *    often a word appears in practice.
 *
 * @module app/words
 */

import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, ViewWillEnter } from '@ionic/angular';
import { FlashcardService, StudiedWord, WordPriority } from '../services/flashcard.service';
import { SettingsService } from '../services/settings.service';
import { I18nAngularService } from '../services/i18n.service';
import { AddWordService } from '../services/add-word.service';
import { AudioService } from '../services/audio.service';
import { KnowledgeLevel } from '../../core/knowledge-level';

type Filter = 'all' | KnowledgeLevel;
type SortKey = 'needsPractice' | 'mostSeen' | 'leastSeen' | 'accuracyHigh' | 'accuracyLow' | 'alpha' | 'hiddenLast';

@Component({
  selector: 'app-words',
  templateUrl: './words.page.html',
  styleUrls: ['./words.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordsPage implements OnInit, ViewWillEnter {
  private router = inject(Router);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private cdr = inject(ChangeDetectorRef);
  private actionSheet = inject(ActionSheetController);
  private addWordService = inject(AddWordService);
  private audio = inject(AudioService);

  allWords: StudiedWord[] = [];
  /** True until the first load finishes, so we show a skeleton (not the empty
   *  message) while data is still being fetched. */
  isLoading = true;
  /** Placeholder rows for the loading skeleton. */
  readonly skeletonRows = Array.from({ length: 8 });
  /** Selected knowledge levels. Empty array = "All" (no level filter). */
  selectedLevels: KnowledgeLevel[] = [];
  search = '';
  sortKey: SortKey = 'needsPractice';

  /** The three knowledge levels shown in the filter dropdown. */
  readonly levelOptions: KnowledgeLevel[] = ['learning', 'familiar', 'known'];

  readonly sortOptions: { value: SortKey; labelKey: string }[] = [
    { value: 'needsPractice', labelKey: 'words.sort.needsPractice' },
    { value: 'mostSeen', labelKey: 'words.sort.mostSeen' },
    { value: 'leastSeen', labelKey: 'words.sort.leastSeen' },
    { value: 'accuracyHigh', labelKey: 'words.sort.accuracyHigh' },
    { value: 'accuracyLow', labelKey: 'words.sort.accuracyLow' },
    { value: 'alpha', labelKey: 'words.sort.alpha' },
    { value: 'hiddenLast', labelKey: 'words.sort.hiddenLast' },
  ];

  /** True once the service is ready, so ionViewWillEnter can safely reload. */
  private initialized = false;

  async ngOnInit() {
    await this.flashcards.initialize();
    this.initialized = true;
    this.reload();
  }

  /**
   * Ionic reuses page components in the nav stack, so ngOnInit does NOT run
   * again on re-entry. Re-read the word stats every time the page is shown so
   * counts reflect the session the user just played (no app restart needed).
   */
  ionViewWillEnter(): void {
    if (this.initialized) this.reload();
  }

  /** Bumped on each reload so the memoized `words` list recomputes even when
   *  the list length is unchanged (e.g. after toggling a word's priority). */
  private dataVersion = 0;

  private reload(): void {
    this.allWords = this.flashcards.getStudiedWords(this.settings.learningLanguage());
    this.dataVersion++;
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  // Memoized filtered+sorted list: recomputed only when the inputs change, so
  // the template's *ngFor doesn't re-filter/re-sort a large list every change
  // detection tick.
  private wordsCacheKey = '';
  private wordsCache: StudiedWord[] = [];

  /** Words after status + level filter + search + sort. */
  get words(): StudiedWord[] {
    const levelsKey = [...this.selectedLevels].sort().join(',');
    const key = `${this.dataVersion}|${levelsKey}|${this.sortKey}|${this.search.trim().toLowerCase()}`;
    if (key === this.wordsCacheKey) return this.wordsCache;

    const q = this.search.trim().toLowerCase();
    let list = this.allWords;

    // Hidden words are no longer filtered out here — they stay in the list and
    // the "hidden last" sort option pushes them to the end (so the hide state
    // is managed via sorting, not a separate filter chip that duplicated "All").
    // Empty selection = "All" (no level filter). Otherwise keep words whose
    // level is among the selected ones (multi-select).
    if (this.selectedLevels.length > 0) {
      const set = new Set(this.selectedLevels);
      list = list.filter(w => set.has(w.level));
    }
    if (q) {
      list = list.filter(
        w => w.text.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q)
      );
    }

    this.wordsCache = [...list].sort((a, b) => this.compare(a, b));
    this.wordsCacheKey = key;
    return this.wordsCache;
  }

  /** Stable identity for the word list *ngFor. */
  trackByWord = (_: number, w: StudiedWord) => w.text;

  /**
   * Words matching the current SEARCH only (ignores level + status filters).
   * Used as the base for the chip counters so they reflect what the user typed.
   */
  private get searchMatched(): StudiedWord[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.allWords;
    return this.allWords.filter(
      w => w.text.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q)
    );
  }

  /** Base list for the LEVEL chip counts: search applied. */
  private get levelCountBase(): StudiedWord[] {
    return this.searchMatched;
  }

  private compare(a: StudiedWord, b: StudiedWord): number {
    switch (this.sortKey) {
      case 'mostSeen': return b.attempts - a.attempts;
      case 'leastSeen': return a.attempts - b.attempts;
      case 'accuracyHigh': return b.accuracy - a.accuracy || b.attempts - a.attempts;
      case 'accuracyLow': return a.accuracy - b.accuracy || b.attempts - a.attempts;
      case 'alpha': return a.text.localeCompare(b.text);
      case 'hiddenLast': {
        // Hidden words sink to the bottom; within each group, worst-first.
        const ah = a.priority === 'hide' ? 1 : 0;
        const bh = b.priority === 'hide' ? 1 : 0;
        return ah - bh || b.missRate - a.missRate || b.attempts - a.attempts;
      }
      case 'needsPractice':
      default: return b.missRate - a.missRate || b.attempts - a.attempts;
    }
  }

  count(level: Filter): number {
    const base = this.levelCountBase;
    if (level === 'all') return base.length;
    return base.filter(w => w.level === level).length;
  }

  /** Multi-select level filter changed (from the dropdown). */
  onLevelsChange(event: CustomEvent) {
    this.selectedLevels = (event.detail?.value ?? []) as KnowledgeLevel[];
  }

  /** Human label for the filter button: "All" when nothing is selected,
   *  the single level name when one is picked, else "N levels". */
  get levelFilterLabel(): string {
    const n = this.selectedLevels.length;
    if (n === 0) return this.t('words.all');
    if (n === 1) return this.t(`home.level.${this.selectedLevels[0]}`);
    return `${n} ${this.t('words.filterLevels').toLowerCase()}`;
  }

  /** True when any level filter is active (drives the button's accent style). */
  get hasLevelFilter(): boolean {
    return this.selectedLevels.length > 0;
  }

  onSearch(event: CustomEvent) {
    this.search = (event.detail?.value ?? '') as string;
  }

  onSortChange(event: CustomEvent) {
    this.sortKey = event.detail.value as SortKey;
  }

  /** Accuracy % for display (0 when never seen correctly/incorrectly). */
  accuracyPct(w: StudiedWord): number {
    return Math.round(w.accuracy * 100);
  }

  /** Play a word's pronunciation (recorded audio if available, else TTS).
   *  Stops the tap from also opening the priority sheet. */
  playWord(w: StudiedWord, event: Event): void {
    event.stopPropagation();
    void this.audio.playWord(w.text, undefined, this.settings.learningLanguage());
  }

  /** Open the priority action sheet for a word (boost / normal / hide). */
  async openPriority(w: StudiedWord, event?: Event) {
    event?.stopPropagation();
    const buttons: any[] = [
      {
        text: this.t('words.priority.boost'),
        icon: 'arrow-up-circle-outline',
        handler: () => { this.setPriority(w, 'boost'); },
      },
    ];
    // "Normal" clears an existing boost/hide — only meaningful when one is set.
    if (w.priority !== 'normal') {
      buttons.push({
        text: this.t('words.priority.normal'),
        icon: 'remove-circle-outline',
        handler: () => { this.setPriority(w, 'normal'); },
      });
    }
    // Don't offer "hide" for an already-hidden word (use "normal" to unhide).
    if (w.priority !== 'hide') {
      buttons.push({
        text: this.t('words.priority.hide'),
        icon: 'eye-off-outline',
        role: 'destructive',
        handler: () => { this.setPriority(w, 'hide'); },
      });
    }
    buttons.push({ text: this.t('common.cancel'), icon: 'close-outline', role: 'cancel' });

    const sheet = await this.actionSheet.create({
      header: w.text,
      buttons,
      cssClass: 'mode-menu-sheet',
    });
    await sheet.present();
  }

  /**
   * Report a problem from this screen. Tagged with a fixed English screen name
   * so GitHub issues stay consistent regardless of the app's display language.
   */
  reportProblem(): void {
    void this.addWordService.reportProblem({
      languageCode: this.settings.learningLanguage(),
      modeName: 'Your words',
      reportContext: 'generic',
    });
  }

  private async setPriority(w: StudiedWord, priority: WordPriority) {
    await this.flashcards.setWordPriority(w.text, priority, this.settings.learningLanguage());
    this.reload();
  }

  /** Add a new custom word to the current learning language, then refresh. */
  async addWord(): Promise<void> {
    const added = await this.addWordService.promptAddWord(this.settings.learningLanguage());
    if (added) this.reload();
  }

  /** Icon shown on a row for its current priority (none for 'normal'). */
  priorityIcon(w: StudiedWord): string | null {
    if (w.priority === 'boost') return 'arrow-up-circle';
    if (w.priority === 'hide') return 'eye-off';
    return null;
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  close() {
    this.router.navigate(['/home']);
  }
}
