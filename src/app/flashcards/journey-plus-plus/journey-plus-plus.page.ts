/**
 * Journey++ Page (EXPERIMENTAL — high-fidelity pass of Journey+)
 *
 * Same data and behaviour as Journey+ (one chapter at a time, shared
 * `journey-*` progress, same node exercises), rebuilt to match the design
 * mockup (src/assets/images/mockup-journey.png):
 *  - compact nodes on a gentle S-route, each with a pill-shaped info panel
 *    anchored to its right (the node overlaps the panel's leading end);
 *  - neon green done nodes, a white-rimmed cyan active node with an outer
 *    glow ring, charcoal locked spheres with a solid padlock;
 *  - short glowing route dashes (green→cyan travelled, lavender ahead);
 *  - a starry night sky over a skyline band of the illustration;
 *  - a single-row progress HUD (ring | progress | XP | CTA).
 *
 * Geometry: node centres are X% of the measured map width and Y px from the
 * map top; the SVG uses a px viewBox of the same size, so the route always
 * passes through the node centres. The row pitch scales with the width.
 *
 * @module app/flashcards/journey-plus-plus
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
  ViewChild, ElementRef, AfterViewInit,
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
  /** Node centre X as a % of the map width. */
  xPct: number;
  /** Node centre Y in px from the top of the map. */
  y: number;
  label: string;
  detail: string;
  aria: string;
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
  @ViewChild('map') private mapEl?: ElementRef<HTMLElement>;

  // ── Geometry ────────────────────────────────────────────────────────────────
  /** Gentle S of node centres (X % of map width), as in the mockup. Kept left
   *  of centre so the right-hand panels always have room. */
  private static readonly X_PATTERN = [33, 43, 50, 40, 31, 42];
  private static readonly PAD_TOP = 62;
  private static readonly PAD_BOTTOM = 64;
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

  isLoading = true;
  deck: FlashcardDeck | null = null;
  chapters: JourneyChapter[] = [];
  currentIndex = 0;
  viewIndex = 0;

  stops: MapStop[] = [];
  mapWidth = 360;
  mapHeight = 0;
  pathDone = '';
  pathAhead = '';
  title = '';
  subtitle = '';
  emoji = '📘';
  progressPct = 0;
  readonly ringCircumference = 2 * Math.PI * 25;
  ringOffset = this.ringCircumference;
  xpReward = 0;
  ctaLabel = '';
  ctaDisabled = false;

  availableLanguages: LanguageOption[] = [];

  private resizeObserver?: ResizeObserver;
  private scrolledOnce = false;

  get chapter(): JourneyChapter | null { return this.chapters[this.viewIndex] ?? null; }
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
  get hasPrev(): boolean { return this.viewIndex > 0; }
  get hasNext(): boolean { return this.viewIndex < this.chapters.length - 1; }
  get viewingCurrent(): boolean { return this.viewIndex === this.currentIndex; }

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
    this.observeMap();
  }

  ngOnDestroy(): void { this.resizeObserver?.disconnect(); }

  async ionViewWillEnter(): Promise<void> {
    if (this.deck) await this.load(false);
  }

  private observeMap(): void {
    const el = this.mapEl?.nativeElement;
    if (el && this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver.observe(el);
    }
  }

  private measure(): void {
    const w = this.mapEl?.nativeElement.clientWidth ?? 0;
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

  // ── Data ────────────────────────────────────────────────────────────────────
  private async load(initial: boolean): Promise<void> {
    this.availableLanguages = this.flashcards
      .getAvailableLanguages()
      .map(l => ({ ...l, flagUrl: this.flagUrl(l.code) }));

    const lang = this.settings.learningLanguage();
    const decks = this.flashcards.getAllDecks().filter(d => d.languageCode === lang);
    this.deck = decks[0] ?? this.flashcards.getAllDecks()[0] ?? null;
    if (!this.deck) {
      this.chapters = [];
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    const levels = await this.flashcards.getDeckLevels(this.deck.id, 'journey-flip');
    const progress = await this.flashcards.getDeckLevelProgressMap(this.deck.id);
    this.chapters = buildJourneyChapters(levels, progress, this.deck.languageCode === 'fr');

    const prevCurrent = this.currentIndex;
    const found = this.chapters.findIndex(c => c.unlocked && !c.complete);
    this.currentIndex = found >= 0 ? found : Math.max(0, this.chapters.length - 1);
    if (initial || (this.viewIndex === prevCurrent && this.currentIndex !== prevCurrent)) {
      this.viewIndex = this.currentIndex;
    }
    this.viewIndex = Math.min(this.viewIndex, Math.max(0, this.chapters.length - 1));

    this.isLoading = false;
    this.rebuild();
    this.cdr.detectChanges();
    setTimeout(() => {
      this.observeMap();
      this.measure();
      if (!this.scrolledOnce) { this.scrolledOnce = true; void this.scrollToActive(); }
    }, 150);
  }

  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    this.isLoading = true;
    this.scrolledOnce = false;
    this.cdr.detectChanges();
    await this.flashcards.initialize();
    await this.load(true);
  }

  // ── View model ──────────────────────────────────────────────────────────────
  private rebuild(): void {
    const ch = this.chapter;
    if (!ch) { this.stops = []; this.pathDone = this.pathAhead = ''; return; }

    const row = this.rowPitch;
    const activeIdx = ch.unlocked ? ch.nodes.findIndex(n => n.unlocked && !n.passed) : -1;
    this.stops = ch.nodes.map((node, i) => {
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
    const n = this.stops.length;
    this.mapHeight = n === 0 ? 0
      : JourneyPlusPlusPage.PAD_TOP + (n - 1) * row + JourneyPlusPlusPage.PAD_BOTTOM;

    this.title = ch.name || this.t('journeyPlus.chapterFallback', { n: ch.number });
    this.emoji = JourneyPlusPlusPage.emojiFor(ch.name);
    // Compact so it fits between the chapter chevrons on narrow phones.
    this.subtitle = `${ch.number}/${this.chapters.length} · ${this.t('journeyPlus.words', { n: ch.cardCount })}`;

    const total = Math.max(1, ch.nodes.length);
    this.progressPct = Math.round((ch.done / total) * 100);
    this.ringOffset = this.ringCircumference * (1 - ch.done / total);
    this.xpReward = ch.nodes.length * JourneyPlusPlusPage.XP_PER_NODE;
    this.updateCta(ch, activeIdx);
    this.buildPaths(activeIdx, ch.complete);
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

  private updateCta(ch: JourneyChapter, activeIdx: number): void {
    this.ctaDisabled = false;
    if (activeIdx >= 0) {
      this.ctaLabel = this.t(ch.done === 0 ? 'journeyPlus.start' : 'journeyPlus.keepGoing');
    } else if (ch.complete && this.viewIndex < this.chapters.length - 1) {
      this.ctaLabel = this.t('journeyPlus.nextChapter');
    } else if (!ch.unlocked) {
      this.ctaLabel = this.t('journeyPP.toCurrent');
    } else {
      this.ctaLabel = this.t('journeyPlus.allDone');
      this.ctaDisabled = true;
    }
  }

  /** Smooth cubic Béziers through the node centres (vertical tangents at each
   *  node), split at the active node into travelled / ahead. */
  private buildPaths(activeIdx: number, complete: boolean): void {
    const pts = this.stops.map(s => ({ x: (s.xPct / 100) * this.mapWidth, y: s.y }));
    if (pts.length < 2) { this.pathDone = this.pathAhead = ''; return; }
    const splitAt = activeIdx >= 0 ? activeIdx : complete ? pts.length - 1 : 0;
    const k = this.rowPitch * JourneyPlusPlusPage.TENSION;
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
    this.pathDone = build(0, splitAt);
    this.pathAhead = build(splitAt, pts.length - 1);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  openStop(stop: MapStop): void {
    const ch = this.chapter;
    if (!ch || !this.deck || stop.state === 'locked') return;
    this.router.navigate([stop.node.route, this.deck.id], {
      queryParams: { level: ch.levelNumber, mode: stop.node.mode, from: JOURNEY_PLUS_PLUS_FROM },
    });
  }

  onCta(): void {
    const ch = this.chapter;
    if (!ch || this.ctaDisabled) return;
    const active = this.stops.find(s => s.state === 'active');
    if (active) { this.openStop(active); return; }
    if (ch.complete && this.hasNext) { this.showChapter(this.viewIndex + 1); return; }
    this.showChapter(this.currentIndex);
  }

  prevChapter(): void { if (this.hasPrev) this.showChapter(this.viewIndex - 1); }
  nextChapter(): void { if (this.hasNext) this.showChapter(this.viewIndex + 1); }
  goToCurrent(): void { this.showChapter(this.currentIndex); }

  private showChapter(index: number): void {
    this.viewIndex = Math.max(0, Math.min(index, this.chapters.length - 1));
    this.rebuild();
    this.cdr.detectChanges();
    void this.scrollToActive();
  }

  /** Bring the active node to ~45% of the visible content height. */
  private async scrollToActive(): Promise<void> {
    const content = this.contentEl?.nativeElement;
    if (!content) return;
    const scrollEl = await content.getScrollElement();
    const node = this.mapEl?.nativeElement.querySelector('.state-active') as HTMLElement | null;
    if (!node) { void content.scrollToTop(400); return; }
    const top = node.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    void content.scrollToPoint(0, Math.max(0, top - scrollEl.clientHeight * 0.45), 500);
  }

  close(): void { this.router.navigate(['/home']); }

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
