/**
 * Capability Detection Layer
 * 
 * Detects device capabilities for TTS and audio features.
 * Used to enable graceful degradation when capabilities are unavailable.
 * 
 * Requirements: 13.3, 13.4, 13.5, 13.6, 13.7, 14.5, 15.7
 * Design: TTS Adapter + Capability_Detection_Layer; TTS graceful degradation
 * 
 * @module services/tts
 */

import { TTSService, VoiceInfo } from './tts-service';

/**
 * Audio capability status for an exercise or feature
 */
export interface AudioCapability {
  /** Whether audio is available for the language */
  available: boolean;
  /** Whether playback rate adjustment is supported */
  supportsRateAdjustment: boolean;
  /** Reason audio is unavailable, if any */
  unavailableReason?: string;
  /** Available voices for the language */
  voices: VoiceInfo[];
}

/**
 * Device capabilities summary
 */
export interface DeviceCapabilities {
  /** Whether speech synthesis is supported */
  speechSynthesisSupported: boolean;
  /** Languages with available voices */
  availableLanguages: string[];
  /** Whether rate adjustment is supported */
  supportsRateAdjustment: boolean;
}

/**
 * Capability Detection Layer interface
 */
export interface CapabilityDetectionLayer {
  /**
   * Check if the device can slow down audio playback.
   * This is useful for learning exercises where users need to hear slower speech.
   */
  canSlowDown(): boolean;
  
  /**
   * Check if rate adjustment is supported.
   * Same as canSlowDown but named differently for clarity in some contexts.
   */
  supportsRateAdjustment(): boolean;
  
  /**
   * Check if there is a voice available for the given language.
   */
  hasVoiceFor(lang: string): boolean;
  
  /**
   * Get audio capability details for a language.
   * Used to determine if audio controls should be shown.
   */
  getAudioCapabilityFor(lang: string): AudioCapability;
  
  /**
   * Get overall device capabilities summary.
   */
  getDeviceCapabilities(): DeviceCapabilities;
  
  /**
   * Check if an exercise should have audio disabled.
   * Returns true if audio should be disabled (voice unavailable).
   */
  shouldDisableAudioFor(lang: string): boolean;
}

/**
 * Create a capability detection layer using the given TTS service.
 * 
 * @param ttsService - TTS service instance to check capabilities against
 * @returns CapabilityDetectionLayer implementation
 */
export function createCapabilityDetectionLayer(ttsService: TTSService): CapabilityDetectionLayer {
  // Rate adjustment is supported if speech synthesis is supported
  // Web Speech API supports rate adjustment on all implementations
  const rateAdjustmentSupported = ttsService.isSupported();
  
  return {
    canSlowDown(): boolean {
      return rateAdjustmentSupported;
    },
    
    supportsRateAdjustment(): boolean {
      return rateAdjustmentSupported;
    },
    
    hasVoiceFor(lang: string): boolean {
      return ttsService.hasVoiceFor(lang);
    },
    
    getAudioCapabilityFor(lang: string): AudioCapability {
      if (!ttsService.isSupported()) {
        return {
          available: false,
          supportsRateAdjustment: false,
          unavailableReason: 'Speech synthesis not supported on this device',
          voices: [],
        };
      }
      
      const voices = ttsService.getVoicesFor(lang);
      const hasVoice = voices.length > 0;
      
      if (!hasVoice) {
        return {
          available: false,
          supportsRateAdjustment: false,
          unavailableReason: `No voice available for language: ${lang}`,
          voices: [],
        };
      }
      
      return {
        available: true,
        supportsRateAdjustment: rateAdjustmentSupported,
        voices,
      };
    },
    
    getDeviceCapabilities(): DeviceCapabilities {
      if (!ttsService.isSupported()) {
        return {
          speechSynthesisSupported: false,
          availableLanguages: [],
          supportsRateAdjustment: false,
        };
      }
      
      // Get unique languages from all voices
      const voices = ttsService.getAllVoices();
      const languageSet = new Set<string>();
      
      for (const voice of voices) {
        // Add both exact lang code and base lang
        languageSet.add(voice.lang);
        const baseLang = voice.lang.split('-')[0];
        languageSet.add(baseLang);
      }
      
      return {
        speechSynthesisSupported: true,
        availableLanguages: Array.from(languageSet).sort(),
        supportsRateAdjustment: rateAdjustmentSupported,
      };
    },
    
    shouldDisableAudioFor(lang: string): boolean {
      // Disable audio if synthesis not supported or no voice for language
      // R13.5: When no Target_Language voice exists, disable audio controls
      return !ttsService.isSupported() || !ttsService.hasVoiceFor(lang);
    },
  };
}

/**
 * Exercise audio state - used by exercise modules to handle audio gracefully
 */
export interface ExerciseAudioState {
  /** Whether audio controls should be shown */
  showAudioControls: boolean;
  /** Whether the slow-down button should be shown */
  showSlowDownButton: boolean;
  /** Message to show if audio is unavailable */
  unavailableMessage?: string;
}

/**
 * Get the audio state for an exercise.
 * Exercises use this to determine what controls to show.
 * 
 * R13.5: When no voice exists, disable audio controls but keep exercise completable
 * R13.7: Make no pronunciation-assessment claim
 * 
 * @param capabilities - Capability detection layer
 * @param lang - Target language for the exercise
 * @param exerciseSupportsAudio - Whether the exercise type supports audio
 * @returns Audio state for the exercise
 */
export function getExerciseAudioState(
  capabilities: CapabilityDetectionLayer,
  lang: string,
  exerciseSupportsAudio: boolean
): ExerciseAudioState {
  if (!exerciseSupportsAudio) {
    return {
      showAudioControls: false,
      showSlowDownButton: false,
    };
  }
  
  const audioCapability = capabilities.getAudioCapabilityFor(lang);
  
  if (!audioCapability.available) {
    return {
      showAudioControls: false,
      showSlowDownButton: false,
      unavailableMessage: audioCapability.unavailableReason,
    };
  }
  
  return {
    showAudioControls: true,
    showSlowDownButton: audioCapability.supportsRateAdjustment,
  };
}
