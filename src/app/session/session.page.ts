/**
 * Session Page - Exercise Host
 * 
 * One-task-at-a-time exercise host rendering the active ExerciseContract (R21.2).
 * 
 * Requirements: 21.2, 17.4
 * 
 * @module app/session
 */

import { Component, OnInit, OnDestroy, inject, HostListener, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonInput } from '@ionic/angular';
import { SessionService } from '../services/session.service';
import { ContentService } from '../services/content.service';
import { ExerciseService } from '../services/exercise.service';
import { TtsService } from '../services/tts.service';
import { I18nAngularService } from '../services/i18n.service';
import { SettingsService } from '../services/settings.service';
import { AttemptOutcomeResult } from '../../core/types';

type SessionPhase = 'exercise' | 'feedback' | 'retry' | 'complete';

// Feedback result: correct, almost (similar but not exact), incorrect
type FeedbackResult = 'correct' | 'almost' | 'incorrect';

@Component({
  selector: 'app-session',
  templateUrl: './session.page.html',
  styleUrls: ['./session.page.scss'],
  standalone: false,
})
export class SessionPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('answerInput') answerInput!: IonInput;
  
  private router = inject(Router);
  private alertController = inject(AlertController);
  private sessionService = inject(SessionService);
  private contentService = inject(ContentService);
  private exerciseService = inject(ExerciseService);
  private ttsService = inject(TtsService);
  private i18n = inject(I18nAngularService);
  private settings = inject(SettingsService);

  phase: SessionPhase = 'exercise';
  userAnswer = '';
  submittedAnswer = ''; // Store what user submitted for display
  hintUsed = false;
  hintVisible = false;
  feedbackResult: FeedbackResult = 'incorrect';
  correctAnswer = '';
  isRetryAttempt = false; // Track if this is a second chance
  feedbackInsight: string | null = null; // Extra explanation for wrong answers
  allAcceptedAnswers: string[] = []; // Store all accepted answers for insight
  alternativeTranslations: string[] = []; // Store alternatives for insight
  
  // Current exercise data
  prompt = '';
  hint: string | null = null;
  audioText: string | null = null;
  targetLanguage = 'nl';
  showAudioControls = false;
  canSlowDown = false;
  
  // Session state from service
  get isActive() { return this.sessionService.isActive(); }
  get currentIndex() { return this.sessionService.currentIndex(); }
  get totalItems() { return this.sessionService.totalItems(); }
  get progress() { return this.sessionService.progress(); }
  get isComplete() { return this.sessionService.isComplete(); }
  get currentItem() { return this.sessionService.currentItem(); }

  ngOnInit() {
    // Ensure content is initialized
    this.contentService.initialize();
    
    if (!this.isActive) {
      this.router.navigate(['/home'], { replaceUrl: true });
      return;
    }
    
    this.loadCurrentExercise();
  }

  ngAfterViewInit() {
    // Focus input after view is ready
    this.focusAnswerInput();
  }

  ngOnDestroy() {
    this.ttsService.stop();
  }

  /**
   * Focus the answer input field (for web usability)
   */
  private focusAnswerInput(): void {
    // Small delay to ensure Ionic input is fully rendered
    setTimeout(() => {
      if (this.answerInput && this.phase === 'exercise') {
        this.answerInput.setFocus();
      }
    }, 100);
  }

  /**
   * Handle keyboard events for navigation
   */
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      // In feedback phase with "almost", Enter triggers retry
      if (this.phase === 'feedback' && this.feedbackResult === 'almost') {
        event.preventDefault();
        this.tryAgain();
      }
      // In feedback phase with correct/incorrect, Enter goes to next exercise
      else if (this.phase === 'feedback') {
        event.preventDefault();
        this.nextExercise();
      }
      // In complete phase, Enter finishes session
      else if (this.phase === 'complete') {
        event.preventDefault();
        this.finishSession();
      }
      // In exercise phase, Enter is handled by the input's (keyup.enter)
    }
  }

  private loadCurrentExercise(): void {
    const item = this.currentItem;
    if (!item) {
      this.phase = 'complete';
      return;
    }

    const enriched = this.contentService.getEnrichedItem(item.learningItemId);
    if (!enriched) {
      this.contentService.logContentGap(`Missing item: ${item.learningItemId}`);
      this.skipItem();
      return;
    }

    // Set up exercise display
    this.prompt = enriched.item.prompt ?? 'Practice';
    this.hint = enriched.vocabulary?.targetText ?? null;
    this.audioText = enriched.vocabulary?.targetText ?? null;
    this.targetLanguage = enriched.item.languageId ?? 'nl';
    
    // Check audio capabilities
    const exerciseContract = this.exerciseService.getExercise(item.exerciseType);
    const audioState = this.ttsService.getExerciseAudioState(
      this.targetLanguage,
      exerciseContract?.supportsAudio ?? false
    );
    this.showAudioControls = audioState.showAudioControls;
    this.canSlowDown = audioState.showSlowDownButton;
    
    // Reset state
    this.phase = 'exercise';
    this.userAnswer = '';
    this.submittedAnswer = '';
    this.hintUsed = false;
    this.hintVisible = false;
    this.isRetryAttempt = false;
    this.feedbackResult = 'incorrect';
    this.feedbackInsight = null;
    this.correctAnswer = enriched.vocabulary?.acceptedAnswers?.[0] ?? '';
    this.allAcceptedAnswers = enriched.vocabulary?.acceptedAnswers ?? [];
    this.alternativeTranslations = enriched.vocabulary?.alternativeTranslations ?? [];
    
    // Focus the input for web usability
    this.focusAnswerInput();
  }

  submitAnswer(): void {
    if (!this.userAnswer.trim()) return;
    
    const item = this.currentItem;
    if (!item) return;
    
    const enriched = this.contentService.getEnrichedItem(item.learningItemId);
    if (!enriched) return;
    
    // Store submitted answer for display
    this.submittedAnswer = this.userAnswer.trim();
    
    const expectedAnswers = enriched.vocabulary?.acceptedAnswers ?? [];
    const normalizedSubmitted = this.submittedAnswer.toLowerCase();
    
    // Check for exact match
    const isExactMatch = expectedAnswers.some(
      (ans: string) => ans.toLowerCase().trim() === normalizedSubmitted
    );
    
    if (isExactMatch) {
      // Correct!
      this.feedbackResult = 'correct';
      const outcome: AttemptOutcomeResult = this.hintUsed ? 'correct-with-hint' : 'correct-unaided';
      this.sessionService.recordResult(true, outcome, this.hintUsed);
      this.correctAnswer = expectedAnswers[0] ?? '';
      this.phase = 'feedback';
      return;
    }
    
    // Check for close match (almost correct) - only on first attempt
    if (!this.isRetryAttempt) {
      const closestMatch = this.findClosestMatch(normalizedSubmitted, expectedAnswers);
      if (closestMatch.similarity >= 0.7) {
        // Almost correct - give second chance
        this.feedbackResult = 'almost';
        this.correctAnswer = closestMatch.answer;
        this.phase = 'feedback';
        return;
      }
    }
    
    // Incorrect
    this.feedbackResult = 'incorrect';
    this.sessionService.recordResult(false, 'incorrect', this.hintUsed);
    this.correctAnswer = expectedAnswers[0] ?? '';
    
    // Generate insight for wrong answer
    this.feedbackInsight = this.generateFeedbackInsight(normalizedSubmitted, expectedAnswers, enriched);
    
    this.phase = 'feedback';
  }

  /**
   * Generate helpful insight when answer is wrong
   */
  private generateFeedbackInsight(
    submitted: string,
    expectedAnswers: string[],
    enriched: any
  ): string | null {
    const alternatives = enriched.vocabulary?.alternativeTranslations ?? [];
    const targetText = enriched.vocabulary?.targetText ?? '';
    
    // Check if user typed one of the alternative translations
    const typedAlternative = alternatives.find(
      (alt: string) => alt.toLowerCase().trim() === submitted
    );
    if (typedAlternative) {
      return this.t('feedback.insight.alternativeUsed', { word: typedAlternative, correct: expectedAnswers[0] });
    }
    
    // Check if user typed the prompt instead of the translation
    const prompt = enriched.item?.prompt?.toLowerCase() ?? '';
    if (submitted === prompt) {
      return this.t('feedback.insight.promptTyped');
    }
    
    // Check if user typed the target text (wrong direction)
    if (submitted === targetText.toLowerCase()) {
      return this.t('feedback.insight.wrongDirection');
    }
    
    // Check for common Dutch-specific mistakes
    const dutchInsight = this.checkDutchMistakes(submitted, expectedAnswers);
    if (dutchInsight) {
      return dutchInsight;
    }
    
    // Check if close match to any alternative (might be confused)
    for (const alt of alternatives) {
      const similarity = this.calculateSimilarity(submitted, alt.toLowerCase());
      if (similarity >= 0.6) {
        return this.t('feedback.insight.closeToAlternative', { word: alt, correct: expectedAnswers[0] });
      }
    }
    
    // Check if there are multiple accepted answers
    if (expectedAnswers.length > 1) {
      return this.t('feedback.insight.multipleAnswers', { answers: expectedAnswers.slice(0, 3).join(', ') });
    }
    
    return null;
  }

  /**
   * Check for common Dutch-specific spelling mistakes
   */
  private checkDutchMistakes(submitted: string, expected: string[]): string | null {
    const expectedLower = expected[0]?.toLowerCase() ?? '';
    
    // Common Dutch spelling confusions
    const dutchConfusions = [
      { pattern: /ij/g, confused: 'ei', explanation: 'feedback.insight.dutch.ijVsEi' },
      { pattern: /ei/g, confused: 'ij', explanation: 'feedback.insight.dutch.eiVsIj' },
      { pattern: /ou/g, confused: 'au', explanation: 'feedback.insight.dutch.ouVsAu' },
      { pattern: /au/g, confused: 'ou', explanation: 'feedback.insight.dutch.auVsOu' },
      { pattern: /g/g, confused: 'ch', explanation: 'feedback.insight.dutch.gVsCh' },
      { pattern: /dt$/g, confused: 't', explanation: 'feedback.insight.dutch.dtEnding' },
    ];
    
    for (const confusion of dutchConfusions) {
      // Check if the expected has the pattern and submitted has the confused version
      if (confusion.pattern.test(expectedLower)) {
        const expectedVariant = expectedLower.replace(confusion.pattern, confusion.confused);
        if (submitted === expectedVariant || this.calculateSimilarity(submitted, expectedVariant) > 0.85) {
          return this.t(confusion.explanation);
        }
      }
    }
    
    return null;
  }

  /**
   * Calculate similarity ratio between two strings
   */
  private calculateSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    const distance = this.levenshteinDistance(a, b);
    return 1 - (distance / maxLen);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
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
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Find the closest matching answer and its similarity score
   */
  private findClosestMatch(submitted: string, answers: string[]): { answer: string; similarity: number } {
    let bestMatch = { answer: '', similarity: 0 };
    
    for (const answer of answers) {
      const normalized = answer.toLowerCase().trim();
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
   * Give user a second chance after "almost correct"
   */
  tryAgain(): void {
    this.isRetryAttempt = true;
    this.userAnswer = '';
    this.phase = 'exercise';
    this.focusAnswerInput();
  }

  /**
   * Accept the "almost correct" and move on (counts as incorrect)
   */
  acceptAlmost(): void {
    this.sessionService.recordResult(false, 'incorrect', this.hintUsed);
    this.nextExercise();
  }

  showHint(): void {
    this.hintUsed = true;
    this.hintVisible = true;
  }

  playAudio(slow: boolean = false): void {
    if (!this.audioText) return;
    
    const rate = slow ? 0.7 : this.settings.audioSpeed();
    this.ttsService.speak(this.audioText, {
      lang: this.targetLanguage,
      rate,
    });
  }

  nextExercise(): void {
    this.sessionService.nextItem();
    
    if (this.isComplete) {
      this.phase = 'complete';
    } else {
      this.loadCurrentExercise();
    }
  }

  skipItem(): void {
    // Record as incorrect if skipped
    this.sessionService.recordResult(false, 'incorrect', false);
    this.nextExercise();
  }

  async endSession(): Promise<void> {
    const alert = await this.alertController.create({
      header: this.t('session.end'),
      message: 'Are you sure you want to end this session?',
      buttons: [
        {
          text: this.t('common.cancel'),
          role: 'cancel',
        },
        {
          text: this.t('session.end'),
          role: 'confirm',
          handler: () => {
            this.sessionService.endSession();
            this.router.navigate(['/home'], { replaceUrl: true });
          },
        },
      ],
    });
    
    await alert.present();
  }

  finishSession(): void {
    this.sessionService.endSession();
    // Replace URL to prevent back button going to completed session
    this.router.navigate(['/progress'], { replaceUrl: true });
  }

  getSummary() {
    return this.sessionService.getSessionSummary();
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
