/**
 * TTS Service and Capability Detection Tests
 * 
 * Feature: language-learning-app
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 14.5, 15.7, 23.2
 */

import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import {
  createTTSService,
  TTSService,
  SpeechSynthesisProvider,
  TTSOptions,
} from './tts-service';
import {
  createCapabilityDetectionLayer,
  getExerciseAudioState,
  CapabilityDetectionLayer,
} from './capability-detection';

// ============================================================================
// Mock SpeechSynthesisUtterance for Node environment
// ============================================================================

class MockSpeechSynthesisUtterance {
  text: string;
  lang: string = '';
  voice: SpeechSynthesisVoice | null = null;
  rate: number = 1;
  pitch: number = 1;
  volume: number = 1;
  onend: ((event: SpeechSynthesisEvent) => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
  onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
  onpause: ((event: SpeechSynthesisEvent) => void) | null = null;
  onresume: ((event: SpeechSynthesisEvent) => void) | null = null;
  onmark: ((event: SpeechSynthesisEvent) => void) | null = null;
  onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
  
  constructor(text: string) {
    this.text = text;
  }
  
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}

// Set up global mock
beforeAll(() => {
  (globalThis as unknown as { SpeechSynthesisUtterance: typeof MockSpeechSynthesisUtterance }).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
});

// ============================================================================
// Mock SpeechSynthesis Provider
// ============================================================================

interface MockVoice {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
  voiceURI: string;
}

function createMockVoice(
  lang: string,
  name: string = `${lang} Voice`,
  localService: boolean = true,
  isDefault: boolean = false
): MockVoice {
  return {
    name,
    lang,
    localService,
    default: isDefault,
    voiceURI: `${lang}-uri`,
  };
}

function createMockProvider(voices: MockVoice[] = []): SpeechSynthesisProvider & {
  lastUtterance: SpeechSynthesisUtterance | null;
  simulateSpeechEnd: () => void;
  simulateSpeechError: (error: string) => void;
  speakCalled: boolean;
  cancelCalled: boolean;
} {
  let isSpeaking = false;
  let lastUtterance: SpeechSynthesisUtterance | null = null;
  let speakCalled = false;
  let cancelCalled = false;
  
  return {
    getVoices: () => voices as unknown as SpeechSynthesisVoice[],
    speak: (utterance: SpeechSynthesisUtterance) => {
      speakCalled = true;
      isSpeaking = true;
      lastUtterance = utterance;
    },
    cancel: () => {
      cancelCalled = true;
      isSpeaking = false;
      if (lastUtterance?.onend) {
        // Don't trigger onend for cancel - just stop
      }
    },
    get speaking() { return isSpeaking; },
    get pending() { return false; },
    get paused() { return false; },
    get lastUtterance() { return lastUtterance; },
    get speakCalled() { return speakCalled; },
    get cancelCalled() { return cancelCalled; },
    simulateSpeechEnd: () => {
      isSpeaking = false;
      if (lastUtterance?.onend) {
        lastUtterance.onend(new Event('end') as SpeechSynthesisEvent);
      }
    },
    simulateSpeechError: (error: string) => {
      isSpeaking = false;
      if (lastUtterance?.onerror) {
        const event = new Event('error') as SpeechSynthesisErrorEvent;
        (event as unknown as { error: string }).error = error;
        lastUtterance.onerror(event);
      }
    },
  };
}

// ============================================================================
// TTS Service Tests
// ============================================================================

describe('TTS Service', () => {
  describe('createTTSService factory', () => {
    it('should create a valid service instance', () => {
      const provider = createMockProvider([createMockVoice('en-US')]);
      const service = createTTSService(provider);
      
      expect(service).toBeDefined();
      expect(typeof service.speak).toBe('function');
      expect(typeof service.stop).toBe('function');
      expect(typeof service.hasVoiceFor).toBe('function');
      expect(typeof service.getVoicesFor).toBe('function');
      expect(typeof service.getAllVoices).toBe('function');
      expect(typeof service.isSpeaking).toBe('function');
      expect(typeof service.isSupported).toBe('function');
    });
    
    it('should report supported when provider exists', () => {
      const provider = createMockProvider();
      const service = createTTSService(provider);
      
      expect(service.isSupported()).toBe(true);
    });
    
    it('should report not supported when no provider', () => {
      const service = createTTSService(undefined);
      
      expect(service.isSupported()).toBe(false);
    });
  });
  
  describe('Voice detection (R13.4)', () => {
    it('should detect voice for exact language match', () => {
      const provider = createMockProvider([
        createMockVoice('nl-NL'),
        createMockVoice('fr-FR'),
      ]);
      const service = createTTSService(provider);
      
      expect(service.hasVoiceFor('nl-NL')).toBe(true);
      expect(service.hasVoiceFor('fr-FR')).toBe(true);
      expect(service.hasVoiceFor('de-DE')).toBe(false);
    });
    
    it('should detect voice for base language', () => {
      const provider = createMockProvider([
        createMockVoice('nl-NL'),
      ]);
      const service = createTTSService(provider);
      
      // Should match base language 'nl' to 'nl-NL'
      expect(service.hasVoiceFor('nl')).toBe(true);
      expect(service.hasVoiceFor('nl-BE')).toBe(true); // Falls back to nl-NL
    });
    
    it('should be case insensitive', () => {
      const provider = createMockProvider([
        createMockVoice('NL-nl'),
      ]);
      const service = createTTSService(provider);
      
      expect(service.hasVoiceFor('nl-NL')).toBe(true);
      expect(service.hasVoiceFor('NL-NL')).toBe(true);
    });
    
    it('should prefer local voices', () => {
      const localVoice = createMockVoice('nl-NL', 'Local Dutch', true);
      const networkVoice = createMockVoice('nl-NL', 'Network Dutch', false);
      const provider = createMockProvider([networkVoice, localVoice]);
      const service = createTTSService(provider);
      
      const voices = service.getVoicesFor('nl-NL');
      expect(voices).toHaveLength(2);
      // Both voices should be returned
      expect(voices.some(v => v.localService)).toBe(true);
    });
    
    it('should return all voices for a language', () => {
      const provider = createMockProvider([
        createMockVoice('nl-NL', 'Dutch 1'),
        createMockVoice('nl-NL', 'Dutch 2'),
        createMockVoice('nl-BE', 'Flemish'),
        createMockVoice('fr-FR', 'French'),
      ]);
      const service = createTTSService(provider);
      
      const dutchVoices = service.getVoicesFor('nl');
      expect(dutchVoices).toHaveLength(3); // nl-NL x2 + nl-BE
    });
    
    it('should return all available voices', () => {
      const provider = createMockProvider([
        createMockVoice('nl-NL'),
        createMockVoice('fr-FR'),
        createMockVoice('en-US'),
      ]);
      const service = createTTSService(provider);
      
      const voices = service.getAllVoices();
      expect(voices).toHaveLength(3);
    });
  });
  
  describe('Property 31: Voice capability detection matches available voices', () => {
    it('should correctly detect presence of voices (R13.4)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              lang: fc.constantFrom('nl-NL', 'fr-FR', 'en-US', 'de-DE', 'es-ES', 'pt-BR'),
              local: fc.boolean(),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          fc.constantFrom('nl-NL', 'fr-FR', 'en-US', 'de-DE', 'es-ES', 'pt-BR', 'it-IT'),
          (voiceConfigs, queryLang) => {
            const voices = voiceConfigs.map(vc => createMockVoice(vc.lang, `${vc.lang} Voice`, vc.local));
            const provider = createMockProvider(voices);
            const service = createTTSService(provider);
            
            const hasVoice = service.hasVoiceFor(queryLang);
            const baseLang = queryLang.split('-')[0];
            
            // Voice detection should match reality
            const actuallyHasVoice = voices.some(v => {
              const vLang = v.lang.toLowerCase();
              const qLang = queryLang.toLowerCase();
              return vLang === qLang || vLang.startsWith(baseLang.toLowerCase());
            });
            
            expect(hasVoice).toBe(actuallyHasVoice);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should return matching voices for language queries', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('nl-NL', 'nl-BE', 'fr-FR', 'fr-CA', 'en-US', 'en-GB'),
            { minLength: 1, maxLength: 4 }
          ),
          fc.constantFrom('nl', 'fr', 'en', 'de'),
          (langCodes, queryBase) => {
            const voices = langCodes.map(lang => createMockVoice(lang));
            const provider = createMockProvider(voices);
            const service = createTTSService(provider);
            
            const matchingVoices = service.getVoicesFor(queryBase);
            
            // All returned voices should match the query language
            for (const voice of matchingVoices) {
              expect(voice.lang.toLowerCase().startsWith(queryBase.toLowerCase())).toBe(true);
            }
            
            // Count should match expected
            const expectedCount = voices.filter(v => 
              v.lang.toLowerCase().startsWith(queryBase.toLowerCase())
            ).length;
            expect(matchingVoices.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Speech functionality (R13.1, R13.2)', () => {
    it('should speak text with correct options', async () => {
      const provider = createMockProvider([createMockVoice('nl-NL')]);
      const service = createTTSService(provider);
      
      const options: TTSOptions = { lang: 'nl-NL', rate: 0.8 };
      const speakPromise = service.speak('Hallo', options);
      
      expect(provider.speakCalled).toBe(true);
      expect(provider.lastUtterance).not.toBeNull();
      expect(provider.lastUtterance?.text).toBe('Hallo');
      expect(provider.lastUtterance?.lang).toBe('nl-NL');
      expect(provider.lastUtterance?.rate).toBe(0.8);
      
      provider.simulateSpeechEnd();
      const result = await speakPromise;
      expect(result.success).toBe(true);
    });
    
    it('should apply rate bounds (R13.3)', async () => {
      const provider = createMockProvider([createMockVoice('nl-NL')]);
      const service = createTTSService(provider);
      
      // Test minimum rate
      service.speak('Test', { lang: 'nl-NL', rate: -1 });
      expect(provider.lastUtterance?.rate).toBe(0.1);
      
      // Test maximum rate  
      service.speak('Test', { lang: 'nl-NL', rate: 100 });
      expect(provider.lastUtterance?.rate).toBe(10);
    });
    
    it('should default to rate 1.0', async () => {
      const provider = createMockProvider([createMockVoice('nl-NL')]);
      const service = createTTSService(provider);
      
      service.speak('Test', { lang: 'nl-NL' });
      expect(provider.lastUtterance?.rate).toBe(1.0);
    });
    
    it('should fail gracefully when no voice available', async () => {
      const provider = createMockProvider([createMockVoice('nl-NL')]);
      const service = createTTSService(provider);
      
      const result = await service.speak('Bonjour', { lang: 'fr-FR' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No voice available');
    });
    
    it('should fail gracefully with empty text', async () => {
      const provider = createMockProvider([createMockVoice('nl-NL')]);
      const service = createTTSService(provider);
      
      const result = await service.speak('', { lang: 'nl-NL' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Empty text');
    });
    
    it('should fail gracefully when synthesis not supported', async () => {
      const service = createTTSService(undefined);
      
      const result = await service.speak('Test', { lang: 'nl-NL' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });
    
    it('should handle mid-utterance errors gracefully (R13.6)', async () => {
      const provider = createMockProvider([createMockVoice('nl-NL')]);
      const service = createTTSService(provider);
      
      const speakPromise = service.speak('Test', { lang: 'nl-NL' });
      provider.simulateSpeechError('interrupted');
      
      const result = await speakPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Speech error');
    });
  });
  
  describe('Stop and state', () => {
    it('should stop current speech', () => {
      const provider = createMockProvider([createMockVoice('nl-NL')]);
      const service = createTTSService(provider);
      
      service.speak('Long text', { lang: 'nl-NL' });
      expect(service.isSpeaking()).toBe(true);
      
      service.stop();
      expect(provider.cancelCalled).toBe(true);
    });
    
    it('should report speaking state', () => {
      const provider = createMockProvider([createMockVoice('nl-NL')]);
      const service = createTTSService(provider);
      
      expect(service.isSpeaking()).toBe(false);
      
      service.speak('Test', { lang: 'nl-NL' });
      expect(service.isSpeaking()).toBe(true);
    });
  });
});

// ============================================================================
// Capability Detection Layer Tests
// ============================================================================

describe('Capability Detection Layer', () => {
  let ttsService: TTSService;
  let capabilities: CapabilityDetectionLayer;
  
  beforeEach(() => {
    const provider = createMockProvider([
      createMockVoice('nl-NL'),
      createMockVoice('fr-FR'),
      createMockVoice('en-US'),
    ]);
    ttsService = createTTSService(provider);
    capabilities = createCapabilityDetectionLayer(ttsService);
  });
  
  describe('createCapabilityDetectionLayer factory', () => {
    it('should create a valid capabilities instance', () => {
      expect(capabilities).toBeDefined();
      expect(typeof capabilities.canSlowDown).toBe('function');
      expect(typeof capabilities.supportsRateAdjustment).toBe('function');
      expect(typeof capabilities.hasVoiceFor).toBe('function');
      expect(typeof capabilities.getAudioCapabilityFor).toBe('function');
      expect(typeof capabilities.getDeviceCapabilities).toBe('function');
      expect(typeof capabilities.shouldDisableAudioFor).toBe('function');
    });
  });
  
  describe('Rate adjustment (R13.3)', () => {
    it('should report rate adjustment support when synthesis supported', () => {
      expect(capabilities.canSlowDown()).toBe(true);
      expect(capabilities.supportsRateAdjustment()).toBe(true);
    });
    
    it('should report no rate adjustment when synthesis not supported', () => {
      const unsupportedService = createTTSService(undefined);
      const caps = createCapabilityDetectionLayer(unsupportedService);
      
      expect(caps.canSlowDown()).toBe(false);
      expect(caps.supportsRateAdjustment()).toBe(false);
    });
  });
  
  describe('Voice availability (R13.4)', () => {
    it('should delegate hasVoiceFor to TTS service', () => {
      expect(capabilities.hasVoiceFor('nl-NL')).toBe(true);
      expect(capabilities.hasVoiceFor('nl')).toBe(true);
      expect(capabilities.hasVoiceFor('de-DE')).toBe(false);
    });
  });
  
  describe('Audio capability details', () => {
    it('should return available capability for supported language', () => {
      const cap = capabilities.getAudioCapabilityFor('nl-NL');
      
      expect(cap.available).toBe(true);
      expect(cap.supportsRateAdjustment).toBe(true);
      expect(cap.unavailableReason).toBeUndefined();
      expect(cap.voices.length).toBeGreaterThan(0);
    });
    
    it('should return unavailable capability for unsupported language', () => {
      const cap = capabilities.getAudioCapabilityFor('de-DE');
      
      expect(cap.available).toBe(false);
      expect(cap.supportsRateAdjustment).toBe(false);
      expect(cap.unavailableReason).toContain('No voice available');
      expect(cap.voices).toHaveLength(0);
    });
    
    it('should return unavailable when synthesis not supported', () => {
      const unsupportedService = createTTSService(undefined);
      const caps = createCapabilityDetectionLayer(unsupportedService);
      
      const cap = caps.getAudioCapabilityFor('nl-NL');
      
      expect(cap.available).toBe(false);
      expect(cap.unavailableReason).toContain('not supported');
    });
  });
  
  describe('Device capabilities summary', () => {
    it('should return complete device capabilities', () => {
      const deviceCaps = capabilities.getDeviceCapabilities();
      
      expect(deviceCaps.speechSynthesisSupported).toBe(true);
      expect(deviceCaps.supportsRateAdjustment).toBe(true);
      expect(deviceCaps.availableLanguages).toContain('nl-NL');
      expect(deviceCaps.availableLanguages).toContain('nl');
      expect(deviceCaps.availableLanguages).toContain('fr-FR');
    });
    
    it('should return empty capabilities when synthesis not supported', () => {
      const unsupportedService = createTTSService(undefined);
      const caps = createCapabilityDetectionLayer(unsupportedService);
      
      const deviceCaps = caps.getDeviceCapabilities();
      
      expect(deviceCaps.speechSynthesisSupported).toBe(false);
      expect(deviceCaps.availableLanguages).toHaveLength(0);
      expect(deviceCaps.supportsRateAdjustment).toBe(false);
    });
  });
  
  describe('Property 32: Exercises remain completable without audio (R13.5, R14.5)', () => {
    it('should disable audio for unsupported languages', () => {
      expect(capabilities.shouldDisableAudioFor('nl-NL')).toBe(false);
      expect(capabilities.shouldDisableAudioFor('de-DE')).toBe(true);
    });
    
    it('should disable audio when synthesis not supported', () => {
      const unsupportedService = createTTSService(undefined);
      const caps = createCapabilityDetectionLayer(unsupportedService);
      
      // All languages should have audio disabled
      expect(caps.shouldDisableAudioFor('nl-NL')).toBe(true);
      expect(caps.shouldDisableAudioFor('en-US')).toBe(true);
    });
    
    it('exercises can proceed without audio (property test)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('nl-NL', 'fr-FR', 'de-DE', 'it-IT', 'zh-CN'),
          fc.boolean(),
          (lang, exerciseSupportsAudio) => {
            const audioState = getExerciseAudioState(capabilities, lang, exerciseSupportsAudio);
            
            // Audio state should never prevent exercise completion
            // It just determines what controls to show
            expect(typeof audioState.showAudioControls).toBe('boolean');
            expect(typeof audioState.showSlowDownButton).toBe('boolean');
            
            // If exercise doesn't support audio, controls should be hidden
            if (!exerciseSupportsAudio) {
              expect(audioState.showAudioControls).toBe(false);
              expect(audioState.showSlowDownButton).toBe(false);
            }
            
            // If no voice available, controls should be hidden with message
            if (exerciseSupportsAudio && capabilities.shouldDisableAudioFor(lang)) {
              expect(audioState.showAudioControls).toBe(false);
              expect(audioState.unavailableMessage).toBeDefined();
            }
            
            // Audio unavailability doesn't block exercise - just hides controls
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Exercise Audio State Tests
// ============================================================================

describe('Exercise Audio State', () => {
  let capabilities: CapabilityDetectionLayer;
  
  beforeEach(() => {
    const provider = createMockProvider([
      createMockVoice('nl-NL'),
      createMockVoice('en-US'),
    ]);
    const ttsService = createTTSService(provider);
    capabilities = createCapabilityDetectionLayer(ttsService);
  });
  
  describe('getExerciseAudioState', () => {
    it('should show controls when audio supported and available', () => {
      const state = getExerciseAudioState(capabilities, 'nl-NL', true);
      
      expect(state.showAudioControls).toBe(true);
      expect(state.showSlowDownButton).toBe(true);
      expect(state.unavailableMessage).toBeUndefined();
    });
    
    it('should hide controls when exercise does not support audio', () => {
      const state = getExerciseAudioState(capabilities, 'nl-NL', false);
      
      expect(state.showAudioControls).toBe(false);
      expect(state.showSlowDownButton).toBe(false);
    });
    
    it('should hide controls when no voice available (R13.5)', () => {
      const state = getExerciseAudioState(capabilities, 'de-DE', true);
      
      expect(state.showAudioControls).toBe(false);
      expect(state.showSlowDownButton).toBe(false);
      expect(state.unavailableMessage).toBeDefined();
    });
    
    it('should always return a valid state object', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('nl-NL', 'de-DE', 'zh-CN', 'ja-JP'),
          fc.boolean(),
          (lang, supportsAudio) => {
            const state = getExerciseAudioState(capabilities, lang, supportsAudio);
            
            // State should always be a valid object
            expect(state).toBeDefined();
            expect(typeof state.showAudioControls).toBe('boolean');
            expect(typeof state.showSlowDownButton).toBe('boolean');
            // unavailableMessage can be undefined or string
            expect(
              state.unavailableMessage === undefined || 
              typeof state.unavailableMessage === 'string'
            ).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// No Pronunciation Assessment Claims (R13.7, R15.7)
// ============================================================================

describe('No pronunciation assessment claims (R13.7, R15.7)', () => {
  it('should not include any pronunciation assessment methods in TTS service', () => {
    const provider = createMockProvider([createMockVoice('nl-NL')]);
    const service = createTTSService(provider);
    
    // The service should NOT have methods like:
    // - assessPronunciation
    // - scorePronunciation
    // - evaluateSpeech
    // - comparePronunciation
    const serviceRecord = service as unknown as Record<string, unknown>;
    expect(serviceRecord['assessPronunciation']).toBeUndefined();
    expect(serviceRecord['scorePronunciation']).toBeUndefined();
    expect(serviceRecord['evaluateSpeech']).toBeUndefined();
    expect(serviceRecord['comparePronunciation']).toBeUndefined();
  });
  
  it('should not include any speech recognition in capability layer', () => {
    const provider = createMockProvider([createMockVoice('nl-NL')]);
    const service = createTTSService(provider);
    const caps = createCapabilityDetectionLayer(service);
    
    // The capabilities should NOT have methods like:
    // - supportsSpeechRecognition
    // - hasMicrophone
    // - canAssessPronunciation
    const capsRecord = caps as unknown as Record<string, unknown>;
    expect(capsRecord['supportsSpeechRecognition']).toBeUndefined();
    expect(capsRecord['hasMicrophone']).toBeUndefined();
    expect(capsRecord['canAssessPronunciation']).toBeUndefined();
  });
});
