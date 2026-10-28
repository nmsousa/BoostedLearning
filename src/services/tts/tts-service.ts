/**
 * TTS (Text-to-Speech) Service
 * 
 * Provides text-to-speech functionality using the Web Speech API.
 * This adapter wraps SpeechSynthesis so it can be injectable/mockable.
 * No network required - uses local voices only.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 23.2
 * Design: TTS Adapter + Capability_Detection_Layer
 * 
 * @module services/tts
 */

/**
 * Options for text-to-speech playback
 */
export interface TTSOptions {
  /** BCP 47 language tag (e.g., 'nl-NL', 'fr-FR') */
  lang: string;
  /** Speech rate (0.1 to 10, default 1.0) */
  rate?: number;
  /** Pitch (0 to 2, default 1.0) */
  pitch?: number;
  /** Volume (0 to 1, default 1.0) */
  volume?: number;
}

/**
 * Result of a TTS operation
 */
export interface TTSResult {
  success: boolean;
  error?: string;
}

/**
 * Voice information for a language
 */
export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

/**
 * TTS Service interface for text-to-speech operations
 */
export interface TTSService {
  /**
   * Speak the given text using the specified options.
   * Returns a promise that resolves when speech completes.
   */
  speak(text: string, options: TTSOptions): Promise<TTSResult>;
  
  /**
   * Stop any currently playing speech
   */
  stop(): void;
  
  /**
   * Check if there's a voice available for the given language
   */
  hasVoiceFor(lang: string): boolean;
  
  /**
   * Get available voices for a language
   */
  getVoicesFor(lang: string): VoiceInfo[];
  
  /**
   * Get all available voices
   */
  getAllVoices(): VoiceInfo[];
  
  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean;
  
  /**
   * Check if speech synthesis is supported at all
   */
  isSupported(): boolean;
}

/**
 * SpeechSynthesis abstraction for testing
 * This allows us to inject a mock in tests
 */
export interface SpeechSynthesisProvider {
  getVoices(): SpeechSynthesisVoice[];
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  readonly speaking: boolean;
  readonly pending: boolean;
  readonly paused: boolean;
}

/**
 * Create a TTS service with the given speech synthesis provider.
 * 
 * @param provider - SpeechSynthesis instance or mock for testing
 * @returns TTSService implementation
 */
export function createTTSService(provider?: SpeechSynthesisProvider): TTSService {
  // Use provided provider or fall back to window.speechSynthesis
  const synthesis = provider ?? (typeof window !== 'undefined' ? window.speechSynthesis : undefined);
  
  // Cache for voices (refreshed on voiceschanged event)
  let cachedVoices: SpeechSynthesisVoice[] = [];
  let voicesLoaded = false;
  
  // Load voices - they may load asynchronously
  const loadVoices = (): SpeechSynthesisVoice[] => {
    if (!synthesis) return [];
    cachedVoices = synthesis.getVoices();
    voicesLoaded = cachedVoices.length > 0;
    return cachedVoices;
  };
  
  // Initial voice load
  loadVoices();
  
  // Listen for voiceschanged event (voices may load async in some browsers)
  if (typeof window !== 'undefined' && synthesis) {
    // Check if addEventListener exists (not in our mock interface)
    const synth = synthesis as unknown as EventTarget;
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', () => {
        loadVoices();
      });
    }
  }
  
  /**
   * Find the best matching voice for a language.
   * Prefers local voices and exact matches.
   */
  const findVoiceFor = (lang: string): SpeechSynthesisVoice | undefined => {
    const voices = loadVoices();
    const langLower = lang.toLowerCase();
    const langBase = langLower.split('-')[0];
    
    // First try exact match with local voice
    let voice = voices.find(v => 
      v.lang.toLowerCase() === langLower && v.localService
    );
    if (voice) return voice;
    
    // Try exact match (any service)
    voice = voices.find(v => v.lang.toLowerCase() === langLower);
    if (voice) return voice;
    
    // Try base language with local voice
    voice = voices.find(v => 
      v.lang.toLowerCase().startsWith(langBase) && v.localService
    );
    if (voice) return voice;
    
    // Try base language (any service)
    voice = voices.find(v => v.lang.toLowerCase().startsWith(langBase));
    return voice;
  };
  
  return {
    async speak(text: string, options: TTSOptions): Promise<TTSResult> {
      if (!synthesis) {
        return { success: false, error: 'Speech synthesis not supported' };
      }
      
      if (!text || text.trim().length === 0) {
        return { success: false, error: 'Empty text provided' };
      }
      
      const voice = findVoiceFor(options.lang);
      if (!voice) {
        return { success: false, error: `No voice available for language: ${options.lang}` };
      }
      
      return new Promise((resolve) => {
        try {
          // Cancel any ongoing speech
          synthesis.cancel();
          
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.voice = voice;
          utterance.lang = options.lang;
          utterance.rate = Math.max(0.1, Math.min(10, options.rate ?? 1.0));
          utterance.pitch = Math.max(0, Math.min(2, options.pitch ?? 1.0));
          utterance.volume = Math.max(0, Math.min(1, options.volume ?? 1.0));
          
          utterance.onend = () => {
            resolve({ success: true });
          };
          
          utterance.onerror = (event) => {
            // Graceful degradation for mid-utterance errors (R13.6)
            const errorMessage = event.error || 'Unknown speech synthesis error';
            resolve({ success: false, error: `Speech error: ${errorMessage}` });
          };
          
          synthesis.speak(utterance);
        } catch (error) {
          resolve({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error during speech' 
          });
        }
      });
    },
    
    stop(): void {
      synthesis?.cancel();
    },
    
    hasVoiceFor(lang: string): boolean {
      return findVoiceFor(lang) !== undefined;
    },
    
    getVoicesFor(lang: string): VoiceInfo[] {
      const voices = loadVoices();
      const langLower = lang.toLowerCase();
      const langBase = langLower.split('-')[0];
      
      return voices
        .filter(v => {
          const vLang = v.lang.toLowerCase();
          return vLang === langLower || vLang.startsWith(langBase);
        })
        .map(v => ({
          name: v.name,
          lang: v.lang,
          localService: v.localService,
          default: v.default,
        }));
    },
    
    getAllVoices(): VoiceInfo[] {
      return loadVoices().map(v => ({
        name: v.name,
        lang: v.lang,
        localService: v.localService,
        default: v.default,
      }));
    },
    
    isSpeaking(): boolean {
      return synthesis?.speaking ?? false;
    },
    
    isSupported(): boolean {
      return synthesis !== undefined;
    },
  };
}
