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
    // own pages but are part of the PracticeMode union, so cover them here too.
    const labels: Record<PracticeMode, string> = {
      flip: 'Flashcards', write: 'Write', match: 'Match', quiz: 'Quiz',
      journey: 'Journey', builder: 'Builder',
    };
    return labels[this.mode];
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
    if (modeParam && ['flip', 'write', 'match', 'quiz'].includes(modeParam)) {
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
    // Recompute which level is "current" / its knowledge colour on every load.
    this.currentLevelCache.clear();
    this.knowledgeColorCache.clear();
    this.knowledgeCache.clear();

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

  /** Flashcards is free practice: coloured by word knowledge, not rounds/stars. */
  get isFlipMode(): boolean {
    return this.mode === 'flip';
  }

  // Memoised per deck+level so the *ngFor binding is cheap under OnPush.
  private knowledgeColorCache = new Map<string, 'none' | 'red' | 'yellow' | 'green'>();
  /** Knowledge colour for a Flashcards level card (see service / doc §6b). */
  levelKnowledgeColor(deckId: string, level: DeckLevel): 'none' | 'red' | 'yellow' | 'green' {
    const key = `${deckId}:${level.levelNumber}`;
    if (!this.knowledgeColorCache.has(key)) {
      this.knowledgeColorCache.set(key, this.flashcardService.getLevelKnowledgeColor(deckId, level.levelNumber));
    }
    return this.knowledgeColorCache.get(key)!;
  }

  private knowledgeCache = new Map<string, { total: number; learning: number; familiar: number; known: number; neverStudied: number }>();
  /** Knowledge breakdown counts for a Flashcards level (for the segmented bar). */
  levelKnowledge(deckId: string, level: DeckLevel) {
    const key = `${deckId}:${level.levelNumber}`;
    if (!this.knowledgeCache.has(key)) {
      this.knowledgeCache.set(key, this.flashcardService.getLevelKnowledge(deckId, level.levelNumber));
    }
    return this.knowledgeCache.get(key)!;
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
