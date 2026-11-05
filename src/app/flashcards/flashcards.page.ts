/**
 * Flashcards Page - Quizlet-style deck management and study
 * 
 * Shows imported decks with levels, allows import from Duolingo, and starts study sessions.
 * 
 * @module app/flashcards
 */

import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ActionSheetController, AlertController } from '@ionic/angular';
import { FlashcardService, FlashcardDeck, DeckLevel, PracticeMode } from '../services/flashcard.service';
import { I18nAngularService } from '../services/i18n.service';
import { SettingsService } from '../services/settings.service';
import { AddWordService } from '../services/add-word.service';

/** Deck list ordering preference. */
type DeckOrder = 'builtinFirst' | 'customFirst';

/** A selectable learning language for the header flag picker. */
interface LangOption { code: string; name: string; flagUrl: string; }

@Component({
  selector: 'app-flashcards',
  templateUrl: './flashcards.page.html',
  styleUrls: ['./flashcards.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashcardsPage implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private alertController = inject(AlertController);
  private actionSheet = inject(ActionSheetController);
  private flashcardService = inject(FlashcardService);
  private i18n = inject(I18nAngularService);
  private settings = inject(SettingsService);
  private addWordService = inject(AddWordService);
  private cdr = inject(ChangeDetectorRef);

  // ── Header language flag (mirrors the homepage selector) ───────────────────
  /** Languages the user can learn, derived from available decks. */
  availableLanguages: LangOption[] = [];

  /** Maps a language/course code to its flag country code (same as homepage). */
  private flagUrl(code: string): string {
    const toCountry: Record<string, string> = {
      nl: 'nl', dn: 'nl', fr: 'fr', es: 'es', it: 'it', de: 'de', pt: 'pt',
      en: 'gb', da: 'dk', el: 'gr', ja: 'jp', ko: 'kr', zs: 'cn', uk: 'ua',
      nb: 'no', he: 'il', hi: 'in', vi: 'vn', cs: 'cz', sv: 'se', ga: 'ie',
      gd: 'gb', cy: 'gb', hw: 'us', ht: 'ht', zu: 'za', sw: 'ke',
    };
    return `https://flagcdn.com/${toCountry[code] ?? code}.svg`;
  }

  private refreshLanguages(): void {
    this.availableLanguages = this.flashcardService
      .getAvailableLanguages()
      .map(l => ({ ...l, flagUrl: this.flagUrl(l.code) }));
  }

  /** Currently selected learning-language code. */
  get learningLanguage(): string {
    return this.settings.learningLanguage();
  }

  /** The flag/name for the currently selected learning language. */
  get currentLanguage(): LangOption {
    return (
      this.availableLanguages.find(l => l.code === this.learningLanguage) ??
      this.availableLanguages[0] ?? {
        code: this.learningLanguage,
        name: this.learningLanguage.toUpperCase(),
        flagUrl: this.flagUrl(this.learningLanguage),
      }
    );
  }

  /** Switch learning language and reload this mode's deck list for it. */
  async selectLanguage(code: string): Promise<void> {
    if (code === this.learningLanguage) return;
    this.settings.updateSetting('learningLanguage', code);
    // Mirror the proven load path (ngOnInit / ionViewWillEnter): ensure the
    // service is initialised (idempotent) BEFORE reloading, then run change
    // detection. Doing loadDecks() alone raced the deck data and sometimes
    // rendered an empty list until a manual refresh.
    this.isLoading = true;
    this.cdr.detectChanges();
    await this.flashcardService.initialize();
    await this.loadDecks();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  /**
   * Header "⋮" menu for the deck list: add a word, and (when there's a custom
   * deck) choose the deck ordering. Keeps the list uncluttered.
   */
  async openMenu(): Promise<void> {
    const buttons: any[] = [];

    // "Add a new word" now lives on the "Your words" screen (vocabulary
    // management), so it's intentionally NOT offered here any more.

    // Quick study: practice the whole deck with no level/stars. Targets the
    // first (current-language) deck.
    const quickDeck = this.decks[0];
    if (quickDeck) {
      buttons.push({
        text: this.t('practice.quickStudy'),
        icon: 'flash-outline',
        handler: () => { void this.startQuickStudy(quickDeck); },
      });
    }

    if (this.hasCustomDecks()) {
      buttons.push(
        {
          text: this.t('practice.order.builtinFirst') + (this.deckOrder === 'builtinFirst' ? '  ✓' : ''),
          icon: 'albums-outline',
          handler: () => this.setDeckOrder('builtinFirst'),
        },
        {
          text: this.t('practice.order.customFirst') + (this.deckOrder === 'customFirst' ? '  ✓' : ''),
          icon: 'person-outline',
          handler: () => this.setDeckOrder('customFirst'),
        }
      );
    }

    // Report a problem — available on the levels list too (no specific word
    // here, so the feedback form uses the generic intro).
    buttons.push({
      text: this.t('feedback.report'),
      icon: 'flag-outline',
      handler: () => {
        void this.addWordService.reportProblem({
          languageCode: this.settings.learningLanguage(),
          modeName: this.modeLabel,
          reportContext: 'generic',
        });
      },
    });

    buttons.push({ text: this.t('common.cancel'), icon: 'close-outline', role: 'cancel' });

    // Reuse the shared menu styling (tightened icon↔label gap, aligned Cancel).
    const sheet = await this.actionSheet.create({ buttons, cssClass: 'mode-menu-sheet' });
    await sheet.present();
  }

  /** Reload decks + levels after a change (e.g. a word was added). */
  private async reloadAfterChange(): Promise<void> {
    await this.loadDecks();
    this.cdr.detectChanges();
  }

  /** Practice mode chosen on the home page (defaults to Flashcards flip). */
  mode: PracticeMode = 'flip';

  /** Human label for the active mode, shown in the header. */
  get modeLabel(): string {
    // Only the four original modes use this page; journey/builder have their
    // own pages. The journey-* node modes never route here. Partial map + a
    // sensible fallback covers the whole PracticeMode union.
    const labels: Partial<Record<PracticeMode, string>> = {
      flip: 'Flashcards', write: 'Write', match: 'Match', quiz: 'Quiz',
      journey: 'Journey', builder: 'Builder', blanks: 'Blanks',
    };
    return labels[this.mode] ?? 'Flashcards';
  }

  /** Icon for the active mode, matching the homepage mode-grid icons. */
  get modeIcon(): string {
    const icons: Partial<Record<PracticeMode, string>> = {
      flip: 'albums-outline', write: 'create-outline', match: 'git-compare-outline',
      quiz: 'help-circle-outline', journey: 'map-outline', builder: 'construct-outline',
      blanks: 'reorder-four-outline',
    };
    return icons[this.mode] ?? 'albums-outline';
  }

  /** Icon colour for the active mode — same accent as the homepage cards. */
  get modeIconColor(): string {
    const colors: Partial<Record<PracticeMode, string>> = {
      flip: 'primary', write: 'secondary', match: 'tertiary',
      quiz: 'success', journey: 'warning', builder: 'tertiary', blanks: 'danger',
    };
    return colors[this.mode] ?? 'primary';
  }

  decks: FlashcardDeck[] = [];
  deckLevels: Map<string, DeckLevel[]> = new Map();
  /**
   * Deck ids the user has explicitly collapsed. Decks default to OPEN, so we
   * only need to remember which ones were closed. Persisted in localStorage.
   */
  private collapsedDecks: Set<string> = this.loadCollapsed();
  isLoading = true;

  /** How decks are ordered in the list; persisted in localStorage. */
  deckOrder: DeckOrder = this.loadDeckOrder();

  private static readonly COLLAPSED_KEY = 'boosted-learning-collapsed-decks';
  private static readonly ORDER_KEY = 'boosted-learning-deck-order';

  private loadDeckOrder(): DeckOrder {
    try {
      const raw = localStorage.getItem(FlashcardsPage.ORDER_KEY);
      if (raw === 'customFirst' || raw === 'builtinFirst') return raw;
    } catch {
      // Ignore unavailable storage.
    }
    return 'builtinFirst';
  }

  setDeckOrder(order: DeckOrder): void {
    this.deckOrder = order;
    try {
      localStorage.setItem(FlashcardsPage.ORDER_KEY, order);
    } catch {
      // Ignore storage errors.
    }
    this.sortDecks();
    // Called from the header action sheet (outside template event binding),
    // so explicitly mark the view for update under OnPush.
    this.cdr.detectChanges();
  }

  /** Order decks by the current preference (stable within each group). */
  private sortDecks(): void {
    const rank = (d: FlashcardDeck) =>
      this.deckOrder === 'customFirst'
        ? (d.isBundled ? 1 : 0)
        : (d.isBundled ? 0 : 1);
    this.decks = [...this.decks].sort((a, b) => rank(a) - rank(b));
  }

  private loadCollapsed(): Set<string> {
    try {
      const raw = localStorage.getItem(FlashcardsPage.COLLAPSED_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // Ignore malformed/unavailable storage.
    }
    return new Set();
  }

  private saveCollapsed(): void {
    try {
      localStorage.setItem(
        FlashcardsPage.COLLAPSED_KEY,
        JSON.stringify([...this.collapsedDecks])
      );
    } catch {
      // Ignore storage errors.
    }
  }

  async ngOnInit() {
    // Mode chosen on the home page; defaults to Flashcards (flip).
    const modeParam = this.route.snapshot.queryParamMap.get('mode') as PracticeMode | null;
    if (modeParam && ['flip', 'write', 'match', 'quiz', 'blanks'].includes(modeParam)) {
      this.mode = modeParam;
    }

    try {
      await this.flashcardService.initialize();
      await this.loadDecks();
    } catch (e) {
      console.error('[FlashcardsPage] Error during init:', e);
    }
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  async ionViewWillEnter() {
    await this.flashcardService.initialize();
    await this.loadDecks();
    this.cdr.detectChanges();
  }

  async loadDecks() {
    // Recompute which level is "current" / its knowledge breakdown on every load.
    this.currentLevelCache.clear();
    this.knowledgeCache.clear();
    // Keep the header flag picker's options in sync with available decks.
    this.refreshLanguages();

    // Show only decks for the currently-selected learning language. User-added
    // decks (no languageCode match) and the selected language's bundled deck.
    const lang = this.settings.learningLanguage();
    const all = this.flashcardService.getAllDecks();
    this.decks = all.filter(d => d.languageCode === lang);
    // Fallback: if nothing matches (e.g. a user deck with a different code),
    // show everything so the screen isn't empty.
    if (this.decks.length === 0) this.decks = all;
    
    // Apply the user's deck-order preference.
    this.sortDecks();

    // Load levels for each deck, and precompute the header stats ONCE so the
    // template binds to plain data instead of calling methods every change
    // detection cycle (which was recomputing deduped cards / star totals per
    // tick for every deck).
    this.deckStats.clear();
    for (const deck of this.decks) {
      const levels = await this.flashcardService.getDeckLevels(deck.id, this.mode);
      this.deckLevels.set(deck.id, levels);

      const totalStars = levels.reduce((sum, l) => sum + l.bestStars, 0);
      this.deckStats.set(deck.id, {
        uniqueCount: this.flashcardService.getDedupedCards(deck.id).length,
        levelCount: levels.length,
        customCount: deck.cards.filter(c => c.isCustom).length,
        totalStars,
        maxStars: levels.length * 3,
      });
    }
  }

  /** Precomputed per-deck header stats (filled in loadDecks). */
  deckStats = new Map<string, {
    uniqueCount: number;
    levelCount: number;
    customCount: number;
    totalStars: number;
    maxStars: number;
  }>();

  /** Stable identity for *ngFor so Angular doesn't rebuild rows each tick. */
  trackByDeckId = (_: number, deck: FlashcardDeck) => deck.id;
  trackByLevelNumber = (_: number, level: DeckLevel) => level.levelNumber;

  getDeckStats(deck: FlashcardDeck) {
    return this.flashcardService.getDeckStats(deck.id);
  }

  /** True if any shown deck is user-added (so the Built-in badge is meaningful). */
  hasCustomDecks(): boolean {
    return this.decks.some(d => !d.isBundled);
  }

  /** Format a best-time (seconds) as m:ss for the level cards (Match only). */
  formatBestTime(seconds: number | undefined): string {
    if (seconds === undefined) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds) % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /** The level list currently belongs to the timed (Match) mode. */
  get isMatchMode(): boolean {
    return this.mode === 'match';
  }

  /**
   * Whether this mode earns STARS per level. Flashcards (flip) is self-rated
   * ("just click"), so stars there are meaningless — hidden. Write, Quiz and
   * Match all score meaningfully.
   */
  get showStars(): boolean {
    return this.mode !== 'flip';
  }

  /**
   * Flashcards is free practice: no stars/rounds, and no "current" highlight.
   * Instead each level shows a knowledge breakdown (learning/familiar/known) as
   * a pie ring around the number + a count legend. The level word set is fixed,
   * so the breakdown is well-defined; it just moves gradually as you practise.
   */
  get isFlipMode(): boolean {
    return this.mode === 'flip';
  }

  // ── Flashcards knowledge breakdown (pie ring + legend) ─────────────────────
  // Memoised per deck+level so the OnPush template can call these freely.
  private knowledgeCache = new Map<string, { total: number; learning: number; familiar: number; known: number; neverStudied: number }>();

  levelKnowledge(deckId: string, level: DeckLevel) {
    const key = `${deckId}:${level.levelNumber}`;
    if (!this.knowledgeCache.has(key)) {
      this.knowledgeCache.set(key, this.flashcardService.getLevelKnowledge(deckId, level.levelNumber));
    }
    return this.knowledgeCache.get(key)!;
  }

  /** True once at least one of the level's words has been practised. */
  hasKnowledge(deckId: string, level: DeckLevel): boolean {
    const k = this.levelKnowledge(deckId, level);
    return k.learning + k.familiar + k.known > 0;
  }

  /**
   * Pie-ring arcs for a Flashcards level: one coloured segment per non-empty
   * bucket, laid end-to-end around the ring (r=17). Each arc carries the
   * `dasharray` (arc length + gap) and `dashoffset` to position it. Proportions
   * are over ALL words in the level, so unstudied words leave a grey remainder
   * (the `.ring-track` circle shows through) instead of letting a single
   * studied word fill the whole ring.
   */
  levelPieSegments(deckId: string, level: DeckLevel): { cls: string; dash: string; offset: number }[] {
    const k = this.levelKnowledge(deckId, level);
    const practised = k.learning + k.familiar + k.known;
    // Nothing studied → no colour (fully grey). Total 0 guards divide-by-zero.
    if (practised === 0 || k.total === 0) return [];
    const C = 2 * Math.PI * 17; // circumference ≈ 106.8
    const buckets: { cls: string; n: number }[] = [
      { cls: 'seg-known', n: k.known },
      { cls: 'seg-familiar', n: k.familiar },
      { cls: 'seg-learning', n: k.learning },
    ];
    const segs: { cls: string; dash: string; offset: number }[] = [];
    let used = 0;
    for (const b of buckets) {
      if (b.n <= 0) continue;
      // Fraction of the WHOLE level, not just the practised words — so the
      // coloured arcs stop short and leave grey for the unstudied remainder.
      const len = (b.n / k.total) * C;
      segs.push({ cls: b.cls, dash: `${len} ${C - len}`, offset: -used });
      used += len;
    }
    return segs;
  }

  getLevels(deckId: string): DeckLevel[] {
    return this.deckLevels.get(deckId) ?? [];
  }

  toggleDeckExpand(deckId: string) {
    // Decks default to open; the set tracks the ones explicitly collapsed.
    if (this.collapsedDecks.has(deckId)) {
      this.collapsedDecks.delete(deckId);
    } else {
      this.collapsedDecks.add(deckId);
    }
    this.saveCollapsed();
  }

  isDeckExpanded(deckId: string): boolean {
    // With a single deck there's nothing to gain from collapsing, so it's
    // always open. Otherwise: open unless the user explicitly collapsed it.
    if (this.decks.length <= 1) return true;
    return !this.collapsedDecks.has(deckId);
  }

  getStarArray(count: number): number[] {
    return Array(count).fill(0);
  }

  getEmptyStarArray(count: number): number[] {
    return Array(3 - count).fill(0);
  }

  /**
   * `stroke-dasharray` for the level progress ring: fills stars/3 of the
   * circle. Circle radius is 17 → circumference ≈ 106.8. First value is the
   * filled arc length, second is the remaining gap.
   */
  ringDash(stars: number): string {
    const circumference = 2 * Math.PI * 17; // ≈ 106.8
    const filled = (Math.max(0, Math.min(3, stars)) / 3) * circumference;
    return `${filled} ${circumference - filled}`;
  }

  /** Ring dash for the 5-round model: fills roundsCompleted / 5. */
  ringDashRounds(rounds: number): string {
    const circumference = 2 * Math.PI * 17;
    const filled = (Math.max(0, Math.min(5, rounds)) / 5) * circumference;
    return `${filled} ${circumference - filled}`;
  }

  /**
   * The "current" level to highlight for a deck: the next one to PLAY, i.e. the
   * first unlocked level the user hasn't started yet (0 rounds done). Only if
   * every unlocked level has already been started do we fall back to the first
   * one that isn't fully complete. This makes the highlight point FORWARD (to
   * the next new level), not back at an already-played one.
   * Memoised per deck id so the *ngFor binding stays cheap under OnPush.
   */
  private currentLevelCache = new Map<string, number>();
  isCurrentLevel(deckId: string, level: DeckLevel): boolean {
    if (!this.currentLevelCache.has(deckId)) {
      const levels = this.getLevels(deckId);
      // A level counts as "complete" when all rounds are done, OR (legacy
      // records written before rounds existed) it already has stars.
      const isComplete = (l: DeckLevel) =>
        l.roundsCompleted >= this.totalRoundsConst || (l.roundsCompleted === 0 && l.bestStars >= 1);
      const next =
        // Prefer the first unlocked level not started AND not complete.
        levels.find(l => l.isUnlocked && l.roundsCompleted === 0 && !isComplete(l)) ??
        // Else the first unlocked, incomplete level (partially played).
        levels.find(l => l.isUnlocked && !isComplete(l)) ??
        // Else nothing to highlight (everything complete).
        undefined;
      this.currentLevelCache.set(deckId, next?.levelNumber ?? -1);
    }
    return this.currentLevelCache.get(deckId) === level.levelNumber;
  }

  /** Rounds that make up a level (mirrors the service constant). */
  private readonly totalRoundsConst = 5;

  getTotalStars(deckId: string): number {
    const levels = this.getLevels(deckId);
    return levels.reduce((sum, level) => sum + level.bestStars, 0);
  }

  /** Number of manually-added cards in a deck (drives the "custom" badge). */
  getCustomCardCount(deck: FlashcardDeck): number {
    return deck.cards.filter(c => c.isCustom).length;
  }

  /** Number of unique prompts in a deck (after collapsing shared prompts). */
  getUniqueCardCount(deck: FlashcardDeck): number {
    return this.flashcardService.getDedupedCards(deck.id).length;
  }

  getMaxStars(deckId: string): number {
    return this.getLevels(deckId).length * 3;
  }

  /** Vocabulary management (import / add / export) lives in Settings now. */
  goToVocabularySettings() {
    this.router.navigate(['/settings']);
  }

  async startLevel(deck: FlashcardDeck, level: DeckLevel) {
    if (!level.isUnlocked) return;
    await this.launchMode(deck, level.levelNumber);
  }

  async startQuickStudy(deck: FlashcardDeck) {
    // Quick study without level restrictions.
    await this.launchMode(deck, 0);
  }

  /**
   * Launch the currently-selected practice mode for a deck/level.
   * level 0 = no level filter (quick study).
   */
  private async launchMode(deck: FlashcardDeck, level: number) {
    const queryParams = level > 0 ? { level } : undefined;

    switch (this.mode) {
      case 'flip':
        this.router.navigate(['/practice/flip', deck.id], { queryParams });
        break;
      case 'write':
        this.router.navigate(['/practice/write', deck.id], { queryParams });
        break;
      case 'match':
        this.router.navigate(['/practice/match', deck.id], { queryParams });
        break;
      case 'quiz':
        this.router.navigate(['/practice/quiz', deck.id], { queryParams });
        break;
      case 'blanks':
        this.router.navigate(['/practice/blanks', deck.id], { queryParams });
        break;
    }
  }

  async confirmDeleteDeck(deck: FlashcardDeck) {
    const alert = await this.alertController.create({
      header: 'Delete Deck',
      message: `Are you sure you want to delete "${deck.name}" with ${deck.cards.length} cards? This cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await this.flashcardService.deleteDeck(deck.id);
            await this.loadDecks();
            this.cdr.detectChanges();
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmResetProgress(deck: FlashcardDeck) {
    const alert = await this.alertController.create({
      header: 'Reset Progress',
      message: `Reset all progress for "${deck.name}"? Your cards will remain but all stats and stars will be cleared.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Reset',
          role: 'destructive',
          handler: async () => {
            await this.flashcardService.resetDeckProgress(deck.id);
            await this.loadDecks();
            this.cdr.detectChanges();
          },
        },
      ],
    });
    await alert.present();
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
