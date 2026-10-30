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

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FlashcardService, Flashcard, FlashcardDeck } from '../../services/flashcard.service';
import { ToastController } from '@ionic/angular';
import { AudioService } from '../../services/audio.service';
import { SettingsService } from '../../services/settings.service';
import { I18nAngularService } from '../../services/i18n.service';
import { AddWordService } from '../../services/add-word.service';

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
})
export class QuizPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
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
      onHidden: () => this.skipHiddenCard(),
    });
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

  private readonly OPTION_COUNT = 4;

  // Cards for the session and progress through them.
  private cards: Flashcard[] = [];
  currentIndex = 0;

  prompt = '';
  options: QuizOption[] = [];

  phase: QuizPhase = 'play';
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
      const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, 'quiz', this.levelNumber);
      if (!isUnlocked) {
        this.router.navigate(['/practice']);
        return;
      }
      cards = this.flashcardService.getLevelCards(deckId, this.levelNumber);
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

    const distractors = this.shuffle([...new Set(pool)]).slice(0, this.OPTION_COUNT - 1);

    const labels = this.shuffle([correctLabel, ...distractors]);
    this.options = labels.map(label => ({
      label,
      correct: label === correctLabel,
      revealed: false,
      chosen: false,
    }));
  }

  choose(option: QuizOption) {
    if (this.answered) return;
    this.answered = true;
    option.chosen = true;

    // Reveal correctness on all options.
    for (const o of this.options) o.revealed = true;

    if (option.correct) {
      this.correctCount++;
      if (this.deck) {
        this.flashcardService.rateFlashcard(this.deck.id, this.cards[this.currentIndex].id, 'easy');
      }
    } else {
      this.mistakes++;
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
    this.phase = 'complete';

    const total = this.cards.length;
    const scorePercent = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

    if (this.levelNumber > 0 && this.deck) {
      const result = await this.flashcardService.saveLevelProgress(
        this.deck.id,
        'quiz',
        this.levelNumber,
        this.correctCount,
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
    this.router.navigate(['/practice'], { replaceUrl: true });
  }

  close() {
    this.router.navigate(['/practice'], { replaceUrl: true });
  }
}
