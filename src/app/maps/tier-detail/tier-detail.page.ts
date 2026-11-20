/**
 * Tier Detail Page — the ONE level page shared by Explore and Explore+.
 *
 * Tapping a Core/topic card in either list opens this page for that node's
 * level (tier): its words (hidden behind a toggle), the Learn step, and the 7
 * games. A level is complete when Learn is done and ANY 5 of the 7 games are
 * passed (in any order) — the other two are optional. A pinned Continue plays
 * the next activity; an optional Flashcards review sits underneath.
 *
 * It runs its own TreeEngine over the shared `tree-v2-<lang>` deck, so progress
 * never drifts from the lists. Exercises launched from here return to THIS page
 * (see journeyBackUrl's 'tier-detail'), and once a finished level comes back it
 * returns to the list so the next thing to do is highlighted there.
 *
 * @module app/maps/tier-detail
 */

import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { FlashcardService } from '../../services/flashcard.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import {
  JOURNEY_TIER_DETAIL_FROM, JOURNEY_TREE_PLUS_FROM, tierOriginUrl,
} from '../journey/journey-back';
import { TreeEngine, type TreeNode, type TreeTier, type TreeModeView } from '../tree/tree-engine';

@Component({
  selector: 'app-tier-detail',
  templateUrl: './tier-detail.page.html',
  styleUrls: ['./tier-detail.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TierDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  private flashcards = inject(FlashcardService);
  private settings = inject(SettingsService);
  private i18n = inject(I18nAngularService);
  private cdr = inject(ChangeDetectorRef);
  private backInterceptor = inject(BackInterceptorService);

  /** Which node ('core' or a theme id) and tier this page shows. */
  nodeId = '';
  tier = 1;
  /** The list page we came from ('tree-plus' = Explore, 'explore-plus'). */
  origin: string = JOURNEY_TREE_PLUS_FROM;

  private engine = new TreeEngine({
    flashcards: this.flashcards,
    settings: this.settings,
    nav: this.navCtrl,
    t: (k, p) => this.i18n.t(k, p),
    from: JOURNEY_TIER_DETAIL_FROM,
    // Launched exercises return to this exact level page.
    extraQuery: () => ({ tierNode: this.nodeId, tierTier: this.tier, tierOrigin: this.origin }),
  });

  isLoading = true;
  node: TreeNode | null = null;
  tierDef: TreeTier | null = null;
  /** Tiers of this node that are open to play (for the level switcher). */
  tierChoices: number[] = [];
  /** Whether the words list is expanded (collapsed by default). */
  wordsOpen = false;

  /** True once we've launched an exercise from here, so on coming back we know
   *  to bounce a now-finished level back to the list. */
  private launched = false;

  private readonly onHardwareBack: () => boolean = () => { this.back(); return true; };

  get adminMode(): boolean { return this.engine.adminMode; }
  get originUrl(): string { return tierOriginUrl(this.origin); }

  t(key: string, params?: Record<string, string | number>): string { return this.i18n.t(key, params); }

  // ── Derived view state ────────────────────────────────────────────────────
  get progress() { return this.tierDef?.progress ?? null; }
  /** Learn + enough games passed: the level is complete. */
  get complete(): boolean { return !!this.tierDef?.progress.complete; }
  get learnMode(): TreeModeView | null { return this.tierDef?.modes.find(m => m.id === 'learn') ?? null; }
  get gameModes(): TreeModeView[] { return (this.tierDef?.modes ?? []).filter(m => m.id !== 'learn'); }
  /** What Continue plays: the first playable, not-passed activity (Learn first,
   *  then the games in order). None once the level is complete. */
  get nextMode(): TreeModeView | null {
    if (this.complete) return null;
    return (this.tierDef?.modes ?? []).find(m => m.state === 'active') ?? null;
  }
  isNext(m: TreeModeView): boolean { return this.nextMode?.id === m.id; }
  /** After completing, the games not yet played are just extra practice. */
  isOptional(m: TreeModeView): boolean { return this.complete && m.state !== 'done'; }
  /** The games stay locked until Learn is done. */
  get gamesLocked(): boolean { return !!this.progress && !this.progress.learnDone; }

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    const p = this.route.snapshot.paramMap;
    this.nodeId = p.get('nodeId') ?? 'core';
    // parseInt (not Number) so a mangled value like '1?origin=tree-plus' still reads as 1.
    this.tier = Math.max(1, parseInt(p.get('tier') ?? '1', 10) || 1);
    this.origin = this.route.snapshot.queryParamMap.get('origin') ?? JOURNEY_TREE_PLUS_FROM;
    await this.flashcards.initialize();
    await this.load();
  }

  ngOnDestroy(): void { this.backInterceptor.clear(this.onHardwareBack); }

  async ionViewWillEnter(): Promise<void> {
    this.backInterceptor.register(this.onHardwareBack);
    if (!this.engine.deckId) return;
    await this.load();
    // Coming back from an exercise: if that finished the level, go back to the
    // list so the next thing to do is highlighted there.
    if (this.launched && this.complete) {
      this.launched = false;
      setTimeout(() => this.back(), 500);
    }
  }

  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); }

  private async load(): Promise<void> {
    await this.engine.load();
    const node = this.nodeId === 'core'
      ? this.engine.coreNode()
      : this.engine.themeNodes().find(n => n.id === this.nodeId) ?? null;
    if (!node) { this.back(); return; }
    this.node = node;

    this.tierChoices = [];
    for (let t = 1; t <= node.availTier; t++) {
      if (this.engine.tierAuthored(node.id, t)) this.tierChoices.push(t);
    }
    // Land on a tier that's actually open.
    if (!this.tierChoices.includes(this.tier)) this.tier = this.tierChoices[this.tierChoices.length - 1] ?? 1;

    this.tierDef = this.engine.tiersFor(node, this.tier).find(d => d.tier === this.tier) ?? null;
    if (!this.tierDef) { this.back(); return; }

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  back(): void { this.navCtrl.navigateBack(this.originUrl); }

  toggleWords(): void { this.wordsOpen = !this.wordsOpen; this.cdr.detectChanges(); }

  /** Switch to another open level of this node (e.g. replay an earlier one). */
  selectTier(t: number): void {
    if (t === this.tier || !this.node) return;
    this.tier = t;
    this.wordsOpen = false;
    this.tierDef = this.engine.tiersFor(this.node, t).find(d => d.tier === t) ?? this.tierDef;
    this.cdr.detectChanges();
  }

  continueNext(): void {
    const m = this.nextMode;
    if (m) this.launch(m);
  }

  /** Optional Flashcards review for this level (never gates completion). */
  review(): void {
    this.launched = true;
    this.engine.launchReview(this.nodeId, this.tier);
  }

  onModeTap(m: TreeModeView): void {
    if (m.state === 'locked') return;
    if (this.adminMode) {
      this.handleAdminDoubleTap(
        `mode:${this.nodeId}:${this.tier}:${m.id}`,
        () => this.launch(m),
        () => void this.adminCompleteMode(m),
      );
      return;
    }
    this.launch(m);
  }

  private launch(m: TreeModeView): void {
    this.launched = true;
    this.engine.launchMode(this.nodeId, this.tier, m.modeIndex);
  }

  // ── Admin double-tap (complete a mode instantly) ────────────────────────────
  private static readonly DOUBLE_TAP_MS = 320;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTapKey: string | null = null;

  private handleAdminDoubleTap(key: string, single: () => void, double: () => void): void {
    if (this.tapTimer && this.pendingTapKey === key) {
      clearTimeout(this.tapTimer); this.tapTimer = null; this.pendingTapKey = null;
      double();
      return;
    }
    if (this.tapTimer) clearTimeout(this.tapTimer);
    this.pendingTapKey = key;
    this.tapTimer = setTimeout(() => {
      this.tapTimer = null; this.pendingTapKey = null; single();
    }, TierDetailPage.DOUBLE_TAP_MS);
  }

  private async adminCompleteMode(m: TreeModeView): Promise<void> {
    await this.engine.adminCompleteMode(this.nodeId, this.tier, m.modeIndex);
    await this.load();
  }

  trackMode(_i: number, m: { id: string }): string { return m.id; }
  trackTier(_i: number, t: number): number { return t; }
}
