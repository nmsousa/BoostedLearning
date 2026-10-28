/**
 * Listening / Audio Dictation Exercise Module
 * 
 * Listen to audio and type what you hear.
 * Uses TTS via Capability_Detection with non-audio fallback.
 * No speech recognition - just listening + typing.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 13.5, 18.1
 * Design: Exercise module contract; TTS graceful degradation
 * 
 * @module exercises/modules
 */

import {
  BaseExerciseModule,
  ExerciseInstance,
  ExerciseResponse,
  EvaluationResult,
  RenderContext,
  ExerciseAccessibility,
} from '../exercise-contract';
import { SkillDimension, ExerciseType, AttemptOutcomeResult } from '../../core/types';
import { createAnswerValidator } from '../../core/answer-validator';

export class ListeningExercise extends BaseExerciseModule {
  readonly type: ExerciseType = 'listening';
  readonly name = 'Listening Comprehension';
  readonly description = 'Listen to audio and type what you hear';
  readonly objective = 'listening';
  readonly applicableSkillDimensions: readonly SkillDimension[] = [
    'listening_comprehension',
    'productive_vocabulary',
  ];
  readonly supportsAudio = true;
  
  private audioPlayed = false;
  private playCount = 0;
  private audioAvailable = true;
  
  render(instance: ExerciseInstance, context: RenderContext): () => void {
    this.reset();
    this.startTimer();
    this.audioPlayed = false;
    this.playCount = 0;
    this.audioAvailable = true; // Would be set by capability detection
    
    return () => {
      this.reset();
    };
  }
  
  evaluate(response: ExerciseResponse, instance: ExerciseInstance): EvaluationResult {
    // Use tolerant matching for listening - focus on comprehension
    const validator = createAnswerValidator();
    
    const allAnswers = [
      ...instance.expectedAnswers,
      ...(instance.alternatives ?? []),
    ];
    
    const result = validator.validate({
      submitted: response.submitted,
      acceptedAnswers: allAnswers,
      policy: {
        ignoreCase: true,
        ignoreAccents: true,
        ignorePunctuationWhitespace: true,
        freeWordOrder: false,
        acceptInflectionsContractions: true,
      },
    });
    
    let outcome: AttemptOutcomeResult;
    if (result.correct) {
      outcome = response.hintUsed ? 'correct-with-hint' : 'correct-unaided';
    } else {
      outcome = 'incorrect';
    }
    
    return {
      correct: result.correct,
      outcome,
      correctAnswers: instance.expectedAnswers,
    };
  }
  
  // Mark that audio was played
  markAudioPlayed(): void {
    this.audioPlayed = true;
    this.playCount++;
    this.setAudioUsed(true);
  }
  
  wasAudioPlayed(): boolean {
    return this.audioPlayed;
  }
  
  getPlayCount(): number {
    return this.playCount;
  }
  
  // Set audio availability from capability detection
  setAudioAvailable(available: boolean): void {
    this.audioAvailable = available;
  }
  
  isAudioAvailable(): boolean {
    return this.audioAvailable;
  }
  
  submitAnswer(answer: string): void {
    this.setSubmitted(answer);
  }
  
  useHint(): void {
    this.setHintUsed(true);
  }
  
  override accessibility(
    instance: ExerciseInstance,
    t: (key: string, params?: Record<string, string | number>) => string
  ): ExerciseAccessibility {
    const audioStatus = this.audioAvailable 
      ? 'Audio available. Click the play button to hear the phrase.'
      : 'Audio unavailable. Read the text shown instead.';
    
    return {
      ariaLabel: `Listening: ${instance.prompt}`,
      ariaDescription: audioStatus,
      keyboardNavigable: true,
      touchTargetCompliant: true,
      screenReaderInstructions: 'Press the play button to hear the audio, then type what you hear in the input field.',
    };
  }
}

export function createListeningExercise(): ListeningExercise {
  return new ListeningExercise();
}
