/**
 * Quiz Page - multiple-choice practice.
 *
 * Shows a Dutch word and four English options; the user taps the correct
 * translation. Correct answers advance; wrong answers reveal the right one.
 * Level-based like the other modes, scored by first-try accuracy into stars
 * stored under the 'quiz' mode.
 *
 * @module app/flashcards/quiz
 */

import { Component, OnInit, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FlashcardService, Flashcard, FlashcardDeck, PracticeMode } from '../../services/flashcard.service';
import { ToastController, NavController } from '@ionic/angular';
import { AudioService } from '../../services/audio.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { AddWordService } from '../../services/add-word.service';
import { journeyBackUrl } from '../journey/journey-back';

type QuizPhase = 'play' | 'complete';

interface QuizOption {
  label: string;
  correct: boolean;
  /** Set once the user has answered, to drive option colours. */
  revealed: boolean;
  chosen: boolean;
}

@Component({
  selector: 'app-quiz',
  templateUrl: './quiz.page.html',
  styleUrls: ['./quiz.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizPage implements OnInit {
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
      modeName: this.t('mode.titleQuiz'),
      onHidden: () => this.skipHiddenCard(),
      showAutoPlayToggle: true,
      onAdminComplete: (stars) => this.adminCompleteLevel(stars, false),
      onAdminCompleteAll: this.singlePass ? undefined : (stars) => this.adminCompleteLevel(stars, true),
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

  /** After hiding the current word, move to the next question. */
  private skipHiddenCard(): void {
    this.currentIndex++;
    if (this.currentIndex >= this.cards.length) {
      this.completeSession();
    } else {
      this.loadQuestion();
    }
    this.cdr.detectChanges();
  }

  deck: FlashcardDeck | null = null;
  levelNumber = 0;
  /** Progress namespace: 'quiz' normally, 'journey-quiz' as a Journey node. */
  private mode: PracticeMode = 'quiz';
  private backUrl = '/practice';
  /** True for a Journey node: one pass, no round loop/interstitial. */
  singlePass = false;

  // ── 5-round model ──────────────────────────────────────────────────────────
  round = 0;
  totalRounds = 5;
  roundsCompleted = 0;
  roundInterstitial = false;
  private missedThisLevel = new Set<string>();

  private readonly OPTION_COUNT = 4;

  // Cards for the session and progress through them.
  private cards: Flashcard[] = [];
  /** Skill/title of the current level (for the header), if any. */
  get levelTitle(): string { return this.cards[0]?.skill ?? ''; }
  currentIndex = 0;

  prompt = '';
  options: QuizOption[] = [];

  phase: QuizPhase = 'play';
  /** True while the session is being prepared (DB load). Prevents showing an
   *  empty play screen before the first question is ready. */
  isLoading = true;
  mistakes = 0;
  correctCount = 0;
  earnedStars = 0;
  isNewBest = false;

  private answered = false;

  async ngOnInit() {
    await this.flashcardService.initialize();

    const deckId = this.route.snapshot.paramMap.get('id');
    const levelParam = this.route.snapshot.queryParamMap.get('level');
    this.levelNumber = levelParam ? parseInt(levelParam, 10) : 0;
    // Journey Quiz node: score under 'journey-quiz', single pass, back to map.
    if (this.route.snapshot.queryParamMap.get('mode') === 'journey-quiz') {
      this.mode = 'journey-quiz';
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

    let cards: Flashcard[];
    if (this.levelNumber > 0) {
      const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, this.mode, this.levelNumber);
      if (!isUnlocked) {
        this.router.navigate([this.backUrl]);
        return;
      }
      if (this.singlePass) {
        this.totalRounds = 1;
        this.round = 1;
        this.roundsCompleted = 0;
        cards = this.flashcardService.getRoundCards(deckId, this.levelNumber, 1);
      } else {
        this.roundsCompleted = await this.flashcardService.getRoundsCompleted(deckId, this.mode, this.levelNumber);
        this.round = Math.min(this.totalRounds, this.roundsCompleted + 1);
        cards = this.flashcardService.getRoundCards(deckId, this.levelNumber, this.round);
      }
    } else {
      cards = this.flashcardService.getFlashcardQueue(deckId, 20);
    }

    // Exclude cards identical in both languages (the prompt word would also be
    // one of the options, making the question trivial).
    cards = this.flashcardService.playableCards(cards);

    this.cards = this.shuffle(cards);

    if (this.cards.length === 0) {
      this.phase = 'complete';
    } else {
      this.loadQuestion();
    }

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  get progress(): number {
    if (this.cards.length === 0) return 0;
    return (this.currentIndex / this.cards.length) * 100;
  }

  get total(): number {
    return this.cards.length;
  }

  private get currentCard(): Flashcard | null {
    return this.cards[this.currentIndex] ?? null;
  }

  /** How many times the (normal-speed) word audio has been played this card. */
  playCount = 0;

  /** Show the slow-replay button only after the word was played twice. */
  get showSlowButton(): boolean {
    return this.playCount >= 2;
  }

  /** Play the prompt word: recorded clip if available, else device TTS. */
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

  /** Build the prompt + options for the current card. */
  private loadQuestion() {
    this.answered = false;
    this.playCount = 0;
    const card = this.cards[this.currentIndex];
    this.prompt = card.text;

    const correctLabel = this.flashcardService.bestTranslation(card);
    const promptLower = card.text.trim().toLowerCase();

    // Gather distractors from other cards in the deck (clean translations),
    // excluding any that equal the correct answer or the prompt word itself.
    const pool = (this.deck?.cards ?? [])
      .filter(c => c.id !== card.id)
      .map(c => this.flashcardService.bestTranslation(c))
      .filter(t => {
        const tl = t.trim().toLowerCase();
        return tl && tl !== correctLabel.toLowerCase() && tl !== promptLower;
      });

    const distractors = this.pickDistractors(pool, correctLabel, this.OPTION_COUNT - 1);

    const labels = this.shuffle([correctLabel, ...distractors]);
    this.options = labels.map(label => ({
      label,
      correct: label === correctLabel,
      revealed: false,
      chosen: false,
    }));
  }

  /** Number of words in a translation label. */
  private wordCount(s: string): number {
    return s.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Pick `n` distractors that, as much as possible, have the SAME word count as
   * the correct answer — so a 1-word answer isn't given away by a long
   * multi-word option. We prefer exact word-count matches, then fall back to
   * the nearest counts, so we always return `n` options even in small decks.
   */
  private pickDistractors(pool: string[], correctLabel: string, n: number): string[] {
    const unique = [...new Set(pool)];
    const target = this.wordCount(correctLabel);

    // Group by |wordCount - target| so exact matches come first (distance 0),
    // then 1-off, etc. Shuffle within each distance band for variety.
    const byDistance = new Map<number, string[]>();
    for (const s of unique) {
      const d = Math.abs(this.wordCount(s) - target);
      (byDistance.get(d) ?? byDistance.set(d, []).get(d)!).push(s);
    }

    const ordered: string[] = [];
    for (const d of [...byDistance.keys()].sort((a, b) => a - b)) {
      ordered.push(...this.shuffle(byDistance.get(d)!));
    }
    return ordered.slice(0, n);
  }

  choose(option: QuizOption) {
    if (this.answered) return;
    this.answered = true;
    option.chosen = true;

    // Reveal correctness on all options.
    for (const o of this.options) o.revealed = true;

    if (option.correct) {
      this.correctCount++;
      if (this.settings.autoPlayAudio()) void this.playWord();
      if (this.deck) {
        this.flashcardService.rateFlashcard(this.deck.id, this.cards[this.currentIndex].id, 'easy');
      }
    } else {
      this.mistakes++;
      this.missedThisLevel.add(this.cards[this.currentIndex].id);
      if (this.deck) {
        this.flashcardService.rateFlashcard(this.deck.id, this.cards[this.currentIndex].id, 'hard');
      }
    }

    this.cdr.detectChanges();

    // Pause to show the result, then advance.
    setTimeout(() => {
      this.currentIndex++;
      if (this.currentIndex >= this.cards.length) {
        this.completeSession();
      } else {
        this.loadQuestion();
      }
      this.cdr.detectChanges();
    }, option.correct ? 650 : 1100);
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private async completeSession() {
    const total = this.cards.length;
    const scorePercent = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

    if (this.levelNumber <= 0 || !this.deck) {
      this.phase = 'complete';
      this.earnedStars = this.flashcardService.calculateStars(scorePercent);
      this.cdr.detectChanges();
      return;
    }

    const result = await this.flashcardService.saveRoundProgress(
      this.deck.id, this.mode, this.levelNumber, scorePercent
    );
    this.roundsCompleted = result.roundsCompleted;
    this.earnedStars = result.stars;
    // Journey node: one pass = done (no interstitial). Otherwise the 5-round rule.
    this.isNewBest = this.singlePass ? true : result.levelComplete;
    this.roundInterstitial = this.singlePass ? false : !result.levelComplete;
    this.phase = 'complete';
    this.cdr.detectChanges();
  }

  /**
   * True only when the NEXT round actually biases toward words missed in this
   * level (final round, with recorded misses). Rounds 2–4 mix new words with
   * earlier-level review, so they get a neutral message instead.
   */
  get nextRoundFocusesOnMissed(): boolean {
    const nextRound = this.roundsCompleted + 1;
    return nextRound >= this.totalRounds && this.missedThisLevel.size > 0;
  }

  /** Continue to the next round. */
  nextRound(): void {
    if (!this.deck) return;
    this.round = Math.min(this.totalRounds, this.roundsCompleted + 1);
    let cards = this.flashcardService.getRoundCards(
      this.deck.id, this.levelNumber, this.round, [...this.missedThisLevel]
    );
    cards = this.flashcardService.playableCards(cards);
    this.cards = this.shuffle(cards);
    this.currentIndex = 0;
    this.correctCount = 0;
    this.mistakes = 0;
    this.roundInterstitial = false;
    this.phase = 'play';
    if (this.cards.length === 0) { this.completeSession(); return; }
    this.loadQuestion();
    this.cdr.detectChanges();
  }

  finish() {
    this.navCtrl.navigateBack(this.backUrl);
  }

  close() {
    this.navCtrl.navigateBack(this.backUrl);
  }
}
