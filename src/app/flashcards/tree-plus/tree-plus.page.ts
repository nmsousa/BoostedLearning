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
 * @module app/flashcards/tree-plus
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
  /** The next Core tier that will unlock (for the "Next: Core N" strip). */
  nextCoreTier = 0;
  nextCoreUnlocked = false;

  /** Expanded node id ('core' or a theme id), null = none. */
  expandedId: string | null = null;
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

    // "Next: Core N" strip — the tier after the Core's current done level.
    this.nextCoreTier = Math.min(this.engine.authoredCoreTiers, this.core.doneLevel + 1);
    this.nextCoreUnlocked = this.core.availTier > this.core.doneLevel;

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

  // ── Progress display ────────────────────────────────────────────────────────
  /** Rough "% learned" for a node = passed activities / (availTier × 5). */
  percentOf(node: TreeNode): number {
    const tiers = node.availTier;
    if (tiers <= 0) return 0;
    let passed = 0;
    for (let t = 1; t <= tiers; t++) {
      const level = this.engine.levelOf(node.id, t);
      if (!level) continue;
      for (const m of this.engine.modesFor(level, node.id, t)) if (m.state === 'done') passed++;
    }
    return Math.round((passed / (tiers * this.engine.modes.length)) * 100);
  }

  /** Short state label for a node card. */
  nodeStatus(node: TreeNode): string {
    if (node.state === 'locked') return this.t('tree.comingSoon');
    if (node.state === 'done') return this.t('tree.unit.done');
    return this.t('tree.levelShort', { n: node.doneLevel });
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
