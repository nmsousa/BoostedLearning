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

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FlashcardService, Flashcard, FlashcardDeck, FlashcardRating } from '../../services/flashcard.service';
import { ToastController } from '@ionic/angular';
import { AudioService } from '../../services/audio.service';
import { SettingsService } from '../../services/settings.service';

type FlipPhase = 'card' | 'complete';

@Component({
  selector: 'app-flip',
  templateUrl: './flip.page.html',
  styleUrls: ['./flip.page.scss'],
  standalone: false,
})
export class FlipPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private flashcardService = inject(FlashcardService);
  private audio = inject(AudioService);
  private settings = inject(SettingsService);
  private toast = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  deck: FlashcardDeck | null = null;
  levelNumber = 0;

  cards: Flashcard[] = [];
  currentIndex = 0;
  isFlipped = false;
  phase: FlipPhase = 'card';

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

    if (!deckId) {
      this.router.navigate(['/flashcards']);
      return;
    }

    this.deck = this.flashcardService.getDeck(deckId);
    if (!this.deck) {
      this.router.navigate(['/flashcards']);
      return;
    }

    // Pull cards for this level if given, else an urgency-ordered queue.
    if (this.levelNumber > 0) {
      const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, 'flip', this.levelNumber);
      if (!isUnlocked) {
        this.router.navigate(['/flashcards']);
        return;
      }
      this.cards = this.flashcardService.getLevelCards(deckId, this.levelNumber);
    } else {
      this.cards = this.flashcardService.getFlashcardQueue(deckId, 20);
    }

    if (this.cards.length === 0) {
      this.phase = 'complete';
    }

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

  /** English translations (back of the card). */
  get backText(): string {
    const c = this.currentCard;
    if (!c) return '';
    return c.translations.slice(0, 4).join(', ');
  }

  /** Display name of the learning language (front-of-card tag). */
  get targetLangName(): string {
    const names: Record<string, string> = {
      nl: 'Dutch', dn: 'Dutch', fr: 'French', es: 'Spanish', it: 'Italian',
      de: 'German', pt: 'Portuguese', en: 'English',
    };
    const code = this.deck?.languageCode ?? '';
    return names[code] ?? (this.deck?.name || code.toUpperCase() || 'Word');
  }

  flip() {
    this.isFlipped = !this.isFlipped;
  }

  /** Play the current word: recorded clip if available, else device TTS. */
  async playWord(event: Event) {
    event.stopPropagation();
    if (!this.currentCard) return;
    const res = await this.audio.playWord(
      this.currentCard.text,
      this.currentCard.audioUrl,
      this.settings.learningLanguage()
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
      // saveLevelProgress expects a "correct count"; pass the weighted score
      // expressed as a count out of total so it computes the same percentage.
      const effectiveCorrect = Math.round((scorePercent / 100) * total);
      const result = await this.flashcardService.saveLevelProgress(
        this.deck.id,
        'flip',
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
    this.router.navigate(['/flashcards'], { replaceUrl: true });
  }

  close() {
    this.router.navigate(['/flashcards'], { replaceUrl: true });
  }
}
