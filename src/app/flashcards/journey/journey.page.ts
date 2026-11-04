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
import { FlashcardService, FlashcardDeck, DeckLevel, PracticeMode } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { AddWordService } from '../../services/add-word.service';

/** The node types of a chapter, in play order:
 *  Flashcards -> Quiz -> Write -> Match -> Builder (-> Blanks, French only). */
type NodeType = 'flip' | 'quiz' | 'write' | 'match' | 'builder' | 'blanks';

/** One node (activity) within a chapter. */
interface JourneyNode {
  type: NodeType;
  /** The per-node progress mode ('journey-flip', …). */
  mode: PracticeMode;
  /** The exercise route to navigate to. */
  route: string;
  icon: string;
  color: string;
  passed: boolean;
  unlocked: boolean;
}

/** A chapter = ONE skill, played as five fixed single-pass nodes. */
interface Chapter {
  /** Chapter number (1-based), shown as a small badge. */
  number: number;
  /** Skill name (shown as the chapter title). */
  name: string;
  /** The skill's level number (the shared level index used by every node mode). */
  levelNumber: number;
  nodes: JourneyNode[];
  /** How many of the 5 nodes are passed. */
  done: number;
  /** True when the chapter is reachable (chapter 1, or prev chapter complete). */
  unlocked: boolean;
  /** True when all 5 nodes are passed. */
  complete: boolean;
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
  deck: FlashcardDeck | null = null;
  /** All chapters (built once — the unlock chain needs every previous one). */
  chapters: Chapter[] = [];
  /** Index of the chapter currently in progress (for auto-scroll on enter). */
  currentChapterIndex = 0;
  isLoading = true;

  // ── Incremental rendering ───────────────────────────────────────────────────
  // Rendering ~300 chapters (each an SVG trail + 6 buttons) at once is slow, so
  // we only render a window of them and grow it as the user scrolls.
  private static readonly RENDER_BATCH = 12;
  /** How many chapters are currently rendered (grows via infinite scroll). */
  renderCount = JourneyPage.RENDER_BATCH;
  /** The chapters actually rendered (a prefix of `chapters`). */
  get visibleChapters(): Chapter[] {
    return this.chapters.slice(0, this.renderCount);
  }
  get hasMoreChapters(): boolean {
    return this.renderCount < this.chapters.length;
  }

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

    // One chapter per skill level. Node modes share this skill level index.
    const levels = await this.flashcards.getDeckLevels(this.deck.id, 'journey-flip');
    this.chapters = await this.buildChapters(this.deck.id, levels);
    // Current chapter = first not-yet-complete unlocked chapter.
    this.currentChapterIndex = Math.max(
      0,
      this.chapters.findIndex(c => c.unlocked && !c.complete),
    );
    // Render at least up to the current chapter (+ a batch) so the auto-scroll
    // target exists, without rendering all chapters up front.
    this.renderCount = Math.min(
      this.chapters.length,
      Math.max(JourneyPage.RENDER_BATCH, this.currentChapterIndex + 1 + JourneyPage.RENDER_BATCH),
    );
    this.isLoading = false;
    this.cdr.detectChanges();
    // Measure the trail width (for scale-correct dashed-path offsets) and jump
    // (smoothly) to the chapter being played once the view has painted.
    setTimeout(() => {
      this.measureTrail();
      this.cdr.detectChanges();
      this.scrollToCurrentChapter();
    }, 150);
  }

  /** Re-measure trail width + redraw the dashed path when the window resizes. */
  @HostListener('window:resize')
  onResize(): void {
    this.measureTrail();
    this.cdr.detectChanges();
  }

  /** trackBy so Angular reuses chapter DOM instead of re-creating it. */
  trackChapter(_index: number, chapter: Chapter): number {
    return chapter.number;
  }

  /** Render the next batch of chapters as the user nears the bottom. */
  loadMoreChapters(ev: Event): void {
    this.renderCount = Math.min(this.chapters.length, this.renderCount + JourneyPage.RENDER_BATCH);
    this.cdr.detectChanges();
    // ion-infinite-scroll expects its `complete()` to be called.
    const target = ev.target as unknown as { complete?: () => void };
    target.complete?.();
  }

  /** Node definitions in play order (type → mode / route / icon / colour):
   *  Flashcards → Quiz → Write → Match → Builder → Blanks. The Blanks node is
   *  French-only and is appended per-chapter in buildChapters(). */
  private static readonly NODE_DEFS: { type: NodeType; mode: PracticeMode; route: string; icon: string; color: string }[] = [
    { type: 'flip',    mode: 'journey-flip',    route: '/practice/flip',            icon: 'albums-outline',      color: 'primary' },
    { type: 'quiz',    mode: 'journey-quiz',    route: '/practice/quiz',            icon: 'help-circle-outline', color: 'success' },
    { type: 'write',   mode: 'journey-write',   route: '/practice/journey-play',    icon: 'create-outline',      color: 'secondary' },
    { type: 'match',   mode: 'journey-match',   route: '/practice/match',           icon: 'git-compare-outline', color: 'tertiary' },
    { type: 'builder', mode: 'journey-builder', route: '/practice/journey-builder', icon: 'construct-outline',   color: 'warning' },
  ];

  /** The French-only Blanks node, appended to each chapter when the deck is FR. */
  private static readonly BLANKS_NODE_DEF = {
    type: 'blanks' as NodeType, mode: 'journey-blanks' as PracticeMode,
    route: '/practice/blanks', icon: 'reorder-four-outline', color: 'danger',
  };

  /**
   * Build one chapter per skill. Each chapter has the fixed nodes (5, +Blanks
   * on French decks); a node is `passed` when its LevelProgress bestScore ≥ 70.
   * Nodes unlock left→right (node 1, else previous node passed). A chapter
   * unlocks when the previous chapter's nodes are all passed (chapter 1 always).
   */
  private async buildChapters(deckId: string, levels: DeckLevel[]): Promise<Chapter[]> {
    // French decks get the extra Blanks node (the phrase generator is French).
    const isFrench = (this.deck?.languageCode ?? this.settings.learningLanguage()) === 'fr';
    const nodeDefs = isFrench
      ? [...JourneyPage.NODE_DEFS, JourneyPage.BLANKS_NODE_DEF]
      : JourneyPage.NODE_DEFS;

    // ONE bulk read of all level progress for the deck, then Map lookups — was
    // ~1 DB read per node (hundreds of chapters × 6 nodes), which was slow.
    const progress = await this.flashcards.getDeckLevelProgressMap(deckId);
    const PASS = 70;

    const chapters: Chapter[] = [];
    let prevComplete = true; // chapter 1 is always reachable
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const chapterUnlocked = prevComplete;

      // Determine each node's passed state from the bulk progress map.
      const passed: boolean[] = nodeDefs.map(def => {
        const p = progress.get(`${def.mode}-${level.levelNumber}`);
        return (p?.bestScore ?? 0) >= PASS;
      });

      const nodes: JourneyNode[] = nodeDefs.map((def, n) => ({
        type: def.type,
        mode: def.mode,
        route: def.route,
        icon: def.icon,
        color: def.color,
        passed: passed[n],
        // Unlocked if the chapter is reachable AND (first node or previous passed).
        unlocked: chapterUnlocked && (n === 0 || passed[n - 1]),
      }));

      const doneCount = passed.filter(Boolean).length;
      const complete = doneCount === nodeDefs.length;
      chapters.push({
        number: i + 1,
        // Skill name only. Decks without named skills (e.g. Dutch) show nothing
        // here — the purple chapter number already identifies the chapter, so
        // the "Level N" fallback is redundant and was dropped.
        name: level.skill ?? '',
        levelNumber: level.levelNumber,
        nodes,
        done: doneCount,
        unlocked: chapterUnlocked,
        complete,
      });
      prevComplete = complete;
    }
    return chapters;
  }

  /** Scroll the content so the chapter being played is in view on entry, with
   *  a custom EASE-OUT (fast at the start, slowing as it arrives). Also backs
   *  the "jump to current" FAB, so it allows forcing even for chapter 0. */
  async scrollToCurrentChapter(force = false): Promise<void> {
    if (this.currentChapterIndex <= 0 && !force) return;
    // Make sure the target chapter is actually rendered (lazy window).
    if (this.renderCount <= this.currentChapterIndex) {
      this.renderCount = Math.min(this.chapters.length, this.currentChapterIndex + 1 + JourneyPage.RENDER_BATCH);
      this.cdr.detectChanges();
    }
    const el = document.getElementById(`journey-chapter-${this.currentChapterIndex}`);
    const content = document.querySelector('ion-content.journey-content') as HTMLIonContentElement | null;
    if (!el || !content) return;
    const scrollEl = await content.getScrollElement();
    const box = el.getBoundingClientRect();
    const from = scrollEl.scrollTop;
    const to = Math.max(0, Math.min(from + box.top - 90, scrollEl.scrollHeight - scrollEl.clientHeight));
    if (Math.abs(to - from) < 4) { this.showJumpFab = false; this.cdr.detectChanges(); return; }
    const duration = 650;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const stepFn = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      scrollEl.scrollTop = from + (to - from) * ease(t);
      if (t < 1) requestAnimationFrame(stepFn);
    };
    requestAnimationFrame(stepFn);
  }

  // ── "Jump to current" FAB ───────────────────────────────────────────────────
  /** True when the current chapter is scrolled well out of view. */
  showJumpFab = false;

  /** Scroll handler on ion-content: show the FAB when the current chapter is
   *  off-screen (above or below the viewport by a margin). */
  onContentScroll(): void {
    if (this.currentChapterIndex < 0 || this.isLoading) return;
    const el = document.getElementById(`journey-chapter-${this.currentChapterIndex}`);
    if (!el) {
      // Current chapter isn't even rendered yet → it's below; show the FAB.
      if (!this.showJumpFab) { this.showJumpFab = true; this.cdr.detectChanges(); }
      return;
    }
    const box = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // Off-screen if its whole box is above the top or below the bottom.
    const offscreen = box.bottom < 80 || box.top > vh - 80;
    if (offscreen !== this.showJumpFab) {
      this.showJumpFab = offscreen;
      this.cdr.detectChanges();
    }
  }

  /** FAB tap: smooth-scroll back to the current chapter. */
  jumpToCurrent(): void {
    void this.scrollToCurrentChapter(true);
  }

  // ── Serpentine trail geometry ──────────────────────────────────────────────
  // Each chapter draws its nodes on a soft zig-zag arc with a dashed tilde path
  // threading through them. MUST match the SCSS (.node is NODE px, .trail gap is
  // GAP px). The SVG viewBox is "0 0 100 H" with preserveAspectRatio=none: X is
  // a 0..100 percent and Y is actual pixels, so the dashed path lines up 1:1
  // with the laid-out node rows. Six positions cover the FR 6-node chapters;
  // 5-node chapters just use the first five.
  private static readonly NODE = 64;  // MUST equal the SCSS .node-row height / .node size
  private static readonly GAP = 22;   // MUST equal the SCSS .trail gap
  // Gentler horizontal spread (was 28/50/72) so the zig-zag is tighter, closer
  // to the Duolingo path. 6 positions cover the FR 6-node chapters.
  private static readonly ARC = [36, 50, 64, 50, 36, 50];

  /** Node centre X (0..100) for its position in the chapter. */
  nodeX(indexInChapter: number): number {
    return JourneyPage.ARC[indexInChapter % JourneyPage.ARC.length];
  }
  /** Node centre X% for the template's inline positioning. */
  nodeLeftPercent(indexInChapter: number): number {
    return this.nodeX(indexInChapter);
  }
  /** Node centre Y in px for row i (half a node down each row pitch). */
  private nodeY(i: number): number {
    return i * (JourneyPage.NODE + JourneyPage.GAP) + JourneyPage.NODE / 2;
  }
  /** Total trail SVG height in px for the chapter's nodes (no trailing gap). */
  trailHeight(nodes: JourneyNode[]): number {
    const n = Math.max(1, nodes.length);
    return (n - 1) * (JourneyPage.NODE + JourneyPage.GAP) + JourneyPage.NODE;
  }
  trailViewBox(nodes: JourneyNode[]): string {
    return `0 0 100 ${this.trailHeight(nodes)}`;
  }

  /** Measured px width of a trail column (all equal); keeps the radius offset
   *  scale-correct at any screen width. */
  private trailWidthPx = 320;
  private measureTrail(): void {
    const el = document.querySelector('.journey .trail') as HTMLElement | null;
    if (el && el.clientWidth > 0) this.trailWidthPx = el.clientWidth;
  }

  /**
   * Dashed tilde path: the line LEAVES a node from the side facing the next
   * node and ARRIVES at the next node's TOP, with a gentle curve. The viewBox
   * X is 0..100 (percent) and Y is px (preserveAspectRatio="none"), so to
   * offset by the node radius we convert X% = NODE/2 / trailWidthPx * 100 and
   * keep Y in px. This makes it scale-stable at any width.
   */
  /** SVG `d` for the single segment node(i-1) → node(i). */
  private segmentPath(i: number): string {
    const RY = JourneyPage.NODE / 2;
    const RX = (RY / Math.max(1, this.trailWidthPx)) * 100;
    const ax = this.nodeX(i - 1), ay = this.nodeY(i - 1);
    const bx = this.nodeX(i), by = this.nodeY(i);
    const dir = bx > ax ? 1 : (bx < ax ? -1 : 0);
    const sx = ax + dir * RX;
    const sy = ay + RY * 0.45;
    const ex = bx;
    const ey = by - RY;
    const midY = (sy + ey) / 2;
    return `M ${sx} ${sy} C ${sx} ${midY}, ${ex} ${midY}, ${ex} ${ey}`;
  }

  /**
   * Per-segment trail so each dash between two nodes can show PROGRESS:
   * - the segment leaving a PASSED node is green (that step is done),
   * - otherwise it stays grey (including the edge into the current node).
   * Returns `{ d, stroke }` for each of the n-1 segments.
   */
  trailSegments(chapter: Chapter): { d: string; stroke: string }[] {
    const nodes = chapter.nodes;
    const n = nodes.length;
    if (n < 2) return [];
    // SVG `stroke` attribute does NOT resolve CSS var() — use literal colours.
    const GREEN = '#2dd36f';
    const GREY = '#33465c';
    const segs: { d: string; stroke: string }[] = [];
    for (let i = 1; i < n; i++) {
      const from = nodes[i - 1];
      segs.push({ d: this.segmentPath(i), stroke: from.passed ? GREEN : GREY });
    }
    return segs;
  }

  /** The next node to play in a chapter (first unlocked, not-yet-passed) — gets
   *  the pulsing "current" highlight. Only the active chapter has one. */
  isCurrentNode(chapter: Chapter, node: JourneyNode): boolean {
    if (!chapter.unlocked || chapter.complete) return false;
    const next = chapter.nodes.find(n => n.unlocked && !n.passed);
    return next === node;
  }

  /** Human label for a node's activity (for the a11y label / tooltip). */
  nodeLabel(type: NodeType): string {
    return this.t(`journey.node.${type}`);
  }

  /** Start a node: navigate to its exercise with the per-node mode + level. */
  startNode(chapter: Chapter, node: JourneyNode): void {
    if (!node.unlocked || !this.deck) return;
    this.router.navigate([node.route, this.deck.id], {
      queryParams: { level: chapter.levelNumber, mode: node.mode },
    });
  }

  close(): void {
    this.router.navigate(['/home']);
  }
}
