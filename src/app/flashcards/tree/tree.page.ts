/**
 * Tree Page (EXPERIMENTAL — radial "learning network" map)
 *
 * A themed alternative to the linear Journey maps. The deck's MANY skill
 * chapters (the French deck has ~295) are grouped into a SMALL set of thematic
 * units (see tree-themes.ts) arranged radially around a central "Core
 * Vocabulary" hub. Tapping a theme opens a detail panel listing that theme's
 * chapters as lessons; each lesson launches the same exercises as Journey and
 * writes the shared `journey-*` progress.
 *
 * Layout: theme nodes are placed on a circle via unitless CSS custom properties
 * (converted to % of the square stage); an SVG layer draws hub→theme connectors
 * behind the nodes. Because the theme COUNT is small and fixed-ish (~11), the
 * radial map stays readable regardless of how many skills the deck has.
 *
 * @module app/flashcards/tree
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { FlashcardService, FlashcardDeck } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { buildJourneyChapters, type JourneyChapter } from '../journey/journey-model';
import { JOURNEY_TREE_FROM } from '../journey/journey-back';
import { groupChaptersIntoThemes, type TreeTheme } from './tree-themes';

type NodeState = 'done' | 'active' | 'locked';

/** A theme node positioned in the radial ring. */
interface ThemeNode {
  theme: TreeTheme;
  index: number;
  title: string;
  emoji: string;
  state: NodeState;
  pct: number;
  done: number;
  total: number;
  hue: number;
  /** Connector endpoint (theme centre) in SVG viewBox units. */
  x: number;
  y: number;
  aria: string;
}

/** A lesson row inside the opened theme's detail panel (= one chapter). */
interface LessonRow {
  chapter: JourneyChapter;
  title: string;
  state: NodeState;
  done: number;
  total: number;
  pct: number;
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
export class TreePage implements OnInit, OnDestroy {
  private router = inject(Router);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private cdr = inject(ChangeDetectorRef);
  private navCtrl = inject(NavController);
  private backInterceptor = inject(BackInterceptorService);

  /** Hardware/gesture back: if a theme panel is open, close it; otherwise go
   *  Home (same as the header X). Claimed so one press doesn't double-pop. */
  private readonly onHardwareBack: () => boolean = () => {
    if (this.openTheme) { this.closeTheme(); return true; }
    this.close();
    return true;
  };

  /** SVG viewBox is a square; nodes are placed on a circle inside it. */
  static readonly VIEW = 1000;
  private static readonly RING_RADIUS = 0.74;

  isLoading = true;
  switchingLanguage = false;
  deck: FlashcardDeck | null = null;
  chapters: JourneyChapter[] = [];
  themes: TreeTheme[] = [];
  nodes: ThemeNode[] = [];

  hubPct = 0;
  hubStarted = false;

  /** The currently opened theme's detail panel (null = radial map shown). */
  openTheme: ThemeNode | null = null;
  openLessons: LessonRow[] = [];

  availableLanguages: LanguageOption[] = [];

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

  ngOnDestroy(): void {
    this.backInterceptor.clear(this.onHardwareBack);
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
      this.themes = [];
      this.nodes = [];
      this.isLoading = false;
      this.switchingLanguage = false;
      this.cdr.detectChanges();
      return;
    }

    const levels = await this.flashcards.getDeckLevels(this.deck.id, 'journey-flip');
    const progress = await this.flashcards.getDeckLevelProgressMap(this.deck.id);
    this.chapters = buildJourneyChapters(levels, progress, this.deck.languageCode === 'fr');
    this.themes = groupChaptersIntoThemes(this.chapters);

    this.rebuild();

    // If a theme panel was open, refresh its lesson list in place (e.g. after
    // returning from an exercise) so progress updates without closing it.
    if (this.openTheme) {
      const refreshed = this.nodes.find(nd => nd.theme.def.id === this.openTheme!.theme.def.id);
      if (refreshed) { this.openTheme = refreshed; this.buildLessons(refreshed); }
      else { this.openTheme = null; this.openLessons = []; }
    }

    this.isLoading = false;
    this.switchingLanguage = false;
    this.cdr.detectChanges();
  }

  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    this.switchingLanguage = true;
    this.openTheme = null;
    this.openLessons = [];
    this.cdr.detectChanges();
    await this.flashcards.initialize();
    await this.load(true);
  }

  // ── View model ──────────────────────────────────────────────────────────────
  private rebuild(): void {
    const n = this.themes.length;
    const cx = TreePage.VIEW / 2;
    const cy = TreePage.VIEW / 2;
    const r = (TreePage.VIEW / 2) * TreePage.RING_RADIUS;

    this.nodes = this.themes.map((theme, i) => {
      const angle = (360 / Math.max(1, n)) * i - 90;
      const rad = (angle * Math.PI) / 180;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      const title = this.t(theme.def.nameKey);
      return {
        theme,
        index: i,
        title,
        emoji: theme.def.emoji,
        state: theme.state,
        pct: theme.pct,
        done: theme.doneChapters,
        total: theme.totalChapters,
        hue: theme.def.hue,
        x,
        y,
        aria: `${title}, ${this.t(`tree.unit.${theme.state}`)}, ${this.t('journeyPlus.percentDone', { p: theme.pct })}`,
      };
    });

    const totalNodes = this.chapters.reduce((s, c) => s + c.nodes.length, 0);
    const doneNodes = this.chapters.reduce((s, c) => s + c.done, 0);
    this.hubPct = totalNodes === 0 ? 0 : Math.round((doneNodes / totalNodes) * 100);
    this.hubStarted = doneNodes > 0;
  }

  private buildLessons(node: ThemeNode): void {
    this.openLessons = node.theme.chapters.map(ch => {
      const total = Math.max(1, ch.nodes.length);
      const state: NodeState = ch.complete ? 'done' : ch.unlocked ? 'active' : 'locked';
      const title = ch.name || this.t('journeyPlus.chapterFallback', { n: ch.number });
      return {
        chapter: ch,
        title,
        state,
        done: ch.done,
        total,
        pct: Math.round((ch.done / total) * 100),
        aria: `${title}, ${this.t(`tree.unit.${state}`)}, ${this.t('journeyPlus.percentDone', { p: Math.round((ch.done / total) * 100) })}`,
      };
    });
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  /** Tap a theme node: open its lesson panel. Locked themes open too (so the
   *  user can see what's inside), but their lessons are individually locked. */
  openThemeNode(node: ThemeNode): void {
    this.openTheme = node;
    this.buildLessons(node);
    this.cdr.detectChanges();
  }

  closeTheme(): void {
    this.openTheme = null;
    this.openLessons = [];
    this.cdr.detectChanges();
  }

  /** Hub tap: open the theme that contains the current in-progress chapter. */
  openHub(): void {
    const active = this.nodes.find(nd => nd.state === 'active') ?? this.nodes[0];
    if (active) this.openThemeNode(active);
  }

  /** Launch a lesson (chapter): open its active node, or the first node for a
   *  completed chapter (replay). Locked chapters do nothing (visual only). */
  openLesson(lesson: LessonRow): void {
    if (!this.deck || lesson.state === 'locked') return;
    const ch = lesson.chapter;
    const node = ch.nodes.find(nd => nd.unlocked && !nd.passed) ?? ch.nodes[0];
    if (!node) return;
    void this.navCtrl.navigateForward([node.route, this.deck.id], {
      queryParams: { level: ch.levelNumber, mode: node.mode, from: JOURNEY_TREE_FROM },
    });
  }

  /** Admin double-tap on an ACTIVE lesson row force-completes it (3★). */
  private static readonly DOUBLE_TAP_MS = 320;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTapLevel: number | null = null;

  onLessonTap(lesson: LessonRow): void {
    if (!this.settings.adminMode() || lesson.state !== 'active') {
      this.openLesson(lesson);
      return;
    }
    const key = lesson.chapter.levelNumber;
    if (this.tapTimer && this.pendingTapLevel === key) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
      this.pendingTapLevel = null;
      void this.adminCompleteLesson(lesson);
      return;
    }
    if (this.tapTimer) clearTimeout(this.tapTimer);
    this.pendingTapLevel = key;
    this.tapTimer = setTimeout(() => {
      this.tapTimer = null;
      this.pendingTapLevel = null;
      this.openLesson(lesson);
    }, TreePage.DOUBLE_TAP_MS);
  }

  private async adminCompleteLesson(lesson: LessonRow): Promise<void> {
    if (!this.deck || !this.settings.adminMode() || lesson.state !== 'active') return;
    const deckId = this.deck.id;
    const ch = lesson.chapter;
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

  trackNode(_i: number, n: ThemeNode): string { return n.theme.def.id; }
  trackLesson(_i: number, l: LessonRow): number { return l.chapter.levelNumber; }

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
}
