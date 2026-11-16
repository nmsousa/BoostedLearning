/**
 * Explore+ Page — a STACKED vertical variant of Explore (Tree+).
 *
 * Where Explore shows a Core hero + a grid of themes, Explore+ lays the whole
 * curriculum out top-to-bottom BY TIER:
 *
 *   Core 1
 *   Themes (tier 1)…
 *   Core 2
 *   Themes (tier 2)…
 *   …
 *
 * so finishing a tier reveals the NEXT tier below it. Tapping a row opens the
 * level page shared with Explore (TierDetailPage). It reuses the same
 * TreeEngine (shared `tree-v2-<lang>` deck + progress), so it never drifts from
 * Explore / the radial Tree.
 *
 * @module app/maps/explore-plus
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { NavController, AlertController, ToastController } from '@ionic/angular';
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
  /** % of this tier completed (Learn + 5 games), for the progress bar. */
  percent: number;
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
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private backInterceptor = inject(BackInterceptorService);

  private engine = new TreeEngine({
    flashcards: this.flashcards,
    settings: this.settings,
    nav: this.navCtrl,
    t: (k, p) => this.i18n.t(k, p),
    from: JOURNEY_EXPLORE_PLUS_FROM,
  });

  private readonly onHardwareBack: () => boolean = () => { this.close(); return true; };

  isLoading = true;
  blocks: TierBlock[] = [];

  /** Row to pulse (gold) when we come back from a level page, or null. */
  pulseRowKey: string | null = null;

  /** True while the shared level page is open on top of this list; on coming
   *  back we scroll to + pulse the row to do next. */
  private leftToDetail = false;

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
    if (this.engine.deckId) {
      await this.load();
      // Back from a level page: show where to carry on (the next row to do).
      if (this.leftToDetail) {
        this.leftToDetail = false;
        this.pulseAndScroll(this.currentRowKey);
      }
    }
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
        percent: tierDef?.progress.percent ?? 0,
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

    // The row to focus = the first unlocked, not-done row (the learner's
    // current spot). Used for the one-time auto-scroll on open.
    this.currentRowKey = null;
    for (const b of this.blocks) {
      const row = b.rows.find(r => !r.locked && !r.done);
      if (row) { this.currentRowKey = this.rowKey(row); break; }
    }

    this.isLoading = false;
    this.cdr.detectChanges();

    // On first open this visit, jump to the current progress AND pulse that
    // next topic's border so the learner immediately sees where to continue.
    if (!this.didInitialScroll && this.currentRowKey) {
      this.didInitialScroll = true;
      this.pulseAndScroll(this.currentRowKey);
    }
  }

  /** Key of the row that represents the learner's current spot (first unlocked
   *  not-done row), for the auto-scroll + highlight on open. */
  currentRowKey: string | null = null;
  private didInitialScroll = false;

  // ── Admin reset ────────────────────────────────────────────────────────────
  async resetProgress(): Promise<void> {
    if (!this.adminMode) return;
    const alert = await this.alertCtrl.create({
      header: this.t('treePlus.resetConfirmTitle'),
      message: this.t('treePlus.resetConfirmBody'),
      buttons: [
        { text: this.t('common.cancel'), role: 'cancel' },
        { text: this.t('treePlus.resetConfirmYes'), role: 'destructive', handler: () => { void this.doReset(); } },
      ],
    });
    await alert.present();
  }

  private async doReset(): Promise<void> {
    await this.engine.adminResetProgress();
    this.didInitialScroll = false;
    await this.load();
    const toast = await this.toastCtrl.create({
      message: this.t('treePlus.resetDone'), duration: 2000, position: 'bottom',
    });
    await toast.present();
  }

  // ── Row tap → the shared LEVEL page ──────────────────────────────────────────
  rowKey(row: StackRow): string { return `${row.nodeId}:${row.tier}`; }

  toggleRow(row: StackRow): void {
    if (this.adminMode) {
      this.handleAdminDoubleTap(
        `row:${this.rowKey(row)}`,
        () => this.openDetail(row),
        () => this.adminComplete(row),
      );
      return;
    }
    this.openDetail(row);
  }

  /** Open the level page (shared with Explore) for this row's node + tier. */
  private openDetail(row: StackRow): void {
    if (row.locked || !row.tierDef) return;
    this.leftToDetail = true;
    void this.navCtrl.navigateForward(['/practice/tier', row.nodeId, row.tier], {
      queryParams: { origin: JOURNEY_EXPLORE_PLUS_FROM },
    });
  }

  private pulseAndScroll(rowKey: string | null): void {
    if (!rowKey) return;
    this.pulseRowKey = rowKey;
    this.cdr.detectChanges();
    void (async () => {
      await new Promise(r => setTimeout(r, 80));
      const el = document.querySelector(`app-explore-plus .ep-row[data-row-key="${rowKey}"]`);
      try { el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* ignore */ }
    })();
    setTimeout(() => { this.pulseRowKey = null; this.cdr.detectChanges(); }, 2600);
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

  // ── Misc ───────────────────────────────────────────────────────────────────
  close(): void { this.router.navigate(['/home']); }
  trackBlock(_i: number, b: TierBlock): number { return b.tier; }
  trackRow = (_i: number, r: StackRow): string => this.rowKey(r);
}
