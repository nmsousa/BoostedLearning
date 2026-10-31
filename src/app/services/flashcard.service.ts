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
import { CapacitorHttp } from '@capacitor/core';
import { getDatabase, FlashcardDeckEntity, FlashcardEntity, LevelProgressEntity } from '../../persistence/database';
import { KnowledgeBreakdown, KnowledgeLevel } from '../../core/knowledge-level';
import { parseDuomeHtml } from './duome-parser';

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
  /** "So-so" (medium) self-ratings — flashcards flip mode only. Optional. */
  mediumCount?: number;
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

  /** Skill/lesson group this card belongs to (duome decks). */
  skill?: string;
  /** 1-based order of the skill in the course. */
  skillOrder?: number;

  /**
   * User override for how often this word appears in practice:
   * - 'boost': surface more often (weighted up in queues),
   * - 'hide': never show in practice,
   * - undefined/'normal': default behaviour.
   */
  priority?: WordPriority;
}

/** Per-word user priority override for practice queues. */
export type WordPriority = 'boost' | 'normal' | 'hide';

/** A practiced word row for the "Your words" screen. */
export interface StudiedWord {
  text: string;
  translation: string;
  correct: number;
  incorrect: number;
  medium: number;
  /** Total attempts across all modes (correct + incorrect + so-so). */
  attempts: number;
  /** Fraction correct over correct+incorrect (0..1). */
  accuracy: number;
  /** Fraction incorrect over correct+incorrect (0..1). */
  missRate: number;
  level: KnowledgeLevel;
  priority: WordPriority;
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
    /** Skill/lesson group (duome decks). Optional. */
    skill?: string;
    /** 1-based order of the skill in the course. Optional. */
    skillOrder?: number;
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
  /** Skill name for skill-based decks (French); undefined for chunked decks. */
  skill?: string;
  /** Best completion time in seconds (Match mode); undefined if never timed. */
  bestTimeSeconds?: number;
  /** Best combo reached (Match mode); undefined if never played. */
  bestCombo?: number;
}

/**
 * List of bundled deck files to load on startup
 */
const BUNDLED_DECKS = [
  'assets/flashcards/duolingo-dutch.json',
  'assets/flashcards/french.json',
];

/** Friendly display names for known language codes (home selector). */
const LANGUAGE_NAMES: Record<string, string> = {
  nl: 'Dutch',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  de: 'German',
  pt: 'Portuguese',
  en: 'English',
};

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
            skill: card.skill,
            skillOrder: card.skillOrder,
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
          skill: card.skill,
          skillOrder: card.skillOrder,
          correctCount: card.correctCount,
          incorrectCount: card.incorrectCount,
          mediumCount: card.mediumCount ?? 0,
          lastSeen: card.lastSeen,
          nextReview: card.nextReview,
          streak: card.streak,
          isCustom: card.isCustom,
          fsrs: card.fsrs,
          priority: card.priority,
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
          card.mediumCount = savedProgress.mediumCount ?? 0;
          card.lastSeen = savedProgress.lastSeen;
          card.nextReview = savedProgress.nextReview;
          card.streak = savedProgress.streak;
          card.fsrs = savedProgress.fsrs;
          card.priority = savedProgress.priority;
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
      skill: card.skill,
      skillOrder: card.skillOrder,
      correctCount: card.correctCount,
      incorrectCount: card.incorrectCount,
      mediumCount: card.mediumCount ?? 0,
      lastSeen: card.lastSeen,
      nextReview: card.nextReview,
      streak: card.streak,
      updatedAt: new Date().toISOString(),
      isCustom: card.isCustom ?? existing?.isCustom,
      createdAt: existing?.createdAt,
      fsrs: card.fsrs ?? existing?.fsrs,
      priority: card.priority ?? existing?.priority,
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
   * Import a language by fetching a duome.eu "by skill" vocabulary page and
   * parsing its words/skills/audio. Uses CapacitorHttp so the request runs at
   * the native layer (avoids browser CORS) — works in the installed app, not
   * the browser preview.
   *
   * @param url A duome skills URL, e.g. https://duome.eu/vocabulary/en/it/skills
   * @param langCode Target language code to tag the deck with (e.g. 'it')
   * @param deckName Display name for the deck
   * @returns { imported, skills, deckId }
   */
  async importFromDuomeUrl(
    url: string,
    langCode: string,
    deckName?: string
  ): Promise<{ imported: number; skills: number; deckId: string; name: string }> {
    const response = await CapacitorHttp.get({ url, responseType: 'text' });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to fetch (HTTP ${response.status})`);
    }
    const html = typeof response.data === 'string' ? response.data : String(response.data);
    const parsed = parseDuomeHtml(html);
    if (parsed.words.length === 0) {
      throw new Error('No words found at that URL. Make sure it is a duome "by skill" page.');
    }

    // Prefer an explicit name, else the name parsed from the page, else known
    // map, else the uppercased code.
    const name =
      deckName?.trim() ||
      parsed.languageName ||
      LANGUAGE_NAMES[langCode] ||
      langCode.toUpperCase();

    const now = new Date().toISOString();
    const deckId = `deck-duome-${langCode}`;

    const entities: FlashcardEntity[] = parsed.words.map((w, index) => ({
      id: `${deckId}-card-${index}`,
      deckId,
      text: w.text,
      translations: w.translations,
      audioUrl: w.audioUrl,
      skill: w.skill,
      skillOrder: w.skillOrder,
      correctCount: 0,
      incorrectCount: 0,
      lastSeen: null,
      nextReview: null,
      streak: 0,
      updatedAt: now,
    }));

    await this.db.flashcards.bulkPut(entities);
    await this.db.flashcardDecks.put({
      id: deckId,
      name,
      languageCode: langCode,
      createdAt: now,
      updatedAt: now,
    });

    const deck: FlashcardDeck = {
      id: deckId,
      name,
      languageCode: langCode,
      isBundled: false,
      createdAt: now,
      updatedAt: now,
      cards: entities.map(e => ({
        id: e.id,
        deckId: e.deckId,
        text: e.text,
        translations: e.translations,
        audioUrl: e.audioUrl,
        skill: e.skill,
        skillOrder: e.skillOrder,
        correctCount: 0,
        incorrectCount: 0,
        lastSeen: null,
        nextReview: null,
        streak: 0,
      })),
    };

    this.decksSignal.update(decks => {
      const without = decks.filter(d => d.id !== deckId);
      return [...without, deck];
    });

    return { imported: parsed.words.length, skills: parsed.skills.length, deckId, name };
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
   * Distinct learning languages that currently have a deck (bundled or
   * imported). Drives the home language selector so imported languages show up.
   */
  getAvailableLanguages(): { code: string; name: string }[] {
    const seen = new Map<string, string>();
    for (const deck of this.decksSignal()) {
      const code = deck.languageCode;
      if (!code) continue;
      // Prefer a friendly display name; fall back to the deck name or code.
      if (!seen.has(code)) {
        seen.set(code, LANGUAGE_NAMES[code] ?? deck.name ?? code.toUpperCase());
      }
    }
    return [...seen.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Drop words the user chose to hide from practice. */
  private excludeHidden(cards: Flashcard[]): Flashcard[] {
    return cards.filter(c => c.priority !== 'hide');
  }

  /** Extra score added to 'boost' words so they surface sooner. */
  private readonly BOOST_SCORE = 600;

  /**
   * Get cards for a study session, prioritizing cards that need practice
   */
  getStudyCards(deckId: string, maxCards: number = 20): Flashcard[] {
    const deck = this.getDeck(deckId);
    if (!deck) return [];
    
    const now = new Date();
    // Use de-duplicated prompts so Quick Study never repeats the same prompt.
    // Hidden words are excluded entirely.
    const cards = this.excludeHidden([...this.getDedupedCards(deckId)]);
    
    // Calculate priority score for each card
    const scored = cards.map(card => {
      let score = 0;

      // User "boost" override surfaces the word sooner.
      if (card.priority === 'boost') {
        score += this.BOOST_SCORE;
      }
      
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
    // Hidden words never appear in the queue.
    const cards = this.excludeHidden(this.getDedupedCards(deckId));
    if (cards.length === 0) return [];

    const now = Date.now();

    const scored = cards.map(card => {
      const state = this.getFsrsState(card);
      const due = state.due instanceof Date ? state.due.getTime() : new Date(state.due).getTime();
      const isNew = !card.fsrs;
      const boosted = card.priority === 'boost';
      return { card, due, isNew, boosted };
    });

    scored.sort((a, b) => {
      // Boosted words come first regardless of schedule.
      if (a.boosted !== b.boosted) return a.boosted ? -1 : 1;
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
   * Set the user's practice-priority override for a word, identified by its
   * target-language text (optionally scoped to a language). Persists the
   * change and refreshes the in-memory decks.
   *
   * Because shared prompts are de-duplicated into a representative card, we
   * apply the flag to every real deck card whose text matches, so the override
   * is consistent regardless of which form was shown.
   */
  async setWordPriority(
    text: string,
    priority: WordPriority,
    languageCode?: string
  ): Promise<void> {
    await this.initialize();
    const key = this.normalizeKey(text);
    const decks = this.decksSignal().filter(
      d => !languageCode || d.languageCode === languageCode
    );

    const toSave: Flashcard[] = [];
    for (const deck of decks) {
      for (const card of deck.cards) {
        if (this.normalizeKey(card.text) === key) {
          card.priority = priority;
          toSave.push(card);
        }
      }
    }

    for (const card of toSave) {
      await this.saveCardProgress(card);
    }

    // Trigger reactive consumers (Words page, breakdown, queues).
    this.decksSignal.update(d => [...d]);
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
    } else {
      // 'medium' = so-so: track separately; doesn't extend or reset the streak.
      card.mediumCount = (card.mediumCount ?? 0) + 1;
    }
    card.lastSeen = now.toISOString();
    card.nextReview =
      next.due instanceof Date ? next.due.toISOString() : new Date(next.due).toISOString();

    await this.saveCardProgress(card);
    this.decksSignal.update(decks => [...decks]);
  }

  // ============================================
  // Translation display helpers
  // ============================================

  /**
   * Curated canonical English translations for high-frequency Dutch words
   * whose imported translation list has a wrong or junk first entry (the
   * Duolingo scrape often leads with contractions/possessives/odd senses).
   * Keyed by the Dutch word (lowercased).
   */
  private readonly CURATED_TRANSLATIONS: Record<string, string> = {
    hij: 'he',
    zij: 'she',
    zijn: 'are',        // plural/infinitive "to be"; also means "his" in other contexts
    hebben: 'have',
    is: 'is',
    ben: 'am',
    bent: 'are',
    wij: 'we',
    we: 'we',
    jullie: 'you (plural)',
    u: 'you (formal)',
    jij: 'you',
    jou: 'you',
    ik: 'I',
    het: 'the',
    de: 'the',
    een: 'a',
    man: 'man',
    mannen: 'men',
    haar: 'her',
    hun: 'their',
    maken: 'make',
    huis: 'house',
    vriend: 'friend',
    blijven: 'stay',
    welke: 'which',
    welk: 'which',
    zoeken: 'search',
    worden: 'become',
  };

  /**
   * Choose the best English translation to DISPLAY for a card.
   *
   * The imported data often leads with contractions ("he'd"), possessives
   * ("man's"), or fragments ("ve"), so translations[0] is unreliable. This:
   *   1. uses a curated override when available,
   *   2. otherwise filters out apostrophe forms and 1-2 char fragments,
   *   3. deprioritizes "-ing" gerunds and negations ("didn't"),
   *   4. prefers the shortest remaining clean form (usually the base word),
   *   5. falls back to translations[0] if nothing clean remains.
   */
  bestTranslation(card: Flashcard): string {
    const curated = this.CURATED_TRANSLATIONS[card.text.trim().toLowerCase()];
    if (curated) return curated;

    const all = card.translations ?? [];
    if (all.length === 0) return '';

    const clean = all.filter(t => {
      const s = t.trim();
      if (s.length <= 2) return false;        // "ve", "s", "th"
      if (s.includes("'")) return false;        // contractions / possessives
      if (/\(.*\)/.test(s)) return true;        // keep clarified forms like "you (plural)"
      return true;
    });

    const pool = clean.length > 0 ? clean : all;

    // Score: prefer non-gerund, non-negation, then shorter.
    const score = (t: string): number => {
      const s = t.trim().toLowerCase();
      let penalty = 0;
      if (s.endsWith('ing')) penalty += 5;                 // "having" < "have"
      if (/n't$|^didn|^couldn|^wasn|^weren/.test(s)) penalty += 10;
      return penalty + s.length * 0.1;
    };

    return [...pool].sort((a, b) => score(a) - score(b))[0] ?? all[0];
  }

  /**
   * True when a card's word is identical to its displayed translation
   * (e.g. Dutch "water" = English "water"). Such cards make trivial or
   * ambiguous questions in the matching/quiz modes.
   */
  isSameInBothLanguages(card: Flashcard): boolean {
    const norm = (s: string) => s.trim().toLowerCase();
    const word = norm(card.text);
    const translation = norm(this.bestTranslation(card));
    return word.length > 0 && word === translation;
  }

  /**
   * Filter a card list down to those suitable for the matching/quiz modes:
   * excludes cards identical in both languages, and words the user has chosen
   * to hide from practice. Centralized here so every mode (and every future
   * language) applies the same content rules.
   */
  playableCards(cards: Flashcard[]): Flashcard[] {
    return cards.filter(c => !this.isSameInBothLanguages(c) && c.priority !== 'hide');
  }

  // ============================================
  // Knowledge breakdown (home "Your words")
  // ============================================

  /** Consecutive-correct streak needed to count a word as "familiar". */
  private readonly FAMILIAR_STREAK = 2;
  /** Consecutive-correct streak needed to count a word as "known".
   *  3-in-a-row reads intuitively as "known" (matches the ✓/✗ counts a user
   *  sees on the Your Words screen). */
  private readonly KNOWN_STREAK = 3;

  /**
   * Map a card's current streak to its knowledge bucket. Single source of
   * truth shared by the home breakdown and the Your Words list.
   */
  private levelForStreak(streak: number): KnowledgeLevel {
    if (streak >= this.KNOWN_STREAK) return 'known';
    if (streak >= this.FAMILIAR_STREAK) return 'familiar';
    return 'learning';
  }

  /** Whether a card has been practiced at least once (any mode). */
  private hasBeenStudied(card: Flashcard): boolean {
    return card.lastSeen !== null || card.correctCount > 0 || card.incorrectCount > 0;
  }

  /**
   * Summarize how well the learner knows their words, derived from real
   * flashcard practice (any mode updates each card's streak/counts):
   *   - known:    current streak >= KNOWN_STREAK
   *   - familiar: current streak >= FAMILIAR_STREAK
   *   - learning: studied at least once but below familiar
   *   - neverStudied: never practiced
   * Counts over de-duplicated prompts so shared forms (de/het) count once.
   */
  /**
   * Words the learner has practiced (any mode), for the "Your words" detail
   * screen. Returns per-word stats sorted by miss rate (worst first) so early
   * levels (seen more often) don't dominate by absolute counts.
   */
  getStudiedWords(languageCode?: string): StudiedWord[] {
    const decks = languageCode
      ? this.getAllDecks().filter(d => d.languageCode === languageCode)
      : this.getAllDecks();

    const rows: StudiedWord[] = [];

    for (const deck of decks) {
      for (const card of this.getDedupedCards(deck.id)) {
        const correct = card.correctCount ?? 0;
        const incorrect = card.incorrectCount ?? 0;
        const medium = card.mediumCount ?? 0;
        const seen = correct + incorrect;
        if (seen === 0 && medium === 0) continue; // never practiced

        const missRate = seen > 0 ? incorrect / seen : 0;
        // Same streak-based bucket as the home breakdown (single source).
        const level = this.levelForStreak(card.streak);

        rows.push({
          text: card.text,
          translation: this.bestTranslation(card),
          correct,
          incorrect,
          medium,
          attempts: correct + incorrect + medium,
          accuracy: seen > 0 ? correct / seen : 0,
          missRate,
          level,
          priority: card.priority ?? 'normal',
        });
      }
    }

    // Worst (highest miss rate) first; tie-break by more attempts.
    return rows.sort((a, b) =>
      b.missRate - a.missRate ||
      b.attempts - a.attempts
    );
  }

  getKnowledgeBreakdown(languageCode?: string): KnowledgeBreakdown {
    const breakdown: KnowledgeBreakdown = {
      learning: 0,
      familiar: 0,
      known: 0,
      neverStudied: 0,
      total: 0,
    };

    // Scope to the given language (e.g. the one selected on the home screen)
    // so switching languages shows that language's progress, not all decks.
    const decks = languageCode
      ? this.getAllDecks().filter(d => d.languageCode === languageCode)
      : this.getAllDecks();

    for (const deck of decks) {
      for (const card of this.getDedupedCards(deck.id)) {
        if (!this.hasBeenStudied(card)) {
          breakdown.neverStudied++;
          continue;
        }
        breakdown[this.levelForStreak(card.streak)]++;
        breakdown.total++;
      }
    }

    return breakdown;
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

  /** Whether a deck carries skill groupings (duome decks do). */
  deckHasSkills(deckId: string): boolean {
    const deck = this.getDeck(deckId);
    return !!deck && deck.cards.some(c => !!c.skill);
  }

  /**
   * Cards grouped into skill levels, in skill order. Each inner array is one
   * level. Used when a deck has skills (e.g. French). Falls back to empty when
   * the deck has no skills.
   */
  private getSkillLevels(deckId: string): Flashcard[][] {
    const deck = this.getDeck(deckId);
    if (!deck) return [];

    // Group by skill, preserving skillOrder.
    const groups = new Map<string, { order: number; cards: Flashcard[] }>();
    for (const card of deck.cards) {
      const skill = card.skill ?? 'Uncategorized';
      const order = card.skillOrder ?? 9999;
      const g = groups.get(skill) ?? { order, cards: [] };
      g.cards.push(card);
      groups.set(skill, g);
    }

    return [...groups.values()]
      .sort((a, b) => a.order - b.order)
      .map(g => g.cards);
  }

  /**
   * Get all levels for a deck
   * Cards are ordered from oldest learned (Level 1) to newest
   */
  async getDeckLevels(deckId: string, mode: PracticeMode): Promise<DeckLevel[]> {
    const deck = this.getDeck(deckId);
    if (!deck) return [];

    // Skill-based decks (French): one level per skill, in course order.
    const skillLevels = this.deckHasSkills(deckId) ? this.getSkillLevels(deckId) : null;
    const totalLevels = skillLevels
      ? skillLevels.length
      : Math.ceil(this.getDedupedCards(deckId).length / this.CARDS_PER_LEVEL);
    const totalCards = this.getDedupedCards(deckId).length;
    
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

      let cardCount: number;
      let skillName: string | undefined;
      if (skillLevels) {
        // Skill-based: level N = the Nth skill, in course order.
        const group = skillLevels[i] ?? [];
        cardCount = group.length;
        skillName = group[0]?.skill;
      } else {
        // Chunked: Level 1 = last cards (oldest learned).
        const startIndex = Math.max(0, totalCards - ((i + 1) * this.CARDS_PER_LEVEL));
        const endIndex = Math.min(totalCards, totalCards - (i * this.CARDS_PER_LEVEL));
        cardCount = endIndex - startIndex;
      }
      
      const progress = progressMap.get(levelNumber);
      
      // Level is unlocked if it's level 1 or the previous level scored >= 70%.
      const previousProgress = progressMap.get(levelNumber - 1);
      const isUnlocked = levelNumber === 1 || (previousProgress?.bestScore ?? 0) >= this.UNLOCK_SCORE;
      
      levels.push({
        levelNumber,
        startIndex: 0,
        endIndex: 0,
        cardCount,
        skill: skillName,
        bestStars: progress?.bestStars ?? 0,
        bestScore: progress?.bestScore ?? 0,
        attempts: progress?.attempts ?? 0,
        isUnlocked,
        bestTimeSeconds: progress?.bestTimeSeconds,
        bestCombo: progress?.bestCombo,
      });
    }
    
    return levels;
  }

  /**
   * Get cards for a specific level
   */
  getLevelCards(deckId: string, levelNumber: number): Flashcard[] {
    // Skill-based decks: level N = the Nth skill's cards (course order).
    if (this.deckHasSkills(deckId)) {
      return this.getSkillLevels(deckId)[levelNumber - 1] ?? [];
    }

    const deduped = this.getDedupedCards(deckId);
    if (deduped.length === 0) return [];

    const totalCards = deduped.length;
    // Reverse order: Level 1 = last cards in array (oldest learned)
    const startIndex = Math.max(0, totalCards - (levelNumber * this.CARDS_PER_LEVEL));
    const endIndex = Math.min(totalCards, totalCards - ((levelNumber - 1) * this.CARDS_PER_LEVEL));
    
    return deduped.slice(startIndex, endIndex);
  }

  /** Cap on how many words a single Match session can hold. */
  private readonly MATCH_SESSION_CAP = 50;

  /**
   * Build the word set for a Match session (solution B): the level's own words
   * plus review words pulled from earlier levels, prioritizing the weakest
   * (lowest success ratio / most-missed). This makes Match sessions longer —
   * so bigger combos are possible — and reinforces shaky words, without
   * changing the level/star system (the level's own words are always included,
   * so passing stays as easy as before).
   */
  getMatchSessionCards(deckId: string, levelNumber: number): Flashcard[] {
    const levelCards = this.getLevelCards(deckId, levelNumber);
    if (levelNumber <= 1) return levelCards; // no earlier levels to review

    const levelIds = new Set(levelCards.map(c => c.id));

    // Gather words from all earlier levels.
    const earlier: Flashcard[] = [];
    for (let n = 1; n < levelNumber; n++) {
      for (const c of this.getLevelCards(deckId, n)) {
        if (!levelIds.has(c.id)) earlier.push(c);
      }
    }

    // Weakness score: higher = weaker (prioritized). Unseen words are neutral.
    const weakness = (c: Flashcard): number => {
      const correct = c.correctCount ?? 0;
      const wrong = c.incorrectCount ?? 0;
      const seen = correct + wrong;
      if (seen === 0) return 0.5; // never practiced: medium priority
      return wrong / seen; // 0 (always right) .. 1 (always wrong)
    };

    const reviewSlots = Math.max(0, this.MATCH_SESSION_CAP - levelCards.length);
    const review = earlier
      .sort((a, b) => weakness(b) - weakness(a))
      .slice(0, reviewSlots);

    return [...levelCards, ...review];
  }

  /**
   * Calculate stars from score percentage
   */
  calculateStars(scorePercent: number): number {
    if (scorePercent >= 100) return 3;
    if (scorePercent >= 85) return 2;
    if (scorePercent >= 70) return 1;
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
    totalCards: number,
    timeSeconds?: number,
    combo?: number
  ): Promise<{ stars: number; isNewBest: boolean; bestTimeSeconds?: number; bestCombo?: number }> {
    const scorePercent = Math.round((correctCount / totalCards) * 100);
    const stars = this.calculateStars(scorePercent);
    
    const progressId = this.levelProgressId(deckId, mode, levelNumber);
    const existing = await this.db.levelProgress.get(progressId);
    
    const isNewBest = !existing || scorePercent > existing.bestScore;

    // Track the fastest completion time, when provided.
    let bestTimeSeconds = existing?.bestTimeSeconds;
    if (timeSeconds !== undefined) {
      bestTimeSeconds =
        bestTimeSeconds === undefined ? timeSeconds : Math.min(bestTimeSeconds, timeSeconds);
    }

    // Track the best combo, when provided.
    let bestCombo = existing?.bestCombo;
    if (combo !== undefined) {
      bestCombo = bestCombo === undefined ? combo : Math.max(bestCombo, combo);
    }
    
    const progress: LevelProgressEntity = {
      id: progressId,
      deckId,
      mode,
      levelNumber,
      bestStars: isNewBest ? stars : (existing?.bestStars ?? stars),
      bestScore: isNewBest ? scorePercent : (existing?.bestScore ?? scorePercent),
      attempts: (existing?.attempts ?? 0) + 1,
      lastAttempt: new Date().toISOString(),
      ...(bestTimeSeconds !== undefined ? { bestTimeSeconds } : {}),
      ...(bestCombo !== undefined ? { bestCombo } : {}),
    };
    
    await this.db.levelProgress.put(progress);
    
    return { stars, isNewBest, bestTimeSeconds, bestCombo };
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
  /** Minimum score on the previous level to unlock the next one (= 1 star). */
  private readonly UNLOCK_SCORE = 70;

  async isLevelUnlocked(deckId: string, mode: PracticeMode, levelNumber: number): Promise<boolean> {
    if (levelNumber === 1) return true;
    
    const previousProgress = await this.getLevelProgress(deckId, mode, levelNumber - 1);
    return (previousProgress?.bestScore ?? 0) >= this.UNLOCK_SCORE;
  }
}
