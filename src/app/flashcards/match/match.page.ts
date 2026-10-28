/**
 * Match Page - connect-the-pairs practice.
 *
 * Shows a batch of Dutch words on the left and their shuffled English
 * translations on the right. The user taps one item on each side to link
 * them; correct pairs lock in, wrong pairs flash and reset. When the batch
 * is cleared, the next batch loads until the level's words are done.
 *
 * @module app/flashcards/match
 */

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FlashcardService, Flashcard, FlashcardDeck } from '../../services/flashcard.service';

type Side = 'left' | 'right';
type MatchPhase = 'play' | 'complete';

interface MatchItem {
  id: string;        // pair id (same on both sides)
  label: string;     // text shown
  side: Side;
  matched: boolean;  // locked in as a correct pair
  wrong: boolean;    // transient wrong-flash state
}

@Component({
  selector: 'app-match',
  templateUrl: './match.page.html',
  styleUrls: ['./match.page.scss'],
  standalone: false,
})
export class MatchPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private flashcardService = inject(FlashcardService);
  private cdr = inject(ChangeDetectorRef);

  deck: FlashcardDeck | null = null;
  levelNumber = 0;

  private readonly BATCH_SIZE = 6;

  // All cards for the session, consumed batch by batch.
  private queue: Flashcard[] = [];
  private totalPairs = 0;
  private solvedPairs = 0;

  leftItems: MatchItem[] = [];
  rightItems: MatchItem[] = [];

  selectedLeft: MatchItem | null = null;
  selectedRight: MatchItem | null = null;

  phase: MatchPhase = 'play';
  mistakes = 0;
  earnedStars = 0;
  isNewBest = false;
  private locked = false; // ignore taps during the wrong-flash animation

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

    let cards: Flashcard[];
    if (this.levelNumber > 0) {
      const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, this.levelNumber);
      if (!isUnlocked) {
        this.router.navigate(['/flashcards']);
        return;
      }
      cards = this.flashcardService.getLevelCards(deckId, this.levelNumber);
    } else {
      cards = this.flashcardService.getFlashcardQueue(deckId, 20);
    }

    this.queue = this.shuffle(cards);
    this.totalPairs = this.queue.length;

    if (this.queue.length === 0) {
      this.phase = 'complete';
    } else {
      this.loadNextBatch();
    }

    this.cdr.detectChanges();
  }

  get progress(): number {
    if (this.totalPairs === 0) return 0;
    return (this.solvedPairs / this.totalPairs) * 100;
  }

  /** Load the next batch of up to BATCH_SIZE pairs onto the board. */
  private loadNextBatch() {
    const batch = this.queue.splice(0, this.BATCH_SIZE);

    const left: MatchItem[] = batch.map(c => ({
      id: c.id,
      label: c.text,
      side: 'left',
      matched: false,
      wrong: false,
    }));

    const right: MatchItem[] = batch.map(c => ({
      id: c.id,
      label: c.translations[0] ?? '',
      side: 'right',
      matched: false,
      wrong: false,
    }));

    this.leftItems = left;
    this.rightItems = this.shuffle(right);
    this.selectedLeft = null;
    this.selectedRight = null;
  }

  select(item: MatchItem) {
    if (this.locked || item.matched) return;

    if (item.side === 'left') {
      this.selectedLeft = this.selectedLeft?.id === item.id && this.selectedLeft.side === item.side
        ? null
        : item;
    } else {
      this.selectedRight = this.selectedRight === item ? null : item;
    }

    // When one on each side is picked, evaluate the pair.
    if (this.selectedLeft && this.selectedRight) {
      this.evaluatePair();
    }
  }

  isSelected(item: MatchItem): boolean {
    return item === this.selectedLeft || item === this.selectedRight;
  }

  private evaluatePair() {
    const left = this.selectedLeft!;
    const right = this.selectedRight!;

    if (left.id === right.id) {
      // Correct pair - lock both in.
      left.matched = true;
      right.matched = true;
      this.selectedLeft = null;
      this.selectedRight = null;
      this.solvedPairs++;

      // Record a positive attempt for scheduling.
      if (this.deck) {
        this.flashcardService.rateFlashcard(this.deck.id, left.id, 'easy');
      }

      // Batch cleared?
      if (this.leftItems.every(i => i.matched)) {
        if (this.queue.length > 0) {
          // brief pause then next batch
          this.locked = true;
          setTimeout(() => {
            this.loadNextBatch();
            this.locked = false;
            this.cdr.detectChanges();
          }, 350);
        } else {
          this.completeSession();
        }
      }
    } else {
      // Wrong pair - flash red then reset.
      this.mistakes++;
      left.wrong = true;
      right.wrong = true;
      this.locked = true;

      if (this.deck) {
        this.flashcardService.rateFlashcard(this.deck.id, left.id, 'hard');
      }

      setTimeout(() => {
        left.wrong = false;
        right.wrong = false;
        this.selectedLeft = null;
        this.selectedRight = null;
        this.locked = false;
        this.cdr.detectChanges();
      }, 650);
    }
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Finish: score by first-try accuracy (each mistake costs one pair's worth)
   * and persist stars for level sessions.
   */
  private async completeSession() {
    this.phase = 'complete';

    const total = this.totalPairs;
    const cleanPairs = Math.max(0, total - this.mistakes);
    const scorePercent = total > 0 ? Math.round((cleanPairs / total) * 100) : 0;

    if (this.levelNumber > 0 && this.deck) {
      const result = await this.flashcardService.saveLevelProgress(
        this.deck.id,
        this.levelNumber,
        cleanPairs,
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
