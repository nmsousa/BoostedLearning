/**
 * Match Page - connect-the-pairs practice.
 *
 * Shows a batch of Dutch words on the left and their shuffled English
 * translations on the right. The user taps one item on each side to link
 * them; correct pairs lock in, wrong pairs flash and reset. When the batch
 * is cleared, the next batch loads until the level's words are done.
 *
 * @module app/exercises/match
 */

import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import { FlashcardService, Flashcard, FlashcardDeck, PracticeMode } from '../../services/flashcard.service';
import { I18nAngularService } from '../../services/i18n.service';
import { AddWordService } from '../../services/add-word.service';
import { AudioService } from '../../services/audio.service';
import { SettingsService } from '../../services/settings.service';
import { BackInterceptorService } from '../../services/back-interceptor.service';
import { ExitConfirmService } from '../../services/exit-confirm.service';
import { journeyBackUrl } from '../../maps/journey/journey-back';
import { GameRulesService } from '../../services/game-rules.service';
import { MATCH_SECONDS_PER_PAIR, matchScorePercent, matchRulesText, tooManyMistakes } from '../../shared/star-rules';

type Side = 'left' | 'right';
type MatchPhase = 'play' | 'complete';

interface MatchItem {
  id: string;        // pair id (same on both sides)
  label: string;     // text shown
  side: Side;
  matched: boolean;  // locked in as a correct pair
  wrong: boolean;    // transient wrong-flash state
  /** Match Audio only: the target word + recording for the left (listen) tile. */
  audioText?: string;
  audioUrl?: string | null;
}

@Component({
  selector: 'app-match',
  templateUrl: './match.page.html',
  styleUrls: ['./match.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private flashcardService = inject(FlashcardService);
  private cdr = inject(ChangeDetectorRef);
  private i18n = inject(I18nAngularService);
  private addWordService = inject(AddWordService);
  private audio = inject(AudioService);
  /** Audio state for the play icons: which kind is playing, and a counter that
   *  bumps on EVERY play so the icon replays its sound-wave animation. */
  readonly playKind = this.audio.playKind;
  readonly playSeq = this.audio.playSeq;
  private settings = inject(SettingsService);
  private rules = inject(GameRulesService);
  /** Admin mode: shows the star-rules button. */
  get adminMode(): boolean { return this.settings.adminMode(); }
  /** ADMIN: how stars are earned on this board. */
  showRules(): void { void this.rules.showRules(matchRulesText(this.totalPairs, !this.isAudio)); }
  private backInterceptor = inject(BackInterceptorService);
  private exitConfirm = inject(ExitConfirmService);

  /** Hardware/gesture back: confirm if there's progress to lose, else leave. */
  private readonly onHardwareBack: () => Promise<boolean> =
    () => this.exitConfirm.request(this.hasProgress, () => this.leave());
  /** How many times this view has been entered. A cold load (F5 on an exercise URL)
   *  bails out to the level page and leaves this instance cached underneath it,
   *  still on its loading spinner. Ionic REUSES that instance on the next visit
   *  without re-running ngOnInit, so it would sit on the spinner forever. */
  private enterCount = 0;


  ionViewWillEnter(): void {

    this.backInterceptor.register(this.onHardwareBack);
    // Re-entered while still loading = a stale instance left by an earlier bail-out:
    // run the setup again for the NEW route.
    if (++this.enterCount > 1 && this.isLoading) void this.ngOnInit();

  }
  ionViewWillLeave(): void { this.backInterceptor.clear(this.onHardwareBack); this.exitConfirm.reset(); }

  /** True when there are matched pairs or mistakes worth confirming. */
  private get hasProgress(): boolean {
    return this.phase !== 'complete' && (this.solvedPairs > 0 || this.mistakes > 0);
  }

  /** Navigate away (shared by the X button and the confirm's End). */
  private leave(): void { this.navCtrl.navigateBack(this.backUrl); }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  /** Open the header menu. Match has no single "current word", so only the
   *  add-word action is offered. */
  async openMenu(): Promise<void> {
    await this.addWordService.openModeMenu({
      languageCode: this.deck?.languageCode,
      modeName: this.t('mode.titleMatch'),
      onAdminComplete: (stars) => this.adminCompleteLevel(stars, false),
      // Match counts each board as one of 5 rounds → offer "complete all 5"
      // for standalone play (not as a journey single-pass node).
      onAdminCompleteAll: (this.mode === 'journey-match' || this.mode === 'journey-match-audio')
        ? undefined : (stars) => this.adminCompleteLevel(stars, true),
    });
  }

  /** DEV-only: finish the level with a chosen star count (one round, or all 5). */
  private async adminCompleteLevel(stars: 0 | 1 | 2 | 3, allRounds: boolean): Promise<void> {
    if (this.levelNumber > 0 && this.deck) {
      if (allRounds) {
        await this.flashcardService.adminForceCompleteAllRounds(this.deck.id, this.mode, this.levelNumber, stars);
      } else {
        await this.flashcardService.adminForceComplete(this.deck.id, this.mode, this.levelNumber, stars);
      }
    }
    this.navCtrl.navigateBack(this.backUrl);
  }

  deck: FlashcardDeck | null = null;
  levelNumber = 0;
  /** Progress namespace: 'match'/'journey-match', or the audio variants. */
  private mode: PracticeMode = 'match';
  /** Match Audio: left tiles play the word's audio instead of showing text. */
  isAudio = false;
  private backUrl = '/practice';

  // How many pairs are visible on the board at once. As each correct match is
  // made, the cleared pair is immediately replaced with a fresh one (if any
  // remain in the queue), so the board stays filled instead of draining.
  private readonly VISIBLE_PAIRS = 5;

  // Words not yet placed on the board.
  private queue: Flashcard[] = [];
  private totalPairs = 0;
  private solvedPairs = 0;

  /** Skill/title of the current level (for the header), if any. */
  levelTitle = '';

  leftItems: MatchItem[] = [];
  rightItems: MatchItem[] = [];

  selectedLeft: MatchItem | null = null;
  selectedRight: MatchItem | null = null;

  phase: MatchPhase = 'play';
  /** True while the session is being prepared (DB load). */
  isLoading = true;
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
    // Mode from the query param. 'journey-match[-audio]' are Journey nodes
    // (back to the map); the '-audio' variants turn the left column into
    // listen-and-match tiles. Standalone audio uses the 'match-audio' route.
    const modeParam = this.route.snapshot.queryParamMap.get('mode');
    if (modeParam === 'journey-match' || modeParam === 'journey-match-audio') {
      this.mode = modeParam;
      this.backUrl = journeyBackUrl(this.route.snapshot.queryParamMap);
    } else if (modeParam === 'match-audio') {
      this.mode = 'match-audio';
    }
    this.isAudio = this.mode === 'match-audio' || this.mode === 'journey-match-audio';

    if (!deckId) {
      this.router.navigateByUrl(this.backUrl);
      return;
    }

    this.deck = this.flashcardService.getDeck(deckId);
    if (!this.deck) {
      this.router.navigateByUrl(this.backUrl);
      return;
    }

    let cards: Flashcard[];
    // TEMPORARY: admin test level — 2 fixed words, no persistence. Skip
    // playableCards (it strips identical-in-both-languages words).
    if (this.flashcardService.isTestLevel(this.levelNumber)) {
      this.levelTitle = 'Level 0 (test)';
      cards = this.flashcardService.getTestLevelCards(deckId);
    } else {
      if (this.levelNumber > 0) {
        const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, this.mode, this.levelNumber);
        if (!isUnlocked) {
          this.router.navigateByUrl(this.backUrl);
          return;
        }
        // Match uses a longer session: the level's words + weak words from
        // earlier levels (for bigger combos and review).
        cards = this.flashcardService.getMatchSessionCards(deckId, this.levelNumber);
        // Title from the level's OWN cards (the session mixes in review words).
        this.levelTitle = this.flashcardService.getLevelCards(deckId, this.levelNumber)[0]?.skill ?? '';
      } else {
        cards = this.flashcardService.getFlashcardQueue(deckId, 20);
      }

      // Exclude cards identical in both languages (e.g. "water" = "water"):
      // they make a trivial/ambiguous match and look like duplicate tiles.
      cards = this.flashcardService.playableCards(cards);
    }

    this.queue = this.shuffle(cards);
    this.totalPairs = this.queue.length;

    if (this.queue.length === 0) {
      this.phase = 'complete';
    } else {
      this.fillBoard();
      // Match AUDIO is untimed — you need time to listen to each clip, so no
      // clock pressure. Other Match variants keep the count-up timer.
      if (!this.isAudio) this.startTimer();
    }

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    this.stopTimer();
    this.backInterceptor.clear(this.onHardwareBack);
    this.exitConfirm.reset();
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

  /** Build the two tiles (left + right) for one card. In audio mode the left
   *  tile hides the word and plays its audio; the right stays the translation. */
  private makePair(card: Flashcard): { left: MatchItem; right: MatchItem } {
    return {
      left: {
        id: card.id, label: card.text, side: 'left', matched: false, wrong: false,
        audioText: card.text, audioUrl: card.audioUrl,
      },
      right: { id: card.id, label: this.flashcardService.bestTranslation(card), side: 'right', matched: false, wrong: false },
    };
  }

  /** Play a listen tile's word (recorded clip, else TTS) at normal speed.
   *  Auto-plays on select; re-tapping the selected tile replays it. */
  playItem(item: MatchItem): void {
    if (!item.audioText) return;
    void this.audio.playWord(item.audioText, item.audioUrl, this.settings.learningLanguage());
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
      const alreadySelected = this.selectedLeft?.id === item.id && this.selectedLeft.side === item.side;
      if (this.isAudio) {
        // Audio mode: tapping the SAME selected tile REPLAYS (normal speed) and
        // keeps it selected. Selection only changes when you tap a DIFFERENT
        // tile (or complete the pair).
        if (alreadySelected) {
          this.playItem(item);
        } else {
          this.selectedLeft = item;
          this.playItem(item);
        }
      } else {
        // Non-audio: tapping the selected tile deselects it (toggle). Either
        // way, hearing the word on tap reinforces the pronunciation while you
        // match (play on select, not on deselect).
        this.selectedLeft = alreadySelected ? null : item;
        if (this.selectedLeft) this.playItem(item);
      }
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

      // Do NOT lock on a correct match — the matched tiles are already gray
      // placeholders (guarded by `item.matched`), so the user can immediately
      // start the next pair with no input delay. The refill just fills freed
      // slots after a short beat; it doesn't need to block taps.
      this.cdr.detectChanges();
      setTimeout(() => {
        this.tryRefill();

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
      // More than half wrong: stop with an encouraging message (nothing saved).
      if (tooManyMistakes(this.mistakes, this.totalPairs)) {
        this.stopTimer();
        setTimeout(() => void this.rules.stopEarly(() => this.leave()), 700);
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

  // --- Scoring (shared/star-rules.ts) ---------------------------------------
  // 3 seconds per pair for every level. 3★ = 0 mistakes in time; 2★ = at most 1
  // mistake; 1★ = at least half the pairs right. Match Audio is untimed.
  private computeScorePercent(total: number): number {
    return matchScorePercent({ pairs: total, mistakes: this.mistakes, seconds: this.elapsedSeconds, timed: !this.isAudio });
  }

  /** Format seconds as m:ss. */
  private fmt(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec) % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /** "Finish in m:ss with no mistakes for 3 stars" (only time-based tier). */
  private buildNextStarHint(total: number, stars: number): string {
    if (stars >= 3) return '';
    return this.t('mode.nextStarHintN', { time: this.fmt(total * MATCH_SECONDS_PER_PAIR), stars: 3 });
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
    const scorePercent = this.computeScorePercent(total);

    if (this.levelNumber > 0 && this.deck) {
      // 5-round model: each Match playthrough counts as one round toward the 5.
      // (Match keeps its single-board session per round for now; the circle on
      // the levels list fills as rounds accumulate.)
      const result = await this.flashcardService.saveRoundProgress(
        this.deck.id,
        this.mode,
        this.levelNumber,
        scorePercent,
        this.elapsedSeconds,
        this.bestCombo
      );
      this.earnedStars = result.stars;
      this.isNewBest = result.levelComplete;
      // The SAVED bests (across all plays), not just this run.
      this.bestTimeSeconds = result.bestTimeSeconds ?? this.elapsedSeconds;
      this.bestComboSaved = Math.max(result.bestCombo ?? 0, this.bestCombo);
    } else {
      this.earnedStars = this.flashcardService.calculateStars(scorePercent);
      this.bestTimeSeconds = this.elapsedSeconds;
      this.bestComboSaved = this.bestCombo;
    }

    // The next-star hint is time-based; it's meaningless for the untimed audio
    // variant (scored on accuracy only), so skip it there.
    this.nextStarHint = this.isAudio ? '' : this.buildNextStarHint(total, this.earnedStars);

    this.cdr.detectChanges();
  }

  /** Best time formatted for the complete screen. */
  get bestTimeFormatted(): string {
    return this.bestTimeSeconds === null ? '' : this.fmt(this.bestTimeSeconds);
  }

  finish() {
    this.navCtrl.navigateBack(this.backUrl);
  }

  /** Header X: confirm if there's progress, else leave. */
  close() {
    void this.exitConfirm.request(this.hasProgress, () => this.leave());
  }
}
