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

  @ViewChild('content', { read: ElementRef }) private contentEl?: ElementRef<HTMLIonContentElement>;
  @ViewChild('scene') private sceneEl?: ElementRef<HTMLElement>;

  // ── Geometry ────────────────────────────────────────────────────────────────
  /** Gentle S of node centres (X % of map width), as in the mockup. Kept left
   *  of centre so the right-hand panels always have room. */
  private static readonly X_PATTERN = [33, 43, 50, 40, 31, 42];
  private static readonly PAD_TOP = 48;
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

  ngOnDestroy(): void { this.resizeObserver?.disconnect(); }

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
  private async load(initial: boolean, returning = false): Promise<void> {
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
    // Render at least up to the current chapter (+ a batch), like the classic
    // Journey, so the auto-scroll target exists without building all chapters.
    this.renderCount = Math.min(
      this.chapters.length,
      Math.max(JourneyPlusPlusPage.RENDER_BATCH, this.currentIndex + 1 + JourneyPlusPlusPage.RENDER_BATCH),
    );

    this.isLoading = false;
    this.rebuild();
    this.updateHud();
    this.cdr.detectChanges();
    setTimeout(() => {
      this.observeScene();
      this.measure();
      if (initial || returning) void this.scrollToCurrent();
    }, 150);
  }

  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    this.isLoading = true;
    this.cdr.detectChanges();
    await this.flashcards.initialize();
    await this.load(true);
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
    this.progressPct = Math.round((ch.done / total) * 100);
    this.ringOffset = this.ringCircumference * (1 - ch.done / total);
    this.xpReward = ch.nodes.length * JourneyPlusPlusPage.XP_PER_NODE;
    this.ctaDisabled = false;
    const activeIdx = ch.unlocked ? ch.nodes.findIndex(n => n.unlocked && !n.passed) : -1;
    if (activeIdx >= 0) {
      this.ctaLabel = this.t(ch.done === 0 ? 'journeyPlus.start' : 'journeyPlus.keepGoing');
    } else {
      this.ctaLabel = this.t('journeyPlus.allDone');
      this.ctaDisabled = true;
    }
  }

  private stopDetail(ch: JourneyChapter, i: number, state: StopState): string {
    if (state === 'done') return this.t('journeyPP.greatJob');
    if (state === 'active') return this.t('journeyPP.minutes', { n: this.minutesFor(ch, ch.nodes[i].type) });
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
  openStop(block: MapChapter, stop: MapStop): void {
    if (!this.deck || stop.state === 'locked') return;
    this.router.navigate([stop.node.route, this.deck.id], {
      queryParams: { level: block.chapter.levelNumber, mode: stop.node.mode, from: JOURNEY_PLUS_PLUS_FROM },
    });
  }

  /** Primary HUD action: play the current chapter's active node. */
  onCta(): void {
    const block = this.mapChapters.find(b => b.current);
    const active = block?.stops.find(s => s.state === 'active');
    if (block && active) { this.openStop(block, active); return; }
    // Otherwise just bring the current chapter into view.
    this.scrollToCurrent();
  }

  // ── Scrolling ─────────────────────────────────────────────────────────────
  /** Bring the active node of the current chapter to ~40% of the viewport. */
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
    const active = document.querySelector(
      `#jpp-chapter-${this.currentIndex} .state-active`,
    ) as HTMLElement | null;
    const chapterEl = document.getElementById(`jpp-chapter-${this.currentIndex}`);
    const el = active ?? chapterEl;
    if (!el) { void content.scrollToTop(400); return; }
    const top = el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    const target = active ? top - scrollEl.clientHeight * 0.4 : top - 70;
    void content.scrollToPoint(0, Math.max(0, target), 500);
  }

  jumpToCurrent(): void { void this.scrollToCurrent(); }

  /** Show the jump FAB when the current chapter is off-screen. */
  onContentScroll(): void {
    if (this.isLoading || this.currentIndex < 0) return;
    const el = document.getElementById(`jpp-chapter-${this.currentIndex}`);
    if (!el) {
      if (!this.showJumpFab) { this.showJumpFab = true; this.cdr.detectChanges(); }
      return;
    }
    const box = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const offscreen = box.bottom < 90 || box.top > vh - 90;
    if (offscreen !== this.showJumpFab) {
      this.showJumpFab = offscreen;
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
