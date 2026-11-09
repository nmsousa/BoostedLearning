/**
 * Tree Page (EXPERIMENTAL — Core Vocabulary + thematic curriculum)
 *
 * A central CORE node surrounded by thematic branches. Each Core/theme LEVEL
 * now contains the five modes (flip → quiz → write → match → builder) played in
 * sequence, exactly like a Journey chapter; a level is complete only when all
 * five modes are passed. Tapping a node expands a sub-star: the node at the
 * centre with its five mode nodes around it (only one node expanded at a time).
 *
 * Gating:
 *  - Completing all 5 modes of Core L(n) unlocks Core L(n+1) (after the themes
 *    rule) and raises the ceiling for every theme to tier n.
 *  - A theme can advance at most to the Core's completed tier; within a theme
 *    level the 5 modes unlock in sequence.
 *
 * Progress is per-mode on the synthetic Tree deck (deck id "tree-<lang>"),
 * independent from the real Journey.
 *
 * NOTE: Core L1–L3 and all theme L1–L3 are authored; Core L4–L6 are "coming
 * soon".
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
import { TREE_MODES } from './tree-modes';
import {
  computeProgression, coreMilestoneId, themeMilestoneId, type ProgressionState,
} from './tree-progression';

type NodeState = 'done' | 'active' | 'locked';

/** A main node on the ring (a theme) or the Core hub. */
interface ThemeNode {
  id: string;            // theme id, or 'core'
  index: number;
  title: string;
  emoji: string;
  hue: number;
  state: NodeState;
  /** Highest FULLY-completed level of this node (0 = none). Shown on the node. */
  doneLevel: number;
  /** The tier currently open to play (0 = locked). */
  availTier: number;
  x: number;
  y: number;
  aria: string;
}

/** A mode node in the expanded sub-star. */
interface ModeNode {
  modeIndex: number;
  id: string;            // 'flip' | 'quiz' | …
  label: string;
  icon: string;
  mode: string;          // progress namespace
  state: NodeState;
  /** Position within the sub-star (px in VIEW units). */
  x: number;
  y: number;
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
    if (this.expandedId) { this.collapse(); return true; }
    this.close();
    return true;
  };

  static readonly VIEW = 1000;
  private static readonly RING_RADIUS = 0.74;
  /** Sub-star radius (mode nodes around the expanded node), VIEW units. */
  private static readonly SUBSTAR_RADIUS = 210;

  readonly modes = TREE_MODES;
  readonly view = TreePage.VIEW;

  isLoading = true;
  switchingLanguage = false;
  deckId = '';
  nodes: ThemeNode[] = [];

  prog: ProgressionState = { unlockedCoreTier: 1, unlockedThemeTier: {} };

  // Hub (Core)
  coreDoneLevel = 0;
  coreAvailTier = 1;
  get coreState(): NodeState { return this.coreDoneLevel >= CORE_TIERS.length ? 'done' : 'active'; }

  /** Currently expanded node id ('core' or a theme id), null = none. */
  expandedId: string | null = null;
  /** The tier shown in the expanded sub-star (the node's current available). */
  expandedTier = 0;
  expandedTitle = '';
  expandedEmoji = '';
  expandedWords: CoreWord[] = [];
  modeNodes: ModeNode[] = [];
  /** Hub centre for the sub-star (so mode nodes orbit the tapped node). */
  expandedCenterX = TreePage.VIEW / 2;
  expandedCenterY = TreePage.VIEW / 2;

  availableLanguages: { code: string; name: string; flagUrl: string }[] = [];

  // ── Pan / pinch-zoom state ──────────────────────────────────────────────────
  private panX = 0;
  private panY = 0;
  private zoom = 1;
  private static readonly ZOOM_MIN = 0.6;
  private static readonly ZOOM_MAX = 2.4;
  /** CSS transform applied to the viewport. */
  get viewportTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }
  // Active pointers for drag/pinch.
  private pointers = new Map<number, { x: number; y: number }>();
  private panStart = { x: 0, y: 0, panX: 0, panY: 0 };
  private pinchStart = { dist: 0, zoom: 1 };
  /** True once the pointer moved beyond a small threshold (so a drag doesn't
   *  also fire a node tap). */
  private panMoved = false;

  /** skill name → deck level. */
  private skillLevels = new Map<string, number>();
  /** Passed modes, keyed "<level>:<mode>". */
  private passedModes = new Set<string>();

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

  // ── Pan / pinch-zoom ────────────────────────────────────────────────────────
  onPanPointerDown(ev: PointerEvent): void {
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this.pointers.size === 1) {
      this.panMoved = false;
      this.panStart = { x: ev.clientX, y: ev.clientY, panX: this.panX, panY: this.panY };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.zoom };
    }
  }

  onPanPointerMove(ev: PointerEvent): void {
    if (!this.pointers.has(ev.pointerId)) return;
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (this.pointers.size >= 2) {
      // Pinch: scale from the two-pointer distance.
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const next = this.pinchStart.zoom * (dist / this.pinchStart.dist);
      this.zoom = Math.min(TreePage.ZOOM_MAX, Math.max(TreePage.ZOOM_MIN, next));
      this.panMoved = true;
      this.cdr.detectChanges();
      return;
    }
    // Single-pointer drag → pan.
    const dx = ev.clientX - this.panStart.x;
    const dy = ev.clientY - this.panStart.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this.panMoved = true;
    this.panX = this.panStart.panX + dx;
    this.panY = this.panStart.panY + dy;
    this.cdr.detectChanges();
  }

  onPanPointerUp(ev: PointerEvent): void {
    this.pointers.delete(ev.pointerId);
    if (this.pointers.size === 1) {
      // Returning to single-pointer after a pinch: reset the drag anchor.
      const [p] = [...this.pointers.values()];
      this.panStart = { x: p.x, y: p.y, panX: this.panX, panY: this.panY };
    }
  }

  onWheelZoom(ev: WheelEvent): void {
    ev.preventDefault();
    const next = this.zoom * (ev.deltaY < 0 ? 1.12 : 0.89);
    this.zoom = Math.min(TreePage.ZOOM_MAX, Math.max(TreePage.ZOOM_MIN, next));
    this.cdr.detectChanges();
  }

  /** True when the last pointer interaction was a drag/pinch (so node taps that
   *  follow a pan are ignored). */
  private get wasPanning(): boolean { return this.panMoved; }

  // ── Data ────────────────────────────────────────────────────────────────────
  private async load(): Promise<void> {
    this.availableLanguages = this.flashcards.getAvailableLanguages().map(l => ({ ...l, flagUrl: this.flagUrl(l.code) }));
    const lang = this.settings.learningLanguage();

    // Deterministic skill→level order: Core 1..6, then each theme's tiers.
    const order: Array<{ skill: string } & ({ kind: 'core'; tier: number } | { kind: 'theme'; id: string; tier: number })> = [];
    for (const ct of CORE_TIERS) order.push({ skill: `Core ${ct.tier}`, kind: 'core', tier: ct.tier });
    for (const th of THEME_DEFS) {
      th.tiers.forEach((_w, ti) => order.push({ skill: `${th.id}:${ti + 1}`, kind: 'theme', id: th.id, tier: ti + 1 }));
    }
    this.skillLevels = new Map(order.map((o, i) => [o.skill, i + 1]));

    // Register the deck (Core-mixed content for theme tiers).
    const groups = order.map(o => ({ skill: o.skill, words: this.wordsForSkill(o, true).map(w => ({ fr: w.fr, en: w.en })) }));
    this.deckId = this.flashcards.registerTreeDeck(lang, groups);

    // Read per-MODE pass state for every level.
    const progress = await this.flashcards.getDeckLevelProgressMap(this.deckId);
    this.passedModes = new Set<string>();
    for (const [, level] of this.skillLevels) {
      for (const m of TREE_MODES) {
        const p = progress.get(`${m.mode}-${level}`);
        if ((p?.bestScore ?? 0) >= JOURNEY_PASS_SCORE) this.passedModes.add(`${level}:${m.mode}`);
      }
    }

    // A tier is complete only when all 5 modes are passed.
    const completed = new Set<string>();
    for (const ct of CORE_TIERS) {
      if (this.tierComplete(this.skillLevels.get(`Core ${ct.tier}`))) completed.add(coreMilestoneId(ct.tier));
    }
    for (const th of THEME_DEFS) {
      th.tiers.forEach((_w, ti) => {
        if (this.tierComplete(this.skillLevels.get(`${th.id}:${ti + 1}`))) completed.add(themeMilestoneId(th.id, ti + 1));
      });
    }

    this.prog = computeProgression({
      config: TREE_CONFIG,
      themeIds: THEME_DEFS.map(t => t.id),
      themeHasTier: (id, tier) => {
        const th = THEME_DEFS.find(t => t.id === id);
        return !!th && tier >= 1 && tier <= th.tiers.length;
      },
      completed,
    });

    this.rebuild();
    if (this.expandedId) this.refreshExpanded();
    this.isLoading = false;
    this.switchingLanguage = false;
    this.cdr.detectChanges();
  }

  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    this.switchingLanguage = true;
    this.collapse();
    this.cdr.detectChanges();
    await this.flashcards.initialize();
    await this.load();
  }

  // ── Completion helpers ──────────────────────────────────────────────────────
  /** True when all 5 modes of a deck level are passed. */
  private tierComplete(level: number | undefined): boolean {
    if (!level) return false;
    return TREE_MODES.every(m => this.passedModes.has(`${level}:${m.mode}`));
  }

  /** Highest fully-completed tier of a Core/theme skill group (0 = none). */
  private highestDoneTier(skillOf: (tier: number) => string, maxTier: number): number {
    let done = 0;
    for (let tier = 1; tier <= maxTier; tier++) {
      if (this.tierComplete(this.skillLevels.get(skillOf(tier)))) done = tier;
      else break; // tiers complete in order
    }
    return done;
  }

  // ── View model ──────────────────────────────────────────────────────────────
  private rebuild(): void {
    // Core hub.
    this.coreDoneLevel = this.highestDoneTier(t => `Core ${t}`, CORE_TIERS.length);
    this.coreAvailTier = this.prog.unlockedCoreTier;

    const n = THEME_DEFS.length;
    const cx = TreePage.VIEW / 2, cy = TreePage.VIEW / 2, r = (TreePage.VIEW / 2) * TreePage.RING_RADIUS;
    this.nodes = THEME_DEFS.map((th, i) => {
      const angle = (360 / n) * i - 90;
      const rad = (angle * Math.PI) / 180;
      const x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
      const availTier = this.prog.unlockedThemeTier[th.id] ?? 0;
      const doneLevel = this.highestDoneTier(t => `${th.id}:${t}`, th.tiers.length);
      const state: NodeState =
        availTier === 0 ? 'locked'
          : doneLevel >= availTier ? 'done' // all available tiers fully done
            : 'active';
      const title = this.t(th.nameKey);
      return {
        id: th.id, index: i, title, emoji: th.emoji, hue: th.hue,
        state, doneLevel, availTier, x, y,
        aria: `${title}, ${this.t(`tree.unit.${state}`)}, ${this.t('tree.levelShort', { n: doneLevel })}`,
      };
    });
  }

  // ── Expand / sub-star ─────────────────────────────────────────────────────
  /** The tier a node should open to: the first not-fully-done available tier,
   *  else the highest available (for replay/review). */
  private openTierFor(doneLevel: number, availTier: number): number {
    if (availTier === 0) return 0;
    return Math.min(availTier, doneLevel + 1);
  }

  openCore(): void {
    const tier = this.openTierFor(this.coreDoneLevel, this.coreAvailTier);
    if (tier === 0) return;
    const ct = CORE_TIERS.find(c => c.tier === tier)!;
    this.expandedId = 'core';
    this.expandedTitle = this.t('tree.hubTitle');
    this.expandedEmoji = '📖';
    this.expandedTier = tier;
    this.expandedCenterX = TreePage.VIEW / 2;
    this.expandedCenterY = TreePage.VIEW / 2;
    this.expandedWords = ct.authored ? ct.words : [];
    this.buildModeNodes(this.skillLevels.get(`Core ${tier}`)!, ct.authored);
    this.cdr.detectChanges();
  }

  openTheme(node: ThemeNode): void {
    const th = THEME_DEFS.find(t => t.id === node.id);
    if (!th || node.availTier === 0) return;
    const tier = this.openTierFor(node.doneLevel, node.availTier);
    this.expandedId = th.id;
    this.expandedTitle = node.title;
    this.expandedEmoji = th.emoji;
    this.expandedTier = tier;
    this.expandedCenterX = node.x;
    this.expandedCenterY = node.y;
    this.expandedWords = this.wordsForSkill({ kind: 'theme', id: th.id, tier }, true);
    this.buildModeNodes(this.skillLevels.get(`${th.id}:${tier}`)!, true);
    this.cdr.detectChanges();
  }

  /** Build the 5 mode nodes orbiting the expanded centre. Modes unlock in
   *  sequence: mode i is active once mode i-1 is passed (mode 0 always active
   *  when the tier is available). */
  private buildModeNodes(level: number, authored: boolean): void {
    const cx = this.expandedCenterX, cy = this.expandedCenterY;
    const r = TreePage.SUBSTAR_RADIUS;
    this.modeNodes = TREE_MODES.map((m, i) => {
      const angle = (360 / TREE_MODES.length) * i - 90;
      const rad = (angle * Math.PI) / 180;
      const x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
      const passed = this.passedModes.has(`${level}:${m.mode}`);
      const prevPassed = i === 0 ? true : this.passedModes.has(`${level}:${TREE_MODES[i - 1].mode}`);
      const state: NodeState = !authored ? 'locked' : passed ? 'done' : prevPassed ? 'active' : 'locked';
      return {
        modeIndex: i, id: m.id, label: this.t(m.labelKey), icon: m.icon, mode: m.mode, state, x, y,
        aria: `${this.t(m.labelKey)}, ${this.t(`tree.unit.${state}`)}`,
      };
    });
  }

  collapse(): void {
    this.expandedId = null;
    this.modeNodes = [];
    this.cdr.detectChanges();
  }

  private refreshExpanded(): void {
    if (this.expandedId === 'core') this.openCore();
    else {
      const node = this.nodes.find(nd => nd.id === this.expandedId);
      if (node) this.openTheme(node); else this.collapse();
    }
  }

  /** Launch a mode node as its exercise over the expanded tier's words. */
  openMode(m: ModeNode): void {
    if (!this.deckId || m.state === 'locked') return;
    const skill = this.expandedId === 'core' ? `Core ${this.expandedTier}` : `${this.expandedId}:${this.expandedTier}`;
    const level = this.skillLevels.get(skill);
    if (!level) return;
    const def = TREE_MODES[m.modeIndex];
    void this.navCtrl.navigateForward([def.route, this.deckId], {
      queryParams: { level, mode: def.mode, from: JOURNEY_TREE_FROM },
    });
  }

  // ── Admin double-tap to complete the next available tier (all 5 modes) ──────
  get adminMode(): boolean { return this.settings.adminMode(); }

  private static readonly DOUBLE_TAP_MS = 320;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTapKey: string | null = null;

  onNodeTap(node: ThemeNode): void {
    if (this.wasPanning) return; // this "click" ended a drag/pinch
    if (!this.adminMode) { this.openTheme(node); return; }
    this.handleAdminDoubleTap(`theme:${node.id}`, () => this.openTheme(node), () => this.adminCompleteTheme(node));
  }

  onCoreTap(): void {
    if (this.wasPanning) return;
    if (!this.adminMode) { this.openCore(); return; }
    this.handleAdminDoubleTap('core', () => this.openCore(), () => this.adminCompleteCore());
  }

  /** Tap a mode node in the sub-star. Non-admin plays it; an admin double-tap
   *  completes just that mode. */
  onModeTap(m: ModeNode): void {
    if (this.wasPanning) return;
    if (m.state === 'locked') return;
    if (!this.adminMode) { this.openMode(m); return; }
    this.handleAdminDoubleTap(`mode:${m.id}`, () => this.openMode(m), () => this.adminCompleteMode(m));
  }

  /** Admin: mark just this one mode of the expanded tier passed, then reload. */
  private async adminCompleteMode(m: ModeNode): Promise<void> {
    if (!this.adminMode || !this.deckId) return;
    const skill = this.expandedId === 'core' ? `Core ${this.expandedTier}` : `${this.expandedId}:${this.expandedTier}`;
    const level = this.skillLevels.get(skill);
    if (!level) return;
    const def = TREE_MODES[m.modeIndex];
    const cards = this.flashcards.getLevelCards(this.deckId, level);
    const n = Math.max(1, cards.length);
    try { await this.flashcards.saveLevelProgress(this.deckId, def.mode, level, n, n); }
    catch { /* best-effort */ }
    await this.load();
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

  /** Admin: mark ALL 5 modes of a level passed (100%), then reload. */
  private async adminPassTier(level: number): Promise<void> {
    if (!this.deckId) return;
    const cards = this.flashcards.getLevelCards(this.deckId, level);
    const n = Math.max(1, cards.length);
    try {
      for (const m of TREE_MODES) {
        await this.flashcards.saveLevelProgress(this.deckId, m.mode, level, n, n);
      }
    } catch { /* best-effort */ }
    await this.load();
  }

  private async adminCompleteTheme(node: ThemeNode): Promise<void> {
    if (!this.adminMode) return;
    const avail = node.availTier;
    for (let tier = 1; tier <= avail; tier++) {
      const lvl = this.skillLevels.get(`${node.id}:${tier}`);
      if (lvl && !this.tierComplete(lvl)) { await this.adminPassTier(lvl); return; }
    }
  }

  private async adminCompleteCore(): Promise<void> {
    if (!this.adminMode) return;
    for (let tier = 1; tier <= this.coreAvailTier; tier++) {
      const ct = CORE_TIERS.find(c => c.tier === tier);
      if (!ct?.authored) continue;
      const lvl = this.skillLevels.get(`Core ${tier}`);
      if (lvl && !this.tierComplete(lvl)) { await this.adminPassTier(lvl); return; }
    }
  }

  // ── Word mixing ─────────────────────────────────────────────────────────────
  private static readonly CORE_MIX = 5;

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

    const pool: CoreWord[] = [];
    const seen = new Set<string>();
    for (const ct of CORE_TIERS) {
      if (ct.tier > o.tier || !ct.authored) continue;
      for (const w of ct.words) if (!seen.has(w.fr)) { seen.add(w.fr); pool.push(w); }
    }
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
  trackMode(_i: number, m: ModeNode): string { return m.id; }

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
