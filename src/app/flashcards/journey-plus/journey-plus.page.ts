/**
 * Journey+ Page (EXPERIMENTAL redesign of the Journey map)
 *
 * An immersive, game-style view of ONE chapter at a time: an illustrated night
 * background, a winding SVG route connecting large glowing activity nodes, a
 * glass info panel beside each node, and a floating progress HUD with the
 * primary "Keep going" action.
 *
 * It reads and writes exactly the same `journey-*` progress as the classic
 * Journey page (shared model in ../journey/journey-model.ts), so the two pages
 * can be compared side by side. Node exercises are launched with
 * `?from=journey-plus` so they return here.
 *
 * Layout: the map is a single coordinate system. Node centres are X% of the
 * measured map width and Y px down the map; the SVG uses a px viewBox of the
 * same size, so the route always passes through the node centres at any width.
 *
 * @module app/flashcards/journey-plus
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
  ViewChild, ElementRef, AfterViewInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { FlashcardService, FlashcardDeck } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import {
  buildJourneyChapters, type JourneyChapter, type JourneyNode, type JourneyNodeType,
} from '../journey/journey-model';
import { JOURNEY_PLUS_FROM } from '../journey/journey-back';

/** Visual state of a node on the map. */
type StopState = 'done' | 'active' | 'locked';

/** Everything the template needs for one stop (precomputed, no template logic). */
interface MapStop {
  node: JourneyNode;
  index: number;
  state: StopState;
  /** Node centre X as a % of the map width. */
  xPct: number;
  /** Node centre Y in px from the top of the map. */
  y: number;
  /** Which side of the node the info panel sits on. */
  side: 'left' | 'right';
  /** Activity name (e.g. "Quiz"). */
  label: string;
  /** Second line of the info panel. */
  detail: string;
  /** Accessible label for the node button. */
  aria: string;
}

interface LanguageOption { code: string; name: string; flagUrl: string }

@Component({
  selector: 'app-journey-plus',
  templateUrl: './journey-plus.page.html',
  styleUrls: ['./journey-plus.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyPlusPage implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private cdr = inject(ChangeDetectorRef);

  /** The <ion-content> element itself (its web-component methods). A class
   *  query (`@ViewChild(IonContent)`) doesn't match under the lazy IonicModule. */
  @ViewChild('content', { read: ElementRef }) private contentEl?: ElementRef<HTMLIonContentElement>;
  @ViewChild('map') private mapEl?: ElementRef<HTMLElement>;

  // ── Map geometry (px). MUST match the SCSS custom properties. ──────────────
  /** Vertical distance between two stops. */
  static readonly ROW = 156;
  /** Space above the first stop / below the last one. */
  static readonly PAD_TOP = 64;
  static readonly PAD_BOTTOM = 72;
  /** Winding pattern of node centres (X % of the map width). */
  static readonly X_PATTERN = [30, 70, 32, 70, 30, 68];
  /** Curve tension: control points sit this fraction of ROW above/below. */
  private static readonly TENSION = 0.55;
  /** Display-only reward per activity (the app has no XP system yet). */
  static readonly XP_PER_NODE = 10;
  /** Rough seconds per word for each activity, for the "~N min" estimate. */
  private static readonly SECONDS_PER_WORD: Record<JourneyNodeType, number> = {
    flip: 5, quiz: 6, write: 12, match: 4, builder: 0, blanks: 8,
  };
  /** Builder plays a fixed set of ~5 generated phrases. */
  private static readonly BUILDER_SECONDS = 180;

  isLoading = true;
  deck: FlashcardDeck | null = null;
  chapters: JourneyChapter[] = [];
  /** First unlocked, not-yet-complete chapter (where the learner is). */
  currentIndex = 0;
  /** The chapter being displayed (prev/next browse through chapters). */
  viewIndex = 0;

  // ── Precomputed view state for the displayed chapter ───────────────────────
  stops: MapStop[] = [];
  mapHeight = 0;
  mapWidth = 360;
  /** SVG `d` for the travelled part of the route (start → active node). */
  pathDone = '';
  /** SVG `d` for the rest of the route (active node → end). */
  pathAhead = '';
  title = '';
  subtitle = '';
  emoji = '📘';
  progressPct = 0;
  /** Progress ring dash offset (circumference × remaining fraction). */
  ringOffset = 0;
  readonly ringCircumference = 2 * Math.PI * 26;
  xpReward = 0;
  ctaLabel = '';
  ctaDisabled = false;

  availableLanguages: LanguageOption[] = [];

  private resizeObserver?: ResizeObserver;
  private scrolledOnce = false;

  get chapter(): JourneyChapter | null {
    return this.chapters[this.viewIndex] ?? null;
  }
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
    // Re-lay the route whenever the map's width changes (rotation, resize).
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.observeMap();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  /** Returning from an exercise: refresh progress, stay on the same chapter
   *  unless the learner just finished it (then follow them forward), and always
   *  bring the new active node into view (it may have moved below the fold). */
  async ionViewWillEnter(): Promise<void> {
    if (this.deck) await this.load(false, true);
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
      this.buildPaths();
      this.cdr.detectChanges();
    }
  }

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
    // First load, or the learner moved on to a new chapter: show where they are.
    if (initial || (this.viewIndex === prevCurrent && this.currentIndex !== prevCurrent)) {
      this.viewIndex = this.currentIndex;
    }
    this.viewIndex = Math.min(this.viewIndex, Math.max(0, this.chapters.length - 1));

    this.isLoading = false;
    this.rebuild();
    this.cdr.detectChanges();
    // The map element only exists once loading is done. Scroll to the active
    // node on first load, and also when returning from a finished exercise
    // (the new active node often sits below the fold).
    setTimeout(() => {
      this.observeMap();
      this.measure();
      if (!this.scrolledOnce) { this.scrolledOnce = true; void this.scrollToActive(); }
      else if (returning) void this.scrollToActive();
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
  /** Recompute everything the template shows for the displayed chapter. */
  private rebuild(): void {
    const ch = this.chapter;
    if (!ch) { this.stops = []; this.pathDone = this.pathAhead = ''; return; }

    const activeIdx = ch.unlocked ? ch.nodes.findIndex(n => n.unlocked && !n.passed) : -1;
    this.stops = ch.nodes.map((node, i) => {
      const state: StopState = node.unlocked && node.passed ? 'done' : i === activeIdx ? 'active' : 'locked';
      const xPct = JourneyPlusPage.X_PATTERN[i % JourneyPlusPage.X_PATTERN.length];
      const label = this.t(`journey.node.${node.type}`);
      return {
        node,
        index: i,
        state,
        xPct,
        y: JourneyPlusPage.PAD_TOP + i * JourneyPlusPage.ROW,
        side: xPct < 50 ? 'right' : 'left',
        label,
        detail: this.stopDetail(ch, i, state),
        aria: state === 'locked'
          ? `${label}, ${this.t('journeyPlus.locked')}`
          : this.t('journeyPlus.startNode', { name: label }),
      };
    });
    const n = this.stops.length;
    this.mapHeight = n === 0 ? 0
      : JourneyPlusPage.PAD_TOP + (n - 1) * JourneyPlusPage.ROW + JourneyPlusPage.PAD_BOTTOM;

    // Header
    this.title = ch.name || this.t('journeyPlus.chapterFallback', { n: ch.number });
    this.emoji = JourneyPlusPage.emojiFor(ch.name);
    // The chapter number already shows in the switcher pill; when the title is
    // the "Chapter N" fallback (decks without skill names) don't repeat it.
    const words = this.t('journeyPlus.words', { n: ch.cardCount });
    this.subtitle = ch.name
      ? `${this.t('journeyPlus.chapterFallback', { n: ch.number })} · ${words}`
      : words;

    // HUD
    const total = Math.max(1, ch.nodes.length);
    this.progressPct = Math.round((ch.done / total) * 100);
    this.ringOffset = this.ringCircumference * (1 - ch.done / total);
    this.xpReward = ch.nodes.length * JourneyPlusPage.XP_PER_NODE;
    this.updateCta(ch, activeIdx);

    this.buildPaths();
  }

  private stopDetail(ch: JourneyChapter, i: number, state: StopState): string {
    if (state === 'done') return this.t('journeyPlus.greatJob');
    if (state === 'active') return this.t('journeyPlus.minutes', { n: this.minutesFor(ch, ch.nodes[i].type) });
    if (!ch.unlocked && i === 0) return this.t('journeyPlus.unlocksChapter', { n: ch.number - 1 });
    const prev = ch.nodes[i - 1];
    return prev
      ? this.t('journeyPlus.unlocksAfter', { name: this.t(`journey.node.${prev.type}`) })
      : this.t('journeyPlus.locked');
  }

  private minutesFor(ch: JourneyChapter, type: JourneyNodeType): number {
    const secs = type === 'builder'
      ? JourneyPlusPage.BUILDER_SECONDS
      : ch.cardCount * JourneyPlusPage.SECONDS_PER_WORD[type];
    return Math.max(1, Math.round(secs / 60));
  }

  private updateCta(ch: JourneyChapter, activeIdx: number): void {
    this.ctaDisabled = false;
    if (activeIdx >= 0) {
      this.ctaLabel = this.t(ch.done === 0 ? 'journeyPlus.start' : 'journeyPlus.keepGoing');
    } else if (ch.complete && this.viewIndex < this.chapters.length - 1) {
      this.ctaLabel = this.t('journeyPlus.nextChapter');
    } else if (!ch.unlocked) {
      this.ctaLabel = this.t('journeyPlus.goToCurrent');
    } else {
      this.ctaLabel = this.t('journeyPlus.allDone');
      this.ctaDisabled = true;
    }
  }

  /**
   * Route through the node centres as smooth cubic Béziers with vertical
   * tangents at every node (so consecutive curves join without kinks). Split at
   * the active node: travelled part (glowing) and the part ahead (muted).
   */
  private buildPaths(): void {
    const pts = this.stops.map(s => ({ x: (s.xPct / 100) * this.mapWidth, y: s.y }));
    if (pts.length < 2) { this.pathDone = this.pathAhead = ''; return; }
    const ch = this.chapter;
    const activeIdx = this.stops.findIndex(s => s.state === 'active');
    // Everything travelled when the chapter is complete; nothing when locked.
    const splitAt = activeIdx >= 0 ? activeIdx : ch?.complete ? pts.length - 1 : 0;

    const k = JourneyPlusPage.ROW * JourneyPlusPage.TENSION;
    const fmt = (v: number) => v.toFixed(1);
    const seg = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      ` C ${fmt(a.x)} ${fmt(a.y + k)}, ${fmt(b.x)} ${fmt(b.y - k)}, ${fmt(b.x)} ${fmt(b.y)}`;
    const build = (from: number, to: number) => {
      if (to <= from) return '';
      let d = `M ${fmt(pts[from].x)} ${fmt(pts[from].y)}`;
      for (let i = from + 1; i <= to; i++) d += seg(pts[i - 1], pts[i]);
      return d;
    };
    this.pathDone = build(0, splitAt);
    this.pathAhead = build(splitAt, pts.length - 1);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  openStop(stop: MapStop): void {
    const ch = this.chapter;
    if (!ch || !this.deck || stop.state === 'locked') return;
    // Ionic FORWARD navigation so this map stays a poppable stack entry
    // (hardware/gesture back returns here, not the /home fallback).
    void this.navCtrl.navigateForward([stop.node.route, this.deck.id], {
      queryParams: { level: ch.levelNumber, mode: stop.node.mode, from: JOURNEY_PLUS_FROM },
    });
  }

  /** Primary HUD action: play the active node, or move to the right chapter. */
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

  /** Bring the active node (or the top of the map) to the middle of the
   *  visible content area (which ends above the HUD). */
  private async scrollToActive(): Promise<void> {
    const content = this.contentEl?.nativeElement;
    if (!content) return;
    const scrollEl = await content.getScrollElement();
    const node = this.mapEl?.nativeElement.querySelector('.state-active') as HTMLElement | null;
    if (!node) { void content.scrollToTop(400); return; }
    // Position within the scroll container, independent of offsetParent chains.
    const top = node.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    const target = top - scrollEl.clientHeight * 0.45;
    void content.scrollToPoint(0, Math.max(0, target), 500);
  }

  close(): void {
    this.router.navigate(['/home']);
  }

  trackStop(_i: number, stop: MapStop): string {
    return stop.node.mode;
  }

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

  /** A small thematic emoji for a (English) skill name, by keyword. */
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
