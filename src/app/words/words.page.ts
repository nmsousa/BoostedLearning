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

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';
import { FlashcardService, StudiedWord, WordPriority } from '../services/flashcard.service';
import { SettingsService } from '../services/settings.service';
import { I18nAngularService } from '../services/i18n.service';
import { KnowledgeLevel } from '../../core/knowledge-level';

type Filter = 'all' | KnowledgeLevel;
type StatusFilter = 'all' | 'enabled' | 'hidden';
type SortKey = 'needsPractice' | 'mostSeen' | 'leastSeen' | 'accuracyHigh' | 'accuracyLow' | 'alpha';

@Component({
  selector: 'app-words',
  templateUrl: './words.page.html',
  styleUrls: ['./words.page.scss'],
  standalone: false,
})
export class WordsPage implements OnInit {
  private router = inject(Router);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private cdr = inject(ChangeDetectorRef);
  private actionSheet = inject(ActionSheetController);

  allWords: StudiedWord[] = [];
  filter: Filter = 'all';
  statusFilter: StatusFilter = 'all';
  search = '';
  sortKey: SortKey = 'needsPractice';

  readonly sortOptions: { value: SortKey; labelKey: string }[] = [
    { value: 'needsPractice', labelKey: 'words.sort.needsPractice' },
    { value: 'mostSeen', labelKey: 'words.sort.mostSeen' },
    { value: 'leastSeen', labelKey: 'words.sort.leastSeen' },
    { value: 'accuracyHigh', labelKey: 'words.sort.accuracyHigh' },
    { value: 'accuracyLow', labelKey: 'words.sort.accuracyLow' },
    { value: 'alpha', labelKey: 'words.sort.alpha' },
  ];

  async ngOnInit() {
    await this.flashcards.initialize();
    this.reload();
  }

  private reload(): void {
    this.allWords = this.flashcards.getStudiedWords(this.settings.learningLanguage());
    this.cdr.detectChanges();
  }

  /** True when at least one word is hidden (drives the status filter row). */
  get hasHiddenWords(): boolean {
    return this.allWords.some(w => w.priority === 'hide');
  }

  /** Words after status + level filter + search + sort. */
  get words(): StudiedWord[] {
    const q = this.search.trim().toLowerCase();
    let list = this.allWords;

    if (this.statusFilter === 'enabled') {
      list = list.filter(w => w.priority !== 'hide');
    } else if (this.statusFilter === 'hidden') {
      list = list.filter(w => w.priority === 'hide');
    }
    if (this.filter !== 'all') {
      list = list.filter(w => w.level === this.filter);
    }
    if (q) {
      list = list.filter(
        w => w.text.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => this.compare(a, b));
  }

  setStatusFilter(s: StatusFilter) {
    this.statusFilter = s;
  }

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

  /** Base list for the LEVEL chip counts: search + status filter applied. */
  private get levelCountBase(): StudiedWord[] {
    let list = this.searchMatched;
    if (this.statusFilter === 'enabled') list = list.filter(w => w.priority !== 'hide');
    else if (this.statusFilter === 'hidden') list = list.filter(w => w.priority === 'hide');
    return list;
  }

  countHidden(): number {
    return this.searchMatched.filter(w => w.priority === 'hide').length;
  }

  countEnabled(): number {
    return this.searchMatched.filter(w => w.priority !== 'hide').length;
  }

  private compare(a: StudiedWord, b: StudiedWord): number {
    switch (this.sortKey) {
      case 'mostSeen': return b.attempts - a.attempts;
      case 'leastSeen': return a.attempts - b.attempts;
      case 'accuracyHigh': return b.accuracy - a.accuracy || b.attempts - a.attempts;
      case 'accuracyLow': return a.accuracy - b.accuracy || b.attempts - a.attempts;
      case 'alpha': return a.text.localeCompare(b.text);
      case 'needsPractice':
      default: return b.missRate - a.missRate || b.attempts - a.attempts;
    }
  }

  count(level: Filter): number {
    const base = this.levelCountBase;
    if (level === 'all') return base.length;
    return base.filter(w => w.level === level).length;
  }

  setFilter(f: Filter) {
    this.filter = f;
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

  /** Open the priority action sheet for a word (boost / normal / hide). */
  async openPriority(w: StudiedWord, event?: Event) {
    event?.stopPropagation();
    const sheet = await this.actionSheet.create({
      header: w.text,
      buttons: [
        {
          text: this.t('words.priority.boost'),
          icon: 'arrow-up-circle-outline',
          handler: () => { this.setPriority(w, 'boost'); },
        },
        {
          text: this.t('words.priority.normal'),
          icon: 'remove-circle-outline',
          handler: () => { this.setPriority(w, 'normal'); },
        },
        {
          text: this.t('words.priority.hide'),
          icon: 'eye-off-outline',
          role: 'destructive',
          handler: () => { this.setPriority(w, 'hide'); },
        },
        { text: this.t('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async setPriority(w: StudiedWord, priority: WordPriority) {
    await this.flashcards.setWordPriority(w.text, priority, this.settings.learningLanguage());
    this.reload();
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
