/**
 * Explore+ Page — a STACKED vertical variant of Explore (Tree+).
 *
 * Where Explore shows a Core hero + a grid of themes (each expanding to its
 * tiers), Explore+ lays the whole curriculum out top-to-bottom BY TIER:
 *
 *   Core 1
 *   Themes (tier 1)…
 *   Core 2
 *   Themes (tier 2)…
 *   …
 *
 * so finishing a tier reveals the NEXT tier below it, instead of the Core card
 * mutating in place. It reuses the same TreeEngine (shared `tree-v2-<lang>`
 * deck + progress), so it never drifts from Explore / the radial Tree.
 *
 * @module app/maps/explore-plus
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { JOURNEY_EXPLORE_PLUS_FROM } from '../journey/journey-back';
import { TreeEngine, type TreeNode, type TreeTier } from '../tree/tree-engine';

/** One row in the stacked list: a node's single tier (Core or a theme). */
interface StackRow {
  nodeId: string;
  title: string;
  emoji: string;
  hue: number;
  tier: number;
  /** The tier view model (words + activities), or null if locked/unauthored. */
  tierDef: TreeTier | null;
  /** 'core' rows are visually distinguished as the tier header. */
  kind: 'core' | 'theme';
  locked: boolean;
  done: boolean;
}

/** A tier block: the Core tier followed by that tier's themes. */
interface TierBlock {
  tier: number;
  rows: StackRow[];
}

@Component({
  selector: 'app-explore-plus',
  templateUrl: './explore-plus.page.html',
  styleUrls: ['./explore-plus.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorePlusPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private cdr = inject(ChangeDetectorRef);
  private navCtrl = inject(NavController);
  private backInterceptor = inject(BackInterceptorService);

  private engine = new TreeEngine({
    flashcards: this.flashcards,
    settings: this.settings,
    nav: this.navCtrl,
    t: (k, p) => this.i18n.t(k, p),
    from: JOURNEY_EXPLORE_PLUS_FROM,
  });

  private readonly onHardwareBack: () => boolean = () => {
    if (this.expandedKey) { this.collapse(); return true; }
    this.close();
    return true;
  };

  isLoading = true;
  blocks: TierBlock[] = [];

  /** Expanded row key ("nodeId:tier"), null = none. */
  expandedKey: string | null = null;
  expandedTier: TreeTier | null = null;
  expandedTitle = '';

  get adminMode(): boolean { return this.engine.adminMode; }

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
    if (this.engine.deckId) await this.load();
  }

  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); }

  private async load(): Promise<void> {
    await this.engine.load();
    const core = this.engine.coreNode();
    const themes = this.engine.themeNodes();

    // How many tiers to show: up to the highest tier ANY node has reached (so
    // the next tier appears once unlocked), capped at the Core's authored tiers.
    const maxTier = Math.max(
      core.availTier,
      ...themes.map(t => t.availTier),
      1,
    );

    const tierRow = (node: TreeNode, kind: 'core' | 'theme', tier: number): StackRow => {
      const reached = tier <= node.availTier && this.engine.tierAuthored(node.id, tier);
      const defs = reached ? this.engine.tiersFor(node, tier) : [];
      const tierDef = defs.find(d => d.tier === tier) ?? null;
      return {
        nodeId: node.id, title: node.title, emoji: node.emoji, hue: node.hue, tier,
        tierDef, kind, locked: !reached, done: !!tierDef?.done,
      };
    };

    this.blocks = [];
    for (let tier = 1; tier <= maxTier; tier++) {
      const rows: StackRow[] = [];
      // Core first…
      if (this.engine.tierAuthored('core', tier)) rows.push(tierRow(core, 'core', tier));
      // …then that tier's themes (only themes that author this tier).
      for (const th of themes) {
        if (tier <= th.maxTier) rows.push(tierRow(th, 'theme', tier));
      }
      if (rows.length) this.blocks.push({ tier, rows });
    }

    if (this.expandedKey) this.refreshExpanded();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  // ── Expand / collapse ──────────────────────────────────────────────────────
  rowKey(row: StackRow): string { return `${row.nodeId}:${row.tier}`; }

  toggleRow(row: StackRow): void {
    if (this.adminMode) {
      this.handleAdminDoubleTap(
        `row:${this.rowKey(row)}`,
        () => this.expandRow(row),
        () => this.adminComplete(row),
      );
      return;
    }
    this.expandRow(row);
  }

  private expandRow(row: StackRow): void {
    if (row.locked || !row.tierDef) return;
    const key = this.rowKey(row);
    if (this.expandedKey === key) { this.collapse(); return; }
    this.expandedKey = key;
    this.expandedTier = row.tierDef;
    this.expandedTitle = row.title;
    this.cdr.detectChanges();
  }

  collapse(): void {
    this.expandedKey = null;
    this.expandedTier = null;
    this.cdr.detectChanges();
  }

  private refreshExpanded(): void {
    if (!this.expandedKey) return;
    const [nodeId, tierStr] = this.expandedKey.split(':');
    const tier = Number(tierStr);
    for (const b of this.blocks) {
      const row = b.rows.find(r => r.nodeId === nodeId && r.tier === tier);
      if (row?.tierDef) { this.expandedTier = row.tierDef; return; }
    }
    this.collapse();
  }

  isExpanded(row: StackRow): boolean { return this.expandedKey === this.rowKey(row); }

  /** Launch an activity of the currently expanded row's tier. */
  onModeTap(modeIndex: number): void {
    if (!this.expandedKey || !this.expandedTier) return;
    const [nodeId] = this.expandedKey.split(':');
    const m = this.expandedTier.modes[modeIndex];
    if (m.state === 'locked') return;
    if (this.adminMode) {
      this.handleAdminDoubleTap(
        `mode:${this.expandedKey}:${m.id}`,
        () => this.engine.launchMode(nodeId, this.expandedTier!.tier, modeIndex),
        () => this.adminCompleteMode(nodeId, this.expandedTier!.tier, modeIndex),
      );
      return;
    }
    this.engine.launchMode(nodeId, this.expandedTier.tier, modeIndex);
  }

  // ── Admin double-tap ───────────────────────────────────────────────────────
  private static readonly DOUBLE_TAP_MS = 320;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTapKey: string | null = null;

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
    }, ExplorePlusPage.DOUBLE_TAP_MS);
  }

  private async adminComplete(row: StackRow): Promise<void> {
    const node = row.nodeId === 'core' ? this.engine.coreNode()
      : this.engine.themeNodes().find(n => n.id === row.nodeId);
    if (node) { await this.engine.adminCompleteNextTier(node); await this.load(); }
  }

  private async adminCompleteMode(nodeId: string, tier: number, modeIndex: number): Promise<void> {
    await this.engine.adminCompleteMode(nodeId, tier, modeIndex);
    await this.load();
  }

  // ── Misc ───────────────────────────────────────────────────────────────────
  close(): void { this.router.navigate(['/home']); }
  trackBlock(_i: number, b: TierBlock): number { return b.tier; }
  trackRow = (_i: number, r: StackRow): string => this.rowKey(r);
  trackMode(_i: number, m: { id: string }): string { return m.id; }
}
