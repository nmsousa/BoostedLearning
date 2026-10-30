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
import { I18nAngularService } from '../../services/i18n.service';

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
  private i18n = inject(I18nAngularService);

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

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
  /** Best combo across runs for this level (persisted). */
  bestComboSaved = 0;

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
      this.router.navigate(['/practice']);
      return;
    }

    this.deck = this.flashcardService.getDeck(deckId);
    if (!this.deck) {
      this.router.navigate(['/practice']);
      return;
    }

    let cards: Flashcard[];
    if (this.levelNumber > 0) {
      const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, 'match', this.levelNumber);
      if (!isUnlocked) {
        this.router.navigate(['/practice']);
        return;
      }
      // Match uses a longer session: the level's words + weak words from
      // earlier levels (for bigger combos and review).
      cards = this.flashcardService.getMatchSessionCards(deckId, this.levelNumber);
    } else {
      cards = this.flashcardService.getFlashcardQueue(deckId, 20);
    }

    // Exclude cards identical in both languages (e.g. "water" = "water"):
    // they make a trivial/ambiguous match and look like duplicate tiles.
    cards = this.flashcardService.playableCards(cards);

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

  /** Build the two tiles (left + right) for one card. */
  private makePair(card: Flashcard): { left: MatchItem; right: MatchItem } {
    return {
      left: { id: card.id, label: card.text, side: 'left', matched: false, wrong: false },
      right: { id: card.id, label: this.flashcardService.bestTranslation(card), side: 'right', matched: false, wrong: false },
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

  /** How many matched slots must accumulate before refilling (in a batch). */
  private readonly REFILL_BATCH = 2;

  /**
   * Refill matched (gray) slots in batches so positions are unpredictable.
   *
   * Matched tiles stay in place as gray placeholders — nothing ever shifts
   * under the finger. Once at least REFILL_BATCH slots are free (and words
   * remain), we fill those freed slots with new words, SHUFFLING which new
   * word lands in which freed slot on each side independently. This prevents
   * the "keep tapping the same two spots" exploit while never moving the tiles
   * the player is currently looking at.
   */
  private tryRefill() {
    const freeLeft = this.leftItems
      .map((it, idx) => ({ it, idx }))
      .filter(x => x.it.matched);
    const freeRight = this.rightItems
      .map((it, idx) => ({ it, idx }))
      .filter(x => x.it.matched);

    const available = this.queue.length;
    // Only refill in full batches; near the end (queue smaller than a batch)
    // fill whatever remains so the level can finish.
    const batch = Math.min(freeLeft.length, freeRight.length, available);
    if (batch < this.REFILL_BATCH && batch < available) return;
    if (batch === 0) return;

    const cards = this.queue.splice(0, batch);
    const lefts = cards.map(c => this.makePair(c).left);
    const rights = cards.map(c => this.makePair(c).right);

    // Shuffle which new tile goes into which freed slot (per side), so the new
    // word's position is not predictable from where the last one was.
    const leftSlots = this.shuffle(freeLeft.slice(0, batch).map(x => x.idx));
    const rightSlots = this.shuffle(freeRight.slice(0, batch).map(x => x.idx));

    leftSlots.forEach((slot, i) => (this.leftItems[slot] = lefts[i]));
    rightSlots.forEach((slot, i) => (this.rightItems[slot] = rights[i]));
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

      // Matched tiles stay in place as gray placeholders (positions never
      // shift). After a short beat, try to batch-refill freed slots.
      this.locked = true;
      setTimeout(() => {
        this.tryRefill();
        this.locked = false;

        // Done when every tile is matched and the queue is drained.
        if (this.queue.length === 0 && this.leftItems.every(i => i.matched)) {
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
   * Stars come from the shared thresholds (100/85/70).
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
  private readonly STAR_THRESHOLDS = { 3: 100, 2: 85, 1: 70 };

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
    return this.t(nextTier === 1 ? 'mode.nextStarHint1' : 'mode.nextStarHintN', {
      time: this.fmt(maxSeconds),
      stars: nextTier,
    });
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
        this.elapsedSeconds,
        this.bestCombo
      );
      this.earnedStars = result.stars;
      this.isNewBest = result.isNewBest;
      this.bestTimeSeconds = result.bestTimeSeconds ?? this.elapsedSeconds;
      this.bestComboSaved = result.bestCombo ?? this.bestCombo;
    } else {
      this.earnedStars = this.flashcardService.calculateStars(scorePercent);
      this.bestTimeSeconds = this.elapsedSeconds;
      this.bestComboSaved = this.bestCombo;
    }

    this.nextStarHint = this.buildNextStarHint(total, this.earnedStars);

    this.cdr.detectChanges();
  }

  /** Best time formatted for the complete screen. */
  get bestTimeFormatted(): string {
    return this.bestTimeSeconds === null ? '' : this.fmt(this.bestTimeSeconds);
  }

  finish() {
    this.router.navigate(['/practice'], { replaceUrl: true });
  }

  close() {
    this.router.navigate(['/practice'], { replaceUrl: true });
  }
}
