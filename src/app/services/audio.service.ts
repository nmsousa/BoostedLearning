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

  /**
   * Speak text with device TTS in the given app language.
   * Returns `{ ok, reason? }` so the UI can explain a failure (e.g. no voice).
   */
  async playTts(text: string, langCode: string): Promise<{ ok: boolean; reason?: string }> {
    if (!text) return { ok: false, reason: 'No text' };
    const lang = LANG_TO_BCP47[langCode] ?? langCode;

    if (!this.tts.isSupported()) {
      return { ok: false, reason: 'Speech is not supported on this device.' };
    }
    if (!this.tts.hasVoiceFor(lang)) {
      return { ok: false, reason: `No voice installed for ${lang} on this device.` };
    }

    if (this.audioEl) this.audioEl.pause(); // don't overlap with recorded
    const result = await this.tts.speak(text, {
      lang,
      rate: this.settings.audioSpeed(),
    });
    if (!result.success) {
      console.warn('AudioService: TTS failed', result.error);
      return { ok: false, reason: result.error };
    }
    return { ok: true };
  }

  /** Whether device TTS has a voice for the given app language. */
  hasTtsVoice(langCode: string): boolean {
    const lang = LANG_TO_BCP47[langCode] ?? langCode;
    return this.tts.hasVoiceFor(lang);
  }

  /**
   * Play a word's audio with the preferred source: the recorded clip when
   * available, falling back to device TTS when there's no recording or the
   * recording fails to play. Returns `{ ok, reason? }` so the UI can report a
   * genuine failure (e.g. no recording AND no voice).
   */
  async playWord(
    text: string,
    audioUrl: string | undefined | null,
    langCode: string
  ): Promise<{ ok: boolean; reason?: string }> {
    if (audioUrl) {
      const played = await this.playRecorded(audioUrl);
      if (played) return { ok: true };
      // Recorded failed (network/expired URL) — fall through to TTS.
    }
    return this.playTts(text, langCode);
  }
}
