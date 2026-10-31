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

  /**
   * Wait (briefly) for the voice list to populate. On Android WebView
   * `getVoices()` is often empty until the `voiceschanged` event fires (and
   * sometimes only after the first `speak()` call), so we give it a short
   * grace period before giving up. Resolves as soon as voices appear.
   */
  const ensureVoicesLoaded = (timeoutMs = 1000): Promise<SpeechSynthesisVoice[]> => {
    const current = loadVoices();
    if (current.length > 0 || !synthesis) return Promise.resolve(current);

    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve(loadVoices());
      };

      const synth = synthesis as unknown as EventTarget;
      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', done, { once: true } as AddEventListenerOptions);
      }
      // Poll as a backstop (some WebViews don't fire voiceschanged reliably).
      const start = Date.now();
      const poll = setInterval(() => {
        if (loadVoices().length > 0 || Date.now() - start >= timeoutMs) {
          clearInterval(poll);
          done();
        }
      }, 100);
    });
  };
  
  return {
    async speak(text: string, options: TTSOptions): Promise<TTSResult> {
      if (!synthesis) {
        return { success: false, error: 'Speech synthesis not supported' };
      }
      
      if (!text || text.trim().length === 0) {
        return { success: false, error: 'Empty text provided' };
      }

      // Give voices a chance to load ONLY when they're not ready yet (Android
      // loads them lazily). When voices are already present we avoid any async
      // gap so `synthesis.speak()` runs synchronously within this call.
      if (loadVoices().length === 0) {
        await ensureVoicesLoaded();
      }
      const voice = findVoiceFor(options.lang);

      // NOTE: we do NOT bail out when no voice is found. On Android the voice
      // list can stay empty even though the engine CAN speak — it picks a voice
      // from `utterance.lang`. So we attempt to speak regardless and only
      // report failure if the engine actually errors.
      
      return new Promise((resolve) => {
        try {
          // Cancel any ongoing speech
          synthesis.cancel();
          
          const utterance = new SpeechSynthesisUtterance(text);
          if (voice) utterance.voice = voice;   // else let the engine choose by lang
          utterance.lang = options.lang;
          utterance.rate = Math.max(0.1, Math.min(10, options.rate ?? 1.0));
          utterance.pitch = Math.max(0, Math.min(2, options.pitch ?? 1.0));
          utterance.volume = Math.max(0, Math.min(1, options.volume ?? 1.0));
          
          utterance.onend = () => {
            resolve({ success: true });
          };
          
          utterance.onerror = (event) => {
            const errorMessage = event.error || 'Unknown speech synthesis error';
            // 'interrupted'/'canceled' happen when a new utterance cancels this
            // one (e.g. the user taps play again). That's expected, not a real
            // failure — report success so callers don't surface an error.
            if (errorMessage === 'interrupted' || errorMessage === 'canceled') {
              resolve({ success: true });
              return;
            }
            // Graceful degradation for genuine mid-utterance errors (R13.6)
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
      // No engine at all → definitively no voice.
      if (!synthesis) return false;
      // Engine present but the voice list hasn't populated yet (common on
      // Android, where it loads lazily or only after the first speak): be
      // optimistic so the UI doesn't block playback. We only return false when
      // voices ARE loaded and none match the language.
      if (loadVoices().length === 0) return true;
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
