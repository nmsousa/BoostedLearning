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
import { NavController, AlertController, ToastController } from '@ionic/angular';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { JOURNEY_EXPLORE_PLUS_FROM } from '../journey/journey-back';
import { TreeEngine, type TreeNode, type TreeTier, type TreeModeView } from '../tree/tree-engine';

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
  /** % of this tier's activities passed (0–100), for the progress bar. */
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

  private readonly onHardwareBack: () => boolean = () => {
    if (this.view === 'detail') { this.backToList(); return true; }
    this.close();
    return true;
  };

  isLoading = true;
  blocks: TierBlock[] = [];

  /** The current view: the stacked LIST, or a node's DETAIL (modes + Continue). */
  view: 'list' | 'detail' = 'list';
  /** Detail view state: which node/tier is open and its modes. */
  detail: {
    nodeId: string; tier: number; title: string; emoji: string; hue: number;
    kind: 'core' | 'theme'; tierDef: TreeTier;
  } | null = null;

  /** Row to pulse (gold) when we return to the list after finishing, or null. */
  pulseRowKey: string | null = null;

  /** Detail view: whether the tier's word list is expanded. Collapsed by
   *  default (like Explore) so the activities are the focus; tap "Show words"
   *  to peek at them. Reset to collapsed whenever a new detail opens. */
  wordsOpen = false;

  get adminMode(): boolean { return this.engine.adminMode; }

  /** The first not-yet-passed activity in the detail tier (what Continue plays);
   *  null when every required mode is done. */
  get nextMode(): TreeModeView | null {
    const modes = this.detail?.tierDef.modes ?? [];
    return modes.find(m => m.state === 'active') ?? null;
  }
  /** True when the detail tier is fully complete (all required modes done). */
  get detailComplete(): boolean {
    const modes = this.detail?.tierDef.modes ?? [];
    return modes.length > 0 && modes.every(m => m.state === 'done');
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
    if (this.engine.deckId) {
      await this.load();
      // Returning from a mode into the detail view: if that tier is now fully
      // complete, slide back to the list and highlight the next row to do (the
      // same "finish → advance + gold pulse" cue as Explore).
      if (this.view === 'detail' && this.detailComplete) {
        setTimeout(() => this.backToList(), 500);
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
      const modes = tierDef?.modes ?? [];
      const percent = modes.length
        ? Math.round((modes.filter(m => m.state === 'done').length / modes.length) * 100)
        : 0;
      return {
        nodeId: node.id, title: node.title, emoji: node.emoji, hue: node.hue, tier,
        tierDef, kind, locked: !reached, done: !!tierDef?.done, percent,
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

    // If a detail view is open (e.g. we just came back from a mode exercise),
    // refresh its tier from the reloaded engine so the mode states/Continue
    // update. If that tier vanished (shouldn't happen), fall back to the list.
    if (this.detail) {
      for (const b of this.blocks) {
        const row = b.rows.find(r => r.nodeId === this.detail!.nodeId && r.tier === this.detail!.tier);
        if (row?.tierDef) { this.detail = { ...this.detail, tierDef: row.tierDef }; break; }
      }
    }

    this.isLoading = false;
    this.cdr.detectChanges();

    // On first open this visit, jump to the current progress AND pulse that
    // next topic's border so the learner immediately sees where to continue.
    if (!this.didInitialScroll && this.currentRowKey && this.view === 'list') {
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
    this.view = 'list';
    this.detail = null;
    await this.engine.adminResetProgress();
    this.didInitialScroll = false;
    await this.load();
    const toast = await this.toastCtrl.create({
      message: this.t('treePlus.resetDone'), duration: 2000, position: 'bottom',
    });
    await toast.present();
  }

  // ── Row tap → DETAIL view ──────────────────────────────────────────────────
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

  /** Open the node/tier's DETAIL view (modes + Continue), decision A: an
   *  in-page view swap so the loaded engine + return-highlight stay seamless. */
  private openDetail(row: StackRow): void {
    if (row.locked || !row.tierDef) return;
    this.detail = {
      nodeId: row.nodeId, tier: row.tier, title: row.title, emoji: row.emoji,
      hue: row.hue, kind: row.kind, tierDef: row.tierDef,
    };
    this.wordsOpen = false;      // start collapsed each time a detail opens
    this.view = 'detail';
    this.cdr.detectChanges();
    void this.scrollDetailTop();
  }

  /** Detail view: show/hide the tier's word list. */
  toggleWords(): void { this.wordsOpen = !this.wordsOpen; this.cdr.detectChanges(); }

  /** Back from detail → the list, pulsing the row we came from so the learner
   *  sees where they are (and, if that tier is now done, the next row). */
  backToList(): void {
    const from = this.detail ? `${this.detail.nodeId}:${this.detail.tier}` : null;
    this.view = 'list';
    this.detail = null;
    this.cdr.detectChanges();
    // Pulse + scroll: if the tier we just left is complete, highlight the next
    // current row; otherwise re-highlight the one we came from.
    const target = this.currentRowKey ?? from;
    this.pulseAndScroll(target);
  }

  private async scrollDetailTop(): Promise<void> {
    await new Promise(r => setTimeout(r, 40));
    const el = document.querySelector('app-explore-plus ion-content');
    try { (el as HTMLIonContentElement | null)?.scrollToTop?.(0); } catch { /* ignore */ }
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

  /** Continue: play the next not-done required mode of the detail tier. */
  continueDetail(): void {
    const m = this.nextMode;
    if (!m || !this.detail) return;
    this.engine.launchMode(this.detail.nodeId, this.detail.tier, m.modeIndex);
  }

  /** Optional Flashcards review for the detail tier (never gates completion). */
  reviewDetail(): void {
    if (!this.detail) return;
    this.engine.launchReview(this.detail.nodeId, this.detail.tier);
  }

  /** Tap a specific activity in the detail list. */
  onModeTap(m: TreeModeView): void {
    if (m.state === 'locked' || !this.detail) return;
    if (this.adminMode) {
      this.handleAdminDoubleTap(
        `mode:${this.detail.nodeId}:${this.detail.tier}:${m.id}`,
        () => this.engine.launchMode(this.detail!.nodeId, this.detail!.tier, m.modeIndex),
        () => this.adminCompleteMode(this.detail!.nodeId, this.detail!.tier, m.modeIndex),
      );
      return;
    }
    this.engine.launchMode(this.detail.nodeId, this.detail.tier, m.modeIndex);
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
