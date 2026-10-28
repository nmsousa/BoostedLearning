/**
 * TTS (Text-to-Speech) Module
 * 
 * Provides text-to-speech services using the Web Speech API with
 * capability detection for graceful degradation.
 * 
 * @module services/tts
 */

export {
  createTTSService,
  type TTSService,
  type TTSOptions,
  type TTSResult,
  type VoiceInfo,
  type SpeechSynthesisProvider,
} from './tts-service';

export {
  createCapabilityDetectionLayer,
  getExerciseAudioState,
  type CapabilityDetectionLayer,
  type AudioCapability,
  type DeviceCapabilities,
  type ExerciseAudioState,
} from './capability-detection';
