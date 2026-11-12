/**
 * Tree engine — the shared, view-agnostic brain behind BOTH Tree layouts.
 *
 * The radial star map (TreePage) and the vertical list (TreePlusPage) show the
 * SAME curriculum, progression and progress; only the presentation differs.
 * All of that shared logic lives here so the two views can never drift:
 *
 *  - register the synthetic "tree-v2-<lang>" deck with the fixed level layout
 *    (each Core/theme tier owns a permanent level number, TREE_LAYOUT);
 *  - read per-mode pass state and compute which tiers are complete;
 *  - run the Core↔theme unlock engine (tree-progression);
 *  - expose each node's done/available tier + state (the view model);
 *  - resolve a node's levels (current + earlier) for review/replay;
 *  - launch a mode exercise with the right `level`, `mode`, `pool` params;
 *  - admin helpers to force-complete a mode / tier.
 *
 * It holds no pixel/pan/sub-star state — that stays in each view. It is NOT an
 * Angular component; it's a plain class a page instantiates with the services
 * it already injects, so it stays easy to unit-test.
 *
 * @module app/flashcards/tree
 */

import type { NavController } from '@ionic/angular';
import type { FlashcardService } from '../../services/flashcard.service';
import type { SettingsService } from '../../services/settings.service';
import { JOURNEY_PASS_SCORE } from '../journey/journey-model';
import {
  CORE_TIERS, THEME_DEFS, TREE_CONFIG, TREE_LAYOUT, coreLevelOf, themeLevelOf, type CoreWord,
} from './tree-curriculum';
import { TREE_MODES, type TreeModeDef } from './tree-modes';
import {
  computeProgression, coreMilestoneId, themeMilestoneId, type ProgressionState,
} from './tree-progression';

export type TreeNodeState = 'done' | 'active' | 'locked';

/** A Core or theme node's progression view model (layout-free). */
export interface TreeNode {
  /** 'core' or a theme id. */
  id: string;
  /** 0-based position in THEME_DEFS (−1 for Core). */
  index: number;
  title: string;
  emoji: string;
  hue: number;
  state: TreeNodeState;
  /** Highest FULLY-completed tier (0 = none). */
  doneLevel: number;
  /** Highest tier currently open to play (0 = locked). */
  availTier: number;
  /** Number of authored tiers this node has. */
  maxTier: number;
}

/** One tier of a node: its own words + completion, for review/replay lists. */
export interface TreeTier {
  tier: number;
  /** Deck level number. */
  level: number;
  /** "Core 3" / "Level 3" label (localized by the caller's translate fn). */
  label: string;
  words: CoreWord[];
  done: boolean;
  /** The 5 activities of this tier, in order, with their unlock state. */
  modes: TreeModeView[];
}

/** One activity (mode) within a tier. */
export interface TreeModeView {
  modeIndex: number;
  id: string;
  mode: string;
  route: string;
  icon: string;
  labelKey: string;
  state: TreeNodeState;
}

/** Minimal translate signature the engine needs for titles/labels. */
export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export interface TreeEngineDeps {
  flashcards: FlashcardService;
  settings: SettingsService;
  nav: NavController;
  t: TranslateFn;
  /** Source page tag for the exercise return route (e.g. 'tree' | 'tree-plus'). */
  from: string;
}

export class TreeEngine {
  /** Deck id prefix → "tree-v2-<lang>". A new prefix starts a fresh namespace. */
  static readonly DECK_PREFIX = 'tree-v2';

  deckId = '';
  prog: ProgressionState = { unlockedCoreTier: 1, unlockedThemeTier: {} };
  coreDoneLevel = 0;
  coreAvailTier = 1;

  /** skill name ("Core 3" / "food:2") → deck level number. */
  private skillLevels = new Map<string, number>();
  /** Passed modes, keyed "<level>:<mode>". */
  private passedModes = new Set<string>();

  constructor(private readonly deps: TreeEngineDeps) {}

  get modes(): readonly TreeModeDef[] { return TREE_MODES; }
  get adminMode(): boolean { return this.deps.settings.adminMode(); }

  /** Total authored Core tiers (used for "Core complete" / coming-soon). */
  get authoredCoreTiers(): number { return CORE_TIERS.filter(c => c.authored).length; }

  // ── Load / register ─────────────────────────────────────────────────────────
  /**
   * (Re)register the deck for the current learning language and recompute all
   * progression state. Call on enter and after any admin change.
   */
  async load(): Promise<void> {
    const lang = this.deps.settings.learningLanguage();

    // Fixed level layout: Core tier t → level t; theme #i tier t →
    // coreSlots + i*themeSlots + t. Groups pushed in level order so group
    // index + 1 === level; unauthored slots are "—" placeholders.
    const order = this.buildOrder();
    this.skillLevels = new Map(order.map(o => [o.skill, o.level]));

    const groups = order.map(o => ({ skill: o.skill, words: this.wordsForSkill(o).map(w => ({ fr: w.fr, en: w.en })) }));
    this.deckId = this.deps.flashcards.registerTreeDeck(lang, groups, TreeEngine.DECK_PREFIX);

    const progress = await this.deps.flashcards.getDeckLevelProgressMap(this.deckId);
    this.passedModes = new Set<string>();
    for (const [, level] of this.skillLevels) {
      for (const m of TREE_MODES) {
        const p = progress.get(`${m.mode}-${level}`);
        if ((p?.bestScore ?? 0) >= JOURNEY_PASS_SCORE) this.passedModes.add(`${level}:${m.mode}`);
      }
    }

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

    this.coreDoneLevel = this.highestDoneTier(t => `Core ${t}`, CORE_TIERS.length);
    this.coreAvailTier = this.prog.unlockedCoreTier;
  }

  private buildOrder(): Array<{ skill: string; level: number } & ({ kind: 'core'; tier: number } | { kind: 'theme'; id: string; tier: number })> {
    const order: Array<{ skill: string; level: number } & ({ kind: 'core'; tier: number } | { kind: 'theme'; id: string; tier: number })> = [];
    for (let t = 1; t <= TREE_LAYOUT.coreSlots; t++) {
      order.push({ skill: `Core ${t}`, level: coreLevelOf(t), kind: 'core', tier: t });
    }
    THEME_DEFS.forEach((th, i) => {
      for (let t = 1; t <= TREE_LAYOUT.themeSlots; t++) {
        order.push({ skill: `${th.id}:${t}`, level: themeLevelOf(i, t), kind: 'theme', id: th.id, tier: t });
      }
    });
    return order;
  }

  /** A level's OWN words — no Core-mix (reused words live in Builder phrases). */
  private wordsForSkill(
    o: { kind: 'core'; tier: number } | { kind: 'theme'; id: string; tier: number },
  ): CoreWord[] {
    if (o.kind === 'core') {
      const ct = CORE_TIERS.find(c => c.tier === o.tier);
      return ct?.authored ? ct.words : [{ fr: '—', en: '—' }];
    }
    const th = THEME_DEFS.find(t => t.id === o.id);
    const own = th?.tiers[o.tier - 1] ?? [];
    return own.length ? own : [{ fr: '—', en: '—' }];
  }

  // ── Completion helpers ───────────────────────────────────────────────────────
  /** True when all 5 modes of a deck level are passed. */
  tierComplete(level: number | undefined): boolean {
    if (!level) return false;
    return TREE_MODES.every(m => this.passedModes.has(`${level}:${m.mode}`));
  }

  /** Highest fully-completed tier of a skill group (0 = none; stops at first gap). */
  private highestDoneTier(skillOf: (tier: number) => string, maxTier: number): number {
    let done = 0;
    for (let tier = 1; tier <= maxTier; tier++) {
      if (this.tierComplete(this.skillLevels.get(skillOf(tier)))) done = tier;
      else break;
    }
    return done;
  }

  /** Level number for a node's tier (node id 'core' or a theme id). */
  levelOf(nodeId: string, tier: number): number | undefined {
    return this.skillLevels.get(nodeId === 'core' ? `Core ${tier}` : `${nodeId}:${tier}`);
  }

  /** The tier a node opens to: first not-done available tier, else highest. */
  openTierFor(doneLevel: number, availTier: number): number {
    if (availTier === 0) return 0;
    return Math.min(availTier, doneLevel + 1);
  }

  // ── View model ────────────────────────────────────────────────────────────
  /** The Core hub node. */
  coreNode(): TreeNode {
    const authored = this.authoredCoreTiers;
    return {
      id: 'core', index: -1,
      title: this.deps.t('tree.hubTitle'), emoji: '📖', hue: 265,
      state: this.coreDoneLevel >= authored ? 'done' : 'active',
      doneLevel: this.coreDoneLevel,
      availTier: this.coreAvailTier,
      maxTier: authored,
    };
  }

  /** All theme nodes, in THEME_DEFS order. */
  themeNodes(): TreeNode[] {
    return THEME_DEFS.map((th, i) => {
      const availTier = this.prog.unlockedThemeTier[th.id] ?? 0;
      const doneLevel = this.highestDoneTier(t => `${th.id}:${t}`, th.tiers.length);
      const state: TreeNodeState =
        availTier === 0 ? 'locked' : doneLevel >= availTier ? 'done' : 'active';
      return {
        id: th.id, index: i, title: this.deps.t(th.nameKey), emoji: th.emoji, hue: th.hue,
        state, doneLevel, availTier, maxTier: th.tiers.length,
      };
    });
  }

  /** A node's own words for a tier (no Core-mix). */
  wordsOf(nodeId: string, tier: number): CoreWord[] {
    if (nodeId === 'core') {
      const ct = CORE_TIERS.find(c => c.tier === tier);
      return ct?.authored ? ct.words : [];
    }
    return this.wordsForSkill({ kind: 'theme', id: nodeId, tier });
  }

  /** Whether a node's tier is authored/playable. */
  tierAuthored(nodeId: string, tier: number): boolean {
    if (nodeId !== 'core') return true;
    return !!CORE_TIERS.find(c => c.tier === tier)?.authored;
  }

  /**
   * The tiers to show for a node up to `maxTier` (its reached tier): each with
   * its own words, completion, and the 5 activities' unlock states. Newest
   * first is left to the view; this returns ascending 1..maxTier.
   */
  tiersFor(node: TreeNode, maxTier: number): TreeTier[] {
    const out: TreeTier[] = [];
    for (let t = 1; t <= maxTier; t++) {
      const level = this.levelOf(node.id, t);
      if (!level || !this.tierAuthored(node.id, t)) continue;
      out.push({
        tier: t, level,
        label: node.id === 'core' ? this.deps.t('tree.coreLevel', { n: t }) : this.deps.t('tree.levelShort', { n: t }),
        words: this.wordsOf(node.id, t),
        done: this.tierComplete(level),
        modes: this.modesFor(level, node.id, t),
      });
    }
    return out;
  }

  /** The 5 activities for a tier, with sequential unlocking. */
  modesFor(level: number, nodeId: string, tier: number): TreeModeView[] {
    const authored = this.tierAuthored(nodeId, tier);
    return TREE_MODES.map((m, i) => {
      const passed = this.passedModes.has(`${level}:${m.mode}`);
      const prevPassed = i === 0 ? true : this.passedModes.has(`${level}:${TREE_MODES[i - 1].mode}`);
      const state: TreeNodeState = !authored ? 'locked' : passed ? 'done' : prevPassed ? 'active' : 'locked';
      return { modeIndex: i, id: m.id, mode: m.mode, route: m.route, icon: m.icon, labelKey: m.labelKey, state };
    });
  }

  // ── Launch ───────────────────────────────────────────────────────────────
  /** Launch a mode exercise for a node's tier (adds the Builder pool). */
  launchMode(nodeId: string, tier: number, modeIndex: number): void {
    if (!this.deckId) return;
    const level = this.levelOf(nodeId, tier);
    if (!level) return;
    const def = TREE_MODES[modeIndex];
    const queryParams: Record<string, string | number> = { level, mode: def.mode, from: this.deps.from };
    if (def.id === 'builder') {
      const pool = this.builderPoolLevels(nodeId, tier);
      if (pool.length) queryParams['pool'] = pool.join(',');
    }
    void this.deps.nav.navigateForward([def.route, this.deckId], { queryParams });
  }

  /**
   * Levels the Builder may combine with a tier:
   *  - theme tier T → Core tiers 1..T + the same theme's tiers 1..T-1;
   *  - Core tier N  → Core tiers 1..N-1 + every COMPLETED theme tier ≤ N-1.
   */
  builderPoolLevels(nodeId: string, tier: number): number[] {
    const levels: number[] = [];
    if (nodeId === 'core') {
      for (let t = 1; t < tier; t++) levels.push(coreLevelOf(t));
      THEME_DEFS.forEach((th, i) => {
        for (let t = 1; t <= Math.min(tier - 1, th.tiers.length); t++) {
          const lvl = themeLevelOf(i, t);
          if (this.tierComplete(lvl)) levels.push(lvl);
        }
      });
      return levels;
    }
    const i = THEME_DEFS.findIndex(th => th.id === nodeId);
    if (i < 0) return levels;
    for (let t = 1; t <= tier; t++) levels.push(coreLevelOf(t));
    for (let t = 1; t < tier; t++) levels.push(themeLevelOf(i, t));
    return levels;
  }

  // ── Admin ────────────────────────────────────────────────────────────────
  /** Admin: mark one mode of a tier passed. Caller reloads afterwards. */
  async adminCompleteMode(nodeId: string, tier: number, modeIndex: number): Promise<void> {
    if (!this.adminMode || !this.deckId) return;
    const level = this.levelOf(nodeId, tier);
    if (!level) return;
    const def = TREE_MODES[modeIndex];
    await this.passLevelMode(level, def.mode);
  }

  /** Admin: complete the next not-done tier of a node (all 5 modes). */
  async adminCompleteNextTier(node: TreeNode): Promise<void> {
    if (!this.adminMode) return;
    const avail = node.id === 'core' ? this.coreAvailTier : node.availTier;
    for (let tier = 1; tier <= avail; tier++) {
      if (node.id === 'core' && !this.tierAuthored('core', tier)) continue;
      const lvl = this.levelOf(node.id, tier);
      if (lvl && !this.tierComplete(lvl)) { await this.adminPassTier(lvl); return; }
    }
  }

  private async adminPassTier(level: number): Promise<void> {
    for (const m of TREE_MODES) await this.passLevelMode(level, m.mode);
  }

  private async passLevelMode(level: number, mode: string): Promise<void> {
    const cards = this.deps.flashcards.getLevelCards(this.deckId, level);
    const n = Math.max(1, cards.length);
    try {
      await this.deps.flashcards.saveLevelProgress(
        this.deckId, mode as Parameters<FlashcardService['saveLevelProgress']>[1], level, n, n,
      );
    } catch { /* best-effort */ }
  }
}
