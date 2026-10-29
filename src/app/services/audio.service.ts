/**
 * Audio Service
 *
 * Plays word audio two ways so they can be compared:
 *  - `playRecorded(url)`: the pre-recorded clip from the deck's audioUrl.
 *  - `playTts(text, langCode)`: device text-to-speech via the TTS service.
 *
 * (Temporary: both are exposed side-by-side for A/B comparison. The intended
 * end state is a single hybrid — recorded when available, TTS fallback.)
 *
 * Respects the Settings audio-speed preference. Web/no-audio environments
 * degrade to no-ops.
 *
 * @module app/services
 */

import { Injectable, inject } from '@angular/core';
import { SettingsService } from './settings.service';
import { createTTSService, TTSService } from '../../services/tts';

/** Map an app language code to a BCP 47 tag for TTS voice selection. */
const LANG_TO_BCP47: Record<string, string> = {
  nl: 'nl-NL',
  fr: 'fr-FR',
  es: 'es-ES',
  en: 'en-US',
  de: 'de-DE',
};

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private settings = inject(SettingsService);
  private tts: TTSService = createTTSService();
  private audioEl: HTMLAudioElement | null = null;

  /** Play a pre-recorded clip from a URL. Returns true if playback started. */
  async playRecorded(url: string | undefined | null): Promise<boolean> {
    if (!url) return false;
    try {
      // Reuse a single element so a new play cancels the previous.
      if (!this.audioEl) {
        this.audioEl = typeof Audio !== 'undefined' ? new Audio() : null;
      }
      if (!this.audioEl) return false;

      this.tts.stop(); // don't overlap with TTS
      this.audioEl.pause();
      this.audioEl.src = url;
      this.audioEl.playbackRate = this.settings.audioSpeed();
      await this.audioEl.play();
      return true;
    } catch (err) {
      console.warn('AudioService: recorded playback failed', err);
      return false;
    }
  }

  /** Speak text with device TTS in the given app language. */
  async playTts(text: string, langCode: string): Promise<boolean> {
    if (!text) return false;
    const lang = LANG_TO_BCP47[langCode] ?? langCode;
    if (this.audioEl) this.audioEl.pause(); // don't overlap with recorded
    const result = await this.tts.speak(text, {
      lang,
      rate: this.settings.audioSpeed(),
    });
    if (!result.success) {
      console.warn('AudioService: TTS failed', result.error);
    }
    return result.success;
  }

  /** Whether device TTS has a voice for the given app language. */
  hasTtsVoice(langCode: string): boolean {
    const lang = LANG_TO_BCP47[langCode] ?? langCode;
    return this.tts.hasVoiceFor(lang);
  }
}
