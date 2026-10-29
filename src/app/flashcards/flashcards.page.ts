/**
 * Flashcards Page - Quizlet-style deck management and study
 * 
 * Shows imported decks with levels, allows import from Duolingo, and starts study sessions.
 * 
 * @module app/flashcards
 */

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { FlashcardService, FlashcardDeck, DeckLevel, PracticeMode } from '../services/flashcard.service';
import { I18nAngularService } from '../services/i18n.service';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-flashcards',
  templateUrl: './flashcards.page.html',
  styleUrls: ['./flashcards.page.scss'],
  standalone: false,
})
export class FlashcardsPage implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private alertController = inject(AlertController);
  private flashcardService = inject(FlashcardService);
  private i18n = inject(I18nAngularService);
  private settings = inject(SettingsService);
  private cdr = inject(ChangeDetectorRef);

  /** Practice mode chosen on the home page (defaults to Flashcards flip). */
  mode: PracticeMode = 'flip';

  /** Human label for the active mode, shown in the header. */
  get modeLabel(): string {
    return { flip: 'Flashcards', write: 'Write', match: 'Match', quiz: 'Quiz' }[this.mode];
  }

  decks: FlashcardDeck[] = [];
  deckLevels: Map<string, DeckLevel[]> = new Map();
  expandedDecks: Set<string> = new Set();
  isLoading = true;

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
    // Show only decks for the currently-selected learning language. User-added
    // decks (no languageCode match) and the selected language's bundled deck.
    const lang = this.settings.learningLanguage();
    const all = this.flashcardService.getAllDecks();
    this.decks = all.filter(d => d.languageCode === lang);
    // Fallback: if nothing matches (e.g. a user deck with a different code),
    // show everything so the screen isn't empty.
    if (this.decks.length === 0) this.decks = all;
    
    // Load levels for each deck
    for (const deck of this.decks) {
      const levels = await this.flashcardService.getDeckLevels(deck.id, this.mode);
      this.deckLevels.set(deck.id, levels);
    }

    // With a single deck there's no reason to keep it collapsed - open it so
    // the levels are visible immediately.
    if (this.decks.length === 1) {
      this.expandedDecks.add(this.decks[0].id);
    }
  }

  getDeckStats(deck: FlashcardDeck) {
    return this.flashcardService.getDeckStats(deck.id);
  }

  getLevels(deckId: string): DeckLevel[] {
    return this.deckLevels.get(deckId) ?? [];
  }

  toggleDeckExpand(deckId: string) {
    if (this.expandedDecks.has(deckId)) {
      this.expandedDecks.delete(deckId);
    } else {
      this.expandedDecks.add(deckId);
    }
  }

  isDeckExpanded(deckId: string): boolean {
    return this.expandedDecks.has(deckId);
  }

  getStarArray(count: number): number[] {
    return Array(count).fill(0);
  }

  getEmptyStarArray(count: number): number[] {
    return Array(3 - count).fill(0);
  }

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
        this.router.navigate(['/flashcards/flip', deck.id], { queryParams });
        break;
      case 'write':
        this.router.navigate(['/flashcards/write', deck.id], { queryParams });
        break;
      case 'match':
        this.router.navigate(['/flashcards/match', deck.id], { queryParams });
        break;
      case 'quiz':
        this.router.navigate(['/flashcards/quiz', deck.id], { queryParams });
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
