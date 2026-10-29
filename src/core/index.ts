/**
 * Core Domain Layer
 * 
 * This is the pure, language-agnostic domain layer.
 * It MUST NOT import Angular, Ionic, the DOM, Dexie, or any Target_Language-specific code.
 * 
 * The core contains:
 * - Types and interfaces for the domain model
 * - Recall-Quality Classifier
 * - Scheduler Interface and FSRS Adapter
 * - Memory Engine
 * - Recovery Workflow (integrated into Memory Engine)
 * - Answer Validator (to be implemented)
 * 
 * @module core
 */

// Types
export * from './types';

// Knowledge Level Classifier
export * from './knowledge-level';

// Recall-Quality Classifier
export {
  classifyRecallQuality,
  isFailureForRecovery,
  isCorrectUnaided,
  validateEvidenceWeightInvariants,
  getEvidenceWeights,
} from './recall-quality-classifier';

// Scheduler
export * from './scheduler';

// Memory Engine
export * from './memory-engine';

// Answer Validator
export * from './answer-validator';
