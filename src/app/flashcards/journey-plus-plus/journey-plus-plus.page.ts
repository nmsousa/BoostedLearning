/**
 * Journey++ Page (EXPERIMENTAL — high-fidelity pass of Journey+)
 *
 * Same data and behaviour as the classic Journey / Journey+ (shared `journey-*`
 * progress, same node exercises), rebuilt to match the design mockup
 * (src/assets/images/mockup-journey.png):
 *  - compact nodes on a gentle S-route, each with a pill-shaped info panel
 *    anchored to its right (the node overlaps the panel's leading end);
 *  - neon green done nodes, a white-rimmed cyan active node with an outer
 *    glow ring, charcoal locked spheres with a solid padlock;
 *  - short glowing route dashes (green→cyan travelled, lavender ahead);
 *  - a starry night sky over a skyline band of the illustration;
 *  - a floating progress HUD (ring | progress | XP | CTA).
 *
 * Unlike the earlier one-chapter-at-a-time version, ALL chapters are stacked in
 * ONE continuous scroll (like the classic Journey): a light chapter header, the
 * chapter's node route, then the next chapter below it — so you just keep
 * scrolling. Chapters render incrementally (a window that grows on scroll) and
 * a "jump to current" FAB appears when the active chapter is off-screen.
 *
 * Geometry: within a chapter, node centres are X% of the measured map width and
 * Y px from the chapter top; each chapter's SVG uses a px viewBox of the same
 * size, so the route always passes through the node centres.
 *
 * @module app/flashcards/journey-plus-plus
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
  ViewChild, ElementRef, AfterViewInit, HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { FlashcardService, FlashcardDeck } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import {
  buildJourneyChapters, type JourneyChapter, type JourneyNode, type JourneyNodeType,
} from '../journey/journey-model';
import { JOURNEY_PLUS_PLUS_FROM } from '../journey/journey-back';

type StopState = 'done' | 'active' | 'locked';

/** Everything the template needs for one stop (precomputed). */
interface MapStop {
  node: JourneyNode;
  index: number;
  state: StopState;
  /** Node centre X as a % of the chapter map width. */
  xPct: number;
  /** Node centre Y in px from the top of the chapter map. */
  y: number;
  label: string;
  detail: string;
  aria: string;
}

/** A fully-precomputed chapter block (header + its node route). */
interface MapChapter {
  chapter: JourneyChapter;
  index: number;
  title: string;
  emoji: string;
  subtitle: string;
  mapHeight: number;
  stops: MapStop[];
  pathDone: string;
  pathAhead: string;
  /** True for the chapter the learner is currently on. */
  current: boolean;
}

interface LanguageOption { code: string; name: string; flagUrl: string }

@Component({
  selector: 'app-journey-plus-plus',
  templateUrl: './journey-plus-plus.page.html',
  styleUrls: ['./journey-plus-plus.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyPlusPlusPage implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private cdr = inject(ChangeDetectorRef);
  private navCtrl = inject(NavController);

  @ViewChild('content', { read: ElementRef }) private contentEl?: ElementRef<HTMLIonContentElement>;
  @ViewChild('scene') private sceneEl?: ElementRef<HTMLElement>;

  // ── Geometry ────────────────────────────────────────────────────────────────
  /** Gentle S of node centres (X % of map width), as in the mockup. Kept left
   *  of centre so the right-hand panels always have room. */
  private static readonly X_PATTERN = [33, 43, 50, 40, 31, 42];
  // Top inset of the first node's CENTRE within a chapter's map. Must clear the
  // largest node (the active one, ~102px → ~51px radius) so a chapter whose
  // first stop is active doesn't crowd the chapter title above it.
  private static readonly PAD_TOP = 68;
  private static readonly PAD_BOTTOM = 36;
  /** Row pitch = width × this, clamped. */
  private static readonly ROW_RATIO = 0.28;
  private static readonly ROW_MIN = 100;
  private static readonly ROW_MAX = 130;
  private static readonly TENSION = 0.5;
  /** Display-only reward per activity (the app has no XP system yet). */
  private static readonly XP_PER_NODE = 10;
  private static readonly SECONDS_PER_WORD: Record<JourneyNodeType, number> = {
    flip: 5, quiz: 6, write: 12, match: 4, builder: 0, blanks: 8,
  };
  private static readonly BUILDER_SECONDS = 180;

  // ── Incremental rendering (all chapters live in one scroll) ────────────────
  private static readonly RENDER_BATCH = 10;

  isLoading = true;
  /** True while a language switch is rebuilding + snapping to the current
   *  chapter. Keeps a spinner overlay over the (already rendered) content so
   *  the reposition isn't visible. */
  switchingLanguage = false;
  deck: FlashcardDeck | null = null;
  chapters: JourneyChapter[] = [];
  /** Index of the chapter in progress (first unlocked, not complete). */
  currentIndex = 0;
  /** Precomputed, rendered chapter blocks (a prefix of `chapters`). */
  mapChapters: MapChapter[] = [];
  /** How many chapters are currently built/rendered. */
  private renderCount = JourneyPlusPlusPage.RENDER_BATCH;

  mapWidth = 360;
  readonly ringCircumference = 2 * Math.PI * 25;
  ringOffset = this.ringCircumference;
  progressPct = 0;
  xpReward = 0;
  ctaLabel = '';
  ctaDisabled = false;
  /** True when the current chapter is scrolled well out of view. */
  showJumpFab = false;
  /** Whether the current node sits ABOVE ('up') or BELOW ('down') the current
   *  viewport — drives the FAB's arrow direction. */
  jumpDirection: 'up' | 'down' = 'down';

  /** Key ("chapterIndex:stopIndex") of the LOCKED node whose "unlocks after…"
   *  caption is currently revealed (tapped). Only one shows at a time; tapping
   *  another, or an unlocked node, replaces/clears it. */
  revealedStopKey: string | null = null;

  /** Stable key for a stop within the rendered map. */
  stopKey(block: MapChapter, stop: MapStop): string { return `${block.index}:${stop.index}`; }

  /** True when this locked node's caption should be visible (it was tapped). */
  isHintVisible(block: MapChapter, stop: MapStop): boolean {
    return stop.state === 'locked' && this.revealedStopKey === this.stopKey(block, stop);
  }

  availableLanguages: LanguageOption[] = [];

  private resizeObserver?: ResizeObserver;

  get learningLanguage(): string { return this.settings.learningLanguage(); }
  get currentLanguage(): LanguageOption {
    return (
      this.availableLanguages.find(l => l.code === this.learningLanguage) ??
      this.availableLanguages[0] ?? {
        code: this.learningLanguage,
        name: this.learningLanguage.toUpperCase(),
        flagUrl: this.flagUrl(this.learningLanguage),
      }
    );
  }
  get currentChapter(): JourneyChapter | null { return this.chapters[this.currentIndex] ?? null; }
  get hasMoreChapters(): boolean { return this.renderCount < this.chapters.length; }

  /** Index of the chapter currently filling the viewport — drives the HEADER
   *  (its name + progress). Tracked on scroll so the header always names the
   *  section you're looking at, not just the in-progress one. Defaults to the
   *  in-progress chapter on load. */
  headerChapterIndex = 0;

  /** The chapter shown in the header (the one on screen). */
  get headerChapter(): JourneyChapter | null {
    return this.chapters[this.headerChapterIndex] ?? this.currentChapter;
  }
  /** Header title = the on-screen chapter's name. */
  get headerTitle(): string {
    const ch = this.headerChapter;
    if (!ch) return this.t('journeyPP.title');
    return ch.name || this.t('journeyPlus.chapterFallback', { n: ch.number });
  }
  get headerDone(): number { return this.headerChapter?.done ?? 0; }
  get headerTotal(): number { return Math.max(1, this.headerChapter?.nodes.length ?? 1); }
  get headerPct(): number { return Math.round((this.headerDone / this.headerTotal) * 100); }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    await this.load(true);
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.observeScene();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.tapTimer) { clearTimeout(this.tapTimer); this.tapTimer = null; }
  }

  async ionViewWillEnter(): Promise<void> {
    // Returning from a finished exercise: refresh progress and bring the new
    // active node into view (it may now sit below the fold).
    if (this.deck) await this.load(false, true);
  }

  private observeScene(): void {
    const el = this.sceneEl?.nativeElement;
    if (el && this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver.observe(el);
    }
  }

  private measure(): void {
    const w = this.sceneEl?.nativeElement.clientWidth ?? 0;
    if (w > 0 && Math.abs(w - this.mapWidth) > 0.5) {
      this.mapWidth = w;
      this.rebuild();
      this.cdr.detectChanges();
    }
  }

  private get rowPitch(): number {
    const r = this.mapWidth * JourneyPlusPlusPage.ROW_RATIO;
    return Math.round(Math.min(JourneyPlusPlusPage.ROW_MAX, Math.max(JourneyPlusPlusPage.ROW_MIN, r)));
  }

  @HostListener('window:resize')
  onResize(): void { this.measure(); }

  // ── Data ────────────────────────────────────────────────────────────────────
  private async load(initial: boolean, returning = false, languageSwitch = false): Promise<void> {
    this.availableLanguages = this.flashcards
      .getAvailableLanguages()
      .map(l => ({ ...l, flagUrl: this.flagUrl(l.code) }));

    const lang = this.settings.learningLanguage();
    const decks = this.flashcards.getAllDecks().filter(d => d.languageCode === lang);
    this.deck = decks[0] ?? this.flashcards.getAllDecks()[0] ?? null;
    if (!this.deck) {
      this.chapters = [];
      this.mapChapters = [];
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    const levels = await this.flashcards.getDeckLevels(this.deck.id, 'journey-flip');
    const progress = await this.flashcards.getDeckLevelProgressMap(this.deck.id);
    this.chapters = buildJourneyChapters(levels, progress, this.deck.languageCode === 'fr');

    const found = this.chapters.findIndex(c => c.unlocked && !c.complete);
    this.currentIndex = found >= 0 ? found : Math.max(0, this.chapters.length - 1);
    // Header starts on the in-progress chapter; scroll updates it thereafter.
    this.headerChapterIndex = this.currentIndex;
    // Render at least up to the current chapter (+ a batch), like the classic
    // Journey, so the auto-scroll target exists without building all chapters.
    this.renderCount = Math.min(
      this.chapters.length,
      Math.max(JourneyPlusPlusPage.RENDER_BATCH, this.currentIndex + 1 + JourneyPlusPlusPage.RENDER_BATCH),
    );

    // On a language switch, keep a loading overlay OVER the (already rendered)
    // content through the rebuild + scroll so the user never sees the new
    // chapter rendered at the OLD scroll position (the "flash then scroll to
    // current" glitch). The content is snapped to the current chapter INSTANTLY
    // (no animation) under the overlay, then the overlay is cleared.
    this.isLoading = false;
    this.switchingLanguage = languageSwitch;
    this.rebuild();
    this.updateHud();
    this.cdr.detectChanges();
    setTimeout(() => {
      this.observeScene();
      this.measure();
      if (languageSwitch) {
        // Content is rendered but hidden behind the overlay: jump to the
        // current chapter with no animation, then reveal.
        void this.jumpToCurrentInstant().then(() => {
          this.switchingLanguage = false;
          this.cdr.detectChanges();
        });
      } else if (initial || returning) {
        void this.scrollToCurrent();
      }
    }, 150);
  }

  /** Snap the current chapter into view with NO animation. Used on a language
   *  switch so there's no visible scroll-from-top. Renders enough chapters for
   *  the target to exist, measures, then writes scrollTop directly. */
  private async jumpToCurrentInstant(): Promise<void> {
    const content = this.contentEl?.nativeElement;
    if (!content) return;
    if (this.renderCount <= this.currentIndex) {
      this.renderCount = Math.min(this.chapters.length, this.currentIndex + 1 + JourneyPlusPlusPage.RENDER_BATCH);
      this.rebuild();
      this.cdr.detectChanges();
    }
    const scrollEl = await content.getScrollElement();
    const prev = scrollEl.style.scrollBehavior;
    scrollEl.style.scrollBehavior = 'auto';
    const target = this.currentScrollTarget(scrollEl);
    scrollEl.scrollTop = target ?? 0;
    scrollEl.style.scrollBehavior = prev;
  }

  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    // Show the overlay immediately, then rebuild + snap under it (no visible
    // "render at old position → scroll to current" flash).
    this.switchingLanguage = true;
    this.cdr.detectChanges();
    await this.flashcards.initialize();
    await this.load(true, false, true);
  }

  /** Render the next batch of chapters as the user nears the bottom. */
  loadMoreChapters(ev: Event): void {
    this.renderCount = Math.min(this.chapters.length, this.renderCount + JourneyPlusPlusPage.RENDER_BATCH);
    this.rebuild();
    this.cdr.detectChanges();
    const target = ev.target as unknown as { complete?: () => void };
    target.complete?.();
  }

  // ── View model ──────────────────────────────────────────────────────────────
  /** Build every rendered chapter block (header + node route). */
  private rebuild(): void {
    const row = this.rowPitch;
    this.mapChapters = this.chapters.slice(0, this.renderCount).map((ch, ci) => {
      const activeIdx = ch.unlocked ? ch.nodes.findIndex(n => n.unlocked && !n.passed) : -1;
      const stops: MapStop[] = ch.nodes.map((node, i) => {
        const state: StopState = node.unlocked && node.passed ? 'done' : i === activeIdx ? 'active' : 'locked';
        const label = this.t(`journey.node.${node.type}`);
        return {
          node,
          index: i,
          state,
          xPct: JourneyPlusPlusPage.X_PATTERN[i % JourneyPlusPlusPage.X_PATTERN.length],
          y: JourneyPlusPlusPage.PAD_TOP + i * row,
          label,
          detail: this.stopDetail(ch, i, state),
          aria: state === 'locked'
            ? `${label}, ${this.t('journeyPlus.locked')}`
            : this.t('journeyPlus.startNode', { name: label }),
        };
      });
      const n = stops.length;
      const mapHeight = n === 0 ? 0
        : JourneyPlusPlusPage.PAD_TOP + (n - 1) * row + JourneyPlusPlusPage.PAD_BOTTOM;
      const { pathDone, pathAhead } = this.buildPaths(stops, activeIdx, ch.complete, row);
      return {
        chapter: ch,
        index: ci,
        title: ch.name || this.t('journeyPlus.chapterFallback', { n: ch.number }),
        emoji: JourneyPlusPlusPage.emojiFor(ch.name),
        subtitle: this.t('journeyPlus.words', { n: ch.cardCount }),
        mapHeight,
        stops,
        pathDone,
        pathAhead,
        current: ci === this.currentIndex,
      };
    });
  }

  /** HUD reflects the chapter in progress (or the last one if all done). */
  private updateHud(): void {
    const ch = this.currentChapter;
    if (!ch) { this.ctaLabel = ''; this.ctaDisabled = true; return; }
    const total = Math.max(1, ch.nodes.length);
    // progressPct kept for the in-progress chapter; the HEADER shows per-chapter
    // progress via headerPct. The ring + XP were removed from the HUD.
    this.progressPct = Math.round((ch.done / total) * 100);
    this.ctaDisabled = false;
    const activeIdx = ch.unlocked ? ch.nodes.findIndex(n => n.unlocked && !n.passed) : -1;
    if (activeIdx >= 0) {
      // A single, calm "Continue" (instead of "Let's start!" / "Keep going!").
      this.ctaLabel = this.t('journeyPlus.continue');
    } else {
      this.ctaLabel = this.t('journeyPlus.allDone');
      this.ctaDisabled = true;
    }
  }

  private stopDetail(ch: JourneyChapter, i: number, state: StopState): string {
    // Done nodes show no "Great job!" caption (removed). Active nodes show the
    // time estimate. Locked nodes carry their "unlocks after…" reason, but the
    // template only SHOWS it for the node the user tapped (revealedStopKey) —
    // so it reads like an inline tooltip pinned to the node, not a toast.
    if (state === 'done') return '';
    if (state === 'active') return this.t('journeyPP.minutes', { n: this.minutesFor(ch, ch.nodes[i].type) });
    // Locked: explain what unlocks it (first node of a locked chapter vs a node
    // gated by the previous node in an unlocked chapter).
    if (!ch.unlocked && i === 0) return this.t('journeyPlus.unlocksChapter', { n: ch.number - 1 });
    const prev = ch.nodes[i - 1];
    return prev
      ? this.t('journeyPP.unlocksAfter', { name: this.t(`journey.node.${prev.type}`) })
      : this.t('journeyPlus.locked');
  }

  private minutesFor(ch: JourneyChapter, type: JourneyNodeType): number {
    const secs = type === 'builder'
      ? JourneyPlusPlusPage.BUILDER_SECONDS
      : ch.cardCount * JourneyPlusPlusPage.SECONDS_PER_WORD[type];
    return Math.max(1, Math.round(secs / 60));
  }

  /** Smooth cubic Béziers through a chapter's node centres (vertical tangents),
   *  split at the active node into travelled / ahead. */
  private buildPaths(
    stops: MapStop[], activeIdx: number, complete: boolean, row: number,
  ): { pathDone: string; pathAhead: string } {
    const pts = stops.map(s => ({ x: (s.xPct / 100) * this.mapWidth, y: s.y }));
    if (pts.length < 2) return { pathDone: '', pathAhead: '' };
    const splitAt = activeIdx >= 0 ? activeIdx : complete ? pts.length - 1 : 0;
    const k = row * JourneyPlusPlusPage.TENSION;
    const f = (v: number) => v.toFixed(1);
    const build = (from: number, to: number) => {
      if (to <= from) return '';
      let d = `M ${f(pts[from].x)} ${f(pts[from].y)}`;
      for (let i = from + 1; i <= to; i++) {
        const a = pts[i - 1], b = pts[i];
        d += ` C ${f(a.x)} ${f(a.y + k)}, ${f(b.x)} ${f(b.y - k)}, ${f(b.x)} ${f(b.y)}`;
      }
      return d;
    };
    return { pathDone: build(0, splitAt), pathAhead: build(splitAt, pts.length - 1) };
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  // ── Admin double-tap to complete a node ─────────────────────────────────────
  private static readonly DOUBLE_TAP_MS = 320;
  /** Pending single-tap timer (admin mode only, so a double-tap can pre-empt
   *  the normal open). */
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTapKey: string | null = null;

  /** Entry point for a node/panel tap. Outside admin mode it opens the node
   *  immediately. In admin mode the single-tap is deferred briefly: a quick
   *  second tap on the SAME node force-completes it (3★, plus a good time/combo
   *  where applicable); a lone tap falls through to the normal open. */
  onNodeTap(block: MapChapter, stop: MapStop): void {
    if (!this.settings.adminMode()) { this.openStop(block, stop); return; }

    const key = this.stopKey(block, stop);
    if (this.tapTimer && this.pendingTapKey === key) {
      // Second tap on the same node within the window → force-complete.
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
      this.pendingTapKey = null;
      void this.adminCompleteNode(block, stop);
      return;
    }
    // First tap: wait briefly for a possible second tap before opening.
    if (this.tapTimer) clearTimeout(this.tapTimer);
    this.pendingTapKey = key;
    this.tapTimer = setTimeout(() => {
      this.tapTimer = null;
      this.pendingTapKey = null;
      this.openStop(block, stop);
    }, JourneyPlusPlusPage.DOUBLE_TAP_MS);
  }

  /** Admin-only: force-complete a node with 3★ (and a good time/combo for
   *  modes that score on those), then refresh the map. */
  private async adminCompleteNode(block: MapChapter, stop: MapStop): Promise<void> {
    if (!this.deck || !this.settings.adminMode()) return;
    const deckId = this.deck.id;
    const level = block.chapter.levelNumber;
    const mode = stop.node.mode;
    const cardCount = Math.max(1, block.chapter.cardCount || 1);

    try {
      if (stop.node.type === 'flip') {
        // Flip scores on correct/total; 100% → 3★. Also set every level card to
        // "known" so the underlying knowledge matches a real clear.
        for (const card of this.flashcards.getLevelCards(deckId, level)) {
          await this.flashcards.adminSetFlipKnowledge(deckId, card.id, 'known');
        }
        await this.flashcards.saveLevelProgress(deckId, mode, level, cardCount, cardCount);
      } else if (stop.node.type === 'match') {
        // Match scores on time + combo: fill all 5 rounds with 100%, a good
        // (fast) time and a full combo.
        const goodTime = Math.max(5, cardCount * 2);
        for (let guard = 0; guard < 5; guard++) {
          const res = await this.flashcards.saveRoundProgress(deckId, mode, level, 100, goodTime, cardCount);
          if (res.levelComplete) break;
        }
      } else {
        // quiz / write / builder / blanks: 3★ across all 5 rounds.
        await this.flashcards.adminForceCompleteAllRounds(deckId, mode, level, 3);
      }
    } catch { /* best-effort admin shortcut */ }

    // Reload to reflect the new progress (unlocks the next node/chapter).
    await this.load(false, false);
  }

  openStop(block: MapChapter, stop: MapStop): void {
    if (!this.deck) return;
    // Tapping a LOCKED node reveals its inline "unlocks after…" caption (pinned
    // to the right of the node), toggling off on a second tap. Tapping any
    // other locked node moves the caption there.
    if (stop.state === 'locked') {
      const key = this.stopKey(block, stop);
      this.revealedStopKey = this.revealedStopKey === key ? null : key;
      this.cdr.detectChanges();
      return;
    }
    // Tapping a playable node clears any revealed hint and opens the exercise.
    this.revealedStopKey = null;
    // Use Ionic's FORWARD navigation (not plain router.navigate) so the map is
    // pushed onto the ion-router-outlet stack and stays a poppable entry. With
    // a plain navigate, hardware/gesture back found nothing to pop and fell
    // through to the /home fallback instead of returning to this map.
    void this.navCtrl.navigateForward([stop.node.route, this.deck.id], {
      queryParams: { level: block.chapter.levelNumber, mode: stop.node.mode, from: JOURNEY_PLUS_PLUS_FROM },
    });
  }

  /** Primary HUD action: play the current chapter's active node. */
  onCta(): void {
    const block = this.mapChapters.find(b => b.current);
    const active = block?.stops.find(s => s.state === 'active');
    if (block && active) { this.openStop(block, active); return; }
    // Otherwise just bring the current chapter into view.
    void this.scrollToCurrent();
  }

  // Like the jump FAB, the Continue button can be pressed while a momentum
  // fling is still running. On Android WebView the first touch is consumed to
  // stop the fling and the synthesized `click` is swallowed, so a single tap
  // appeared to do nothing. Drive it from pointer events: pointerdown kills the
  // momentum, pointerup performs the action. `click` is kept as a de-duplicated
  // fallback for keyboard/a11y activation.
  private ctaHandledAt = 0;

  onCtaPointerDown(ev: Event): void {
    ev.preventDefault();
    void this.stopMomentum();
  }

  onCtaPointerUp(ev: Event): void {
    ev.preventDefault();
    this.ctaHandledAt = Date.now();
    this.onCta();
  }

  onCtaClick(): void {
    if (Date.now() - this.ctaHandledAt < 700) return;
    this.onCta();
  }

  // ── Scrolling ─────────────────────────────────────────────────────────────
  /** Compute the target scrollTop that brings the current node to ~40% of the
   *  viewport (or the chapter top near the top of the viewport). Returns null
   *  if nothing to scroll to. */
  private currentScrollTarget(scrollEl: HTMLElement): number | null {
    const active = document.querySelector(
      `#jpp-chapter-${this.currentIndex} .state-active`,
    ) as HTMLElement | null;
    const chapterEl = document.getElementById(`jpp-chapter-${this.currentIndex}`);
    const el = active ?? chapterEl;
    if (!el) return null;
    const top = el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    return Math.max(0, active ? top - scrollEl.clientHeight * 0.4 : top - 70);
  }

  /** Bring the active node of the current chapter to ~40% of the viewport.
   *  Works on the FIRST tap even mid-fling: we hard-stop any momentum scroll by
   *  writing scrollTop (with smooth behaviour temporarily disabled), then run
   *  our own animation and re-assert the target once more in case the fling
   *  fought the first attempt. */
  async scrollToCurrent(): Promise<void> {
    const content = this.contentEl?.nativeElement;
    if (!content) return;
    // Make sure the current chapter is actually rendered.
    if (this.renderCount <= this.currentIndex) {
      this.renderCount = Math.min(this.chapters.length, this.currentIndex + 1 + JourneyPlusPlusPage.RENDER_BATCH);
      this.rebuild();
      this.cdr.detectChanges();
    }
    const scrollEl = await content.getScrollElement();

    // Hard-stop any in-flight momentum: temporarily force instant scrolling and
    // pin scrollTop to its current value. On Android WebView a running fling
    // otherwise swallows the first programmatic scroll (the reported "first tap
    // only stops the scroll" bug).
    const prevBehavior = scrollEl.style.scrollBehavior;
    scrollEl.style.scrollBehavior = 'auto';
    scrollEl.scrollTop = scrollEl.scrollTop + 0; // commit a write to kill momentum

    const target = this.currentScrollTarget(scrollEl);
    if (target === null) { scrollEl.style.scrollBehavior = prevBehavior; void content.scrollToTop(400); return; }

    // Animate to the target. Recompute on the next frame (layout is now stable
    // after the momentum stop) and issue the real animated scroll. Then, once
    // the animation window elapses, snap-correct if a late fling left us short.
    requestAnimationFrame(() => {
      const t2 = this.currentScrollTarget(scrollEl) ?? target;
      void content.scrollToPoint(0, t2, 450);
      setTimeout(() => {
        scrollEl.style.scrollBehavior = prevBehavior;
        const t3 = this.currentScrollTarget(scrollEl);
        if (t3 !== null && Math.abs(scrollEl.scrollTop - t3) > 24) {
          scrollEl.scrollTop = t3; // instant correction if the animation fell short
        }
      }, 520);
    });
  }

  // The FAB can be tapped while a momentum fling is still running. On Android
  // WebView the first touch that lands on the button is consumed to stop the
  // fling, and the synthesized `click` is often suppressed — which is why a
  // single tap "only stopped the scrolling" and you had to tap again. We drive
  // the jump from pointer events instead: pointerdown kills the momentum
  // immediately; pointerup performs the jump (it fires even when click is
  // swallowed). `click` is a fallback for non-pointer (keyboard/a11y) activation
  // and is de-duplicated against a just-handled pointerup.
  private jumpHandledAt = 0;

  onJumpPointerDown(ev: Event): void {
    ev.preventDefault(); // don't let the press start a drag/scroll gesture
    void this.stopMomentum();
  }

  onJumpPointerUp(ev: Event): void {
    ev.preventDefault();
    this.jumpHandledAt = Date.now();
    void this.scrollToCurrent();
  }

  onJumpClick(): void {
    // Ignore the click that follows a pointerup we already handled.
    if (Date.now() - this.jumpHandledAt < 700) return;
    void this.scrollToCurrent();
  }

  /** Halt any in-flight momentum scroll immediately (instant scroll write). */
  async stopMomentum(): Promise<void> {
    const content = this.contentEl?.nativeElement;
    if (!content) return;
    const scrollEl = await content.getScrollElement();
    const prev = scrollEl.style.scrollBehavior;
    scrollEl.style.scrollBehavior = 'auto';
    scrollEl.scrollTop = scrollEl.scrollTop + 0;
    scrollEl.style.scrollBehavior = prev;
  }

  /** Show the jump FAB when the current chapter is off-screen, and point its
   *  arrow toward the current node (up if it's above us, down if below). */
  onContentScroll(): void {
    if (this.isLoading || this.currentIndex < 0) return;
    this.updateHeaderChapter();
    const el = document.getElementById(`jpp-chapter-${this.currentIndex}`);
    const vh = window.innerHeight;

    // Prefer the active node's position; fall back to the chapter block.
    const active = document.querySelector(
      `#jpp-chapter-${this.currentIndex} .state-active`,
    ) as HTMLElement | null;
    const ref = active ?? el;

    if (!ref) {
      // Chapter not rendered yet → it's further down the list.
      if (!this.showJumpFab || this.jumpDirection !== 'down') {
        this.showJumpFab = true; this.jumpDirection = 'down'; this.cdr.detectChanges();
      }
      return;
    }

    const box = ref.getBoundingClientRect();
    const above = box.bottom < 90;          // current node is above the viewport
    const below = box.top > vh - 90;        // current node is below the viewport
    const offscreen = above || below;
    const dir: 'up' | 'down' = above ? 'up' : 'down';

    if (offscreen !== this.showJumpFab || (offscreen && dir !== this.jumpDirection)) {
      this.showJumpFab = offscreen;
      this.jumpDirection = dir;
      this.cdr.detectChanges();
    }
  }

  /** Pick the chapter whose section currently sits under the header, so the
   *  header names the section you're looking at. We take the LAST rendered
   *  chapter whose top has scrolled above a line just under the header. */
  private updateHeaderChapter(): void {
    const line = 110; // px from the top of the viewport (just below the header)
    let idx = 0;
    for (let i = 0; i < this.mapChapters.length; i++) {
      const el = document.getElementById(`jpp-chapter-${i}`);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= line) idx = i;
      else break;
    }
    if (idx !== this.headerChapterIndex) {
      this.headerChapterIndex = idx;
      this.cdr.detectChanges();
    }
  }

  close(): void { this.router.navigate(['/home']); }

  trackChapter(_i: number, block: MapChapter): number { return block.chapter.number; }
  trackStop(_i: number, stop: MapStop): string { return stop.node.mode; }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private flagUrl(code: string): string {
    const toCountry: Record<string, string> = {
      nl: 'nl', dn: 'nl', fr: 'fr', es: 'es', it: 'it', de: 'de', pt: 'pt',
      en: 'gb', da: 'dk', el: 'gr', ja: 'jp', ko: 'kr', zs: 'cn', uk: 'ua',
      nb: 'no', he: 'il', hi: 'in', vi: 'vn', cs: 'cz', sv: 'se', ga: 'ie',
      gd: 'gb', cy: 'gb', hw: 'us', ht: 'ht', zu: 'za', sw: 'ke',
    };
    return `https://flagcdn.com/${toCountry[code] ?? code}.svg`;
  }

  private static emojiFor(skill: string): string {
    const s = skill.toLowerCase();
    const rules: [RegExp, string][] = [
      [/caf[eé]|coffee|drink/, '☕'],
      [/food|eat|restaurant|meal|cook|fruit/, '🍽️'],
      [/greet|hello|intro|meet|people/, '👋'],
      [/family|parent|child/, '👨‍👩‍👧'],
      [/travel|trip|airport|vacation|holiday|hotel/, '✈️'],
      [/shop|buy|cloth|store|money/, '🛍️'],
      [/home|house|room|furniture/, '🏠'],
      [/work|job|office|business/, '💼'],
      [/school|study|class|learn|education/, '🎓'],
      [/time|date|day|calendar|week|month/, '🕒'],
      [/weather|season/, '🌦️'],
      [/colou?r/, '🎨'],
      [/number|count/, '🔢'],
      [/animal|pet/, '🐾'],
      [/sport|hobby|game|play/, '⚽'],
      [/health|body|doctor|sick/, '🩺'],
      [/city|place|direction|where|town/, '🗺️'],
      [/music|song/, '🎵'],
      [/language|speak/, '💬'],
      [/feel|emotion|trait|describe/, '😊'],
      [/nature|plant|garden/, '🌿'],
    ];
    return rules.find(([re]) => re.test(s))?.[1] ?? '📘';
  }
}
