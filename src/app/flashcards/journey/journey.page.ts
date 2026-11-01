/**
 * Journey Page (EXPERIMENTAL mode)
 *
 * A game-style map of the deck's levels: a "continue" hero for the current
 * level at the top, then the levels grouped into chapters, each drawn as a
 * winding colour-coded trail (CSS/SVG, no painted art). Tapping a level runs
 * the normal Write exercise, but scored under the independent `journey` mode
 * namespace so it doesn't affect the original modes.
 *
 * This sits ALONGSIDE the existing four modes; nothing here changes them.
 *
 * @module app/flashcards/journey
 */

import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FlashcardService, FlashcardDeck, DeckLevel } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';

/** A chapter = a contiguous run of levels shown as one trail. */
interface Chapter {
  title: string;
  levels: DeckLevel[];
  /** 0..1 completion (levels with >=1 star / total). */
  progress: number;
  done: number;
  total: number;
  /** True when every level in it is still locked. */
  allLocked: boolean;
}

@Component({
  selector: 'app-journey',
  templateUrl: './journey.page.html',
  styleUrls: ['./journey.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyPage implements OnInit {
  private router = inject(Router);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private cdr = inject(ChangeDetectorRef);

  private static readonly MODE = 'journey' as const;
  /** Levels per chapter for chunked decks (skill decks chapter per skill). */
  private static readonly LEVELS_PER_CHAPTER = 5;

  deck: FlashcardDeck | null = null;
  levels: DeckLevel[] = [];
  chapters: Chapter[] = [];
  /** The level the user should play next (first unlocked & not 3-star). */
  current: DeckLevel | null = null;
  isLoading = true;
  /** Jump field value. */
  jumpTo = '';

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    await this.load();
  }

  async ionViewWillEnter(): Promise<void> {
    // Recompute stars/unlock when returning from an exercise.
    if (!this.isLoading || this.deck) await this.load();
  }

  private async load(): Promise<void> {
    const lang = this.settings.learningLanguage();
    const decks = this.flashcards.getAllDecks().filter(d => d.languageCode === lang);
    this.deck = decks[0] ?? this.flashcards.getAllDecks()[0] ?? null;

    if (!this.deck) {
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.levels = await this.flashcards.getDeckLevels(this.deck.id, JourneyPage.MODE);
    this.chapters = this.buildChapters(this.levels);
    this.current =
      this.levels.find(l => l.isUnlocked && l.bestStars < 3) ??
      this.levels.find(l => l.isUnlocked) ??
      this.levels[0] ??
      null;
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  /** Group levels into chapters: one per skill when the deck has skills,
   *  otherwise fixed runs of LEVELS_PER_CHAPTER. */
  private buildChapters(levels: DeckLevel[]): Chapter[] {
    const hasSkills = levels.some(l => !!l.skill);
    const groups: DeckLevel[][] = [];

    if (hasSkills) {
      // Each skill is already one level; chunk skills into chapters so the
      // page isn't one node per chapter.
      for (let i = 0; i < levels.length; i += JourneyPage.LEVELS_PER_CHAPTER) {
        groups.push(levels.slice(i, i + JourneyPage.LEVELS_PER_CHAPTER));
      }
    } else {
      for (let i = 0; i < levels.length; i += JourneyPage.LEVELS_PER_CHAPTER) {
        groups.push(levels.slice(i, i + JourneyPage.LEVELS_PER_CHAPTER));
      }
    }

    return groups.map((levelsInChapter, idx) => {
      const total = levelsInChapter.length;
      const done = levelsInChapter.filter(l => l.bestStars >= 1).length;
      const allLocked = levelsInChapter.every(l => !l.isUnlocked);
      // A chapter title: use the first level's skill if present, else a range.
      const first = levelsInChapter[0];
      const last = levelsInChapter[total - 1];
      const title = first?.skill
        ? first.skill
        : this.t('journey.chapterRange', { from: first?.levelNumber ?? 0, to: last?.levelNumber ?? 0 });
      return {
        title: `${this.t('journey.chapter')} ${idx + 1} · ${title}`,
        levels: levelsInChapter,
        progress: total ? done / total : 0,
        done,
        total,
        allLocked,
      };
    });
  }

  /** Horizontal offset for a node in the winding trail (alternating). */
  nodeOffset(indexInChapter: number): number {
    // 0, 1, 2, 3, 4 -> left, mid-right, right, mid-right, left (sine-ish)
    const pattern = [0, 1, 2, 1, 0];
    return pattern[indexInChapter % pattern.length];
  }

  isCurrent(level: DeckLevel): boolean {
    return this.current?.levelNumber === level.levelNumber;
  }

  starArray(n: number): number[] { return Array(Math.max(0, n)).fill(0); }
  emptyStarArray(n: number): number[] { return Array(Math.max(0, 3 - n)).fill(0); }

  startLevel(level: DeckLevel): void {
    if (!level.isUnlocked || !this.deck) return;
    // Journey uses the Write exercise under its own mode namespace.
    this.router.navigate(['/practice/journey-play', this.deck.id], {
      queryParams: { level: level.levelNumber, mode: 'journey' },
    });
  }

  continueCurrent(): void {
    if (this.current) this.startLevel(this.current);
  }

  onJump(): void {
    const n = parseInt(this.jumpTo, 10);
    if (!n) return;
    const level = this.levels.find(l => l.levelNumber === n);
    if (level) this.startLevel(level);
  }

  close(): void {
    this.router.navigate(['/home']);
  }
}
