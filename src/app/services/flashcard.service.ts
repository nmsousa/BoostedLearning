/**
 * Flashcard Service - Quizlet-style spaced repetition
 * 
 * Manages vocabulary decks with two sources:
 * 1. Bundled decks (JSON files in assets) - shared with all users
 * 2. User-imported decks - stored in IndexedDB
 * 
 * Progress for all cards is stored in IndexedDB.
 * 
 * @module app/services
 */

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { fsrs, createEmptyCard, Rating, State, type Card as FsrsCard } from 'ts-fsrs';
import { getDatabase, FlashcardDeckEntity, FlashcardEntity, LevelProgressEntity } from '../../persistence/database';

/** Self-rating options in Flashcards (flip) mode. */
export type FlashcardRating = 'hard' | 'medium' | 'easy';

/**
 * A practice mode. Level stars/progress are tracked PER MODE so that, e.g.,
 * clearing a level in Flashcards does not mark it complete in Match.
 * ('quiz' is defined for completeness but not yet implemented.)
 */
export type PracticeMode = 'flip' | 'write' | 'match' | 'quiz';

/**
 * A single flashcard with learning stats
 */
export interface Flashcard {
  id: string;
  deckId: string;
  text: string;
  translations: string[];
  audioUrl?: string;
  
  // Learning stats (persisted)
  correctCount: number;
  incorrectCount: number;
  lastSeen: string | null;
  nextReview: string | null;
  streak: number;

  /**
   * true = manually added by the user. Not part of the shipped app data,
   * so it only exists in this device's storage and is lost on reinstall /
   * device change unless exported. Drives the "custom" badge and export.
   */
  isCustom?: boolean;

  /**
   * Computed (not persisted): all target-language forms that share this card's
   * primary English translation, e.g. "the" -> [de, het]. Populated when the
   * deck is de-duplicated into unique prompts for the level system.
   */
  acceptedForms?: string[];

  /** Serialized FSRS state (JSON) for Flashcards flip mode. */
  fsrs?: string;
}

/**
 * A deck of flashcards
 */
export interface FlashcardDeck {
  id: string;
  name: string;
  languageCode: string;
  description?: string;
  isBundled: boolean;  // true = came with app, false = user imported
  createdAt: string;
  updatedAt: string;
  cards: Flashcard[];
}

/**
 * Bundled deck JSON format (in assets/flashcards/)
 */
interface BundledDeckJson {
  id: string;
  name: string;
  languageCode: string;
  description?: string;
  cards: {
    text: string;
    translations: string[];
    audioUrl?: string;
  }[];
}

/**
 * Duolingo API response format
 */
export interface DuolingoLexeme {
  text: string;
  translations: string[];
  audioURL?: string;
  isNew?: boolean;
}

export interface DuolingoResponse {
  learnedLexemes: DuolingoLexeme[];
  pagination?: {
    totalLexemes: number;
    pageSize: number;
    nextStartIndex?: number;
  };
}

/**
 * Level information for a deck
 */
export interface DeckLevel {
  levelNumber: number;
  startIndex: number;
  endIndex: number;
  cardCount: number;
  bestStars: number;
  bestScore: number;
  attempts: number;
  isUnlocked: boolean;
}

/**
 * List of bundled deck files to load on startup
 */
const BUNDLED_DECKS = [
  'assets/flashcards/duolingo-dutch.json',
];

@Injectable({
  providedIn: 'root',
})
export class FlashcardService {
  private decksSignal = signal<FlashcardDeck[]>([]);
  private initialized = false;
  private db = getDatabase();
  
  readonly decks = computed(() => this.decksSignal());
  readonly totalCards = computed(() => 
    this.decksSignal().reduce((sum, deck) => sum + deck.cards.length, 0)
  );

  constructor(private http: HttpClient) {}

  /**
   * Initialize the service - load bundled decks and user data
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log('[FlashcardService] Starting initialization...');
      
      // Load bundled decks from JSON files
      console.log('[FlashcardService] Loading bundled decks...');
      const bundledDecks = await this.loadBundledDecks();
      console.log('[FlashcardService] Loaded bundled decks:', bundledDecks.length);
      
      // Load user-imported decks from IndexedDB
      console.log('[FlashcardService] Loading user decks...');
      const userDecks = await this.loadUserDecks();
      console.log('[FlashcardService] Loaded user decks:', userDecks.length);
      
      // Load progress for all cards from IndexedDB
      console.log('[FlashcardService] Loading progress for bundled decks...');
      await this.loadProgress(bundledDecks);
      console.log('[FlashcardService] Loading progress for user decks...');
      await this.loadProgress(userDecks);
      
      // Combine all decks
      this.decksSignal.set([...bundledDecks, ...userDecks]);
      this.initialized = true;
      console.log('[FlashcardService] Initialization complete!');
      
    } catch (e) {
      console.error('[FlashcardService] Failed to initialize:', e);
      this.initialized = true; // Prevent infinite retries
    }
  }

  /**
   * Load bundled decks from JSON files in assets
   */
  private async loadBundledDecks(): Promise<FlashcardDeck[]> {
    const decks: FlashcardDeck[] = [];
    
    for (const path of BUNDLED_DECKS) {
      try {
        const json = await firstValueFrom(this.http.get<BundledDeckJson>(path));
        if (!json) continue;
        
        const deck: FlashcardDeck = {
          id: json.id,
          name: json.name,
          languageCode: json.languageCode,
          description: json.description,
          isBundled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: json.cards.map((card, index) => ({
            id: `${json.id}-card-${index}`,
            deckId: json.id,
            text: card.text,
            translations: card.translations,
            audioUrl: card.audioUrl,
            correctCount: 0,
            incorrectCount: 0,
            lastSeen: null,
            nextReview: null,
            streak: 0,
          })),
        };
        
        decks.push(deck);
      } catch (e) {
        console.warn(`Failed to load bundled deck: ${path}`, e);
      }
    }
    
    return decks;
  }

  /**
   * Load user-imported decks from IndexedDB
   */
  private async loadUserDecks(): Promise<FlashcardDeck[]> {
    const deckEntities = await this.db.flashcardDecks.toArray();
    const decks: FlashcardDeck[] = [];
    
    for (const deckEntity of deckEntities) {
      const cardEntities = await this.db.flashcards
        .where('deckId')
        .equals(deckEntity.id)
        .toArray();
      
      decks.push({
        id: deckEntity.id,
        name: deckEntity.name,
        languageCode: deckEntity.languageCode,
        isBundled: false,
        createdAt: deckEntity.createdAt,
        updatedAt: deckEntity.updatedAt,
        cards: cardEntities.map(card => ({
          id: card.id,
          deckId: card.deckId,
          text: card.text,
          translations: card.translations,
          audioUrl: card.audioUrl,
          correctCount: card.correctCount,
          incorrectCount: card.incorrectCount,
          lastSeen: card.lastSeen,
          nextReview: card.nextReview,
          streak: card.streak,
          isCustom: card.isCustom,
          fsrs: card.fsrs,
        })),
      });
    }
    
    return decks;
  }

  /**
   * Load progress for bundled deck cards from IndexedDB
   */
  private async loadProgress(decks: FlashcardDeck[]): Promise<void> {
    for (const deck of decks) {
      if (!deck.isBundled) continue;
      
      for (const card of deck.cards) {
        const savedProgress = await this.db.flashcards.get(card.id);
        if (savedProgress) {
          card.correctCount = savedProgress.correctCount;
          card.incorrectCount = savedProgress.incorrectCount;
          card.lastSeen = savedProgress.lastSeen;
          card.nextReview = savedProgress.nextReview;
          card.streak = savedProgress.streak;
          card.fsrs = savedProgress.fsrs;
        }
      }
    }
  }

  /**
   * Save card progress to IndexedDB
   */
  private async saveCardProgress(card: Flashcard): Promise<void> {
    // Preserve any existing creation timestamp (set when a manual card is
    // first created) so we don't overwrite it on every progress update.
    const existing = await this.db.flashcards.get(card.id);

    const entity: FlashcardEntity = {
      id: card.id,
      deckId: card.deckId,
      text: card.text,
      translations: card.translations,
      audioUrl: card.audioUrl,
      correctCount: card.correctCount,
      incorrectCount: card.incorrectCount,
      lastSeen: card.lastSeen,
      nextReview: card.nextReview,
      streak: card.streak,
      updatedAt: new Date().toISOString(),
      isCustom: card.isCustom ?? existing?.isCustom,
      createdAt: existing?.createdAt,
      fsrs: card.fsrs ?? existing?.fsrs,
    };
    
    await this.db.flashcards.put(entity);
  }

  /**
   * Import lexemes from Duolingo JSON response
   */
  async importFromDuolingo(
    json: DuolingoResponse | DuolingoLexeme[],
    deckName: string = 'Duolingo Import',
    languageCode: string = 'nl'
  ): Promise<{ imported: number; duplicates: number; deckId: string }> {
    await this.initialize();
    
    const lexemes = Array.isArray(json) ? json : json.learnedLexemes;
    const now = new Date().toISOString();
    
    // Find existing user deck with same name and language, or create new
    let deck = this.decksSignal().find(
      d => !d.isBundled && d.name === deckName && d.languageCode === languageCode
    );
    
    const isNewDeck = !deck;
    
    if (!deck) {
      deck = {
        id: `deck-user-${Date.now()}`,
        name: deckName,
        languageCode,
        isBundled: false,
        createdAt: now,
        updatedAt: now,
        cards: [],
      };
    }
    
    // Get all existing cards (bundled + user) to check for duplicates
    const allCards = this.decksSignal().flatMap(d => d.cards);
    
    let imported = 0;
    let duplicates = 0;
    
    for (const lexeme of lexemes) {
      // Check for duplicates across all decks
      const exists = allCards.some(
        c => c.text.toLowerCase() === lexeme.text.toLowerCase()
      );
      
      if (exists) {
        duplicates++;
        continue;
      }
      
      const card: Flashcard = {
        id: `card-${Date.now()}-${imported}`,
        deckId: deck.id,
        text: lexeme.text,
        translations: lexeme.translations,
        audioUrl: lexeme.audioURL,
        correctCount: 0,
        incorrectCount: 0,
        lastSeen: null,
        nextReview: null,
        streak: 0,
      };
      
      deck.cards.push(card);
      allCards.push(card); // Add to duplicate check list
      imported++;
      
      // Save card to IndexedDB
      await this.saveCardProgress(card);
    }
    
    deck.updatedAt = now;
    
    // Save deck to IndexedDB
    const deckEntity: FlashcardDeckEntity = {
      id: deck.id,
      name: deck.name,
      languageCode: deck.languageCode,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
    };
    await this.db.flashcardDecks.put(deckEntity);
    
    // Update signal
    if (isNewDeck) {
      this.decksSignal.update(decks => [...decks, deck!]);
    } else {
      this.decksSignal.update(decks => 
        decks.map(d => d.id === deck!.id ? deck! : d)
      );
    }
    
    return { imported, duplicates, deckId: deck.id };
  }

  /**
   * Add a single card manually (one word + its translation).
   *
   * Manual cards are flagged with isCustom = true so the UI can show the
   * "not part of the app, lives only on this device" indicator, and so they
   * can be exported. They are stored in a dedicated user deck (created on
   * first use) rather than mixed into a bundled deck.
   *
   * @param text The word/phrase in the target language
   * @param translations One or more accepted translations
   * @param languageCode Target language (defaults to Dutch)
   * @param deckName Name of the deck to store custom cards in
   */
  async addManualCard(
    text: string,
    translations: string[],
    languageCode: string = 'nl',
    deckName: string = 'My Cards'
  ): Promise<{ card: Flashcard; isDuplicate: boolean } | null> {
    await this.initialize();

    const cleanText = text.trim();
    const cleanTranslations = translations
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (!cleanText || cleanTranslations.length === 0) {
      return null;
    }

    // Reject if this word already exists in ANY deck (bundled or user).
    const allCards = this.decksSignal().flatMap(d => d.cards);
    const isDuplicate = allCards.some(
      c => c.text.toLowerCase() === cleanText.toLowerCase()
    );
    if (isDuplicate) {
      return { card: allCards.find(c => c.text.toLowerCase() === cleanText.toLowerCase())!, isDuplicate: true };
    }

    const now = new Date().toISOString();

    // Find or create the user's custom deck.
    let deck = this.decksSignal().find(
      d => !d.isBundled && d.name === deckName && d.languageCode === languageCode
    );
    const isNewDeck = !deck;

    if (!deck) {
      deck = {
        id: `deck-user-${Date.now()}`,
        name: deckName,
        languageCode,
        isBundled: false,
        createdAt: now,
        updatedAt: now,
        cards: [],
      };
    }

    const card: Flashcard = {
      id: `card-custom-${Date.now()}`,
      deckId: deck.id,
      text: cleanText,
      translations: cleanTranslations,
      correctCount: 0,
      incorrectCount: 0,
      lastSeen: null,
      nextReview: null,
      streak: 0,
      isCustom: true,
    };

    deck.cards.push(card);
    deck.updatedAt = now;

    // Persist card (with createdAt) and deck.
    await this.db.flashcards.put({
      id: card.id,
      deckId: card.deckId,
      text: card.text,
      translations: card.translations,
      audioUrl: card.audioUrl,
      correctCount: 0,
      incorrectCount: 0,
      lastSeen: null,
      nextReview: null,
      streak: 0,
      updatedAt: now,
      isCustom: true,
      createdAt: now,
    });

    const deckEntity: FlashcardDeckEntity = {
      id: deck.id,
      name: deck.name,
      languageCode: deck.languageCode,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
    };
    await this.db.flashcardDecks.put(deckEntity);

    if (isNewDeck) {
      this.decksSignal.update(decks => [...decks, deck!]);
    } else {
      this.decksSignal.update(decks =>
        decks.map(d => (d.id === deck!.id ? deck! : d))
      );
    }

    return { card, isDuplicate: false };
  }

  /**
   * Get all manually-added (custom) cards across every deck.
   */
  getCustomCards(): Flashcard[] {
    return this.decksSignal()
      .flatMap(d => d.cards)
      .filter(c => c.isCustom);
  }

  /**
   * Build a shareable export of the user's custom cards.
   *
   * Returns a compact JSON string (text + translations only) that can be
   * emailed/pasted and later merged into a shipped deck. Returns null when
   * there are no custom cards to export.
   */
  exportCustomCards(): { json: string; count: number } | null {
    const customCards = this.getCustomCards();
    if (customCards.length === 0) return null;

    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'BoostedLearning',
      cards: customCards.map(c => ({
        text: c.text,
        translations: c.translations,
        languageCode:
          this.getDeck(c.deckId)?.languageCode ?? 'nl',
      })),
    };

    return {
      json: JSON.stringify(payload, null, 2),
      count: customCards.length,
    };
  }

  /**
   * Get a deck by ID
   */
  getDeck(deckId: string): FlashcardDeck | null {
    return this.decksSignal().find(d => d.id === deckId) ?? null;
  }

  /**
   * Get all decks
   */
  getAllDecks(): FlashcardDeck[] {
    return this.decksSignal();
  }

  /**
   * Get cards for a study session, prioritizing cards that need practice
   */
  getStudyCards(deckId: string, maxCards: number = 20): Flashcard[] {
    const deck = this.getDeck(deckId);
    if (!deck) return [];
    
    const now = new Date();
    // Use de-duplicated prompts so Quick Study never repeats the same prompt.
    const cards = [...this.getDedupedCards(deckId)];
    
    // Calculate priority score for each card
    const scored = cards.map(card => {
      let score = 0;
      
      // Never seen - highest priority
      if (!card.lastSeen) {
        score += 1000;
      }
      
      // Due for review
      if (card.nextReview && new Date(card.nextReview) <= now) {
        score += 500;
      }
      
      // Low accuracy (more incorrect than correct)
      const total = card.correctCount + card.incorrectCount;
      if (total > 0) {
        const accuracy = card.correctCount / total;
        score += Math.round((1 - accuracy) * 300);
      }
      
      // Low streak
      score += Math.max(0, 10 - card.streak) * 10;
      
      // Add some randomness
      score += Math.random() * 50;
      
      return { card, score };
    });
    
    // Sort by score (highest first) and take top N
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, maxCards).map(s => s.card);
  }

  /**
   * Record a card attempt result
   */
  async recordAttempt(deckId: string, cardId: string, correct: boolean): Promise<void> {
    const deck = this.getDeck(deckId);
    if (!deck) return;
    
    const card = deck.cards.find(c => c.id === cardId);
    if (!card) return;
    
    const now = new Date();
    const newStreak = correct ? card.streak + 1 : 0;
    
    // Calculate next review time based on streak
    const intervals = [1, 10, 60, 24 * 60, 3 * 24 * 60, 7 * 24 * 60];
    const intervalMinutes = intervals[Math.min(newStreak, intervals.length - 1)];
    const nextReview = new Date(now.getTime() + intervalMinutes * 60 * 1000);
    
    // Update card
    card.correctCount += correct ? 1 : 0;
    card.incorrectCount += correct ? 0 : 1;
    card.lastSeen = now.toISOString();
    card.nextReview = nextReview.toISOString();
    card.streak = newStreak;
    
    // Save to IndexedDB
    await this.saveCardProgress(card);
    
    // Trigger signal update
    this.decksSignal.update(decks => [...decks]);
  }

  /**
   * Get deck statistics
   */
  getDeckStats(deckId: string): {
    totalCards: number;
    learned: number;
    mastered: number;
    needsPractice: number;
    dueNow: number;
    averageAccuracy: number;
  } {
    const deck = this.getDeck(deckId);
    if (!deck) {
      return { totalCards: 0, learned: 0, mastered: 0, needsPractice: 0, dueNow: 0, averageAccuracy: 0 };
    }
    
    const now = new Date();
    let totalCorrect = 0;
    let totalAttempts = 0;
    let learned = 0;
    let mastered = 0;
    let needsPractice = 0;
    let dueNow = 0;
    
    for (const card of deck.cards) {
      const attempts = card.correctCount + card.incorrectCount;
      totalCorrect += card.correctCount;
      totalAttempts += attempts;
      
      if (card.lastSeen) {
        learned++;
        if (card.streak >= 5) mastered++;
      }
      
      if (attempts > 0) {
        const accuracy = card.correctCount / attempts;
        if (accuracy < 0.6) needsPractice++;
      }
      
      if (card.nextReview && new Date(card.nextReview) <= now) {
        dueNow++;
      } else if (!card.lastSeen) {
        dueNow++;
      }
    }
    
    return {
      totalCards: deck.cards.length,
      learned,
      mastered,
      needsPractice,
      dueNow,
      averageAccuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    };
  }

  /**
   * Delete a user-imported deck (cannot delete bundled decks)
   */
  async deleteDeck(deckId: string): Promise<boolean> {
    const deck = this.getDeck(deckId);
    if (!deck || deck.isBundled) return false;
    
    // Delete from IndexedDB
    await this.db.flashcards.where('deckId').equals(deckId).delete();
    await this.db.flashcardDecks.delete(deckId);
    
    // Update signal
    this.decksSignal.update(decks => decks.filter(d => d.id !== deckId));
    
    return true;
  }

  /**
   * Reset progress for a deck
   */
  async resetDeckProgress(deckId: string): Promise<void> {
    const deck = this.getDeck(deckId);
    if (!deck) return;
    
    for (const card of deck.cards) {
      card.correctCount = 0;
      card.incorrectCount = 0;
      card.lastSeen = null;
      card.nextReview = null;
      card.streak = 0;
      
      await this.saveCardProgress(card);
    }
    
    // Also reset level progress
    await this.db.levelProgress.where('deckId').equals(deckId).delete();
    
    // Trigger signal update
    this.decksSignal.update(decks => [...decks]);
  }

  // ============================================
  // Flashcards (flip + self-rating) mode - FSRS
  // ============================================

  private fsrsEngine = fsrs();

  /** Parse a card's stored FSRS state, or create a fresh one. */
  private getFsrsState(card: Flashcard): FsrsCard {
    if (card.fsrs) {
      try {
        const parsed = JSON.parse(card.fsrs);
        // Revive Date fields that JSON serialized to strings.
        return {
          ...parsed,
          due: new Date(parsed.due),
          last_review: parsed.last_review ? new Date(parsed.last_review) : undefined,
        } as FsrsCard;
      } catch {
        // fall through to a fresh card
      }
    }
    return createEmptyCard(new Date());
  }

  /**
   * Order a deck's (de-duplicated) cards for a Flashcards flip session,
   * most-urgent first:
   *  - Cards that are due (or never seen) come first, oldest due date first.
   *  - Not-yet-due cards follow, soonest due first (shown only occasionally).
   * The least-known cards naturally surface most often because failing a card
   * (hard) gives it a near-immediate due date via FSRS.
   */
  getFlashcardQueue(deckId: string, maxCards: number = 20): Flashcard[] {
    const cards = this.getDedupedCards(deckId);
    if (cards.length === 0) return [];

    const now = Date.now();

    const scored = cards.map(card => {
      const state = this.getFsrsState(card);
      const due = state.due instanceof Date ? state.due.getTime() : new Date(state.due).getTime();
      const isNew = !card.fsrs;
      return { card, due, isNew };
    });

    scored.sort((a, b) => {
      const aDue = a.due <= now;
      const bDue = b.due <= now;
      // Due/new cards before not-due ones.
      if (aDue !== bDue) return aDue ? -1 : 1;
      // Among due cards, the most overdue first; among future cards, soonest first.
      return a.due - b.due;
    });

    return scored.slice(0, maxCards).map(s => s.card);
  }

  /**
   * Record a self-rating for a flashcard and advance its FSRS schedule.
   * Mapping: hard -> Again (see very soon), medium -> Hard (soon),
   * easy -> Easy (much later).
   */
  async rateFlashcard(deckId: string, cardId: string, rating: FlashcardRating): Promise<void> {
    const deck = this.getDeck(deckId);
    if (!deck) return;

    // The deduped card may be a representative; map back to a real deck card.
    const card =
      deck.cards.find(c => c.id === cardId) ??
      deck.cards.find(c => this.normalizeKey(c.text) === this.normalizeKey(cardId));
    if (!card) return;

    const fsrsRating =
      rating === 'hard' ? Rating.Again :
      rating === 'medium' ? Rating.Hard :
      Rating.Easy;

    const current = this.getFsrsState(card);
    const now = new Date();
    const scheduling = this.fsrsEngine.repeat(current, now);
    const next = scheduling[fsrsRating].card;

    card.fsrs = JSON.stringify(next);

    // Keep the lightweight stats roughly in sync for display elsewhere.
    if (rating === 'easy') {
      card.correctCount += 1;
      card.streak += 1;
    } else if (rating === 'hard') {
      card.incorrectCount += 1;
      card.streak = 0;
    }
    card.lastSeen = now.toISOString();
    card.nextReview =
      next.due instanceof Date ? next.due.toISOString() : new Date(next.due).toISOString();

    await this.saveCardProgress(card);
    this.decksSignal.update(decks => [...decks]);
  }

  // ============================================
  // Level System Methods
  // ============================================

  private readonly CARDS_PER_LEVEL = 20;

  /** Lowercase + strip accents, for grouping/comparison. */
  private normalizeKey(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Return the deck's cards with duplicate English prompts collapsed into a
   * single representative card. Cards that share the same primary English
   * translation (e.g. de/het -> "the", drink/drinkt/drinken -> "drink") are
   * merged: the first occurrence is kept and gains an `acceptedForms` list of
   * every target-language word for that prompt.
   *
   * The original deck order is preserved, so the level system can still slice
   * "oldest learned first" but now over unique prompts, giving consistent
   * packs of 20.
   */
  getDedupedCards(deckId: string): Flashcard[] {
    const deck = this.getDeck(deckId);
    if (!deck) return [];

    // Group cards that share their PRIMARY English translation. Each group's
    // prompt is translations[0] of its first card. For every card in the
    // group we accept its Dutch word. We also accept Dutch words from other
    // cards whose translation list contains that same prompt word, e.g.:
    //   we  -> [we, ons]   (prompt "we")
    //   wij -> [us, we]    ("we" appears here too, so "wij" is also accepted)
    const keyOf = (c: Flashcard) => this.normalizeKey(c.translations[0] ?? '');

    // Accepted Dutch forms per prompt key.
    const formsByPrompt = new Map<string, string[]>();
    const addForm = (key: string, word: string) => {
      const forms = formsByPrompt.get(key) ?? [];
      if (!forms.some(f => this.normalizeKey(f) === this.normalizeKey(word))) {
        forms.push(word);
      }
      formsByPrompt.set(key, forms);
    };

    // Pass 1: every card contributes its own word to its own prompt.
    for (const card of deck.cards) {
      addForm(keyOf(card), card.text);
    }

    // Pass 2: a card whose translations contain another prompt's word is also
    // a valid answer for that prompt (covers synonyms like we/wij).
    const promptKeys = new Set(formsByPrompt.keys());
    for (const card of deck.cards) {
      for (const tr of card.translations) {
        const k = this.normalizeKey(tr);
        if (promptKeys.has(k)) {
          addForm(k, card.text);
        }
      }
    }

    // Keep only the first card per prompt, attaching all accepted forms.
    const seen = new Set<string>();
    const result: Flashcard[] = [];
    for (const card of deck.cards) {
      const key = keyOf(card);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...card, acceptedForms: formsByPrompt.get(key) ?? [card.text] });
    }

    return result;
  }

  /**
   * Get all levels for a deck
   * Cards are ordered from oldest learned (Level 1) to newest
   */
  async getDeckLevels(deckId: string, mode: PracticeMode): Promise<DeckLevel[]> {
    const deck = this.getDeck(deckId);
    if (!deck) return [];

    // Work over de-duplicated prompts so each level is a consistent pack of
    // unique cards (collapsed forms like de/het count as one).
    // Cards are in order (oldest first); Level 1 = oldest learned.
    const totalCards = this.getDedupedCards(deckId).length;
    const totalLevels = Math.ceil(totalCards / this.CARDS_PER_LEVEL);
    
    // Load this deck's level progress for the requested mode only, so stars
    // and unlock state are tracked independently per practice mode.
    const progressRecords = await this.db.levelProgress
      .where('deckId')
      .equals(deckId)
      .toArray();
    
    const progressMap = new Map<number, LevelProgressEntity>();
    for (const record of progressRecords) {
      if (record.mode === mode) {
        progressMap.set(record.levelNumber, record);
      }
    }

    const levels: DeckLevel[] = [];
    
    for (let i = 0; i < totalLevels; i++) {
      const levelNumber = i + 1;
      // Reverse order: Level 1 = last cards in array (oldest learned)
      const startIndex = totalCards - ((i + 1) * this.CARDS_PER_LEVEL);
      const endIndex = totalCards - (i * this.CARDS_PER_LEVEL);
      
      const progress = progressMap.get(levelNumber);
      
      // Level is unlocked if it's level 1 or previous level has at least 1 star
      const previousProgress = progressMap.get(levelNumber - 1);
      const isUnlocked = levelNumber === 1 || (previousProgress?.bestStars ?? 0) >= 1;
      
      levels.push({
        levelNumber,
        startIndex: Math.max(0, startIndex),
        endIndex: Math.min(totalCards, endIndex),
        cardCount: Math.min(this.CARDS_PER_LEVEL, endIndex - Math.max(0, startIndex)),
        bestStars: progress?.bestStars ?? 0,
        bestScore: progress?.bestScore ?? 0,
        attempts: progress?.attempts ?? 0,
        isUnlocked,
      });
    }
    
    return levels;
  }

  /**
   * Get cards for a specific level
   */
  getLevelCards(deckId: string, levelNumber: number): Flashcard[] {
    const deduped = this.getDedupedCards(deckId);
    if (deduped.length === 0) return [];

    const totalCards = deduped.length;
    // Reverse order: Level 1 = last cards in array (oldest learned)
    const startIndex = Math.max(0, totalCards - (levelNumber * this.CARDS_PER_LEVEL));
    const endIndex = Math.min(totalCards, totalCards - ((levelNumber - 1) * this.CARDS_PER_LEVEL));
    
    return deduped.slice(startIndex, endIndex);
  }

  /**
   * Calculate stars from score percentage
   */
  calculateStars(scorePercent: number): number {
    if (scorePercent >= 90) return 3;
    if (scorePercent >= 70) return 2;
    if (scorePercent >= 50) return 1;
    return 0;
  }

  /**
   * Save level progress after completing a study session
   */
  async saveLevelProgress(
    deckId: string,
    mode: PracticeMode,
    levelNumber: number,
    correctCount: number,
    totalCards: number
  ): Promise<{ stars: number; isNewBest: boolean }> {
    const scorePercent = Math.round((correctCount / totalCards) * 100);
    const stars = this.calculateStars(scorePercent);
    
    const progressId = this.levelProgressId(deckId, mode, levelNumber);
    const existing = await this.db.levelProgress.get(progressId);
    
    const isNewBest = !existing || scorePercent > existing.bestScore;
    
    const progress: LevelProgressEntity = {
      id: progressId,
      deckId,
      mode,
      levelNumber,
      bestStars: isNewBest ? stars : (existing?.bestStars ?? stars),
      bestScore: isNewBest ? scorePercent : (existing?.bestScore ?? scorePercent),
      attempts: (existing?.attempts ?? 0) + 1,
      lastAttempt: new Date().toISOString(),
    };
    
    await this.db.levelProgress.put(progress);
    
    return { stars, isNewBest };
  }

  /** Storage key for a level's progress, scoped to deck + mode + level. */
  private levelProgressId(deckId: string, mode: PracticeMode, levelNumber: number): string {
    return `${deckId}-${mode}-${levelNumber}`;
  }

  /**
   * Get progress for a specific level
   */
  async getLevelProgress(deckId: string, mode: PracticeMode, levelNumber: number): Promise<LevelProgressEntity | null> {
    const progressId = this.levelProgressId(deckId, mode, levelNumber);
    return await this.db.levelProgress.get(progressId) ?? null;
  }

  /**
   * Check if a level is unlocked
   */
  async isLevelUnlocked(deckId: string, mode: PracticeMode, levelNumber: number): Promise<boolean> {
    if (levelNumber === 1) return true;
    
    const previousProgress = await this.getLevelProgress(deckId, mode, levelNumber - 1);
    return (previousProgress?.bestStars ?? 0) >= 1;
  }
}
