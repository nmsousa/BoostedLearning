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
  private cdr = inject(ChangeDetectorRef);

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
      const isUnlocked = await this.flashcardService.isLevelUnlocked(deckId, 'quiz', this.levelNumber);
      if (!isUnlocked) {
        this.router.navigate(['/flashcards']);
        return;
      }
      cards = this.flashcardService.getLevelCards(deckId, this.levelNumber);
    } else {
      cards = this.flashcardService.getFlashcardQueue(deckId, 20);
    }

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

  /** Build the prompt + options for the current card. */
  private loadQuestion() {
    this.answered = false;
    const card = this.cards[this.currentIndex];
    this.prompt = card.text;

    const correctLabel = this.flashcardService.bestTranslation(card);

    // Gather distractors from other cards in the deck (clean translations,
    // excluding any that equal the correct answer).
    const pool = (this.deck?.cards ?? [])
      .filter(c => c.id !== card.id)
      .map(c => this.flashcardService.bestTranslation(c))
      .filter(t => t && t.toLowerCase() !== correctLabel.toLowerCase());

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
    this.router.navigate(['/flashcards'], { replaceUrl: true });
  }

  close() {
    this.router.navigate(['/flashcards'], { replaceUrl: true });
  }
}
