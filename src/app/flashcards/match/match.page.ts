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

import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
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
export class MatchPage implements OnInit, OnDestroy {
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
  /** Best completion time for this level (seconds), across runs. */
  bestTimeSeconds: number | null = null;
  /** A hint like "Finish under 0:25 for 3 stars" shown when not yet 3 stars. */
  nextStarHint = '';
  private locked = false; // ignore taps during the wrong-flash animation

  // Timer (counts up from the first board being shown).
  elapsedSeconds = 0;
  private timerStart = 0;
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  // Combo: current streak of consecutive correct matches, and the best this run.
  combo = 0;
  bestCombo = 0;

  // The number of rows the board started with. Used to reserve a stable board
  // height so the layout doesn't re-center (and the timer doesn't drift down)
  // as tiles are removed near the end of the level.
  private initialRows = 0;

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

    // Exclude cards whose Dutch word is identical to its English translation
    // (e.g. "water" = "water"). They make a trivial/ambiguous match and look
    // like duplicate tiles on the board.
    cards = cards.filter(c => !this.isIdenticalPair(c));

    this.queue = this.shuffle(cards);
    this.totalPairs = this.queue.length;

    if (this.queue.length === 0) {
      this.phase = 'complete';
    } else {
      this.fillBoard();
      this.startTimer();
    }

    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  /** Start the count-up timer, ticking once a second. */
  private startTimer() {
    this.timerStart = Date.now();
    this.elapsedSeconds = 0;
    this.stopTimer();
    this.timerHandle = setInterval(() => {
      this.elapsedSeconds = Math.floor((Date.now() - this.timerStart) / 1000);
      this.cdr.detectChanges();
    }, 1000);
  }

  private stopTimer() {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  /** mm:ss display for the elapsed time. */
  get formattedTime(): string {
    const m = Math.floor(this.elapsedSeconds / 60);
    const s = this.elapsedSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  get progress(): number {
    if (this.totalPairs === 0) return 0;
    return (this.solvedPairs / this.totalPairs) * 100;
  }

  /**
   * True when the card's word equals its primary translation (case/space
   * insensitive) — i.e. the same text would appear on both sides of the board.
   */
  private isIdenticalPair(card: Flashcard): boolean {
    const norm = (s: string) => s.trim().toLowerCase();
    const word = norm(card.text);
    const translation = norm(card.translations[0] ?? '');
    return word.length > 0 && word === translation;
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
    this.initialRows = lefts.length;
    this.selectedLeft = null;
    this.selectedRight = null;
  }

  /**
   * Minimum height (px) to reserve for the board, based on the initial row
   * count. Keeps the board (and the timer above it) anchored so it doesn't
   * re-center as tiles are removed at the end of the level.
   * Tile min-height is 76px with 18px gaps (see SCSS).
   */
  get boardMinHeight(): number {
    const rows = this.initialRows;
    if (rows <= 0) return 0;
    return rows * 76 + (rows - 1) * 18;
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

      // Combo: extend the current streak and track the best this run.
      this.combo++;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;

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
      // Wrong pair - flash red then reset. Breaks the combo.
      this.mistakes++;
      this.combo = 0;
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

  /** A comfortable pace, in seconds per pair, used as the no-penalty target. */
  private readonly SECONDS_PER_PAIR = 2.5;
  /** Lowest the time multiplier can drag the score (so a slow-but-perfect run
   *  can still earn stars). */
  private readonly MIN_TIME_FACTOR = 0.6;

  /**
   * Final score combines accuracy and speed:
   *   accuracy  = clean pairs / total
   *   timeFactor= 1.0 at/under the target pace, easing down to MIN_TIME_FACTOR
   *               the slower the run.
   *   score%    = round(accuracy * timeFactor * 100)
   * Stars come from the existing thresholds (90/70/50).
   */
  private computeScorePercent(total: number, cleanPairs: number): number {
    if (total === 0) return 0;
    const accuracy = cleanPairs / total;

    const targetSeconds = total * this.SECONDS_PER_PAIR;
    const elapsed = Math.max(1, this.elapsedSeconds);
    const timeFactor = Math.min(
      1,
      Math.max(this.MIN_TIME_FACTOR, targetSeconds / elapsed)
    );

    return Math.round(accuracy * timeFactor * 100);
  }

  /** Star thresholds (percent) matching FlashcardService.calculateStars. */
  private readonly STAR_THRESHOLDS = { 3: 90, 2: 70, 1: 50 };

  /** Format seconds as m:ss. */
  private fmt(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec) % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * With a perfect run (no mistakes), the time needed to reach a star tier T%:
   *   accuracy = 1, so score = timeFactor*100, need timeFactor >= T/100
   *   targetSeconds / elapsed >= T/100  ->  elapsed <= targetSeconds * 100 / T
   * Returns the seconds the user must beat to earn the next tier above their
   * current stars, or '' if already at 3 stars.
   */
  private buildNextStarHint(total: number, stars: number): string {
    if (stars >= 3) return '';
    const nextTier = (stars + 1) as 1 | 2 | 3;
    const thresholdPct = this.STAR_THRESHOLDS[nextTier];
    const targetSeconds = total * this.SECONDS_PER_PAIR;
    // Max time (with a flawless run) to still hit the next tier.
    const maxSeconds = (targetSeconds * 100) / thresholdPct;
    return `Finish under ${this.fmt(maxSeconds)} with no mistakes for ${nextTier} star${nextTier === 1 ? '' : 's'}.`;
  }

  /**
   * Finish: stop the timer, score by combined accuracy + speed, and persist
   * stars for level sessions.
   */
  private async completeSession() {
    this.phase = 'complete';
    this.stopTimer();
    // Snap elapsed to the exact finishing moment (the interval ticks whole seconds).
    this.elapsedSeconds = Math.max(this.elapsedSeconds, Math.floor((Date.now() - this.timerStart) / 1000));

    const total = this.totalPairs;
    const cleanPairs = Math.max(0, total - this.mistakes);
    const scorePercent = this.computeScorePercent(total, cleanPairs);

    if (this.levelNumber > 0 && this.deck) {
      // saveLevelProgress derives the percentage from correct/total, so pass an
      // "effective correct" count that encodes the combined score.
      const effectiveCorrect = Math.round((scorePercent / 100) * total);
      const result = await this.flashcardService.saveLevelProgress(
        this.deck.id,
        'match',
        this.levelNumber,
        effectiveCorrect,
        total,
        this.elapsedSeconds
      );
      this.earnedStars = result.stars;
      this.isNewBest = result.isNewBest;
      this.bestTimeSeconds = result.bestTimeSeconds ?? this.elapsedSeconds;
    } else {
      this.earnedStars = this.flashcardService.calculateStars(scorePercent);
      this.bestTimeSeconds = this.elapsedSeconds;
    }

    this.nextStarHint = this.buildNextStarHint(total, this.earnedStars);

    this.cdr.detectChanges();
  }

  /** Best time formatted for the complete screen. */
  get bestTimeFormatted(): string {
    return this.bestTimeSeconds === null ? '' : this.fmt(this.bestTimeSeconds);
  }

  finish() {
    this.router.navigate(['/flashcards'], { replaceUrl: true });
  }

  close() {
    this.router.navigate(['/flashcards'], { replaceUrl: true });
  }
}
