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
 * 'journey' and 'builder' are EXPERIMENTAL modes added alongside the originals.
 *
 * The `journey-*` modes are the Journey redesign: a chapter is ONE skill played
 * as five fixed SINGLE-PASS nodes (flip → quiz → match → write → builder). Each
 * node records its own LevelProgress under its own mode, so the standalone
 * flip/quiz/match/write mode lists keep their 5-round behaviour untouched. The
 * old single 'journey' mode is kept for back-compat (unused by the new page).
 */
export type PracticeMode =
  | 'flip' | 'write' | 'match' | 'quiz' | 'journey' | 'builder' | 'blanks'
  | 'journey-flip' | 'journey-quiz' | 'journey-match' | 'journey-write' | 'journey-builder' | 'journey-blanks';

/** The Journey chapter node modes, in play order (French chapters add Blanks). */
export const JOURNEY_NODE_MODES: PracticeMode[] =
  ['journey-flip', 'journey-quiz', 'journey-write', 'journey-match', 'journey-builder', 'journey-blanks'];

/** True for any Journey single-pass node mode. */
export function isJourneyNodeMode(mode: PracticeMode): boolean {
  return (JOURNEY_NODE_MODES as string[]).includes(mode);
}

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
  /** Recorded pronunciation clip, when the source card has one. The Words page
   *  prefers this over TTS so playback matches the Flashcard modes. */
  audioUrl?: string;
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
  /** 5-round model: rounds completed (0-5). The level card ring fills by this. */
  roundsCompleted: number;
  attempts: number;
  isUnlocked: boolean;
  /** Skill name for skill-based decks (French); undefined for chunked decks. */
  skill?: string;
  /** Best completion time in seconds (Match mode); undefined if never timed. */
  bestTimeSeconds?: number;
  /** Best combo reached (Match mode); undefined if never played. */
  bestCombo?: number;
  /**
   * Actual number of pairs a Match session plays for this level (level words +
   * weakest review words from earlier levels). Only set in Match mode; other
   * modes use `cardCount`. Lets the UI show the true count (which the combo can
   * reach) instead of the generic level size.
   */
  matchWordCount?: number;
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
  /** Shared in-flight init promise so concurrent first-callers (app boot +
   *  the first page) don't each start the heavy load. */
  private initPromise: Promise<void> | null = null;
  private db = getDatabase();
  
  readonly decks = computed(() => this.decksSignal());
  readonly totalCards = computed(() => 
    this.decksSignal().reduce((sum, deck) => sum + deck.cards.length, 0)
  );

  constructor(private http: HttpClient) {}

  /**
   * Initialize the service - load bundled decks and user data. Idempotent:
   * runs at most once per session, and concurrent callers share one promise.
   * Kick it off as early as possible (app boot) so the work overlaps the
   * splash screen instead of stalling the first mode the user opens.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      // Load bundled decks (JSON assets) and user decks (IndexedDB) in
      // parallel, then merge saved progress with a single bulk read per deck.
      const [bundledDecks, userDecks] = await Promise.all([
        this.loadBundledDecks(),
        this.loadUserDecks(),
      ]);

      await Promise.all([
        this.loadProgress(bundledDecks),
        this.loadProgress(userDecks),
      ]);

      this.decksSignal.set([...bundledDecks, ...userDecks]);
      this.invalidateDedupe();
      this.initialized = true;
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

      // ONE bulk read per deck instead of one IndexedDB get() per card. The old
      // per-card loop did ~7205 serial round-trips for the French deck, which
      // stalled startup for many seconds on slow phones. Here we read all saved
      // rows for this deck once and merge them in memory via a Map lookup.
      const saved = await this.db.flashcards.where('deckId').equals(deck.id).toArray();
      if (saved.length === 0) continue;
      const byId = new Map(saved.map(s => [s.id, s]));

      for (const card of deck.cards) {
        const savedProgress = byId.get(card.id);
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
    this.invalidateDedupe(deck.id);
    
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
    this.invalidateDedupe(deck.id);

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

  /** Public form of excludeHidden, for pages that serve level cards directly
   *  (e.g. Flashcards flip) so hidden words don't appear in a level session. */
  excludeHiddenCards(cards: Flashcard[]): Flashcard[] {
    return this.excludeHidden(cards);
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

    // The deduped list holds COPIES of the cards, so mutating the originals
    // above doesn't change what getStudiedWords/getDedupedCards return until the
    // cache is rebuilt. Without this, "Your words" kept showing pre-lesson
    // counts until the app was reopened. Drop this deck's memo so the next read
    // rebuilds from the live card.
    this.invalidateDedupe(deckId);

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
    this.invalidateDedupe(deckId);
    
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

  /**
   * Delete ALL learning data for one language, as triggered by the Settings
   * "Delete learning data" action. This:
   *  - resets every card's progress (counters, streak, review dates, FSRS
   *    spaced-repetition state) for that language's decks,
   *  - clears per-deck level/star progress,
   *  - deletes any user-imported / manually-added (non-bundled) decks for the
   *    language, including their custom cards,
   *  - clears the Phrase Builder progress stored for the language.
   * Bundled decks remain (so the language itself stays available to study
   * again from scratch).
   */
  async resetLanguageData(languageCode: string): Promise<void> {
    await this.initialize();

    const decks = this.getAllDecks().filter(d => d.languageCode === languageCode);

    for (const deck of decks) {
      if (deck.isBundled) {
        // Wipe progress but keep the bundled deck + its cards.
        for (const card of deck.cards) {
          card.correctCount = 0;
          card.incorrectCount = 0;
          card.mediumCount = 0;
          card.lastSeen = null;
          card.nextReview = null;
          card.streak = 0;
          card.fsrs = undefined;
          card.priority = undefined;
          await this.saveCardProgress(card);
          // saveCardProgress preserves the old fsrs/priority when the in-memory
          // value is undefined, so clear those stored fields explicitly.
          await this.db.flashcards.update(card.id, { fsrs: undefined, priority: undefined });
        }
        await this.db.levelProgress.where('deckId').equals(deck.id).delete();
        this.invalidateDedupe(deck.id);
      } else {
        // User-imported / manual deck: remove it entirely (cards + deck + levels).
        await this.db.flashcards.where('deckId').equals(deck.id).delete();
        await this.db.flashcardDecks.delete(deck.id);
        await this.db.levelProgress.where('deckId').equals(deck.id).delete();
        this.invalidateDedupe(deck.id);
      }
    }

    // Drop deleted user decks from the in-memory list; keep the rest.
    const removedIds = new Set(decks.filter(d => !d.isBundled).map(d => d.id));
    this.decksSignal.update(list => [...list.filter(d => !removedIds.has(d.id))]);

    // Phrase Builder keeps its own per-language progress in localStorage.
    try {
      localStorage.removeItem(`boosted-builder-progress-${languageCode}`);
    } catch { /* ignore storage errors */ }
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
    const touchedDecks = new Set<string>();
    for (const deck of decks) {
      for (const card of deck.cards) {
        if (this.normalizeKey(card.text) === key) {
          card.priority = priority;
          toSave.push(card);
          touchedDecks.add(deck.id);
        }
      }
    }

    for (const card of toSave) {
      await this.saveCardProgress(card);
    }

    // The deduped list is memoised and holds COPIES of the cards, so mutating
    // the originals above doesn't change what getStudiedWords/getDedupedCards
    // return until the cache is rebuilt. Without this the Words list showed the
    // old priority until the app was reopened. Invalidate the touched decks.
    for (const id of touchedDecks) this.invalidateDedupe(id);

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

    // Keep the lightweight display stats in sync. The Flashcards breakdown is a
    // snapshot of the learner's CURRENT knowledge, so the LATEST rating decides
    // the bucket: rating a card "know it" clears its earlier "don't know" (and
    // vice-versa). Without this reset the counters only ever accumulated, so a
    // card marked "don't know" once could never turn green no matter how many
    // times it was later known. (FSRS scheduling keeps its own full history via
    // the engine above — this only affects the red/green display buckets.)
    if (rating === 'easy') {
      card.correctCount += 1;
      card.incorrectCount = 0;   // latest rating is "know it" → clear red
      card.mediumCount = 0;
      card.streak += 1;
    } else if (rating === 'hard') {
      card.incorrectCount += 1;
      card.correctCount = 0;     // latest rating is "don't know" → clear green
      card.streak = 0;
    } else {
      // 'medium' = so-so: track separately; doesn't extend or reset the streak.
      card.mediumCount = (card.mediumCount ?? 0) + 1;
    }
    card.lastSeen = now.toISOString();
    card.nextReview =
      next.due instanceof Date ? next.due.toISOString() : new Date(next.due).toISOString();

    await this.saveCardProgress(card);
    // The deduped-cards cache holds SNAPSHOT copies (built with {...card}); it's
    // keyed by the deck.cards array reference, which rating mutates in place
    // (same reference) — so without invalidating it, "Your words" / breakdowns
    // kept showing pre-rating counts until the app was reopened. Drop it so the
    // next read rebuilds from the live cards.
    this.invalidateDedupe(deck.id);
    this.decksSignal.update(decks => [...decks]);
  }

  // ============================================
  // Translation display helpers
  // ============================================

  /**
   * Curated canonical English translations for high-frequency words whose
   * scraped translation list has a wrong/junk/arbitrary leading entry.
   * Scoped BY LANGUAGE (keyed by the lowercased source word) because the same
   * spelling can mean different things per language (e.g. "de" = "the" in
   * Dutch but "of" in French).
   */
  private readonly CURATED_TRANSLATIONS: Record<string, Record<string, string>> = {
    nl: {
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
    },
    fr: {
      // Words whose scraped data is wrong, arbitrary, or confusing.
      // (The heuristic handles most French words; these are the exceptions.)
      de: 'of',
      'à': 'to',
      es: 'are',               // tu es = you are (data leads with "feel")
      'tu parles': 'you talk', // data has only "Yeah"/"right"
      master: "master's degree",
      maternel: 'maternal',
      'nouvel an': 'New Year',
      chambre: 'bedroom',   // data leads with "rooms'"
      des: 'some',          // partitive/plural article; data leads with "city's"
      du: 'of the',
      ma: 'my',
      salle: 'room',
      spectacle: 'show',
      professionnel: 'professional',
      marque: 'brand',
      'musée': 'museum',
      national: 'national',
      actuel: 'current',
      local: 'local',
    },
  };

  /**
   * Contractions that are legitimate standalone meanings (not junk).
   * e.g. "il est" -> "he's", "peux plus" -> "can't".
   */
  private readonly OK_CONTRACTIONS = new Set([
    "he's", "she's", "it's", "that's", "there's", "here's", "what's", "who's",
    "let's", "i'm", "you're", "we're", "they're", "i've", "i'd", "i'll",
    "can't", "won't", "don't", "doesn't", "didn't", "isn't", "aren't",
    "wasn't", "weren't", "couldn't", "wouldn't", "shouldn't", "haven't",
    "hasn't", "o'clock",
  ]);

  /** True when a translation is junk: a noun possessive ("book's"), bare "'s",
   *  a single letter other than I/a, or an abbreviation like "f.". Real
   *  contractions ("he's", "can't") are NOT junk. */
  private isJunkTranslation(raw: string): boolean {
    const s = raw.trim();
    const low = s.toLowerCase().replace('\u2019', "'");
    if (s.length === 0) return true;
    if (low === "'s") return true;
    if (s.length === 1 && low !== 'i' && low !== 'a') return true;
    if (/^[a-z]\.$/i.test(s)) return true;
    if (/['\u2019]s$/i.test(s) && !this.OK_CONTRACTIONS.has(low)) return true;
    return false;
  }

  /** True for English gerunds ("talking") — deprioritized when a non-gerund
   *  option exists, but never excluded (some words only have an -ing form).
   *  A few -ing words that are NOT gerunds are excluded from this test. */
  private isGerund(s: string): boolean {
    const t = s.trim();
    if (/^(.?ring|thing|spring|string|king|wing|ceiling|evening|morning|building|meeting|feeling|boarding|landing|wedding|something|nothing|everything)$/i.test(t)) {
      return false;
    }
    return /\w+ing$/i.test(t);
  }

  /**
   * Choose the best English translation to DISPLAY for a card.
   *
   *   1. Curated override wins (fixes words whose data is wrong/arbitrary).
   *   2. Otherwise trust translations[0] (duome lists the primary sense first)
   *      unless it's junk, a gerund, or a negation.
   *   3. Else pick the first non-junk, non-gerund, non-negation option.
   *   4. Else the first non-junk option (an -ing/"'t" word that IS the meaning).
   *   5. Else the shortest raw option.
   */
  bestTranslation(card: Flashcard): string {
    const langCode = this.getDeck(card.deckId)?.languageCode ?? '';
    const curated = this.CURATED_TRANSLATIONS[langCode]?.[card.text.trim().toLowerCase()];
    if (curated) return curated;

    const all = (card.translations ?? []).map(s => s.trim()).filter(Boolean);
    if (all.length === 0) return '';

    const isNegation = (s: string) => /n['\u2019]t$/i.test(s.trim());

    // Trust the primary sense unless it's clearly unusable.
    if (!this.isJunkTranslation(all[0]) && !this.isGerund(all[0]) && !isNegation(all[0])) {
      return all[0];
    }

    const nonJunk = all.filter(s => !this.isJunkTranslation(s));
    if (nonJunk.length === 0) {
      return [...all].sort((a, b) => a.length - b.length)[0];
    }

    const preferred = nonJunk.filter(s => !this.isGerund(s) && !isNegation(s));
    if (preferred.length > 0) return preferred[0];

    return nonJunk[0];
  }

  /**
   * All meaningful translations to show on a flashcard (the "learn" view),
   * so the user sees every valid sense — e.g. "copain" -> "friend, boyfriend"
   * — not just one. Drops junk (possessives like "friend's", bare "'s",
   * abbreviations) and de-duplicates case-insensitively, keeping source order.
   * If a curated override exists it is placed first. Capped at `max`.
   */
  displayTranslations(card: Flashcard, max = 4): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (s: string) => {
      const key = s.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(s.trim());
    };

    const langCode = this.getDeck(card.deckId)?.languageCode ?? '';
    const curated = this.CURATED_TRANSLATIONS[langCode]?.[card.text.trim().toLowerCase()];
    if (curated) add(curated);

    for (const t of card.translations ?? []) {
      if (!this.isJunkTranslation(t)) add(t);
    }
    // If everything was junk, fall back to the single best pick.
    if (out.length === 0) {
      const best = this.bestTranslation(card);
      if (best) add(best);
    }
    return out.slice(0, max);
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

  // ============================================
  // TEMPORARY: admin-only "Level 0" test cards
  // ============================================
  //
  // A throwaway test level available only when adminMode is on. It holds 2
  // fixed words that are identical in the base and target languages, so any
  // mode can be reached and finished in seconds for testing. Internally the
  // level is numbered -1 (a sentinel) because level 0 already means "quick
  // study / no level filter" everywhere; the UI shows it as "Level 0".
  //
  // This block is intentionally self-contained so it can be deleted in one go
  // when the test level is no longer needed. Progress is NEVER persisted for
  // it (the mode pages skip saveRoundProgress/recordAttempt for this level).

  /** Sentinel level number for the admin-only test level (shown as "Level 0"). */
  static readonly TEST_LEVEL = -1;
  /** The fixed test words (same in base + target language). */
  private static readonly TEST_WORDS = ['wifi', 'internet'];

  /** True for the admin-only test level. */
  isTestLevel(levelNumber: number): boolean {
    return levelNumber === FlashcardService.TEST_LEVEL;
  }

  /**
   * Build the 2 in-memory test cards for a deck. These are NOT part of the
   * deck's `cards` array and are never saved, so recordAttempt (which looks a
   * card up by id in the deck) naturally no-ops on them.
   */
  getTestLevelCards(deckId: string): Flashcard[] {
    return FlashcardService.TEST_WORDS.map(w => ({
      id: `test-${w}`,
      deckId,
      text: w,
      translations: [w],
      correctCount: 0,
      incorrectCount: 0,
      lastSeen: null,
      nextReview: null,
      streak: 0,
      acceptedForms: [w],
      skill: 'Level 0 (test)',
    }));
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

  /** Lifetime accuracy (correct / seen) at/above which a word is "known". */
  private readonly KNOWN_MIN_ACCURACY = 0.7;
  /** Lifetime accuracy at/above which a word is "familiar". */
  private readonly FAMILIAR_MIN_ACCURACY = 0.5;

  /**
   * Map a card to its knowledge bucket purely from its lifetime ACCURACY
   * (correct / times seen) — see docs/LEVEL-ALGORITHM.md §10. Simple and
   * language-agnostic:
   *   - accuracy  > 70%            → known    (green)
   *   - 50% ≤ accuracy ≤ 70%       → familiar (yellow)
   *   - accuracy  < 50%            → learning (red)   (missed more than half)
   * A never-answered word (no correct/incorrect yet) is "learning" — it still
   * needs practice. Single source of truth shared by the home breakdown and the
   * Your Words list. (Replaced an earlier streak-based rule that could call a
   * word with a poor overall record "known" after a few lucky answers.)
   */
  private levelForCard(card: Flashcard): KnowledgeLevel {
    const correct = card.correctCount ?? 0;
    const incorrect = card.incorrectCount ?? 0;
    const seen = correct + incorrect;
    if (seen === 0) return 'learning';
    const accuracy = correct / seen;
    if (accuracy > this.KNOWN_MIN_ACCURACY) return 'known';
    if (accuracy >= this.FAMILIAR_MIN_ACCURACY) return 'familiar';
    return 'learning';
  }

  /**
   * Bucket a card for the FLASHCARDS level breakdown (pie ring + legend).
   *
   * This is deliberately NOT `levelForCard`: that one needs a long streak to
   * call a word "known", which is right for the long-term "Your words" mastery
   * view but wrong here — a single flip pass can never build a streak, so a
   * level you mostly *knew* would show all-red. Flashcards flip has its own
   * direct self-rating ("don't know" / "so-so" / "know"), so we classify from
   * those counts instead, reflecting what the user actually said. The rating is
   * now two-way (don't-know / know-it), so there are only two studied buckets:
   *   - known:    said "know" at least once and never "don't know".
   *   - learning: anything else that's been studied (said "don't know" at least
   *               once, or only legacy "so-so" ratings).
   * The old middle "familiar" / so-so bucket was removed. Legacy cards with a
   * mediumCount fall into "learning" unless they also have a clean "know".
   * See docs/LEVEL-ALGORITHM.md §6b.
   */
  private flipKnowledgeBucket(card: Flashcard): KnowledgeLevel {
    const know = card.correctCount ?? 0;
    const dont = card.incorrectCount ?? 0;

    if (know > 0 && dont === 0) return 'known';
    return 'learning';
  }

  /**
   * Knowledge breakdown for one Flashcards level: how many of the level's words
   * fall in each bucket (learning / familiar / known), plus the untouched ones.
   * The level's word set is FIXED (skill group or fixed 20-card slice), so this
   * is well-defined even before the user starts. Drives the pie ring + legend
   * on the Flashcards level list. See docs/LEVEL-ALGORITHM.md §6b.
   */
  getLevelKnowledge(deckId: string, levelNumber: number): {
    total: number; learning: number; familiar: number; known: number; neverStudied: number;
  } {
    const cards = this.getLevelCards(deckId, levelNumber);
    // getLevelCards returns cached SNAPSHOT copies (built once for speed), so
    // their counts go stale after practice. Read the LIVE card (by id) from the
    // deck so the breakdown reflects the latest ratings without rebuilding the
    // (expensive) cached structure. Falls back to the snapshot if not found.
    const deck = this.getDeck(deckId);
    const liveById = new Map<string, Flashcard>();
    if (deck) for (const c of deck.cards) liveById.set(c.id, c);

    const out = { total: cards.length, learning: 0, familiar: 0, known: 0, neverStudied: 0 };
    for (const snapshot of cards) {
      const c = liveById.get(snapshot.id) ?? snapshot;
      if (!this.hasBeenStudied(c)) { out.neverStudied++; continue; }
      out[this.flipKnowledgeBucket(c)]++;
    }
    return out;
  }

  /** Whether a card has been practiced at least once (any mode). */
  private hasBeenStudied(card: Flashcard): boolean {
    return card.lastSeen !== null || card.correctCount > 0 || card.incorrectCount > 0;
  }

  /**
   * How many of the deck's words the learner currently does NOT know (red /
   * 'learning' in the Flashcards breakdown). Drives the "practice unknowns"
   * button's visibility. Counts live cards, skips hidden ones, and de-dupes by
   * prompt so a word with several forms counts once.
   */
  countUnknownCards(deckId: string): number {
    return this.getUnknownCards(deckId, Number.MAX_SAFE_INTEGER).length;
  }

  /**
   * Up to `max` words the learner marked "don't know" (red / 'learning'),
   * for the "practice the words I don't know" Flashcards session. Rating one
   * "know it" there flips it green in its level (rateFlashcard clears the red).
   * Hidden words are excluded; de-duped by prompt; weakest-first ordering.
   */
  getUnknownCards(deckId: string, max = 20): Flashcard[] {
    const deck = this.getDeck(deckId);
    if (!deck) return [];
    const seen = new Set<string>();
    const unknown: Flashcard[] = [];
    for (const card of this.excludeHiddenCards(deck.cards)) {
      if (!this.hasBeenStudied(card)) continue;
      if (this.flipKnowledgeBucket(card) !== 'learning') continue;
      const key = this.normalizeKey(card.text);
      if (seen.has(key)) continue;
      seen.add(key);
      unknown.push(card);
    }
    // Weakest first: most "don't know"s, then most recently seen.
    unknown.sort((a, b) => {
      const d = (b.incorrectCount ?? 0) - (a.incorrectCount ?? 0);
      if (d !== 0) return d;
      return (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '');
    });
    return unknown.slice(0, Math.max(0, max));
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
        // Skip never-practised words — EXCEPT the user's own custom words, which
        // should appear in "Your words" right after being added (so the user
        // sees their new word immediately, before any practice).
        if (seen === 0 && medium === 0 && !card.isCustom) continue;

        const missRate = seen > 0 ? incorrect / seen : 0;
        // Same bucket rule as the home breakdown (streak + accuracy).
        const level = this.levelForCard(card);

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
          audioUrl: card.audioUrl,
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
        breakdown[this.levelForCard(card)]++;
        breakdown.total++;
      }
    }

    return breakdown;
  }

  // ============================================
  // Level System Methods
  // ============================================

  private readonly CARDS_PER_LEVEL = 20;

  // ── 5-round model (see docs/LEVEL-ALGORITHM.md) ────────────────────────────
  /** Rounds that make up one level. */
  readonly ROUNDS_PER_LEVEL = 5;
  /** First-try accuracy needed for a round to count toward the 5. */
  private readonly ROUND_PASS_SCORE = 70;
  /** Per-round composition: fraction of NEW (this-level) words. The rest is
   *  review drawn worst-first (round 5 biases to words missed in this level). */
  private readonly ROUND_NEW_FRACTION = [1.0, 0.9, 0.75, 0.6, 0.8];
  /** Target items per round (capped to the level's size). */
  private readonly ROUND_TARGET_ITEMS = 10;

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
  /**
   * Memo of the deduped result per deck, invalidated when the deck's `cards`
   * array reference changes. `getDeckLevels`/`getMatchSessionCards` call this
   * many times per render, so caching avoids repeatedly grouping thousands of
   * cards (which made the Match deck list slow on large courses).
   */
  private dedupeCache = new Map<string, { cards: Flashcard[]; result: Flashcard[] }>();

  /**
   * Memo of skill-grouped levels per deck, keyed on the deck's `cards` array
   * reference. getSkillLevels builds a whole-deck forms map (multiple passes
   * over every card) + a grouping/dedupe pass — very expensive for large decks
   * (the French course has 7205 cards). Without this cache it was rebuilt on
   * every getLevelCards/getLevelKnowledge call, freezing the UI when returning
   * to the list. Invalidated alongside dedupeCache.
   */
  private skillLevelsCache = new Map<string, { cards: Flashcard[]; result: Flashcard[][] }>();

  /** Clear the deduped-cards + skill-levels memos (all decks, or one). Call
   *  after adding/importing/removing cards so the grouped list is rebuilt. */
  private invalidateDedupe(deckId?: string): void {
    if (deckId) {
      this.dedupeCache.delete(deckId);
      this.skillLevelsCache.delete(deckId);
    } else {
      this.dedupeCache.clear();
      this.skillLevelsCache.clear();
    }
  }

  /** Primary-translation key for grouping a card by its English prompt. */
  private promptKeyOf(c: Flashcard): string {
    return this.normalizeKey(c.translations[0] ?? '');
  }

  /**
   * Map of prompt key -> every accepted target-language form for that prompt,
   * across the given cards. Shared by de-duplication AND by skill-level
   * building so that, e.g., the English "your" accepts BOTH "ta" and "ton"
   * (French), not just whichever card happens to be shown.
   */
  private buildFormsByPrompt(cards: Flashcard[]): Map<string, string[]> {
    const formsByPrompt = new Map<string, string[]>();
    const addForm = (key: string, word: string) => {
      const forms = formsByPrompt.get(key) ?? [];
      if (!forms.some(f => this.normalizeKey(f) === this.normalizeKey(word))) {
        forms.push(word);
      }
      formsByPrompt.set(key, forms);
    };
    // Pass 1: every card contributes its own word to its own prompt.
    for (const card of cards) {
      addForm(this.promptKeyOf(card), card.text);
    }
    // Pass 2: a card whose translations contain another prompt's word is also
    // a valid answer for that prompt (covers synonyms like we/wij, ta/ton).
    const promptKeys = new Set(formsByPrompt.keys());
    for (const card of cards) {
      for (const tr of card.translations) {
        const k = this.normalizeKey(tr);
        if (promptKeys.has(k)) addForm(k, card.text);
      }
    }
    return formsByPrompt;
  }

  getDedupedCards(deckId: string): Flashcard[] {
    const deck = this.getDeck(deckId);
    if (!deck) return [];

    const cached = this.dedupeCache.get(deckId);
    if (cached && cached.cards === deck.cards) {
      return cached.result;
    }

    // Group cards that share their PRIMARY English translation. Each group's
    // prompt is translations[0] of its first card. For every card in the
    // group we accept its word, plus words from other cards whose translation
    // list contains that same prompt word (synonyms like we/wij, ta/ton).
    const keyOf = (c: Flashcard) => this.promptKeyOf(c);
    const formsByPrompt = this.buildFormsByPrompt(deck.cards);

    // Keep only the first card per prompt, attaching all accepted forms.
    const seen = new Set<string>();
    const result: Flashcard[] = [];
    for (const card of deck.cards) {
      const key = keyOf(card);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...card, acceptedForms: formsByPrompt.get(key) ?? [card.text] });
    }

    // Cache against the current cards reference (invalidated when it changes).
    this.dedupeCache.set(deckId, { cards: deck.cards, result });
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

    // Memoised: rebuilding this over every card (×7205 for French) on each call
    // froze the UI. Reuse the cached result while the deck's cards are unchanged.
    const cached = this.skillLevelsCache.get(deckId);
    if (cached && cached.cards === deck.cards) return cached.result;

    // Accepted forms per English prompt across the WHOLE deck, so a prompt like
    // "your" accepts every French form (ta/ton/tes/votre/vos) no matter which
    // card is shown. Without this, skill-level cards carried no acceptedForms
    // and Write/Quiz only accepted the single shown form (e.g. "ta" but not
    // "ton"), marking a valid answer wrong.
    const formsByPrompt = this.buildFormsByPrompt(deck.cards);

    // Bucket the raw cards by skill first (keeping document order within each
    // skill), so we can then walk the skills in skillOrder and de-duplicate.
    const raw = new Map<string, { order: number; cards: Flashcard[] }>();
    for (const card of deck.cards) {
      const skill = card.skill ?? 'Uncategorized';
      const order = card.skillOrder ?? 9999;
      const g = raw.get(skill) ?? { order, cards: [] };
      g.cards.push(card);
      raw.set(skill, g);
    }

    // Walk skills in skillOrder and de-duplicate prompts GLOBALLY: a prompt key
    // lands only in the FIRST (earliest-order) skill that teaches it, and never
    // repeats in later levels. (Previously the `seen` set was per-skill, so a
    // word taught early reappeared in later skills.) Shared forms like ta/ton
    // (both "your") still collapse into one card that accepts every form.
    const seen = new Set<string>();
    const result = [...raw.values()]
      .sort((a, b) => a.order - b.order)
      .map(g => {
        const cards: Flashcard[] = [];
        for (const card of g.cards) {
          const key = this.promptKeyOf(card);
          if (seen.has(key)) continue;
          seen.add(key);
          cards.push({ ...card, acceptedForms: formsByPrompt.get(key) ?? [card.text] });
        }
        return cards;
      })
      // A skill whose every prompt was already taught earlier collapses to
      // nothing — drop it so levels stay contiguous (no empty levels).
      .filter(cards => cards.length > 0);
    this.skillLevelsCache.set(deckId, { cards: deck.cards, result });
    return result;
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
      
      // Unlock: Flashcards is free practice (all open). Otherwise level 1, or
      // the previous level has all 5 rounds done. Legacy records (no
      // roundsCompleted) fall back to the old >=70% score rule.
      const previousProgress = progressMap.get(levelNumber - 1);
      const prevRounds = previousProgress?.roundsCompleted;
      const prevUnlocks = prevRounds !== undefined
        ? prevRounds >= this.ROUNDS_PER_LEVEL
        : (previousProgress?.bestScore ?? 0) >= this.UNLOCK_SCORE;
      const isUnlocked = mode === 'flip' || levelNumber === 1 || prevUnlocks;
      
      levels.push({
        levelNumber,
        startIndex: 0,
        endIndex: 0,
        cardCount,
        skill: skillName,
        bestStars: progress?.bestStars ?? 0,
        bestScore: progress?.bestScore ?? 0,
        roundsCompleted: progress?.roundsCompleted ?? 0,
        attempts: progress?.attempts ?? 0,
        isUnlocked,
        bestTimeSeconds: progress?.bestTimeSeconds,
        bestCombo: progress?.bestCombo,
        // Match plays level words + review words; show the real pair count so
        // it lines up with the combo the user can reach. Only computed for
        // UNLOCKED levels — getMatchSessionCards is O(level) (it scans all
        // earlier levels), so doing it for every level of a 295-level course
        // was O(n²) and froze the page for several seconds. Locked levels show
        // the unlock hint instead of a count, so they don't need it.
        matchWordCount: mode === 'match' && isUnlocked
          ? this.playableCards(this.getMatchSessionCards(deckId, levelNumber)).length
          : undefined,
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

  // ── 5-round model API ──────────────────────────────────────────────────────

  /** How many of a level's 5 rounds are done (0-5). */
  async getRoundsCompleted(deckId: string, mode: PracticeMode, levelNumber: number): Promise<number> {
    const p = await this.getLevelProgress(deckId, mode, levelNumber);
    return p?.roundsCompleted ?? 0;
  }

  /**
   * Build the card set for a specific round (1-based) of a level, per the
   * composition in docs/LEVEL-ALGORITHM.md: increasingly review-heavy, with the
   * final round biased toward words the user missed in THIS level.
   *
   * `missedThisLevel` are card ids the user got wrong in earlier rounds of the
   * same level (the mode page tracks these across the 5 rounds).
   */
  getRoundCards(
    deckId: string,
    levelNumber: number,
    round: number,
    missedThisLevel: string[] = []
  ): Flashcard[] {
    // Exclude words hidden from practice (getLevelCards returns the fixed set).
    const levelCards = this.excludeHidden(this.getLevelCards(deckId, levelNumber));
    if (levelCards.length === 0) return [];

    const r = Math.max(1, Math.min(this.ROUNDS_PER_LEVEL, round));
    const newFraction = this.ROUND_NEW_FRACTION[r - 1];
    const target = Math.min(this.ROUND_TARGET_ITEMS, levelCards.length);

    // Round 1 (or any 100%-new round): just the level's words, shuffled.
    if (newFraction >= 1) return this.shuffleArr(levelCards).slice(0, Math.max(target, levelCards.length >= target ? target : levelCards.length));

    const newCount = Math.max(1, Math.round(target * newFraction));
    const reviewCount = Math.max(0, target - newCount);

    const newPart = this.shuffleArr(levelCards).slice(0, newCount);

    // Review pool: earlier-level words, worst-first. On the final round, bias
    // to words missed in THIS level first.
    let reviewPool: Flashcard[] = [];
    if (reviewCount > 0) {
      const earlier = this.getReviewPool(deckId, levelNumber);
      if (r === this.ROUNDS_PER_LEVEL && missedThisLevel.length > 0) {
        const missedSet = new Set(missedThisLevel);
        const missedCards = levelCards.filter(c => missedSet.has(c.id));
        reviewPool = [...missedCards, ...earlier];
      } else {
        reviewPool = earlier;
      }
    }
    const reviewPart = reviewPool.slice(0, reviewCount);

    return this.shuffleArr([...newPart, ...reviewPart]);
  }

  /** Earlier-level words ordered worst-first (weakest accuracy). */
  private getReviewPool(deckId: string, levelNumber: number): Flashcard[] {
    const deck = this.getDeck(deckId);
    if (!deck || levelNumber <= 1) return [];
    const deduped = this.getDedupedCards(deckId);
    const levelIds = new Set(this.getLevelCards(deckId, levelNumber).map(c => c.id));
    // Candidate review = everything not in the current level.
    const candidates = deduped.filter(c => !levelIds.has(c.id));
    const weakness = (c: Flashcard) => {
      const seen = c.correctCount + c.incorrectCount;
      return seen === 0 ? 0.5 : c.incorrectCount / seen;
    };
    return [...candidates].sort((a, b) => weakness(b) - weakness(a));
  }

  private shuffleArr<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Record the result of ONE round. Advances roundsCompleted when the round is
   * passed (>= ROUND_PASS_SCORE). Recomputes stars from the average of all
   * recorded round scores. Returns the updated round count + stars + whether
   * the level just became fully complete (all 5 rounds).
   */
  async saveRoundProgress(
    deckId: string,
    mode: PracticeMode,
    levelNumber: number,
    roundScorePercent: number,
    timeSeconds?: number,
    combo?: number
  ): Promise<{ roundsCompleted: number; stars: number; levelComplete: boolean }> {
    const progressId = this.levelProgressId(deckId, mode, levelNumber);
    const existing = await this.db.levelProgress.get(progressId);

    const prevRounds = existing?.roundsCompleted ?? 0;
    const passed = roundScorePercent >= this.ROUND_PASS_SCORE;
    // A round only advances the counter when passed and we aren't already at 5.
    const roundsCompleted = passed ? Math.min(this.ROUNDS_PER_LEVEL, prevRounds + 1) : prevRounds;

    const roundScores = [...(existing?.roundScores ?? [])];
    roundScores.push(roundScorePercent);

    // Stars for THIS round, from its first-try accuracy. The stored bestStars
    // keeps the best (highest) across rounds — see below. We still track the
    // running average for bestScore.
    const avg = roundScores.reduce((s, v) => s + v, 0) / roundScores.length;
    const roundStars = this.calculateStars(Math.round(roundScorePercent));
    const stars = Math.max(existing?.bestStars ?? 0, roundStars);

    let bestTimeSeconds = existing?.bestTimeSeconds;
    if (timeSeconds !== undefined) {
      bestTimeSeconds = bestTimeSeconds === undefined ? timeSeconds : Math.min(bestTimeSeconds, timeSeconds);
    }
    let bestCombo = existing?.bestCombo;
    if (combo !== undefined) {
      bestCombo = bestCombo === undefined ? combo : Math.max(bestCombo, combo);
    }

    const levelComplete = roundsCompleted >= this.ROUNDS_PER_LEVEL;

    const progress: LevelProgressEntity = {
      id: progressId,
      deckId,
      mode,
      levelNumber,
      // Stars = the BEST (highest) rating across all rounds of this level, like
      // best time / best combo. Once you earn a star count it sticks, even if a
      // later round scores lower. Shown from the first round on. bestScore keeps
      // the running average for reference.
      bestStars: stars,
      bestScore: Math.round(avg),
      attempts: (existing?.attempts ?? 0) + 1,
      lastAttempt: new Date().toISOString(),
      roundsCompleted,
      roundScores,
      ...(bestTimeSeconds !== undefined ? { bestTimeSeconds } : {}),
      ...(bestCombo !== undefined ? { bestCombo } : {}),
    };
    await this.db.levelProgress.put(progress);

    return { roundsCompleted, stars, levelComplete };
  }

  /**
   * DEV/admin: simulate completing ONE round of a level with the chosen star
   * rating (maps to a round score). Advances roundsCompleted by one — so
   * repeated use fills the ring 1/5 at a time, mirroring real play. This lets
   * you watch the levels-list ring fill step by step.
   */
  async adminForceComplete(deckId: string, mode: PracticeMode, levelNumber: number, stars: 0 | 1 | 2 | 3): Promise<void> {
    const pct = { 0: 30, 1: 75, 2: 90, 3: 100 }[stars];
    await this.saveRoundProgress(deckId, mode, levelNumber, pct);
  }

  /**
   * DEV/admin: complete ALL rounds of a level at once (fills the ring to 5/5)
   * with the chosen star rating, for fast testing of the 5-round modes. Runs
   * the per-round save enough times to reach ROUNDS_PER_LEVEL from the current
   * progress. A 0★ round score doesn't pass, so 0★ would never advance — we
   * floor the pass case to at least the pass score for 1★+, and for 0★ we only
   * record a (failing) round without looping forever.
   */
  async adminForceCompleteAllRounds(deckId: string, mode: PracticeMode, levelNumber: number, stars: 0 | 1 | 2 | 3): Promise<void> {
    const pct = { 0: 30, 1: 75, 2: 90, 3: 100 }[stars];
    if (stars === 0) { await this.saveRoundProgress(deckId, mode, levelNumber, pct); return; }

    // Passing rounds advance the counter by one each; loop until 5/5.
    for (let guard = 0; guard < this.ROUNDS_PER_LEVEL; guard++) {
      const res = await this.saveRoundProgress(deckId, mode, levelNumber, pct);
      if (res.levelComplete) break;
    }
  }

  /**
   * DEV-only: SET (not accumulate) a card's flip self-rating counts to a clean
   * state for a knowledge bucket, so the Flashcards admin "complete level" is
   * idempotent — picking 3★ marks every word "know it" the same way every time,
   * instead of nudging counts around. Mirrors `flipKnowledgeBucket`'s rule:
   *   known    → correct=1, medium=0, incorrect=0
   *   familiar → correct=1, medium=1, incorrect=0
   *   learning → correct=0, medium=0, incorrect=1
   */
  async adminSetFlipKnowledge(deckId: string, cardId: string, bucket: 'known' | 'familiar' | 'learning'): Promise<void> {
    const deck = this.getDeck(deckId);
    if (!deck) return;
    const card = deck.cards.find(c => c.id === cardId);
    if (!card) return;

    if (bucket === 'known') { card.correctCount = 1; card.mediumCount = 0; card.incorrectCount = 0; card.streak = 1; }
    else if (bucket === 'familiar') { card.correctCount = 1; card.mediumCount = 1; card.incorrectCount = 0; card.streak = 0; }
    else { card.correctCount = 0; card.mediumCount = 0; card.incorrectCount = 1; card.streak = 0; }

    card.lastSeen = new Date().toISOString();
    await this.saveCardProgress(card);
    this.decksSignal.update(d => [...d]);
  }

  /**
   * Get progress for a specific level
   */
  async getLevelProgress(deckId: string, mode: PracticeMode, levelNumber: number): Promise<LevelProgressEntity | null> {
    const progressId = this.levelProgressId(deckId, mode, levelNumber);
    return await this.db.levelProgress.get(progressId) ?? null;
  }

  /**
   * Bulk-read ALL level progress for a deck in ONE query, keyed by
   * `"<mode>-<levelNumber>"`. The Journey page needs every node's bestScore
   * across hundreds of chapters; doing one DB read + Map lookups is far faster
   * than ~1 read per node (which stalled the map on big decks / slow phones).
   */
  async getDeckLevelProgressMap(deckId: string): Promise<Map<string, LevelProgressEntity>> {
    const rows = await this.db.levelProgress.where('deckId').equals(deckId).toArray();
    const map = new Map<string, LevelProgressEntity>();
    for (const r of rows) map.set(`${r.mode}-${r.levelNumber}`, r);
    return map;
  }

  /**
   * Check if a level is unlocked
   */
  /** Minimum score on the previous level to unlock the next one (= 1 star). */
  private readonly UNLOCK_SCORE = 70;

  async isLevelUnlocked(deckId: string, mode: PracticeMode, levelNumber: number): Promise<boolean> {
    if (levelNumber === 1) return true;
    // Flashcards is a free practice mode: every level is always open so the
    // user can review anything. No round/unlock gating.
    if (mode === 'flip') return true;
    // Journey node modes: the Journey PAGE gates node/chapter unlocking, so the
    // exercise page itself shouldn't block on the generic rule.
    if (isJourneyNodeMode(mode)) return true;

    const previousProgress = await this.getLevelProgress(deckId, mode, levelNumber - 1);
    if (!previousProgress) return false;

    // Match is a quick timed game: requiring 5 full rounds just to unlock the
    // next level felt grindy (play the same board 5×). Unlock Match on a single
    // passing play (best score >= 70%). It still fills its 5-round ring for
    // stars/completion — that's separate from unlocking.
    if (mode === 'match') {
      return (previousProgress.bestScore ?? 0) >= this.UNLOCK_SCORE
        || (previousProgress.roundsCompleted ?? 0) >= this.ROUNDS_PER_LEVEL;
    }

    // 5-round model: the previous level must have all rounds completed.
    if (previousProgress.roundsCompleted !== undefined) {
      return previousProgress.roundsCompleted >= this.ROUNDS_PER_LEVEL;
    }
    // Legacy records (pre-rounds): fall back to the old score threshold so
    // existing progress keeps the next level open.
    return (previousProgress.bestScore ?? 0) >= this.UNLOCK_SCORE;
  }
}
