/**
 * TTS Angular Service
 * 
 * Wraps the TTS service and capability detection for Angular DI.
 * 
 * @module app/services
 */

import { Injectable } from '@angular/core';
import {
  createTTSService,
  createCapabilityDetectionLayer,
  getExerciseAudioState,
  TTSService,
  CapabilityDetectionLayer,
  TTSOptions,
  TTSResult,
  VoiceInfo,
  ExerciseAudioState,
} from '../../services/tts';

@Injectable({
  providedIn: 'root',
})
export class TtsService {
  private tts: TTSService;
  private capabilities: CapabilityDetectionLayer;

  constructor() {
    this.tts = createTTSService();
    this.capabilities = createCapabilityDetectionLayer(this.tts);
  }

  /**
   * Speak text using TTS
   */
  async speak(text: string, options: TTSOptions): Promise<TTSResult> {
    return this.tts.speak(text, options);
  }

  /**
   * Stop current speech
   */
  stop(): void {
    this.tts.stop();
  }

  /**
   * Check if voice is available for a language
   */
  hasVoiceFor(lang: string): boolean {
    return this.tts.hasVoiceFor(lang);
  }

  /**
   * Get voices for a language
   */
  getVoicesFor(lang: string): VoiceInfo[] {
    return this.tts.getVoicesFor(lang);
  }

  /**
   * Check if speech is in progress
   */
  isSpeaking(): boolean {
    return this.tts.isSpeaking();
  }

  /**
   * Check if TTS is supported
   */
  isSupported(): boolean {
    return this.tts.isSupported();
  }

  /**
   * Check if rate adjustment is supported
   */
  canSlowDown(): boolean {
    return this.capabilities.canSlowDown();
  }

  /**
   * Check if audio should be disabled for a language
   */
  shouldDisableAudioFor(lang: string): boolean {
    return this.capabilities.shouldDisableAudioFor(lang);
  }

  /**
   * Get audio state for an exercise
   */
  getExerciseAudioState(lang: string, exerciseSupportsAudio: boolean): ExerciseAudioState {
    return getExerciseAudioState(this.capabilities, lang, exerciseSupportsAudio);
  }

  /**
   * Get device capabilities
   */
  getDeviceCapabilities() {
    return this.capabilities.getDeviceCapabilities();
  }
}
