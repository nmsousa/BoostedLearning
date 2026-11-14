/**
 * Tree+ Page (EXPERIMENTAL — vertical layout over the Tree engine)
 *
 * Same curriculum, progression and progress as the radial Tree (it shares the
 * `tree-v2-<lang>` deck via TreeEngine), presented top-to-bottom instead of as
 * a star:
 *   - a hero "Core Vocabulary — Level N" card;
 *   - a "choose your next topic" two-column grid of theme cards (level + %);
 *   - a "Next: Core N — locked / unlocked" strip;
 *   - tapping a node expands, inline, its levels and the five activities
 *     (Cards → Quiz → Write → Match → Builder), launched like the Tree.
 *
 * All logic lives in TreeEngine so this view and the star view never drift.
 *
 * @module app/maps/tree-plus
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
import { JOURNEY_TREE_PLUS_FROM } from '../journey/journey-back';
import { TreeEngine, type TreeNode, type TreeTier } from '../tree/tree-engine';

@Component({
  selector: 'app-tree-plus',
  templateUrl: './tree-plus.page.html',
  styleUrls: ['./tree-plus.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreePlusPage implements OnInit, OnDestroy {
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
    from: JOURNEY_TREE_PLUS_FROM,
  });

  private readonly onHardwareBack: () => boolean = () => {
    if (this.expandedId) { this.collapse(); return true; }
    this.close();
    return true;
  };

  isLoading = true;
  switchingLanguage = false;

  core!: TreeNode;
  themes: TreeNode[] = [];
  /** Theme cards grouped into rows of two to match the 2-column grid. */
  themeRows: TreeNode[][] = [];
  /** The next Core tier that will unlock (for the "Next: Core N" strip). */
  nextCoreTier = 0;
  nextCoreUnlocked = false;

  /** Expanded node id ('core' or a theme id), null = none. */
  expandedId: string | null = null;
  /** Tier numbers whose word list is currently expanded (words are hidden by
   *  default; the user toggles them per tier). Cleared when a node collapses. */
  private openWordTiers = new Set<number>();
  expandedTitle = '';
  expandedEmoji = '';
  /** Tiers of the expanded node (newest first), with words + activities. */
  expandedTiers: TreeTier[] = [];

  availableLanguages: { code: string; name: string; flagUrl: string }[] = [];

  get learningLanguage(): string { return this.settings.learningLanguage(); }
  get currentLanguage() {
    return (
      this.availableLanguages.find(l => l.code === this.learningLanguage) ??
      this.availableLanguages[0] ??
      { code: this.learningLanguage, name: this.learningLanguage.toUpperCase(), flagUrl: this.flagUrl(this.learningLanguage) }
    );
  }
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
    this.availableLanguages = this.flashcards.getAvailableLanguages().map(l => ({ ...l, flagUrl: this.flagUrl(l.code) }));
    await this.engine.load();
    this.core = this.engine.coreNode();
    this.themes = this.engine.themeNodes();
    // Chunk into rows of two so the inline expansion can be placed AFTER a
    // complete grid row (both cards), never between a row's two columns.
    this.themeRows = [];
    for (let i = 0; i < this.themes.length; i += 2) {
      this.themeRows.push(this.themes.slice(i, i + 2));
    }

    // "Next: Core N" strip — the tier after the Core's current done level.
    this.nextCoreTier = Math.min(this.engine.authoredCoreTiers, this.core.doneLevel + 1);
    this.nextCoreUnlocked = this.core.availTier > this.core.doneLevel;

    if (this.expandedId) this.refreshExpanded();
    this.isLoading = false;
    this.switchingLanguage = false;
    this.cdr.detectChanges();

    // Celebrate finishing a whole level: when the Core's available tier has
    // advanced past what we last celebrated, Core N + ALL themes N are done —
    // so "Level N is complete, Level N+1 is now open". Shown once per level.
    void this.maybeCelebrateLevelUp();
  }

  /** localStorage key for the highest level we've already celebrated (per lang). */
  private get levelUpKey(): string { return `boosted-tree-levelup-${this.learningLanguage}`; }
  /** The Core available-tier seen on the PREVIOUS load this visit (−1 = not yet
   *  measured). The celebration only fires when this INCREASES while the page
   *  is open — i.e. the user just finished the level here — never merely
   *  because the level is already high when the page first opens. */
  private prevAvailTier = -1;

  private async maybeCelebrateLevelUp(): Promise<void> {
    const availTier = this.engine.coreNode().availTier;

    // First measurement this visit: record the baseline and DON'T celebrate.
    // Opening Explore at an already-high level must never pop the modal.
    if (this.prevAvailTier < 0) { this.prevAvailTier = availTier; return; }

    // Only celebrate a genuine increase that happened while the page was open.
    if (availTier <= this.prevAvailTier) { this.prevAvailTier = availTier; return; }
    this.prevAvailTier = availTier;

    // The Core's available tier N means levels 1..N-1 are each fully complete.
    const completedLevel = availTier - 1;
    if (completedLevel < 1) return;

    // Never repeat a level we've already celebrated (survives reloads).
    let lastCelebrated = 0;
    try { lastCelebrated = Number(localStorage.getItem(this.levelUpKey) ?? 0); } catch { /* ignore */ }
    if (completedLevel <= lastCelebrated) return;
    try { localStorage.setItem(this.levelUpKey, String(completedLevel)); } catch { /* ignore */ }

    const nextLevel = completedLevel + 1;
    const alert = await this.alertCtrl.create({
      header: this.t('treePlus.levelUpTitle', { n: completedLevel }),
      message: this.t('treePlus.levelUpBody', { done: completedLevel, next: nextLevel }),
      buttons: [{ text: this.t('treePlus.levelUpGo'), role: 'confirm' }],
      cssClass: 'tp-levelup-alert',
    });
    await alert.present();
    await alert.onDidDismiss();
    // Bring the Core card (now showing the newly-unlocked level) into view at
    // the top and pulse it so the learner notices they can play it now.
    this.collapse();
    await this.scrollToTop();
    this.pulseCore = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.pulseCore = false; this.cdr.detectChanges(); }, 2600);
  }

  /** True briefly after a level-up to pulse the Core hero card's border. */
  pulseCore = false;

  /** Smooth-scroll the Explore content back to the top (to the Core card). */
  private async scrollToTop(): Promise<void> {
    const content = document.querySelector('app-tree-plus ion-content') as HTMLIonContentElement | null;
    try { await content?.scrollToTop?.(400); } catch { /* ignore */ }
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

  // ── Progress display ────────────────────────────────────────────────────────
  /**
   * The 1-based tier the learner is CURRENTLY working toward for a node.
   * = doneLevel + 1 (the next tier), capped at the node's authored maxTier, and
   * never below 1. So a node fully done at tier 1 but whose tier 2 exists reads
   * "Level 2" (at 0%) even before tier 2 is unlocked — the card shows the next
   * goal, not "completed". A node done at its LAST tier reads that last tier.
   */
  currentTier(node: TreeNode): number {
    const next = node.doneLevel + 1;
    return Math.min(Math.max(1, next), Math.max(1, node.maxTier));
  }

  /**
   * "% learned" for a node, scoped to the tier the learner is CURRENTLY on —
   * i.e. the passed activities of the open tier over its total activities.
   *
   * Earlier this averaged over ALL unlocked tiers, so finishing a tier and
   * unlocking the next made the bar jump to ~50% (the done tier dragged it up)
   * even though the new tier was untouched. Scoping to the current tier makes a
   * freshly-unlocked tier correctly read 0%, climbing to 100% as you complete
   * its activities, then resetting to 0% when the next tier opens.
   */
  percentOf(node: TreeNode): number {
    if (node.availTier <= 0) return 0;
    const tier = this.currentTier(node);
    // If the current-goal tier is BEYOND what's done (e.g. a theme whose tier 2
    // isn't started/unlocked yet), it reads 0% — not the completed tier's 100%.
    if (tier > node.doneLevel) {
      // Unless that tier is actually in progress (some of its modes passed).
      const lvl = this.engine.levelOf(node.id, tier);
      const modes = lvl ? this.engine.modesFor(lvl, node.id, tier) : [];
      if (!modes.length || modes.every(m => m.state !== 'done')) return 0;
      return Math.round((modes.filter(m => m.state === 'done').length / modes.length) * 100);
    }
    // The goal tier is the done tier (node finished its last authored tier) → 100%.
    return 100;
  }

  /** True only when a node has finished its LAST authored tier — i.e. there's
   *  nothing left to do. Drives the green "done" check badge and the
   *  "completed" label. A node that finished an EARLIER level (with more to
   *  come) is NOT fully complete — it's working toward the next level. */
  isFullyComplete(node: TreeNode): boolean {
    return node.maxTier > 0 && node.doneLevel >= node.maxTier;
  }

  /** Words list visibility (hidden by default) for a tier. */
  isWordsOpen(tier: number): boolean { return this.openWordTiers.has(tier); }
  toggleWords(tier: number): void {
    if (this.openWordTiers.has(tier)) this.openWordTiers.delete(tier);
    else this.openWordTiers.add(tier);
    this.cdr.detectChanges();
  }

  /** Short state label for a node card. Shows the CURRENT (1-based) level the
   *  learner is working toward, so a fresh node reads "Level 1" and a node that
   *  just finished a level reads the NEXT level (not "completed"). Only a node
   *  that has finished its LAST authored tier reads "completed". */
  nodeStatus(node: TreeNode): string {
    if (node.state === 'locked') return this.t('tree.comingSoon');
    if (this.isFullyComplete(node)) return this.t('tree.unit.done');
    return this.t('tree.levelShort', { n: this.currentTier(node) });
  }

  // ── Expand / collapse (inline) ────────────────────────────────────────────
  private openTierFor(node: TreeNode): number {
    return this.engine.openTierFor(node.doneLevel, node.availTier);
  }

  toggleNode(node: TreeNode): void {
    if (this.adminMode) {
      this.handleAdminDoubleTap(`node:${node.id}`, () => this.expandNode(node), () => this.adminComplete(node));
      return;
    }
    this.expandNode(node);
  }

  private expandNode(node: TreeNode): void {
    if (node.state === 'locked' || node.availTier === 0) return;
    if (this.expandedId === node.id) { this.collapse(); return; }
    this.expandedId = node.id;
    this.expandedTitle = node.title;
    this.expandedEmoji = node.emoji;
    const maxTier = this.openTierFor(node); // reached tier
    this.expandedTiers = this.engine.tiersFor(node, maxTier).reverse(); // newest first
    this.cdr.detectChanges();
  }

  collapse(): void {
    this.expandedId = null;
    this.expandedTiers = [];
    this.openWordTiers.clear();
    this.cdr.detectChanges();
  }

  private refreshExpanded(): void {
    const node = this.expandedId === 'core' ? this.core : this.themes.find(n => n.id === this.expandedId);
    if (!node) { this.collapse(); return; }
    this.expandedTitle = node.title;
    this.expandedEmoji = node.emoji;
    const maxTier = this.openTierFor(node);
    this.expandedTiers = maxTier ? this.engine.tiersFor(node, maxTier).reverse() : [];
  }

  // ── Launch ─────────────────────────────────────────────────────────────────
  /** Launch a MIX session (several activity types) for a tier's level — a
   *  "play a bit of everything" shortcut, not a completion node. Returns here. */
  launchMix(tier: TreeTier): void {
    if (!this.engine.deckId) return;
    this.navCtrl.navigateForward(['/practice/mix', this.engine.deckId], {
      queryParams: { level: tier.level, from: JOURNEY_TREE_PLUS_FROM },
    });
  }

  onModeTap(tier: TreeTier, modeIndex: number): void {
    const m = tier.modes[modeIndex];
    if (m.state === 'locked') return;
    if (this.adminMode) {
      this.handleAdminDoubleTap(
        `mode:${this.expandedId}:${tier.tier}:${m.id}`,
        () => this.engine.launchMode(this.expandedId!, tier.tier, modeIndex),
        () => this.adminCompleteMode(tier.tier, modeIndex),
      );
      return;
    }
    this.engine.launchMode(this.expandedId!, tier.tier, modeIndex);
  }

  // ── Admin double-tap ─────────────────────────────────────────────────────
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
    }, TreePlusPage.DOUBLE_TAP_MS);
  }

  /**
   * ADMIN: wipe all Tree progress after a confirm. Resets the shared
   * tree-v2-<lang> deck, so BOTH the radial Tree and Tree+ go back to scratch
   * (they share one deck). Collapses any open node and reloads the map.
   */
  async resetProgress(): Promise<void> {
    if (!this.adminMode) return;
    const alert = await this.alertCtrl.create({
      header: this.t('treePlus.resetConfirmTitle'),
      message: this.t('treePlus.resetConfirmBody'),
      buttons: [
        { text: this.t('common.cancel'), role: 'cancel' },
        {
          text: this.t('treePlus.resetConfirmYes'),
          role: 'destructive',
          handler: () => { void this.doReset(); },
        },
      ],
    });
    await alert.present();
  }

  private async doReset(): Promise<void> {
    this.collapse();
    try { localStorage.removeItem(this.levelUpKey); } catch { /* ignore */ }
    this.prevAvailTier = -1;   // re-baseline so the reset doesn't trigger a celebration
    await this.engine.adminResetProgress();
    await this.load();
    const toast = await this.toastCtrl.create({
      message: this.t('treePlus.resetDone'),
      duration: 2000,
      position: 'bottom',
    });
    await toast.present();
  }

  private async adminComplete(node: TreeNode): Promise<void> {
    await this.engine.adminCompleteNextTier(node);
    await this.load();
  }

  private async adminCompleteMode(tier: number, modeIndex: number): Promise<void> {
    if (!this.expandedId) return;
    await this.engine.adminCompleteMode(this.expandedId, tier, modeIndex);
    await this.load();
  }

  // ── Misc ─────────────────────────────────────────────────────────────────
  close(): void { this.router.navigate(['/home']); }
  trackNode(_i: number, n: TreeNode): string { return n.id; }
  /** Stable key for a theme row: the ids of its (up to two) cards. */
  trackRow(_i: number, row: TreeNode[]): string { return row.map(n => n.id).join('|'); }
  /** True when the currently expanded theme belongs to this row. */
  rowHasExpanded(row: TreeNode[]): boolean {
    return this.expandedId != null && row.some(n => n.id === this.expandedId);
  }
  trackTier(_i: number, t: TreeTier): number { return t.tier; }
  trackMode(_i: number, m: { id: string }): string { return m.id; }

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
