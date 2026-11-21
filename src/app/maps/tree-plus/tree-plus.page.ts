/**
 * Tree+ / "Explore" Page — vertical layout over the Tree engine.
 *
 * Same curriculum, progression and progress as the radial Tree (it shares the
 * `tree-v2-<lang>` deck via TreeEngine), presented top-to-bottom instead of as
 * a star:
 *   - a hero "Core Vocabulary — Level N" card;
 *   - a "choose your next topic" two-column grid of theme cards (level + %);
 *   - a pinned Continue button that plays the next activity of the NEXT item
 *     (the Core, or a topic once the Core's level is done);
 *   - tapping a card opens the level page shared with Explore+ (TierDetailPage),
 *     where the activities are played (Learn, then any 5 of 7 games).
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
import { TreeEngine, type TreeNode } from '../tree/tree-engine';

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

  private readonly onHardwareBack: () => boolean = () => { this.close(); return true; };

  isLoading = true;
  switchingLanguage = false;

  core!: TreeNode;
  themes: TreeNode[] = [];
  /** Theme cards grouped into rows of two to match the 2-column grid. */
  themeRows: TreeNode[][] = [];

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
    // Chunk into rows of two so the grid stays a simple 2-column layout.
    this.themeRows = [];
    for (let i = 0; i < this.themes.length; i += 2) {
      this.themeRows.push(this.themes.slice(i, i + 2));
    }

    this.nextTargetId = this.computeNextTargetId();
    this.isLoading = false;
    this.switchingLanguage = false;
    this.cdr.detectChanges();

    // Celebrate finishing a whole level: when the Core's available tier has
    // advanced past what we last celebrated, Core N + ALL themes N are done —
    // so "Level N is complete, Level N+1 is now open". Shown once per level.
    void this.maybeCelebrateLevelUp();
  }

  // ── What to do next ──────────────────────────────────────────────────────────
  /** The node the learner should do NEXT: 'core', a theme id, or null when
   *  everything available is finished. The Core comes first whenever its
   *  current level isn't complete (topics of that level stay locked until it
   *  is); otherwise it's the first unlocked topic that still has work. It keeps
   *  a permanent gold highlight, a "Start lesson" pill, and is what Continue
   *  plays. */
  nextTargetId: string | null = null;

  private computeNextTargetId(): string | null {
    if (this.core && this.core.availTier > 0 && this.percentOf(this.core) < 100) return 'core';
    const t = this.themes.find(n => n.state !== 'locked' && n.availTier > 0 && this.percentOf(n) < 100);
    return t ? t.id : null;
  }

  /** True when this node is the one to do next. */
  isNext(node: TreeNode): boolean { return this.nextTargetId === node.id; }

  /** True when this node's CURRENT level is complete (its bar is at 100%).
   *  Such cards get a check and are shown muted so the eye goes to what's still
   *  to do. (Different from isFullyComplete, which means every level.) */
  isTierDone(node: TreeNode): boolean {
    return node.availTier > 0 && this.percentOf(node) >= 100;
  }

  /** Continue: launch the next activity of the next node (Core or a topic),
   *  like the Continue button in Explore+. */
  continueNext(): void {
    const id = this.nextTargetId;
    if (!id) return;
    const node = id === 'core' ? this.core : this.themes.find(n => n.id === id);
    if (!node) return;
    const tier = this.currentTier(node);
    const def = this.engine.tiersFor(node, tier).find(d => d.tier === tier);
    if (!def || def.progress.complete) return;
    const mode = def.modes.find(m => m.state === 'active');
    if (!mode) return;
    this.engine.launchMode(node.id, tier, mode.modeIndex);
  }

  // ── Celebrations (level up / topics unlocked) ────────────────────────────────
  /** localStorage key for the highest Core available-tier we've already
   *  celebrated (per lang) — the "all topics done → next Core unlocked" event. */
  private get levelUpKey(): string { return `boosted-tree-levelup-${this.learningLanguage}`; }
  /** localStorage key for the highest Core DONE level we've already celebrated
   *  (per lang) — the "finished Core N → its topics are now the thing to do". */
  private get coreDoneKey(): string { return `boosted-tree-coredone-${this.learningLanguage}`; }
  /** The Core available-tier seen on the PREVIOUS load this visit (−1 = not yet
   *  measured). A celebration fires only when a baseline INCREASES while the
   *  page is open — i.e. the user just finished something here — never merely
   *  because the level is already high when the page first opens. */
  private prevAvailTier = -1;
  /** Same idea for the Core's fully-completed level. */
  private prevCoreDone = -1;
  /** Each topic's done-level seen on the PREVIOUS load this visit (null = not
   *  yet measured). Lets us spot when ONE topic just got finished so we can
   *  scroll the learner to the next topic to tackle. */
  private prevTopicDone: Map<string, number> | null = null;

  private async maybeCelebrateLevelUp(): Promise<void> {
    const core = this.engine.coreNode();
    const availTier = core.availTier;
    const coreDone = core.doneLevel;

    // Snapshot each topic's done-level, and note which one just advanced.
    const topicDone = new Map(this.themes.map(n => [n.id, n.doneLevel]));
    let finishedTopicId: string | null = null;
    if (this.prevTopicDone) {
      for (const n of this.themes) {
        if (n.doneLevel > (this.prevTopicDone.get(n.id) ?? 0)) { finishedTopicId = n.id; break; }
      }
    }

    // Establish baselines on the FIRST measurement this visit without firing —
    // opening Explore at an already-high level must never pop a celebration.
    const firstMeasure = this.prevAvailTier < 0 || this.prevCoreDone < 0 || !this.prevTopicDone;
    const availGrew = this.prevAvailTier >= 0 && availTier > this.prevAvailTier;
    const coreDoneGrew = this.prevCoreDone >= 0 && coreDone > this.prevCoreDone;
    this.prevAvailTier = availTier;
    this.prevCoreDone = coreDone;
    this.prevTopicDone = topicDone;
    if (firstMeasure) return;

    // Priority 1: all topics at level N done → Core N+1 just unlocked.
    if (availGrew) { await this.celebrateCoreUnlocked(availTier); return; }

    // Priority 2: finished Core level N → every topic's level N is now the
    // place to grind. Scroll to the FIRST topic.
    if (coreDoneGrew) { await this.celebrateTopicsUnlocked(coreDone); return; }

    // Priority 3 (quiet): finished a SINGLE topic's tier → scroll to the next
    // topic that still needs work. No modal for this smaller milestone.
    if (finishedTopicId) void this.scrollToNextTopic();
  }

  /** After finishing one topic, scroll to the topic that's now next. */
  private async scrollToNextTopic(): Promise<void> {
    const id = this.nextTargetId;
    if (id && id !== 'core') await this.scrollToTopic(id);
  }

  /** "All topics done → next Core unlocked": announce + bring the Core into view. */
  private async celebrateCoreUnlocked(availTier: number): Promise<void> {
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
    // The Core (now the next thing to do, and highlighted) comes into view.
    await this.scrollToTop();
  }

  /** "Finished Core N → its topics are now the thing to do": announce + scroll
   *  to the FIRST topic (now open at the new level and highlighted as next). */
  private async celebrateTopicsUnlocked(coreDone: number): Promise<void> {
    if (coreDone < 1) return;

    // Once per completed Core level (survives reloads).
    let lastCelebrated = 0;
    try { lastCelebrated = Number(localStorage.getItem(this.coreDoneKey) ?? 0); } catch { /* ignore */ }
    if (coreDone <= lastCelebrated) return;
    try { localStorage.setItem(this.coreDoneKey, String(coreDone)); } catch { /* ignore */ }

    const firstTopic = this.themes[0];
    if (!firstTopic) return;

    const alert = await this.alertCtrl.create({
      header: this.t('treePlus.coreDoneTitle', { n: coreDone }),
      message: this.t('treePlus.coreDoneBody', { n: coreDone }),
      buttons: [{ text: this.t('treePlus.levelUpGo'), role: 'confirm' }],
      cssClass: 'tp-levelup-alert',
    });
    await alert.present();
    await alert.onDidDismiss();
    await this.scrollToTopic(this.nextTargetId && this.nextTargetId !== 'core' ? this.nextTargetId : firstTopic.id);
  }

  /** Smooth-scroll the Explore content back to the top (to the Core card). */
  private async scrollToTop(): Promise<void> {
    const content = document.querySelector('app-tree-plus ion-content') as HTMLIonContentElement | null;
    try { await content?.scrollToTop?.(400); } catch { /* ignore */ }
  }

  /** Smooth-scroll a specific topic card into view (centred). */
  private async scrollToTopic(topicId: string): Promise<void> {
    // Let the view settle before measuring.
    await new Promise(r => setTimeout(r, 60));
    const el = document.querySelector(`app-tree-plus .tp-topic[data-topic-id="${topicId}"]`);
    try { el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* ignore */ }
  }

  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    this.switchingLanguage = true;
    this.cdr.detectChanges();
    await this.flashcards.initialize();
    await this.load();
  }

  // ── Progress display ────────────────────────────────────────────────────────
  /**
   * The tier the card currently REPRESENTS: the lowest AVAILABLE tier that
   * isn't complete; or, if every available tier is complete, the highest
   * available tier (shown at 100% until the next one opens).
   *
   * Crucially it does NOT jump to doneLevel+1 the instant a tier completes — so
   * finishing the last activity reads "100%", not "0% of the next tier". When
   * the next tier actually unlocks (availTier grows), the card moves to it at 0%.
   */
  currentTier(node: TreeNode): number {
    const avail = Math.max(1, node.availTier);
    for (let t = 1; t <= avail; t++) {
      const lvl = this.engine.levelOf(node.id, t);
      if (lvl && this.engine.tierAuthored(node.id, t) && !this.engine.tierComplete(lvl)) return t;
    }
    return avail;   // all available tiers complete → the highest one (100%)
  }

  /** "% done" of the current tier under the Learn + 5-of-7-games rule. */
  percentOf(node: TreeNode): number {
    if (node.availTier <= 0) return 0;
    return this.engine.tierPercent(node.id, this.currentTier(node));
  }

  /** True only when a node has finished its LAST authored tier — i.e. there's
   *  nothing left to do. Drives the "completed" label. A node that finished an
   *  EARLIER level (with more to come) is NOT fully complete. */
  isFullyComplete(node: TreeNode): boolean {
    return node.maxTier > 0 && node.doneLevel >= node.maxTier;
  }

  /** Short state label for a node card. Shows the CURRENT (1-based) level the
   *  learner is working toward. Only a node that has finished its LAST authored
   *  tier reads "completed". */
  nodeStatus(node: TreeNode): string {
    if (node.state === 'locked') return this.t('tree.comingSoon');
    if (this.isFullyComplete(node)) return this.t('tree.unit.done');
    return this.t('tree.levelShort', { n: this.currentTier(node) });
  }

  /** The small line under a topic's name. The level is already shown on the Core
   *  card, so repeating "Level 2" on every topic is noise: a topic only shows a
   *  level when it is NOT the Core's current level. Otherwise it shows "Coming
   *  soon" (locked), "Completed", or nothing. */
  topicStatus(node: TreeNode): string {
    if (node.state === 'locked') return this.t('tree.comingSoon');
    if (this.isFullyComplete(node)) return this.t('tree.unit.done');
    const level = this.currentTier(node);
    return level === this.currentTier(this.core) ? '' : this.t('tree.levelShort', { n: level });
  }

  // ── Open a card → the shared level page ──────────────────────────────────────
  toggleNode(node: TreeNode): void {
    if (this.adminMode) {
      this.handleAdminDoubleTap(`node:${node.id}`, () => this.openDetail(node), () => this.adminComplete(node));
      return;
    }
    this.openDetail(node);
  }

  /** Open the level page (shared with Explore+) for this node's current level. */
  private openDetail(node: TreeNode): void {
    if (node.state === 'locked' || node.availTier === 0) return;
    void this.navCtrl.navigateForward(['/practice/tier', node.id, this.currentTier(node)], {
      queryParams: { origin: JOURNEY_TREE_PLUS_FROM },
    });
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
   * (they share one deck). Reloads the map.
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
    try { localStorage.removeItem(this.levelUpKey); } catch { /* ignore */ }
    try { localStorage.removeItem(this.coreDoneKey); } catch { /* ignore */ }
    this.prevAvailTier = -1;   // re-baseline so the reset doesn't trigger a celebration
    this.prevCoreDone = -1;
    this.prevTopicDone = null;
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

  // ── Misc ─────────────────────────────────────────────────────────────────
  close(): void { this.router.navigate(['/home']); }
  trackNode(_i: number, n: TreeNode): string { return n.id; }
  /** Stable key for a theme row: the ids of its (up to two) cards. */
  trackRow(_i: number, row: TreeNode[]): string { return row.map(n => n.id).join('|'); }

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
