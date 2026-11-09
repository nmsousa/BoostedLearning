/**
 * Tree Page (EXPERIMENTAL — Core Vocabulary + thematic curriculum)
 *
 * Implements the curriculum brief: a central CORE node (the reusable grammar
 * toolkit, six tiers) surrounded by thematic branches. Core L1 is the only
 * initial node; completing it unlocks Theme L1 across themes; completing X
 * distinct Theme L1 milestones unlocks Core L2; and so on (see
 * tree-progression.ts). Curriculum content lives in tree-curriculum.ts.
 *
 * Lessons are playable via the existing flip engine over a synthetic "Tree"
 * deck (FlashcardService.registerTreeDeck) whose skills are the Core/theme
 * milestones, so progress rides the normal journey-flip level progress — but
 * under a separate deck id, never colliding with the real course.
 *
 * NOTE: only Core L1 and each theme's L1 are authored/playable right now;
 * higher tiers are defined but marked "coming soon".
 *
 * @module app/flashcards/tree
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy, HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { JOURNEY_TREE_FROM } from '../journey/journey-back';
import { JOURNEY_PASS_SCORE } from '../journey/journey-model';
import { CORE_TIERS, THEME_DEFS, TREE_CONFIG, type CoreWord } from './tree-curriculum';
import {
  computeProgression, coreMilestoneId, themeMilestoneId, type ProgressionState,
} from './tree-progression';

type NodeState = 'done' | 'active' | 'locked';

interface ThemeNode {
  id: string;
  index: number;
  title: string;
  emoji: string;
  hue: number;
  state: NodeState;
  /** The theme tier currently available (0 = locked). */
  tier: number;
  /** % of the available tier's words passed (0 if none). */
  pct: number;
  authored: boolean;
  x: number;
  y: number;
  aria: string;
}

interface LessonRow {
  /** Milestone id ("core:1" or "theme:health:1"). */
  milestone: string;
  /** The deck skill name backing this lesson. */
  skill: string;
  /** The level number in the synthetic deck. */
  level: number;
  title: string;
  subtitle: string;
  words: CoreWord[];
  state: NodeState;
  authored: boolean;
  aria: string;
}

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

  private readonly onHardwareBack: () => boolean = () => {
    if (this.panelOpen) { this.closePanel(); return true; }
    this.close();
    return true;
  };

  static readonly VIEW = 1000;
  private static readonly RING_RADIUS = 0.74;

  isLoading = true;
  switchingLanguage = false;
  deckId = '';
  nodes: ThemeNode[] = [];

  /** Progression state (unlocked core tier + per-theme available tier). */
  prog: ProgressionState = { unlockedCoreTier: 1, unlockedThemeTier: {} };

  // Hub (Core) display
  coreTier = 1;
  coreState: NodeState = 'active';
  corePct = 0;

  /** Open panel: either the Core lessons or a theme's lessons. */
  panelOpen = false;
  panelTitle = '';
  panelEmoji = '';
  panelLessons: LessonRow[] = [];

  availableLanguages: { code: string; name: string; flagUrl: string }[] = [];
  readonly view = TreePage.VIEW;

  /** The synthetic deck's skill ordering: index 0 = Core current tier, then
   *  one skill per theme (L1). Rebuilt each load. Maps skill→level. */
  private skillLevels = new Map<string, number>();
  /** Progress map (mode-level → bestScore) for the tree deck. */
  private passedLevels = new Set<number>();

  get learningLanguage(): string { return this.settings.learningLanguage(); }
  get currentLanguage() {
    return (
      this.availableLanguages.find(l => l.code === this.learningLanguage) ??
      this.availableLanguages[0] ??
      { code: this.learningLanguage, name: this.learningLanguage.toUpperCase(), flagUrl: this.flagUrl(this.learningLanguage) }
    );
  }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.t(key, params); }

  async ngOnInit(): Promise<void> {
    await this.flashcards.initialize();
    await this.load();
  }

  ngOnDestroy(): void {
    this.backInterceptor.clear(this.onHardwareBack);
    if (this.tapTimer) { clearTimeout(this.tapTimer); this.tapTimer = null; }
  }

  async ionViewWillEnter(): Promise<void> {
    this.backInterceptor.register(this.onHardwareBack);
    if (this.deckId) await this.load();
  }

  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); }

  @HostListener('window:resize')
  onResize(): void { this.cdr.detectChanges(); }

  // ── Data ────────────────────────────────────────────────────────────────────
  private async load(languageSwitch = false): Promise<void> {
    this.availableLanguages = this.flashcards.getAvailableLanguages().map(l => ({ ...l, flagUrl: this.flagUrl(l.code) }));
    const lang = this.settings.learningLanguage();

    // 1) Deterministic skill→level ordering (independent of word content):
    //    Core 1..6, then each theme's authored tiers in THEME_DEFS order.
    const order: Array<{ skill: string } & ({ kind: 'core'; tier: number } | { kind: 'theme'; id: string; tier: number })> = [];
    for (const ct of CORE_TIERS) order.push({ skill: `Core ${ct.tier}`, kind: 'core', tier: ct.tier });
    for (const th of THEME_DEFS) {
      th.tiers.forEach((_w, ti) => order.push({ skill: `${th.id}:${ti + 1}`, kind: 'theme', id: th.id, tier: ti + 1 }));
    }
    this.skillLevels = new Map(order.map((o, i) => [o.skill, i + 1]));

    // 2) Register once (any content) so progress can be read by level, THEN we
    //    re-register below with the Core-mixed content. We need a deck id first.
    const plain = order.map(o => ({
      skill: o.skill,
      words: this.wordsForSkill(o).map(w => ({ fr: w.fr, en: w.en })),
    }));
    this.deckId = this.flashcards.registerTreeDeck(lang, plain);

    // 3) Read which levels are passed (bestScore >= pass score) under journey-flip.
    const progress = await this.flashcards.getDeckLevelProgressMap(this.deckId);
    this.passedLevels = new Set<number>();
    for (const [, level] of this.skillLevels) {
      const p = progress.get(`journey-flip-${level}`);
      if ((p?.bestScore ?? 0) >= JOURNEY_PASS_SCORE) this.passedLevels.add(level);
    }

    // 4) Completed-milestone set from passed levels.
    const completed = new Set<string>();
    for (const ct of CORE_TIERS) {
      const lvl = this.skillLevels.get(`Core ${ct.tier}`);
      if (lvl && this.passedLevels.has(lvl)) completed.add(coreMilestoneId(ct.tier));
    }
    for (const th of THEME_DEFS) {
      th.tiers.forEach((_w, ti) => {
        const lvl = this.skillLevels.get(`${th.id}:${ti + 1}`);
        if (lvl && this.passedLevels.has(lvl)) completed.add(themeMilestoneId(th.id, ti + 1));
      });
    }

    // 5) Progression. A theme has tier t if it has that many authored tiers.
    this.prog = computeProgression({
      config: TREE_CONFIG,
      themeIds: THEME_DEFS.map(t => t.id),
      themeHasTier: (id, tier) => {
        const th = THEME_DEFS.find(t => t.id === id);
        return !!th && tier >= 1 && tier <= th.tiers.length;
      },
      completed,
    });

    // 6) Re-register with Core-MIXED content: each theme tier's session now also
    //    includes a small review sample of the Core words learned up to that
    //    tier (brief §7: core vocabulary recurs in theme exercises). Level order
    //    is unchanged, so progress/levels stay valid.
    const mixed = order.map(o => ({
      skill: o.skill,
      words: this.wordsForSkill(o, true).map(w => ({ fr: w.fr, en: w.en })),
    }));
    this.flashcards.registerTreeDeck(lang, mixed);

    this.rebuild();
    if (this.panelOpen) this.refreshOpenPanel();
    this.isLoading = false;
    this.switchingLanguage = false;
    this.cdr.detectChanges();
  }

  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    this.switchingLanguage = true;
    this.closePanel();
    this.cdr.detectChanges();
    await this.flashcards.initialize();
    await this.load(true);
  }

  // ── View model ──────────────────────────────────────────────────────────────
  private rebuild(): void {
    // Hub (Core) state.
    this.coreTier = this.prog.unlockedCoreTier;
    const coreLvl = this.skillLevels.get(`Core ${this.coreTier}`)!;
    const corePassed = this.passedLevels.has(coreLvl);
    this.coreState = corePassed ? 'done' : 'active';
    // corePct: fraction of core tiers passed.
    const corePassedCount = CORE_TIERS.filter(ct => this.passedLevels.has(this.skillLevels.get(`Core ${ct.tier}`)!)).length;
    this.corePct = Math.round((corePassedCount / CORE_TIERS.length) * 100);

    const n = THEME_DEFS.length;
    const cx = TreePage.VIEW / 2, cy = TreePage.VIEW / 2, r = (TreePage.VIEW / 2) * TreePage.RING_RADIUS;
    this.nodes = THEME_DEFS.map((th, i) => {
      const angle = (360 / n) * i - 90;
      const rad = (angle * Math.PI) / 180;
      const x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
      const availTier = this.prog.unlockedThemeTier[th.id] ?? 0;
      // Count passed tiers up to the available one.
      let passedTiers = 0;
      for (let tr = 1; tr <= th.tiers.length; tr++) {
        if (this.passedLevels.has(this.skillLevels.get(`${th.id}:${tr}`)!)) passedTiers++;
      }
      // done = every available tier passed; locked = no tier available; else active.
      const state: NodeState =
        availTier === 0 ? 'locked'
          : passedTiers >= availTier ? 'done'
            : 'active';
      const pct = th.tiers.length ? Math.round((passedTiers / th.tiers.length) * 100) : 0;
      const title = this.t(th.nameKey);
      return {
        id: th.id, index: i, title, emoji: th.emoji, hue: th.hue,
        state, tier: availTier, pct, authored: true, x, y,
        aria: `${title}, ${this.t(`tree.unit.${state}`)}`,
      };
    });
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  /** Open the Core panel (the hub). Shows the current Core tier's lesson. */
  openCore(): void {
    this.panelOpen = true;
    this.panelEmoji = '📖';
    this.panelTitle = this.t('tree.hubTitle');
    this.panelLessons = CORE_TIERS
      .filter(ct => ct.tier <= this.prog.unlockedCoreTier || ct.tier === this.prog.unlockedCoreTier + 1)
      .map(ct => this.coreLesson(ct.tier));
    this.cdr.detectChanges();
  }

  openTheme(node: ThemeNode): void {
    const th = THEME_DEFS.find(t => t.id === node.id);
    if (!th) return;
    this.panelOpen = true;
    this.panelEmoji = th.emoji;
    this.panelTitle = node.title;
    // All authored tiers of this theme, each gated by the progression engine.
    this.panelLessons = th.tiers.map((_w, ti) => this.themeLesson(th.id, ti + 1));
    this.cdr.detectChanges();
  }

  closePanel(): void {
    this.panelOpen = false;
    this.panelLessons = [];
    this.cdr.detectChanges();
  }

  private refreshOpenPanel(): void {
    if (this.panelTitle === this.t('tree.hubTitle')) this.openCore();
    else {
      const node = this.nodes.find(nd => nd.title === this.panelTitle);
      if (node) this.openTheme(node); else this.closePanel();
    }
  }

  private coreLesson(tier: number): LessonRow {
    const ct = CORE_TIERS.find(c => c.tier === tier)!;
    const level = this.skillLevels.get(`Core ${tier}`)!;
    const passed = this.passedLevels.has(level);
    // Core tier n is playable if it's <= unlocked tier.
    const playable = ct.authored && tier <= this.prog.unlockedCoreTier;
    const state: NodeState = passed ? 'done' : playable ? 'active' : 'locked';
    return {
      milestone: coreMilestoneId(tier), skill: `Core ${tier}`, level,
      title: `${this.t('tree.coreLevel', { n: tier })} · ${ct.cefr}`,
      subtitle: ct.outcome, words: ct.words, state, authored: ct.authored,
      aria: `${ct.title}, ${this.t(`tree.unit.${state}`)}`,
    };
  }

  private themeLesson(themeId: string, tier: number): LessonRow {
    const th = THEME_DEFS.find(t => t.id === themeId)!;
    const level = this.skillLevels.get(`${themeId}:${tier}`)!;
    const passed = this.passedLevels.has(level);
    const available = (this.prog.unlockedThemeTier[themeId] ?? 0) >= tier;
    const state: NodeState = passed ? 'done' : available ? 'active' : 'locked';
    // Preview shows the mixed set (topic words + a Core review sample) — exactly
    // what the session plays.
    const words = this.wordsForSkill({ kind: 'theme', id: themeId, tier }, true);
    return {
      milestone: themeMilestoneId(themeId, tier), skill: `${themeId}:${tier}`, level,
      title: `${this.t('tree.themeLevel', { n: tier })}`,
      subtitle: '', words, state, authored: true,
      aria: `${this.t(th.nameKey)} ${tier}, ${this.t(`tree.unit.${state}`)}`,
    };
  }

  /** Launch a lesson as a flip session over its words. */
  openLesson(lesson: LessonRow): void {
    if (!this.deckId || lesson.state === 'locked' || !lesson.authored) return;
    void this.navCtrl.navigateForward(['/practice/flip', this.deckId], {
      queryParams: { level: lesson.level, mode: 'journey-flip', from: JOURNEY_TREE_FROM },
    });
  }

  // ── Admin double-tap to complete the next available tier ────────────────────
  get adminMode(): boolean { return this.settings.adminMode(); }

  private static readonly DOUBLE_TAP_MS = 320;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTapKey: string | null = null;

  /** Tap a theme node. Non-admin (or no second tap) opens the theme panel; an
   *  admin double-tap completes that theme's next available-not-done tier. */
  onNodeTap(node: ThemeNode): void {
    if (!this.adminMode) { this.openTheme(node); return; }
    this.handleAdminDoubleTap(`theme:${node.id}`, () => this.openTheme(node), () => this.adminCompleteTheme(node.id));
  }

  /** Tap the Core hub. Admin double-tap completes the next Core tier. */
  onCoreTap(): void {
    if (!this.adminMode) { this.openCore(); return; }
    this.handleAdminDoubleTap('core', () => this.openCore(), () => this.adminCompleteCore());
  }

  private handleAdminDoubleTap(key: string, single: () => void, double: () => void): void {
    if (this.tapTimer && this.pendingTapKey === key) {
      clearTimeout(this.tapTimer); this.tapTimer = null; this.pendingTapKey = null;
      void double();
      return;
    }
    if (this.tapTimer) clearTimeout(this.tapTimer);
    this.pendingTapKey = key;
    this.tapTimer = setTimeout(() => {
      this.tapTimer = null; this.pendingTapKey = null; single();
    }, TreePage.DOUBLE_TAP_MS);
  }

  /** Admin: mark a deck level as passed (100%) under journey-flip, then reload. */
  private async adminPassLevel(level: number): Promise<void> {
    if (!this.deckId) return;
    const cards = this.flashcards.getLevelCards(this.deckId, level);
    const n = Math.max(1, cards.length);
    try { await this.flashcards.saveLevelProgress(this.deckId, 'journey-flip', level, n, n); }
    catch { /* best-effort */ }
    await this.load();
  }

  /** Admin: complete the next available, not-yet-passed tier of a theme. */
  private async adminCompleteTheme(themeId: string): Promise<void> {
    if (!this.adminMode) return;
    const avail = this.prog.unlockedThemeTier[themeId] ?? 0;
    for (let tier = 1; tier <= avail; tier++) {
      const lvl = this.skillLevels.get(`${themeId}:${tier}`);
      if (lvl && !this.passedLevels.has(lvl)) { await this.adminPassLevel(lvl); return; }
    }
  }

  /** Admin: complete the current (unlocked, not-passed) Core tier. */
  private async adminCompleteCore(): Promise<void> {
    if (!this.adminMode) return;
    for (let tier = 1; tier <= this.prog.unlockedCoreTier; tier++) {
      const ct = CORE_TIERS.find(c => c.tier === tier);
      if (!ct?.authored) continue;
      const lvl = this.skillLevels.get(`Core ${tier}`);
      if (lvl && !this.passedLevels.has(lvl)) { await this.adminPassLevel(lvl); return; }
    }
  }

  /** Max Core review words mixed into a theme session (brief §7.1: a manageable
   *  subset, not every mastered word). */
  private static readonly CORE_MIX = 5;

  /** The words for a skill. For a THEME tier, when `mix` is true, append a small
   *  review sample of the Core vocabulary learned up to that tier (Core 1..tier)
   *  so core words recur in theme practice. Core tiers themselves never mix. */
  private wordsForSkill(
    o: { kind: 'core'; tier: number } | { kind: 'theme'; id: string; tier: number },
    mix = false,
  ): CoreWord[] {
    if (o.kind === 'core') {
      const ct = CORE_TIERS.find(c => c.tier === o.tier);
      return ct?.authored ? ct.words : [{ fr: '—', en: '—' }];
    }
    const th = THEME_DEFS.find(t => t.id === o.id);
    const own = th?.tiers[o.tier - 1] ?? [];
    if (own.length === 0) return [{ fr: '—', en: '—' }];
    if (!mix) return own;

    // Pool of Core words from tiers 1..o.tier (authored only), deduped by fr.
    const pool: CoreWord[] = [];
    const seen = new Set<string>();
    for (const ct of CORE_TIERS) {
      if (ct.tier > o.tier || !ct.authored) continue;
      for (const w of ct.words) {
        if (!seen.has(w.fr)) { seen.add(w.fr); pool.push(w); }
      }
    }
    // Deterministic sample: spread across the pool so it isn't always the first
    // few. Take up to CORE_MIX, skipping words already in the theme set.
    const ownFr = new Set(own.map(w => w.fr));
    const sample: CoreWord[] = [];
    if (pool.length) {
      const step = Math.max(1, Math.floor(pool.length / TreePage.CORE_MIX));
      for (let i = 0; i < pool.length && sample.length < TreePage.CORE_MIX; i += step) {
        const w = pool[i];
        if (!ownFr.has(w.fr)) sample.push(w);
      }
    }
    return [...own, ...sample];
  }

  close(): void { this.router.navigate(['/home']); }

  trackNode(_i: number, n: ThemeNode): string { return n.id; }
  trackLesson(_i: number, l: LessonRow): string { return l.milestone; }

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
