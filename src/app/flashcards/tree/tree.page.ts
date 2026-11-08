/**
 * Tree Page (EXPERIMENTAL — radial "learning network" map)
 *
 * An alternative to the linear Journey maps: a central "Core Vocabulary" hub
 * with the deck's skill chapters arranged as thematic UNIT nodes in a circle
 * around it, each connected to the hub by a thin line. Small lesson dots branch
 * off every unit (one per activity node) showing done / active / locked state.
 *
 * It reuses the EXACT same data and progress as Journey/Journey+/Journey++:
 *  - `buildJourneyChapters` turns the deck's skill levels into chapters;
 *  - each chapter is a unit, its nodes are the lessons;
 *  - tapping a unit opens that unit's active node exercise with the same
 *    `navigateForward([route, deckId], { level, mode, from: tree })` wiring, so
 *    scores land in the shared `journey-*` namespaces and the exercise returns
 *    here (via journeyBackUrl → /practice/tree).
 *
 * The hub is an aggregate/foundation node: it shows overall progress and, when
 * tapped, jumps into the current in-progress unit's active lesson.
 *
 * Layout: nodes are positioned with CSS custom properties (angle + radius) so
 * the radial arrangement scales with the measured viewport; an SVG layer draws
 * the hub→unit connectors behind the nodes (pointer-events: none).
 *
 * @module app/flashcards/tree
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
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { buildJourneyChapters, type JourneyChapter } from '../journey/journey-model';
import { JOURNEY_TREE_FROM } from '../journey/journey-back';

type UnitState = 'done' | 'active' | 'locked';
type LessonState = 'done' | 'active' | 'locked';

/** A lesson dot branching off a unit (mirrors a chapter node). */
interface Lesson {
  index: number;
  state: LessonState;
  label: string;
  aria: string;
}

/** A thematic unit node in the radial ring (= one JourneyChapter). */
interface Unit {
  chapter: JourneyChapter;
  index: number;
  title: string;
  emoji: string;
  state: UnitState;
  /** 0-based position in the ring. */
  ring: number;
  /** Angle (deg) and radius (% of the map radius) for CSS positioning. */
  angle: number;
  done: number;
  total: number;
  pct: number;
  /** Theme hue (deg) derived from the ring position for a harmonious palette. */
  hue: number;
  /** Connector line endpoint (unit centre) in SVG viewBox units. */
  x: number;
  y: number;
  lessons: Lesson[];
  aria: string;
}

interface LanguageOption { code: string; name: string; flagUrl: string }

@Component({
  selector: 'app-tree',
  templateUrl: './tree.page.html',
  styleUrls: ['./tree.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreePage implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private cdr = inject(ChangeDetectorRef);
  private navCtrl = inject(NavController);
  private backInterceptor = inject(BackInterceptorService);

  /** Hardware/gesture back → same as the header X (go Home). Claimed here so a
   *  single press doesn't fall through to the global handler and pop twice. */
  private readonly onHardwareBack: () => boolean = () => { this.close(); return true; };

  @ViewChild('scene') private sceneEl?: ElementRef<HTMLElement>;

  /** SVG viewBox is a square; nodes are placed on a circle inside it. */
  static readonly VIEW = 1000;
  /** Ring radius as a fraction of half the viewBox (leaves room for labels). */
  private static readonly RING_RADIUS = 0.72;

  isLoading = true;
  switchingLanguage = false;
  deck: FlashcardDeck | null = null;
  chapters: JourneyChapter[] = [];
  /** Index of the chapter in progress (first unlocked, not complete). */
  currentIndex = 0;
  units: Unit[] = [];

  /** Overall foundation (hub) progress across all units. */
  hubPct = 0;
  hubStarted = false;

  /** Key of the locked unit whose "unlocks after…" hint is shown (tapped). */
  revealedUnitIndex: number | null = null;

  availableLanguages: LanguageOption[] = [];
  private resizeObserver?: ResizeObserver;

  readonly view = TreePage.VIEW;

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

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    await this.load();
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.cdr.detectChanges());
    const el = this.sceneEl?.nativeElement;
    if (el) this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.backInterceptor.clear(this.onHardwareBack);
    if (this.tapTimer) { clearTimeout(this.tapTimer); this.tapTimer = null; }
  }

  async ionViewWillEnter(): Promise<void> {
    this.backInterceptor.register(this.onHardwareBack);
    if (this.deck) await this.load();
  }

  ionViewWillLeave(): void {
    this.backInterceptor.clear(this.onHardwareBack);
  }

  @HostListener('window:resize')
  onResize(): void { this.cdr.detectChanges(); }

  // ── Data ────────────────────────────────────────────────────────────────────
  private async load(languageSwitch = false): Promise<void> {
    this.availableLanguages = this.flashcards
      .getAvailableLanguages()
      .map(l => ({ ...l, flagUrl: this.flagUrl(l.code) }));

    const lang = this.settings.learningLanguage();
    const decks = this.flashcards.getAllDecks().filter(d => d.languageCode === lang);
    this.deck = decks[0] ?? this.flashcards.getAllDecks()[0] ?? null;
    if (!this.deck) {
      this.chapters = [];
      this.units = [];
      this.isLoading = false;
      this.switchingLanguage = false;
      this.cdr.detectChanges();
      return;
    }

    const levels = await this.flashcards.getDeckLevels(this.deck.id, 'journey-flip');
    const progress = await this.flashcards.getDeckLevelProgressMap(this.deck.id);
    this.chapters = buildJourneyChapters(levels, progress, this.deck.languageCode === 'fr');

    const found = this.chapters.findIndex(c => c.unlocked && !c.complete);
    this.currentIndex = found >= 0 ? found : Math.max(0, this.chapters.length - 1);

    this.rebuild();
    this.isLoading = false;
    this.switchingLanguage = false;
    this.cdr.detectChanges();
  }

  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    this.switchingLanguage = true;
    this.revealedUnitIndex = null;
    this.cdr.detectChanges();
    await this.flashcards.initialize();
    await this.load(true);
  }

  // ── View model ──────────────────────────────────────────────────────────────
  private rebuild(): void {
    const n = this.chapters.length;
    const cx = TreePage.VIEW / 2;
    const cy = TreePage.VIEW / 2;
    const r = (TreePage.VIEW / 2) * TreePage.RING_RADIUS;

    this.units = this.chapters.map((ch, i) => {
      const state: UnitState = ch.complete ? 'done' : ch.unlocked ? 'active' : 'locked';
      const total = Math.max(1, ch.nodes.length);
      const pct = Math.round((ch.done / total) * 100);
      // Even spread around the circle, starting at the top (-90deg).
      const angle = (360 / Math.max(1, n)) * i - 90;
      const rad = (angle * Math.PI) / 180;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      const hue = Math.round((360 / Math.max(1, n)) * i);

      const activeLessonIdx = ch.unlocked ? ch.nodes.findIndex(nd => nd.unlocked && !nd.passed) : -1;
      const lessons: Lesson[] = ch.nodes.map((nd, li) => {
        const ls: LessonState = nd.unlocked && nd.passed ? 'done' : li === activeLessonIdx ? 'active' : 'locked';
        const label = this.t(`journey.node.${nd.type}`);
        return {
          index: li,
          state: ls,
          label,
          aria: `${label}, ${this.t(`tree.lesson.${ls}`)}`,
        };
      });

      const title = ch.name || this.t('journeyPlus.chapterFallback', { n: ch.number });
      return {
        chapter: ch,
        index: i,
        title,
        emoji: TreePage.emojiFor(ch.name),
        state,
        ring: i,
        angle,
        done: ch.done,
        total,
        pct,
        hue,
        x,
        y,
        lessons,
        aria: `${title}, ${this.t(`tree.unit.${state}`)}, ${this.t('journeyPlus.percentDone', { p: pct })}`,
      };
    });

    // Hub = aggregate of all units' lessons.
    const totalNodes = this.chapters.reduce((s, c) => s + c.nodes.length, 0);
    const doneNodes = this.chapters.reduce((s, c) => s + c.done, 0);
    this.hubPct = totalNodes === 0 ? 0 : Math.round((doneNodes / totalNodes) * 100);
    this.hubStarted = doneNodes > 0;
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  private static readonly DOUBLE_TAP_MS = 320;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTapIndex: number | null = null;

  /** Tap a unit. Admin double-tap on the ACTIVE unit force-completes its active
   *  lesson (same shortcut as Journey++); otherwise open the unit. */
  onUnitTap(unit: Unit): void {
    if (!this.settings.adminMode() || unit.state !== 'active') {
      this.openUnit(unit);
      return;
    }
    if (this.tapTimer && this.pendingTapIndex === unit.index) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
      this.pendingTapIndex = null;
      void this.adminCompleteUnit(unit);
      return;
    }
    if (this.tapTimer) clearTimeout(this.tapTimer);
    this.pendingTapIndex = unit.index;
    this.tapTimer = setTimeout(() => {
      this.tapTimer = null;
      this.pendingTapIndex = null;
      this.openUnit(unit);
    }, TreePage.DOUBLE_TAP_MS);
  }

  /** Open a unit: launch its active lesson, or reveal the "unlocks after…"
   *  hint for a locked unit. Done units re-open their first lesson for replay. */
  openUnit(unit: Unit): void {
    if (!this.deck) return;
    if (unit.state === 'locked') {
      this.revealedUnitIndex = this.revealedUnitIndex === unit.index ? null : unit.index;
      this.cdr.detectChanges();
      return;
    }
    this.revealedUnitIndex = null;
    const ch = unit.chapter;
    // The lesson to play: the active (unlocked, not-passed) node, else the first
    // node (replay for a completed unit).
    const node = ch.nodes.find(nd => nd.unlocked && !nd.passed) ?? ch.nodes[0];
    if (!node) return;
    void this.navCtrl.navigateForward([node.route, this.deck.id], {
      queryParams: { level: ch.levelNumber, mode: node.mode, from: JOURNEY_TREE_FROM },
    });
  }

  /** Hub tap: jump into the current in-progress unit's active lesson. */
  openHub(): void {
    const unit = this.units[this.currentIndex] ?? this.units.find(u => u.state === 'active');
    if (unit) this.openUnit(unit);
  }

  /** True when a locked unit's "unlocks after…" hint should show. */
  isHintVisible(unit: Unit): boolean {
    return unit.state === 'locked' && this.revealedUnitIndex === unit.index;
  }

  unitHint(unit: Unit): string {
    const ch = unit.chapter;
    if (ch.number <= 1) return this.t('journeyPlus.locked');
    return this.t('journeyPlus.unlocksChapter', { n: ch.number - 1 });
  }

  /** Admin-only: force-complete the unit's active lesson with 3★. */
  private async adminCompleteUnit(unit: Unit): Promise<void> {
    if (!this.deck || !this.settings.adminMode() || unit.state !== 'active') return;
    const deckId = this.deck.id;
    const ch = unit.chapter;
    const level = ch.levelNumber;
    const node = ch.nodes.find(nd => nd.unlocked && !nd.passed);
    if (!node) return;
    const cardCount = Math.max(1, ch.cardCount || 1);
    try {
      if (node.type === 'flip') {
        for (const card of this.flashcards.getLevelCards(deckId, level)) {
          await this.flashcards.adminSetFlipKnowledge(deckId, card.id, 'known');
        }
        await this.flashcards.saveLevelProgress(deckId, node.mode, level, cardCount, cardCount);
      } else if (node.type === 'match') {
        const goodTime = Math.max(5, cardCount * 2);
        for (let guard = 0; guard < 5; guard++) {
          const res = await this.flashcards.saveRoundProgress(deckId, node.mode, level, 100, goodTime, cardCount);
          if (res.levelComplete) break;
        }
      } else {
        await this.flashcards.adminForceCompleteAllRounds(deckId, node.mode, level, 3);
      }
    } catch { /* best-effort admin shortcut */ }
    await this.load();
  }

  close(): void { this.router.navigate(['/home']); }

  trackUnit(_i: number, u: Unit): number { return u.chapter.number; }
  trackLesson(_i: number, l: Lesson): number { return l.index; }

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
    const s = (skill || '').toLowerCase();
    const rules: [RegExp, string][] = [
      [/caf[eé]|coffee|drink/, '☕'],
      [/food|eat|restaurant|meal|cook|fruit/, '🍽️'],
      [/greet|hello|intro|meet|people/, '👋'],
      [/family|parent|child|relation/, '❤️'],
      [/travel|trip|airport|vacation|holiday|hotel/, '✈️'],
      [/shop|buy|cloth|store|money|business|work|job|office/, '💼'],
      [/home|house|room|furniture/, '🏠'],
      [/school|study|class|learn|education/, '🎓'],
      [/time|date|day|calendar|week|month/, '🕒'],
      [/weather|season|nature/, '🌳'],
      [/colou?r/, '🎨'],
      [/number|count/, '🔢'],
      [/animal|pet/, '🐾'],
      [/sport|hobby|game|play/, '⚽'],
      [/health|body|doctor|sick/, '🩺'],
      [/city|place|direction|where|town|culture/, '🗺️'],
      [/music|song/, '🎵'],
      [/language|speak|daily|life/, '💬'],
      [/feel|emotion|trait|describe/, '😊'],
      [/science|tech/, '🔬'],
    ];
    for (const [re, emoji] of rules) if (re.test(s)) return emoji;
    return '📘';
  }
}
