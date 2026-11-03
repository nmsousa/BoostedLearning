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

import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular';
import { FlashcardService, FlashcardDeck, DeckLevel } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { AddWordService } from '../../services/add-word.service';

/** A chapter = a contiguous run of levels shown as one trail. */
interface Chapter {
  /** Chapter number (1-based), shown as a small badge. */
  number: number;
  /** Skill/range name, shown on its own line (may wrap, never truncated). */
  name: string;
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
  private addWordService = inject(AddWordService);
  private actionSheet = inject(ActionSheetController);
  private cdr = inject(ChangeDetectorRef);

  private static readonly MODE = 'journey' as const;

  // ── Header language flag (mirrors the homepage / mode-list selector) ───────
  availableLanguages: { code: string; name: string; flagUrl: string }[] = [];

  private flagUrl(code: string): string {
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
  get learningLanguage(): string { return this.settings.learningLanguage(); }
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
  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    this.isLoading = true;
    this.cdr.detectChanges();
    await this.flashcards.initialize();
    await this.load();
  }

  /**
   * Header "⋮" menu: just a problem report for now (Report / Cancel). The
   * report is tagged with a FIXED ENGLISH screen name so GitHub issues are
   * consistent regardless of the app's display language.
   */
  async openMenu(): Promise<void> {
    const sheet = await this.actionSheet.create({
      cssClass: 'mode-menu-sheet',   // shared tightened icon↔label gap
      buttons: [
        {
          text: this.i18n.t('feedback.report'),
          icon: 'flag-outline',
          handler: () => {
            void this.addWordService.reportProblem({
              languageCode: this.settings.learningLanguage(),
              modeName: 'Journey',
              reportContext: 'generic',
            });
          },
        },
        { text: this.i18n.t('common.cancel'), icon: 'close-outline', role: 'cancel' },
      ],
    });
    await sheet.present();
  }
  /** Levels per chapter for chunked decks (skill decks chapter per skill). */
  private static readonly LEVELS_PER_CHAPTER = 5;

  deck: FlashcardDeck | null = null;
  levels: DeckLevel[] = [];
  chapters: Chapter[] = [];
  /** The level the user should play next (first unlocked & not 3-star). */
  current: DeckLevel | null = null;
  /** Index of the chapter containing `current` (for auto-scroll on enter). */
  currentChapterIndex = 0;
  isLoading = true;

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
    this.refreshLanguages();
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
    // Which chapter contains the current level (for auto-scroll on enter).
    this.currentChapterIndex = this.current
      ? this.chapters.findIndex(c => c.levels.some(l => l.levelNumber === this.current!.levelNumber))
      : 0;
    this.isLoading = false;
    this.cdr.detectChanges();
    // Measure the trail width (for scale-correct line offsets) + jump to the
    // chapter being played, once the view has painted.
    setTimeout(() => {
      this.measureTrail();
      this.cdr.detectChanges();
      this.scrollToCurrentChapter();
    }, 150);
  }

  /** Recompute line geometry when the window resizes (width changes the X%). */
  @HostListener('window:resize')
  onResize(): void {
    this.measureTrail();
    this.cdr.detectChanges();
  }

  /**
   * Scroll the content so the chapter being played is in view on entry, with a
   * custom EASE-OUT (fast at the start, slowing as it arrives). Ionic's
   * scrollToPoint uses ease-in-out, so we animate scrollTop ourselves.
   */
  private async scrollToCurrentChapter(): Promise<void> {
    if (this.currentChapterIndex <= 0) return; // chapter 1 is already at top
    const el = document.getElementById(`journey-chapter-${this.currentChapterIndex}`);
    const content = document.querySelector('ion-content.journey-content') as HTMLIonContentElement | null;
    if (!el || !content) return;
    const scrollEl = await content.getScrollElement();
    const box = el.getBoundingClientRect();
    const from = scrollEl.scrollTop;
    const to = Math.max(0, Math.min(from + box.top - 90, scrollEl.scrollHeight - scrollEl.clientHeight));
    if (Math.abs(to - from) < 4) return;

    const duration = 650;
    const start = performance.now();
    // easeOutCubic: fast then gently decelerating.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      scrollEl.scrollTop = from + (to - from) * ease(t);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
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
      // Chapter name: the first level's skill if present, else a level range.
      const first = levelsInChapter[0];
      const last = levelsInChapter[total - 1];
      const name = first?.skill
        ? first.skill
        : this.t('journey.chapterRange', { from: first?.levelNumber ?? 0, to: last?.levelNumber ?? 0 });
      return {
        number: idx + 1,
        name,
        levels: levelsInChapter,
        progress: total ? done / total : 0,
        done,
        total,
        allLocked,
      };
    });
  }

  /** Horizontal offset for a node in the winding trail (alternating). */
  // Trail geometry — MUST match the SCSS (.node 64px, .trail gap 30px). The SVG
  // viewBox is "0 0 100 H" with preserveAspectRatio=none: X is a 0..100 percent
  // and Y is actual pixels so the dashed path lines up 1:1 with the laid-out
  // node rows.
  private static readonly NODE = 64;
  private static readonly GAP = 30;

  /**
   * Node centre X (0..100): a balanced left→centre→right→centre→left zig-zag
   * (the well-liked original layout), spread across the width. Same pattern in
   * every chapter; the dashed line connects the nodes.
   */
  nodeX(indexInChapter: number): number {
    // Gentler amplitude (28..72, not 20..80) so the centre node isn't a sharp
    // triangular peak — especially on the wide desktop column.
    const pattern = [28, 50, 72, 50, 28];
    return pattern[indexInChapter % pattern.length];
  }
  /** Node centre X% for the template's inline positioning. */
  nodeLeftPercent(indexInChapter: number): number {
    return this.nodeX(indexInChapter);
  }

  /** Node centre Y in px for row i (half a node down each row pitch). */
  private nodeY(i: number): number {
    return i * (JourneyPage.NODE + JourneyPage.GAP) + JourneyPage.NODE / 2;
  }

  /** Total trail SVG height in px for n nodes (no trailing gap). */
  trailHeight(levels: DeckLevel[]): number {
    const n = Math.max(1, levels.length);
    return (n - 1) * (JourneyPage.NODE + JourneyPage.GAP) + JourneyPage.NODE;
  }
  trailViewBox(levels: DeckLevel[]): string {
    return `0 0 100 ${this.trailHeight(levels)}`;
  }

  /** Measured px width of a trail column (all are equal). Updated on render /
   *  resize so edge offsets convert correctly at any screen width. */
  private trailWidthPx = 320;

  /** Re-measure the trail column width (called after render and on resize). */
  private measureTrail(): void {
    const el = document.querySelector('.journey .trail') as HTMLElement | null;
    if (el && el.clientWidth > 0) this.trailWidthPx = el.clientWidth;
  }

  /**
   * SVG path: the line LEAVES a node from the side facing the next node and
   * ARRIVES at the next node's TOP, with a gentle tilde curve — the hand-drawn
   * "exit right → enter top, then exit left → enter top" pattern.
   *
   * The viewBox X is 0..100 (percent) and Y is px, stretched with
   * preserveAspectRatio="none". A node's radius is 32px in BOTH axes on screen,
   * so to offset by the node radius we convert: X% offset = 32 / trailWidthPx *
   * 100 (re-measured on render/resize, so it stays correct at any width); Y is
   * just 32px. This is what makes it scale-stable (the old fixed 9% broke on
   * wide desktop).
   */
  trailPath(levels: DeckLevel[]): string {
    const n = levels.length;
    if (n < 2) return '';
    const RY = JourneyPage.NODE / 2;                         // 32px
    const RX = (RY / Math.max(1, this.trailWidthPx)) * 100;  // same radius, in X%
    const segs: string[] = [];
    for (let i = 1; i < n; i++) {
      const ax = this.nodeX(i - 1), ay = this.nodeY(i - 1);
      const bx = this.nodeX(i), by = this.nodeY(i);
      const dir = bx > ax ? 1 : (bx < ax ? -1 : 0);
      // Start: on node A's side facing B, slightly below its centre.
      const sx = ax + dir * RX;
      const sy = ay + RY * 0.45;
      // End: the TOP of node B.
      const ex = bx;
      const ey = by - RY;
      // Gentle tilde: control points at mid-height keep its own X, so the line
      // eases out sideways and eases into the top — soft, not a semicircle.
      const midY = (sy + ey) / 2;
      segs.push(`M ${sx} ${sy} C ${sx} ${midY}, ${ex} ${midY}, ${ex} ${ey}`);
    }
    return segs.join(' ');
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

  close(): void {
    this.router.navigate(['/home']);
  }
}
