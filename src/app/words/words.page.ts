/**
 * Your Words Page
 *
 * Detailed list of practiced words for the selected language, with per-word
 * correct / incorrect / so-so counts, sorted by miss rate (worst first) so
 * early levels don't dominate by absolute counts.
 *
 * @module app/words
 */

import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FlashcardService } from '../services/flashcard.service';
import { SettingsService } from '../services/settings.service';
import { I18nAngularService } from '../services/i18n.service';
import { KnowledgeLevel } from '../../core/knowledge-level';

interface WordRow {
  text: string;
  translation: string;
  correct: number;
  incorrect: number;
  medium: number;
  missRate: number;
  level: KnowledgeLevel;
}

type Filter = 'all' | KnowledgeLevel;

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

  allWords: WordRow[] = [];
  filter: Filter = 'all';

  async ngOnInit() {
    await this.flashcards.initialize();
    this.allWords = this.flashcards.getStudiedWords(this.settings.learningLanguage());
  }

  get words(): WordRow[] {
    if (this.filter === 'all') return this.allWords;
    return this.allWords.filter(w => w.level === this.filter);
  }

  count(level: Filter): number {
    if (level === 'all') return this.allWords.length;
    return this.allWords.filter(w => w.level === level).length;
  }

  setFilter(f: Filter) {
    this.filter = f;
  }

  /** Accuracy % for display (0 when never seen correctly/incorrectly). */
  accuracy(w: WordRow): number {
    const seen = w.correct + w.incorrect;
    return seen > 0 ? Math.round((w.correct / seen) * 100) : 0;
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  close() {
    this.router.navigate(['/home']);
  }
}
