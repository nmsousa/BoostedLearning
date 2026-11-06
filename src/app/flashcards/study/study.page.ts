/**
 * Flashcard Study Page - Quizlet-style study session
 * 
 * Interactive flashcard study with typed answers and spaced repetition.
 * Supports bidirectional practice: English→Dutch (primary) and Dutch→English (fallback).
 * Features progressive hints and star-based scoring per level.
 * 
 * @module app/flashcards/study
 */

import { Component, OnInit, OnDestroy, inject, ViewChild, HostListener, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, IonInput, ToastController, ViewDidEnter, NavController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { FlashcardService, Flashcard, FlashcardDeck, PracticeMode } from '../../services/flashcard.service';
import { I18nAngularService } from '../../services/i18n.service';
import { SettingsService } from '../../services/settings.service';
import { AudioService } from '../../services/audio.service';
import { AddWordService } from '../../services/add-word.service';
import { journeyBackUrl } from '../journey/journey-back';
import { gradeAnswer } from '../../../core/answer-validator/typo-grader';

type StudyPhase = 'question' | 'feedback' | 'complete';
type FeedbackResult = 'correct' | 'almost' | 'incorrect';
type CardDirection = 'en-to-target' | 'target-to-en';

interface StudyCard {
  card: Flashcard;
  direction: CardDirection;
  isRetry: boolean;
  /**
   * Other Dutch words in the deck that share this card's English prompt
   * (e.g. for "the": de, het). All are accepted as answers, and all are
   * shown when the answer is revealed. Includes this card's own word.
   */
  acceptedForms: string[];
}

@Component({
  selector: 'app-study',
  templateUrl: './study.page.html',
  styleUrls: ['./study.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyPage implements OnInit, OnDestroy, ViewDidEnter {
  @ViewChild('answerInput') answerInput!: IonInput;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private alertController = inject(AlertController);
  private flashcardService = inject(FlashcardService);
  private i18n = inject(I18nAngularService);
  private settings = inject(SettingsService);
  private audio = inject(AudioService);
  private toast = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);
  private addWordService = inject(AddWordService);

  /** Open the header menu: add a word, or hide the current word. */
  async openMenu(): Promise<void> {
    await this.addWordService.openModeMenu({
      languageCode: this.deck?.languageCode,
      currentWord: this.currentCard?.text ?? null,
      correctAnswer: this.targetWord ?? null,
      modeName: this.t('mode.titleWrite'),
      onHidden: () => this.nextCard(),
      showAutoPlayToggle: true,
      onAdminComplete: (stars) => this.adminCompleteLevel(stars, false),
      // Write is a 5-round mode (unless a single-pass journey node) → offer
      // "complete all 5 rounds" for fast testing.
      onAdminCompleteAll: this.singlePass ? undefined : (stars) => this.adminCompleteLevel(stars, true),
    });
  }

  /**
   * DEV-only: finish the current level with a chosen star count, then return.
   * `allRounds` fills all 5 rounds at once; otherwise just one round.
   */
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
  studyCards: StudyCard[] = [];
  /** Skill/title of the current level (for the header), if any. */
  get levelTitle(): string { return this.studyCards[0]?.card?.skill ?? ''; }
  currentIndex = 0;
  phase: StudyPhase = 'question';
  /** True while the session is being prepared (DB load). */
  isLoading = true;
  feedbackResult: FeedbackResult = 'incorrect';
  
  // Level info
  levelNumber = 0;

  /** Timer that auto-advances after a correct answer (no Continue tap). */
  private autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── 5-round model ──────────────────────────────────────────────────────────
  /** Current round (1..5) when playing a level. 0 = quick study (no rounds). */
  round = 0;
  /** Total rounds in a level. 5 normally; 1 for a Journey single-pass node. */
  totalRounds = 5;
  /** True for a Journey node: one pass, no round loop/interstitial. */
  singlePass = false;
  /** Card ids the user failed across THIS level's rounds (feeds round 5). */
  private missedThisLevel = new Set<string>();
  /** True on the "round complete" interstitial (not the final level summary). */
  roundInterstitial = false;
  /** Rounds completed so far (for the progress display). */
  roundsCompleted = 0;

  /**
   * Which mode this Write session is scored under. Defaults to 'write' (the
   * normal Write mode). The experimental Journey mode reuses this page via a
   * `?mode=journey` query param so its progress is tracked separately.
   */
  mode: PracticeMode = 'write';
  /** Where "finish/close" returns to (the levels list, or the journey map). */
  private backUrl = '/practice';

  userAnswer = '';
  submittedAnswer = '';
  correctAnswer = '';
  isRetryAttempt = false;
  /**
   * When an answer is ACCEPTED but wasn't a perfect match, how it differed from
   * the expected answer — so we can show a Duolingo-style note while still
   * accepting it: 'accent' (only diacritics differ, e.g. cafe vs café),
   * 'typo' (a single small spelling slip). 'none' = perfect match.
   */
  nearMiss: 'none' | 'accent' | 'typo' = 'none';
  
  // Hint system - each click reveals one more character of the answer.
  // When all characters are revealed, the answer is shown.
  hintRevealed = 0;      // how many characters are currently revealed
  hintText = '';
  usedHint = false;      // Track if any hint was used for this card
  revealedViaHint = false; // true when the answer was fully revealed via hints
  
  // Number of unique cards in this session (after de-duplicating prompts).
  totalUnique = 0;
  // IDs of unique cards the learner has answered correctly at least once.
  private completedIds = new Set<string>();
  // IDs of cards failed at least once (affects the star score, not progress).
  private failedIds = new Set<string>();
  
  // Session stats (only count cards without hints as correct)
  correctCount = 0;
  incorrectCount = 0;
  
  // Final results
  earnedStars = 0;
  isNewBest = false;

  async ngOnInit() {
    await this.flashcardService.initialize();
    
    const deckId = this.route.snapshot.paramMap.get('id');
    const levelParam = this.route.snapshot.queryParamMap.get('level');
    this.levelNumber = levelParam ? parseInt(levelParam, 10) : 0;
    // Journey reuses this page under its own mode namespace + return route.
    const modeParam = this.route.snapshot.queryParamMap.get('mode');
    if (modeParam === 'journey') {
      this.mode = 'journey';
      this.backUrl = journeyBackUrl(this.route.snapshot.queryParamMap);
    } else if (modeParam === 'journey-write') {
      // Journey WRITE node: a single pass (no 5-round loop), back to the map.
      this.mode = 'journey-write';
      this.backUrl = journeyBackUrl(this.route.snapshot.queryParamMap);
      this.singlePass = true;
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

    // Get cards for this level (or all cards if no level specified)
    let cards: Flashcard[];
    if (this.levelNumber > 0) {
      // Check if level is unlocked
      const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, this.mode, this.levelNumber);
      if (!isUnlocked) {
        this.router.navigate([this.backUrl]);
        return;
      }
      if (this.singlePass) {
        // Journey node: ONE pass over the level's words, no round sequence.
        this.totalRounds = 1;
        this.round = 1;
        this.roundsCompleted = 0;
        cards = this.flashcardService.getRoundCards(deckId, this.levelNumber, 1);
      } else {
        // Start the 5-round sequence from where the user left off (so finishing
        // round 2 earlier resumes at round 3).
        this.roundsCompleted = await this.flashcardService.getRoundsCompleted(deckId, this.mode, this.levelNumber);
        this.round = Math.min(this.totalRounds, this.roundsCompleted + 1);
        cards = this.flashcardService.getRoundCards(deckId, this.levelNumber, this.round);
      }
    } else {
      cards = this.flashcardService.getStudyCards(deckId, 20);
    }
    
    if (cards.length === 0) {
      this.phase = 'complete';
    } else {
      this.studyCards = this.buildStudyCards(cards);
      this.totalUnique = this.studyCards.length;
    }

    this.isLoading = false;
    this.cdr.detectChanges();
    // Now that the first card is rendered (phase === 'question'), grab focus.
    // ngAfterViewInit fired too early — before this async load set the phase —
    // so the <ion-input> (behind *ngIf) didn't exist yet and focus silently
    // failed, leaving the keyboard open but unfocused.
    this.focusInput();
  }

  /**
   * Build the study queue from a list of (already de-duplicated) cards.
   * Each card carries its own `acceptedForms` (every target-language form for
   * its prompt), computed by the service. Here we only assign the typing
   * direction based on the user's setting.
   */
  private buildStudyCards(cards: Flashcard[]): StudyCard[] {
    const mixed = this.settings.flashcardDirection() === 'mixed';

    return cards.map((card, index) => ({
      card,
      direction: (mixed && index % 5 === 0 ? 'target-to-en' : 'en-to-target') as CardDirection,
      isRetry: false,
      acceptedForms: card.acceptedForms ?? [card.text],
    }));
  }

  ngOnDestroy() {
    if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);
  }

  /**
   * Ionic fires this once the page's ENTER transition has finished — the most
   * reliable moment to focus the input and pop the keyboard (focusing mid-
   * transition on Android often pops the keyboard without the field actually
   * taking focus, so typing went nowhere until you tapped the field). We also
   * focus at the end of ngOnInit (above) so a cached/instant re-entry is covered.
   */
  ionViewDidEnter(): void {
    this.focusInput();
  }

  /**
   * Hold focus on the input so the keyboard stays up. We focus during the
   * question AND during correct/incorrect feedback (the input stays mounted,
   * editable), so the keyboard doesn't close + reopen between cards. The "almost"
   * retry card is excluded (its own flow).
   *
   * Robustness: the <ion-input> lives behind *ngIf, so right after an async
   * load it may not exist yet. We retry a few times and — crucially — only pop
   * the soft keyboard AFTER setFocus() resolves on a real element, so we never
   * show the keyboard while the field is unfocused (the reported bug: keyboard
   * open, typing ignored, fixed only by a manual tap).
   */
  private focusInput(attempt = 0): void {
    const keepUp = () =>
      this.phase === 'question' ||
      (this.phase === 'feedback' && this.feedbackResult !== 'almost');
    if (!keepUp()) return;

    const input = this.answerInput;
    if (!input) {
      // The input isn't rendered yet (phase/ngIf not settled). Retry briefly.
      if (attempt < 10) setTimeout(() => this.focusInput(attempt + 1), 50);
      return;
    }

    void input.setFocus()
      .then(() => {
        // Focus actually landed → now it's safe to ensure the keyboard is up.
        if (keepUp()) this.forceKeyboard();
      })
      .catch(() => {
        if (attempt < 10) setTimeout(() => this.focusInput(attempt + 1), 50);
      });
  }

  /**
   * On native Android, focusing an input programmatically (not from a user tap)
   * sometimes doesn't pop the soft keyboard. Explicitly ask the Keyboard plugin
   * to show it. No-op on web / where the plugin isn't available.
   */
  private forceKeyboard(): void {
    if (!Capacitor.isNativePlatform()) return;
    void Keyboard.show().catch(() => { /* ignore */ });
  }

  /** True while the IME is composing a character (accents / dead keys). */
  private composing = false;
  onCompositionStart(): void { this.composing = true; }
  onCompositionEnd(): void { this.composing = false; }

  /**
   * Enter key inside the input: submit while typing, else advance. On some
   * Android keyboards Enter fires DURING composition of an accented char (e.g.
   * "é"), committing a truncated value ("caf"). If we're mid-composition, let
   * it finish and don't submit on this keystroke.
   */
  onEnter(): void {
    if (this.composing) return;
    if (this.phase === 'question') void this.submitAnswer();
    else if (this.phase === 'feedback' && this.feedbackResult !== 'almost') this.nextCard();
  }

  /**
   * While an answer is being SHOWN (feedback phase) the field stays focused so
   * the keyboard doesn't close, but the answer is final — block any further
   * typing so the graded text can't be edited. Enter still advances (handled by
   * keyup.enter → onEnter). We let navigation/modifier keys through so the
   * field doesn't feel frozen.
   */
  onKeydownWhileLocked(event: KeyboardEvent): void {
    if (this.phase !== 'feedback') return;
    const allowed = ['Enter', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (allowed.includes(event.key)) return;
    event.preventDefault();
  }

  /** Swallow IME / autocorrect / paste insertions during feedback (keydown
   *  alone doesn't cover soft-keyboard composition). */
  onBeforeInputWhileLocked(event: Event): void {
    if (this.phase === 'feedback') event.preventDefault();
  }

  /**
   * Read the input's LIVE native value into `userAnswer`. ngModel can lag the
   * IME on composed characters, so before checking we pull the real DOM value
   * so "café" isn't read as "caf".
   */
  private async syncNativeValue(): Promise<void> {
    try {
      const native = await this.answerInput?.getInputElement();
      if (native && typeof native.value === 'string') this.userAnswer = native.value;
    } catch { /* fall back to the ngModel value */ }
  }

  /**
   * Keep the soft keyboard open when the user taps elsewhere on the screen
   * (e.g. the audio button) while answering. The keyboard closes when the
   * focused input loses focus, which a tap on any other control triggers.
   * By preventing the pointerdown's default on taps OUTSIDE the header and the
   * input itself, the input never blurs — so the keyboard stays up — while the
   * subsequent `click` still fires (preventing mousedown/pointerdown does not
   * cancel the click). The ONE exception is the app header: tapping it blurs
   * the input and lets the keyboard close (the intended escape).
   *
   * Captured on the document in the capture phase so it runs before the target
   * receives focus. Only active while the keyboard is meant to be up.
   */
  @HostListener('document:pointerdown', ['$event'])
  keepKeyboardOnOutsideTap(event: PointerEvent): void {
    // The keyboard stays up during question AND feedback (the field keeps
    // focus; typing is blocked during feedback). Keep it open on taps elsewhere
    // so it doesn't flicker between a card and its result. The Continue button
    // tap still works — preventing pointerdown's default doesn't cancel click.
    const keyboardUp =
      this.phase === 'question' ||
      (this.phase === 'feedback' && this.feedbackResult !== 'almost');
    if (!keyboardUp) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Tapping the header is the escape hatch: let the input blur so the
    // keyboard closes (e.g. to reach the close/menu buttons comfortably).
    if (target.closest('ion-header')) {
      void this.answerInput?.getInputElement().then(el => el?.blur()).catch(() => { /* ignore */ });
      return;
    }

    // Let taps on the input itself through so the user can place the caret.
    if (target.closest('ion-input, input, textarea')) return;

    // Anywhere else (audio button, Check, hint, empty space): keep the input
    // focused so the keyboard doesn't close. The click still fires.
    event.preventDefault();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;

    // When the answer input is focused it has its own (keyup.enter)="onEnter()"
    // for question + correct/incorrect feedback, so skip those here to avoid a
    // double advance. We still handle the cases the input can't: the "almost"
    // retry and the final complete screen.
    if (this.phase === 'feedback' && this.feedbackResult === 'almost') {
      event.preventDefault();
      this.tryAgain();
    } else if (this.phase === 'complete') {
      event.preventDefault();
      this.finishStudy();
    }
  }

  get currentStudyCard(): StudyCard | null {
    return this.studyCards[this.currentIndex] ?? null;
  }

  get currentCard(): Flashcard | null {
    return this.currentStudyCard?.card ?? null;
  }

  /** True when this card is a requeued one the learner got wrong earlier in the
   *  session — drives the "Previous mistake" banner (like Duolingo). */
  get isPreviousMistake(): boolean {
    return this.currentStudyCard?.isRetry === true;
  }

  get currentDirection(): CardDirection {
    return this.currentStudyCard?.direction ?? 'en-to-target';
  }

  get progress(): number {
    if (this.totalUnique === 0) return 0;
    return (this.completedIds.size / this.totalUnique) * 100;
  }

  /** How many unique cards have been answered correctly so far. */
  get completedCount(): number {
    return this.completedIds.size;
  }

  // What to show as the prompt
  get promptText(): string {
    if (!this.currentCard) return '';
    return this.currentDirection === 'en-to-target'
      ? this.currentCard.translations[0]  // Show English
      : this.currentCard.text;             // Show Dutch
  }

  /** The target-language word (e.g. "hij") — always the card's own text. */
  get targetWord(): string {
    return this.currentCard?.text ?? '';
  }

  /** The base-language (English) word for the result card. */
  get englishWord(): string {
    return this.currentCard
      ? this.flashcardService.bestTranslation(this.currentCard)
      : '';
  }

  /** Localized "English" label for the result card (base language). */
  get baseLangName(): string {
    const key = 'langName.en';
    const name = this.i18n.t(key);
    return name === key ? 'English' : name;
  }

  /** Localized name of the learning language (for the instruction text). */
  get targetLangName(): string {
    const code = this.deck?.languageCode ?? '';
    const key = `langName.${code}`;
    const name = this.i18n.t(key);
    // Fall back to the deck name / code if there's no catalog entry.
    return name === key ? (this.deck?.name || code.toUpperCase() || '') : name;
  }

  // Instruction text
  get instructionText(): string {
    return this.currentDirection === 'en-to-target'
      ? this.t('mode.typeInTarget', { lang: this.targetLangName })
      : this.t('mode.typeInEnglish');
  }

  /** How many times the (normal-speed) word audio has been played this card. */
  playCount = 0;

  /** Show the slow-replay button only after the word was played twice. */
  get showSlowButton(): boolean {
    return this.playCount >= 2;
  }

  /** Play the target-language word: recorded clip if available, else TTS. */
  async playWord(slow = false) {
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

  // What answers are valid
  get validAnswers(): string[] {
    if (!this.currentCard) return [];

    if (this.currentDirection === 'target-to-en') {
      // Translating NL -> EN: accept any English translation of this card.
      return this.currentCard.translations;
    }

    // Translating EN -> NL: accept every Dutch form that maps to this prompt
    // (e.g. "the" -> de, het). These were pre-computed when building the queue.
    const forms = this.currentStudyCard?.acceptedForms;
    return forms && forms.length > 0 ? forms : [this.currentCard.text];
  }

  /**
   * The answer the hint is based on (the first valid answer).
   */
  private get hintAnswer(): string {
    return this.validAnswers[0] ?? '';
  }

  /**
   * Total number of letters (excludes spaces) in the answer.
   */
  private get hintLetterCount(): number {
    return this.hintAnswer.replace(/\s/g, '').length;
  }

  /**
   * Build the masked hint string. Reveals the first `hintRevealed` letters
   * (spaces are always shown, and don't count toward the reveal budget).
   * Example: "of" with 1 revealed -> "o _"; "nodig hebben" with 3 -> "nod__ ______".
   */
  generateHint(): string {
    const answer = this.hintAnswer;
    // No answer, or no letters revealed yet -> no hint to show.
    if (!answer || this.hintRevealed <= 0) return '';

    let revealedSoFar = 0;
    let result = '';

    for (const ch of answer) {
      if (ch === ' ') {
        result += '  ';  // keep word separation visible
        continue;
      }
      if (revealedSoFar < this.hintRevealed) {
        result += ch;
        revealedSoFar++;
      } else {
        result += '_';
      }
    }

    return result.trim();
  }

  /** True when the hint button should be disabled (whole answer revealed). */
  get hintExhausted(): boolean {
    return this.hintRevealed >= this.hintLetterCount;
  }

  /**
   * Reveal one more letter of the answer. When the full answer is revealed,
   * mark the card as "given up" and move to the incorrect feedback.
   */
  showHint(): void {
    this.usedHint = true;

    // Reveal one more letter.
    this.hintRevealed = Math.min(this.hintRevealed + 1, this.hintLetterCount);
    this.hintText = this.generateHint();

    // If the whole word is now revealed, show the answer (counts as incorrect
    // for scoring, but presented as a friendly reveal rather than "gave up").
    if (this.hintRevealed >= this.hintLetterCount) {
      this.revealedViaHint = true;
      this.correctAnswer = this.hintAnswer;
      this.feedbackResult = 'incorrect';
      this.incorrectCount++;
      this.recordAttempt(false);
      this.phase = 'feedback';
      this.markFailedAndRequeue();
    }

    this.cdr.detectChanges();
  }

  async recordAttempt(correct: boolean): Promise<void> {
    if (this.deck && this.currentCard) {
      await this.flashcardService.recordAttempt(this.deck.id, this.currentCard.id, correct);
    }
  }

  /**
   * Mark the current card as failed: it won't count toward progress and will
   * be re-queued at the end so the learner gets another try. The star score
   * remembers the failure (failedIds) so retried-then-correct cards don't
   * score as a first-try success.
   */
  private markFailedAndRequeue(): void {
    if (!this.currentStudyCard || !this.currentCard) return;

    this.failedIds.add(this.currentCard.id);

    // Re-queue a fresh copy at the end of the session (same direction so the
    // user keeps practising in the language they chose), flagged as a retry.
    this.studyCards.push({
      card: this.currentStudyCard.card,
      direction: this.currentStudyCard.direction,
      isRetry: true,
      acceptedForms: this.currentStudyCard.acceptedForms,
    });
  }

  /**
   * Mark the current card as successfully completed (counts toward progress).
   */
  private markCompleted(): void {
    if (this.currentCard) {
      this.completedIds.add(this.currentCard.id);
    }
  }

  async submitAnswer(): Promise<void> {
    // Pull the live DOM value first so a composed accent ("café") isn't read as
    // its pre-composition value ("caf") from a lagging ngModel.
    await this.syncNativeValue();
    if (!this.userAnswer.trim() || !this.currentCard || !this.deck) return;

    this.submittedAnswer = this.userAnswer.trim();
    const validAnswers = this.validAnswers;

    // Grade against every accepted answer with the shared typo grader
    // (docs/LEVEL-ALGORITHM.md §9): exact / accent / typo are all ACCEPTED;
    // only 'wrong' is a miss. Write has a free-text keyboard, so there is no
    // "can't edit the tile" trap — we never show the amber retry here; we just
    // accept with a note (accent/typo) or mark it wrong.
    const { grade, matched } = gradeAnswer(this.submittedAnswer, validAnswers);

    if (grade !== 'wrong') {
      this.nearMiss = grade === 'accent' ? 'accent' : grade === 'typo' ? 'typo' : 'none';
      this.correctAnswer = matched || validAnswers[0];
      this.feedbackResult = 'correct';
      // A perfect first-try answer (no hint, no typo/accent slip) earns the
      // "correct" stat; an accepted slip OR a hint counts as a mistake for
      // scoring, but the card still completes so the learner isn't blocked.
      if (grade === 'exact' && !this.usedHint) {
        this.correctCount++;
        this.recordAttempt(true);
      } else {
        this.incorrectCount++;
        this.recordAttempt(false);
      }
      this.markCompleted();
      this.phase = 'feedback';
      // Keep focus so the keyboard stays open (typing is blocked by the
      // feedback guards). No auto-advance: tap the green Continue to move on.
      this.focusInput();
      if (this.settings.autoPlayAudio()) this.playWord();
      this.cdr.detectChanges();
      return;
    }

    // Incorrect
    this.feedbackResult = 'incorrect';
    this.incorrectCount++;
    this.recordAttempt(false);
    this.correctAnswer = validAnswers[0];
    this.phase = 'feedback';
    // Keep focus (keyboard stays up; typing blocked) until the user continues.
    this.focusInput();
    this.markFailedAndRequeue();
  }

  /**
   * Reveal a hint while on the "almost" feedback, without leaving the
   * feedback screen. The user then chooses Try Again or Skip.
   */
  showHintInAlmost(): void {
    this.usedHint = true;
    this.hintRevealed = Math.min(this.hintRevealed + 1, this.hintLetterCount);
    this.hintText = this.generateHint();
    this.cdr.detectChanges();
  }

  tryAgain(): void {
    this.isRetryAttempt = true;
    this.userAnswer = '';
    this.nearMiss = 'none';
    this.phase = 'question';
    // Only keep a hint if the user actually revealed one; otherwise clear it
    // so no empty "______" mask shows up unprompted.
    this.hintText = this.hintRevealed > 0 ? this.generateHint() : '';
    this.focusInput();
  }

  acceptAlmost(): void {
    // Count as incorrect for learning purposes
    this.incorrectCount++;
    this.recordAttempt(false);
    this.markFailedAndRequeue();
    this.nextCard();
  }

  nextCard(): void {
    if (this.autoAdvanceTimer) { clearTimeout(this.autoAdvanceTimer); this.autoAdvanceTimer = null; }
    this.currentIndex++;
    this.userAnswer = '';
    this.submittedAnswer = '';
    this.isRetryAttempt = false;
    this.nearMiss = 'none';
    this.hintRevealed = 0;
    this.hintText = '';
    this.usedHint = false;
    this.revealedViaHint = false;
    this.playCount = 0;

    // The session ends only when every unique card has been answered
    // correctly. Failed cards were appended to the queue, so we keep going
    // until we run past the end of the (possibly extended) list.
    if (this.completedIds.size >= this.totalUnique || this.currentIndex >= this.studyCards.length) {
      this.completeSession();
    } else {
      this.phase = 'question';
      this.focusInput();
      this.cdr.detectChanges();
    }
  }

  async completeSession(): Promise<void> {
    // First-try accuracy for this round/session.
    const firstTryCorrect = Math.max(0, this.totalUnique - this.failedIds.size);
    const pct = this.totalUnique > 0
      ? Math.round((firstTryCorrect / this.totalUnique) * 100)
      : 0;

    // Quick study (no level): just show a simple result, no rounds.
    if (this.levelNumber <= 0 || !this.deck) {
      this.phase = 'complete';
      this.earnedStars = this.flashcardService.calculateStars(pct);
      this.cdr.detectChanges();
      return;
    }

    // Record which words were missed this round, to bias the final round.
    for (const id of this.failedIds) this.missedThisLevel.add(id);

    // Save this round's result.
    const result = await this.flashcardService.saveRoundProgress(
      this.deck.id, this.mode, this.levelNumber, pct
    );
    this.roundsCompleted = result.roundsCompleted;
    this.earnedStars = result.stars;

    if (this.singlePass) {
      // Journey node: one pass IS the whole node — go straight to the summary
      // (no round interstitial). The node counts as passed via bestScore.
      this.isNewBest = true;
      this.roundInterstitial = false;
      this.phase = 'complete';
    } else if (result.levelComplete) {
      // All 5 rounds done → final level summary.
      this.isNewBest = true;
      this.phase = 'complete';
    } else {
      // More rounds to go → show a round interstitial with a Continue button.
      this.roundInterstitial = true;
      this.phase = 'complete';
    }
    this.cdr.detectChanges();
  }

  /** Continue to the next round (rebuilds the round's cards and resets state). */
  nextRound(): void {
    if (!this.deck) return;
    this.round = Math.min(this.totalRounds, this.roundsCompleted + 1);
    const cards = this.flashcardService.getRoundCards(
      this.deck.id, this.levelNumber, this.round, [...this.missedThisLevel]
    );
    // Reset per-session state for the new round.
    this.studyCards = this.buildStudyCards(cards);
    this.totalUnique = this.studyCards.length;
    this.currentIndex = 0;
    this.failedIds.clear();
    this.completedIds.clear();
    this.userAnswer = '';
    this.submittedAnswer = '';
    this.roundInterstitial = false;
    this.phase = 'question';
    this.cdr.detectChanges();
    this.focusInput();
  }

  /** True when the current round has no answered/typed progress to lose. */
  private get hasNothingToLose(): boolean {
    return this.completedIds.size === 0
      && this.failedIds.size === 0
      && this.currentIndex === 0
      && !this.userAnswer.trim();
  }

  async endStudy(): Promise<void> {
    // If nothing was answered this round, there's nothing to lose — just exit
    // without the confirmation prompt.
    if (this.hasNothingToLose) {
      this.navCtrl.navigateBack(this.backUrl);
      return;
    }
    const alert = await this.alertController.create({
      header: this.t('mode.endStudyHeader'),
      message: this.t('mode.endStudyMessage'),
      buttons: [
        {
          text: this.t('common.cancel'),
          role: 'cancel',
        },
        {
          text: this.t('mode.end'),
          role: 'confirm',
          handler: () => {
            this.navCtrl.navigateBack(this.backUrl);
          },
        },
      ],
    });
    await alert.present();
  }

  finishStudy(): void {
    this.navCtrl.navigateBack(this.backUrl);
  }

  get accuracy(): number {
    const total = this.correctCount + this.incorrectCount;
    if (total === 0) return 0;
    return Math.round((this.correctCount / total) * 100);
  }
  
  // For display in feedback - show all alternatives
  get alternativeAnswers(): string[] {
    if (!this.currentCard) return [];
    const answers = this.currentDirection === 'en-to-target'
      ? []  // Dutch word has no alternatives
      : this.currentCard.translations.slice(1, 4);
    return answers;
  }

  /**
   * All accepted answers to display when the word is revealed via hints.
   * For EN -> NL this is every Dutch form (de, het). For NL -> EN it's the
   * list of English translations.
   */
  get revealedForms(): string[] {
    return this.validAnswers;
  }
  
  // Star display helpers
  getStarArray(count: number): number[] {
    return Array(count).fill(0);
  }
  
  getEmptyStarArray(count: number): number[] {
    return Array(3 - count).fill(0);
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
