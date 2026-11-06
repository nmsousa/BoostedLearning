/**
 * Flashcards (flip) Page - classic spaced-repetition flashcards.
 *
 * Shows a Dutch word; the user taps to flip and reveal the English
 * translation, then self-rates with three options (sad / neutral / cool).
 * Scheduling is handled by FSRS (ts-fsrs) so the least-known cards resurface
 * most often and well-known ones only occasionally.
 *
 * @module app/flashcards/flip
 */

import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FlashcardService, Flashcard, FlashcardDeck, FlashcardRating, PracticeMode } from '../../services/flashcard.service';
import { ToastController, NavController } from '@ionic/angular';
import { AudioService } from '../../services/audio.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { AddWordService } from '../../services/add-word.service';
import { journeyBackUrl } from '../journey/journey-back';

type FlipPhase = 'card' | 'complete';

@Component({
  selector: 'app-flip',
  templateUrl: './flip.page.html',
  styleUrls: ['./flip.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlipPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private flashcardService = inject(FlashcardService);
  private audio = inject(AudioService);
  private settings = inject(SettingsService);
  private toast = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);
  private i18n = inject(I18nAngularService);
  private addWordService = inject(AddWordService);

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  /** Open the header menu: add a word, or hide the current word. */
  async openMenu(): Promise<void> {
    await this.addWordService.openModeMenu({
      languageCode: this.deck?.languageCode,
      currentWord: this.currentCard?.text ?? null,
      correctAnswer: this.currentCard ? this.flashcardService.bestTranslation(this.currentCard) : null,
      modeName: this.t('mode.titleFlip'),
      onHidden: () => this.skipHiddenCard(),
      // Admin shortcut: finish the session now. Like the other modes it writes
      // progress/stars, and (flip-specific) it also gives each would-be-played
      // card a RANDOM self-rating so the knowledge breakdown looks played.
      onAdminComplete: (stars) => this.adminCompleteLevel(stars),
    });
  }

  /**
   * DEV-only: finish the Flashcards session immediately with a chosen star
   * count. Flashcards is self-rated, so the rating applied to each remaining
   * card MUST match the chosen stars (3★ = "know it" everywhere, 0★ = "don't
   * know"), otherwise the knowledge breakdown contradicts the choice. Earlier
   * this used a random rating, which made 3★ still lower the green count.
   */
  private async adminCompleteLevel(stars: 0 | 1 | 2 | 3): Promise<void> {
    if (!this.deck) { this.router.navigate([this.backUrl], { replaceUrl: true }); return; }

    // Stars → knowledge bucket, applied as a clean SET (not accumulate) so the
    // action is idempotent: 3★ marks every word "know it" the same way each
    // time, 0★ "don't know", 1–2★ "so-so".
    const bucket: 'known' | 'familiar' | 'learning' =
      stars >= 3 ? 'known' : stars === 0 ? 'learning' : 'familiar';

    for (let i = this.currentIndex; i < this.cards.length; i++) {
      await this.flashcardService.adminSetFlipKnowledge(this.deck.id, this.cards[i].id, bucket);
    }

    // Persist the chosen star rating for the level (if this is a level session).
    if (this.levelNumber > 0) {
      await this.flashcardService.adminForceComplete(this.deck.id, this.mode, this.levelNumber, stars);
    }

    this.navCtrl.navigateBack(this.backUrl);
  }

  /** After hiding the current word, advance to the next card. */
  private skipHiddenCard(): void {
    this.currentIndex++;
    this.isFlipped = false;
    this.playCount = 0;
    if (this.currentIndex >= this.cards.length) {
      this.completeSession();
    }
    this.cdr.detectChanges();
  }

  deck: FlashcardDeck | null = null;
  levelNumber = 0;
  /** Progress namespace: 'flip' normally, 'journey-flip' as a Journey node. */
  private mode: PracticeMode = 'flip';
  /** Where the X / finish returns to. */
  private backUrl = '/practice';

  cards: Flashcard[] = [];
  /** Skill/title of the current level (for the header), if any. */
  /** True for the "practice the words I don't know" session (?mode=unknowns). */
  unknownsMode = false;
  get levelTitle(): string {
    if (this.unknownsMode) return this.i18n.t('mode.practiceUnknownsTitle');
    return this.cards[0]?.skill ?? '';
  }
  currentIndex = 0;
  isFlipped = false;
  phase: FlipPhase = 'card';
  /** True while the session is being prepared (DB load). */
  isLoading = true;

  // Exit animation direction for the current card: '' | 'left' | 'right' | 'down'.
  exitDirection: '' | 'left' | 'right' | 'down' = '';
  // Which rating button is briefly highlighted after a tap.
  pendingRating: FlashcardRating | null = null;
  // True briefly while the incoming card plays its entrance animation.
  entering = false;
  private animating = false;

  // Session tallies for the summary screen.
  ratedHard = 0;
  ratedMedium = 0;
  ratedEasy = 0;

  // Level result (stars) when played as a level session.
  earnedStars = 0;
  isNewBest = false;

  async ngOnInit() {
    await this.flashcardService.initialize();

    const deckId = this.route.snapshot.paramMap.get('id');
    const levelParam = this.route.snapshot.queryParamMap.get('level');
    this.levelNumber = levelParam ? parseInt(levelParam, 10) : 0;
    const modeParam = this.route.snapshot.queryParamMap.get('mode');
    // Journey Flashcards node: score under 'journey-flip', return to the map.
    if (modeParam === 'journey-flip') {
      this.mode = 'journey-flip';
      this.backUrl = journeyBackUrl(this.route.snapshot.queryParamMap);
    } else if (modeParam === 'unknowns') {
      // "Practice the words I don't know": a free session over the deck's red
      // cards. Scored under the normal 'flip' namespace so a "know it" here
      // flips the word green in its level (no separate progress).
      this.unknownsMode = true;
    }

    if (!deckId) {
      this.router.navigate([this.backUrl]);
      return;
    }

    this.deck = this.flashcardService.getDeck(deckId);
    if (!this.deck) {
      this.router.navigate([this.backUrl]);
      return;
    }

    // Pull cards: unknowns session, a specific level, or an urgency queue.
    if (this.flashcardService.isTestLevel(this.levelNumber)) {
      // TEMPORARY: admin test level — 2 fixed words, no persistence.
      this.cards = this.flashcardService.getTestLevelCards(deckId);
    } else if (this.unknownsMode) {
      this.cards = this.flashcardService.getUnknownCards(deckId, 20);
    } else if (this.levelNumber > 0) {
      const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, this.mode, this.levelNumber);
      if (!isUnlocked) {
        this.router.navigate([this.backUrl]);
        return;
      }
      // Exclude words the user hid from practice (getLevelCards returns the
      // fixed level set, which still includes hidden words).
      this.cards = this.flashcardService.excludeHiddenCards(
        this.flashcardService.getLevelCards(deckId, this.levelNumber)
      );
    } else {
      this.cards = this.flashcardService.getFlashcardQueue(deckId, 20);
    }

    if (this.cards.length === 0) {
      this.phase = 'complete';
    }

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  get currentCard(): Flashcard | null {
    return this.cards[this.currentIndex] ?? null;
  }

  get progress(): number {
    if (this.cards.length === 0) return 0;
    return (this.currentIndex / this.cards.length) * 100;
  }

  /** Dutch word (front of the card). */
  get frontText(): string {
    return this.currentCard?.text ?? '';
  }

  /** English translations (back of the card) — all meaningful senses, cleaned
   *  of junk possessives (e.g. "copain" -> "friend, boyfriend"). */
  get backText(): string {
    const c = this.currentCard;
    if (!c) return '';
    return this.flashcardService.displayTranslations(c, 4).join(', ');
  }

  /** Localized display name of the learning language (front-of-card tag). */
  get targetLangName(): string {
    const code = this.deck?.languageCode ?? '';
    const key = `langName.${code}`;
    const name = this.i18n.t(key);
    // Fall back to the deck name / code if there's no catalog entry.
    return name === key ? (this.deck?.name || code.toUpperCase() || '') : name;
  }

  flip() {
    this.isFlipped = !this.isFlipped;
  }

  /** How many times the (normal-speed) word audio has been played this card. */
  playCount = 0;

  /** Show the slow-replay button only after the word was played twice. */
  get showSlowButton(): boolean {
    return this.playCount >= 2;
  }

  /** Play the current word: recorded clip if available, else device TTS. */
  async playWord(event: Event, slow = false) {
    event.stopPropagation();
    if (!this.currentCard) return;
    if (!slow) this.playCount++;
    const res = await this.audio.playWord(
      this.currentCard.text,
      this.currentCard.audioUrl,
      this.settings.learningLanguage(),
      slow
    );
    if (!res.ok && res.reason) {
      const t = await this.toast.create({ message: res.reason, duration: 2500, position: 'bottom' });
      await t.present();
    }
  }

  async rate(rating: FlashcardRating) {
    const card = this.currentCard;
    if (!card || !this.deck || this.animating) return;

    this.animating = true;
    this.pendingRating = rating;

    if (rating === 'hard') this.ratedHard++;
    else if (rating === 'medium') this.ratedMedium++;
    else this.ratedEasy++;

    // Persist the rating immediately; the visual swipe runs in parallel.
    await this.flashcardService.rateFlashcard(this.deck.id, card.id, rating);

    // Swipe direction mirrors the rating: hard=left, easy=right, so-so=down.
    this.exitDirection = rating === 'hard' ? 'left' : rating === 'easy' ? 'right' : 'down';
    this.cdr.detectChanges();

    // After the exit animation, advance and reset for the next card.
    setTimeout(() => {
      this.currentIndex++;
      this.isFlipped = false;
      this.exitDirection = '';
      this.pendingRating = null;
      this.playCount = 0;

      if (this.currentIndex >= this.cards.length) {
        this.completeSession();
      } else {
        // Play a brief entrance animation on the incoming card.
        this.entering = true;
      }
      this.cdr.detectChanges();

      // Clear the entrance flag after it plays, and unlock input.
      setTimeout(() => {
        this.entering = false;
        this.animating = false;
        this.cdr.detectChanges();
      }, 260);
    }, 300);
  }

  /**
   * Finish the session: compute a score and, for level sessions, persist
   * stars. Know it = full credit, So-so = half credit, Don't know = none.
   */
  private async completeSession() {
    this.phase = 'complete';

    const total = this.cards.length;
    const weighted = this.ratedEasy * 1 + this.ratedMedium * 0.5;
    const scorePercent = total > 0 ? Math.round((weighted / total) * 100) : 0;

    if (this.levelNumber > 0 && this.deck) {
      // Flashcards is free practice (no rounds, no unlock gating). We still
      // record a best score/stars for display via the simple single-pass save.
      // As a Journey node, flip has no real "fail" (it's self-rated), so going
      // through all cards passes the node — record at least the pass line.
      const effectivePct = this.mode === 'journey-flip' ? Math.max(scorePercent, 70) : scorePercent;
      const effectiveCorrect = Math.round((effectivePct / 100) * total);
      const result = await this.flashcardService.saveLevelProgress(
        this.deck.id,
        this.mode,
        this.levelNumber,
        effectiveCorrect,
        total
      );
      this.earnedStars = result.stars;
      this.isNewBest = result.isNewBest;
    } else {
      this.earnedStars = this.flashcardService.calculateStars(scorePercent);
    }

    this.cdr.detectChanges();
  }

  finish() {
    this.navCtrl.navigateBack(this.backUrl);
  }

  close() {
    this.navCtrl.navigateBack(this.backUrl);
  }
}
