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
import { AlertController, IonInput, ToastController } from '@ionic/angular';
import { FlashcardService, Flashcard, FlashcardDeck, PracticeMode } from '../../services/flashcard.service';
import { I18nAngularService } from '../../services/i18n.service';
import { SettingsService } from '../../services/settings.service';
import { AudioService } from '../../services/audio.service';
import { AddWordService } from '../../services/add-word.service';

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
export class StudyPage implements OnInit, OnDestroy {
  @ViewChild('answerInput') answerInput!: IonInput;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
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
    this.router.navigate([this.backUrl], { replaceUrl: true });
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
      this.backUrl = '/practice/journey';
    } else if (modeParam === 'journey-write') {
      // Journey WRITE node: a single pass (no 5-round loop), back to the map.
      this.mode = 'journey-write';
      this.backUrl = '/practice/journey';
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

  ngAfterViewInit() {
    this.focusInput();
  }

  /**
   * Keep the keyboard up by holding focus on the input. We focus during the
   * question AND during correct/incorrect feedback (the input stays mounted,
   * read-only), so the keyboard doesn't close + reopen between cards. We do NOT
   * force focus for the "almost" retry card (it has its own flow).
   */
  private focusInput(): void {
    setTimeout(() => {
      const keepUp =
        this.phase === 'question' ||
        (this.phase === 'feedback' && this.feedbackResult !== 'almost');
      if (this.answerInput && keepUp) {
        this.answerInput.setFocus();
      }
    }, 100);
  }

  /**
   * Enter key inside the input: submit while typing, else advance to the next
   * card (the input stays focused through feedback, so Enter still lands here).
   */
  onEnter(): void {
    if (this.phase === 'question') this.submitAnswer();
    else if (this.phase === 'feedback' && this.feedbackResult !== 'almost') this.nextCard();
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

  submitAnswer(): void {
    if (!this.userAnswer.trim() || !this.currentCard || !this.deck) return;

    this.submittedAnswer = this.userAnswer.trim();
    const normalizedSubmitted = this.normalizeForComparison(this.submittedAnswer);
    const validAnswers = this.validAnswers;

    // Check for exact match (accent-insensitive)
    const isExactMatch = validAnswers.some(
      t => this.normalizeForComparison(t) === normalizedSubmitted
    );

    if (isExactMatch) {
      this.feedbackResult = 'correct';
      // Only count as correct if no hints were used
      if (!this.usedHint) {
        this.correctCount++;
        this.recordAttempt(true);
      } else {
        this.incorrectCount++;
        this.recordAttempt(false);
      }
      // A correct answer completes this unique card (progress advances).
      this.markCompleted();
      this.correctAnswer = validAnswers[0];
      this.phase = 'feedback';
      // Correct answers DON'T need a "Continue" tap: show a brief green flash,
      // keep the keyboard up, optionally play the word, then auto-advance. This
      // also removes the keyboard open/close flicker between cards.
      this.focusInput();
      if (this.settings.autoPlayAudio()) this.playWord();
      if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = setTimeout(() => {
        this.autoAdvanceTimer = null;
        // Only auto-advance if still on this correct card (user didn't act).
        if (this.phase === 'feedback' && this.feedbackResult === 'correct') {
          this.nextCard();
          // OnPush: a bare setTimeout doesn't re-render this component, so mark
          // it explicitly after advancing.
          this.cdr.detectChanges();
        }
      }, 900);
      this.cdr.detectChanges();
      return;
    }

    // Check for close match (only on first attempt)
    if (!this.isRetryAttempt) {
      const closestMatch = this.findClosestMatch(normalizedSubmitted, validAnswers);
      if (closestMatch.similarity >= 0.7) {
        this.feedbackResult = 'almost';
        this.correctAnswer = closestMatch.answer;
        this.phase = 'feedback';
        return;
      }
    }

    // Incorrect
    this.feedbackResult = 'incorrect';
    this.incorrectCount++;
    this.recordAttempt(false);
    this.correctAnswer = validAnswers[0];
    this.phase = 'feedback';
    this.focusInput(); // keep the keyboard up for the next card
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
      this.router.navigate([this.backUrl], { replaceUrl: true });
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
            this.router.navigate([this.backUrl], { replaceUrl: true });
          },
        },
      ],
    });
    await alert.present();
  }

  finishStudy(): void {
    this.router.navigate([this.backUrl], { replaceUrl: true });
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

  private findClosestMatch(submitted: string, answers: string[]): { answer: string; similarity: number } {
    let bestMatch = { answer: '', similarity: 0 };

    for (const answer of answers) {
      const normalized = this.normalizeForComparison(answer);
      const maxLen = Math.max(submitted.length, normalized.length);

      if (maxLen === 0) continue;

      const distance = this.levenshteinDistance(submitted, normalized);
      const similarity = 1 - (distance / maxLen);

      if (similarity > bestMatch.similarity) {
        bestMatch = { answer, similarity };
      }
    }

    return bestMatch;
  }

  /**
   * Normalize text for comparison. Accent-insensitive, case-insensitive, and
   * punctuation-insensitive so e.g. "cafe" == "café" and "ça va" == "ça va?".
   * We strip sentence punctuation (? ! . , ; : « » " and the ¿¡ marks) and
   * collapse whitespace, but KEEP in-word apostrophes/hyphens (s'il, au-revoir)
   * since those change the word.
   */
  private normalizeForComparison(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')          // drop diacritical marks
      .replace(/[?!.,;:«»"¿¡]/g, '')             // drop sentence punctuation
      .replace(/\s+/g, ' ')                       // collapse whitespace
      .trim();
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
