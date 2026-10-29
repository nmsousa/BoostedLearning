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

  // How many pairs are visible on the board at once. As each correct match is
  // made, the cleared pair is immediately replaced with a fresh one (if any
  // remain in the queue), so the board stays filled instead of draining.
  private readonly VISIBLE_PAIRS = 5;

  // Words not yet placed on the board.
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
      const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, 'match', this.levelNumber);
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
      this.fillBoard();
    }

    this.cdr.detectChanges();
  }

  get progress(): number {
    if (this.totalPairs === 0) return 0;
    return (this.solvedPairs / this.totalPairs) * 100;
  }

  /** Build the two tiles (left + right) for one card. */
  private makePair(card: Flashcard): { left: MatchItem; right: MatchItem } {
    return {
      left: { id: card.id, label: card.text, side: 'left', matched: false, wrong: false },
      right: { id: card.id, label: card.translations[0] ?? '', side: 'right', matched: false, wrong: false },
    };
  }

  /** Initial board fill: up to VISIBLE_PAIRS pairs from the queue. */
  private fillBoard() {
    const first = this.queue.splice(0, this.VISIBLE_PAIRS);
    const lefts: MatchItem[] = [];
    const rights: MatchItem[] = [];
    for (const card of first) {
      const { left, right } = this.makePair(card);
      lefts.push(left);
      rights.push(right);
    }
    this.leftItems = lefts;
    this.rightItems = this.shuffle(rights);
    this.selectedLeft = null;
    this.selectedRight = null;
  }

  /**
   * Replace a just-matched pair with a fresh one from the queue (if any),
   * so the board stays full. The new left tile takes the matched left's slot;
   * the new right tile is inserted at a random position so columns don't line
   * up. If the queue is empty, the matched tiles are simply removed.
   */
  private refillAfterMatch(matchedId: string) {
    const leftIndex = this.leftItems.findIndex(i => i.id === matchedId);
    const rightIndex = this.rightItems.findIndex(i => i.id === matchedId);

    const next = this.queue.shift();

    if (next) {
      const { left, right } = this.makePair(next);
      // Swap the new left tile into the cleared left slot.
      if (leftIndex >= 0) this.leftItems.splice(leftIndex, 1, left);
      // Remove the cleared right tile and drop the new one in at a random spot.
      if (rightIndex >= 0) this.rightItems.splice(rightIndex, 1);
      const insertAt = Math.floor(Math.random() * (this.rightItems.length + 1));
      this.rightItems.splice(insertAt, 0, right);
    } else {
      // No more words: remove the matched tiles from the board.
      if (leftIndex >= 0) this.leftItems.splice(leftIndex, 1);
      if (rightIndex >= 0) this.rightItems.splice(rightIndex, 1);
    }
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
      // Correct pair - briefly mark it matched (fade), then swap in a fresh
      // pair so the board stays filled.
      const matchedId = left.id;
      left.matched = true;
      right.matched = true;
      this.selectedLeft = null;
      this.selectedRight = null;
      this.solvedPairs++;

      // Record a positive attempt for scheduling.
      if (this.deck) {
        this.flashcardService.rateFlashcard(this.deck.id, matchedId, 'easy');
      }

      this.locked = true;
      setTimeout(() => {
        this.refillAfterMatch(matchedId);
        this.locked = false;

        // Done when nothing is left on the board and the queue is drained.
        if (this.leftItems.length === 0 && this.queue.length === 0) {
          this.completeSession();
        }
        this.cdr.detectChanges();
      }, 250);
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
        'match',
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
