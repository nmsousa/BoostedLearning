/**
 * Export, Import, and Backup Functions
 * 
 * Implements R15.2 (export), R15.3 (deletion), R22.3 (backup), R22.4 (import/restore).
 * All operations work on the full repository set as JSON.
 * Learning history is never uploaded (R15.1).
 * 
 * @module persistence/export-import
 */

import { getDatabase } from './database';
import type {
  LanguageEntity,
  ModuleEntity,
  LessonEntity,
  LearningItemEntity,
  VocabularyEntity,
  GrammarInfoEntity,
  ExampleEntity,
  ExerciseEntity,
  ReviewStateEntity,
  AttemptEntity,
  SessionEntity,
  AchievementEntity,
  LearnerProfileEntity,
} from './entities';

// ============================================================================
// Export Data Structure
// ============================================================================

/**
 * Version information for the export format.
 */
export interface ExportMetadata {
  version: number;
  exportedAt: string;
  appVersion: string;
}

/**
 * Content data (can be shared, not personal).
 */
export interface ContentExport {
  languages: LanguageEntity[];
  modules: ModuleEntity[];
  lessons: LessonEntity[];
  learningItems: LearningItemEntity[];
  vocabulary: VocabularyEntity[];
  grammarInfo: GrammarInfoEntity[];
  examples: ExampleEntity[];
  exercises: ExerciseEntity[];
}

/**
 * Learner data (personal, privacy-sensitive).
 */
export interface LearnerDataExport {
  reviewStates: ReviewStateEntity[];
  attempts: AttemptEntity[];
  sessions: SessionEntity[];
  achievements: AchievementEntity[];
  learnerProfile: LearnerProfileEntity | null;
}

/**
 * Complete export of all data.
 */
export interface FullExport {
  metadata: ExportMetadata;
  content: ContentExport;
  learnerData: LearnerDataExport;
}

/**
 * Export of learner data only (for backup/restore).
 */
export interface LearnerBackup {
  metadata: ExportMetadata;
  learnerData: LearnerDataExport;
}

// ============================================================================
// Export Functions
// ============================================================================

const CURRENT_EXPORT_VERSION = 1;
const APP_VERSION = '1.0.0';

/**
 * Export all data from the database.
 * Returns a JSON-serializable object containing all content and learner data.
 */
export async function exportAll(): Promise<FullExport> {
  const db = getDatabase();

  const [
    languages,
    modules,
    lessons,
    learningItems,
    vocabulary,
    grammarInfo,
    examples,
    exercises,
    reviewStates,
    attempts,
    sessions,
    achievements,
    learnerProfiles,
  ] = await Promise.all([
    db.languages.toArray(),
    db.modules.toArray(),
    db.lessons.toArray(),
    db.learningItems.toArray(),
    db.vocabulary.toArray(),
    db.grammarInfo.toArray(),
    db.examples.toArray(),
    db.exercises.toArray(),
    db.reviewStates.toArray(),
    db.attempts.toArray(),
    db.sessions.toArray(),
    db.achievements.toArray(),
    db.learnerProfile.toArray(),
  ]);

  return {
    metadata: {
      version: CURRENT_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
    },
    content: {
      languages,
      modules,
      lessons,
      learningItems,
      vocabulary,
      grammarInfo,
      examples,
      exercises,
    },
    learnerData: {
      reviewStates,
      attempts,
      sessions,
      achievements,
      learnerProfile: learnerProfiles[0] ?? null,
    },
  };
}

/**
 * Export learner data only (for backup purposes).
 * Does not include content data.
 */
export async function exportLearnerData(): Promise<LearnerBackup> {
  const db = getDatabase();

  const [reviewStates, attempts, sessions, achievements, learnerProfiles] = await Promise.all([
    db.reviewStates.toArray(),
    db.attempts.toArray(),
    db.sessions.toArray(),
    db.achievements.toArray(),
    db.learnerProfile.toArray(),
  ]);

  return {
    metadata: {
      version: CURRENT_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
    },
    learnerData: {
      reviewStates,
      attempts,
      sessions,
      achievements,
      learnerProfile: learnerProfiles[0] ?? null,
    },
  };
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Validation result for import data.
 */
export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a full export before importing.
 * Checks structure and version compatibility.
 */
export function validateFullExport(data: unknown): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data: expected an object'], warnings: [] };
  }

  const obj = data as Record<string, unknown>;

  // Check metadata
  if (!obj['metadata'] || typeof obj['metadata'] !== 'object') {
    errors.push('Missing or invalid metadata');
  } else {
    const metadata = obj['metadata'] as Record<string, unknown>;
    if (typeof metadata['version'] !== 'number') {
      errors.push('Missing or invalid version in metadata');
    } else if ((metadata['version'] as number) > CURRENT_EXPORT_VERSION) {
      errors.push(`Unsupported export version: ${metadata['version']} (max supported: ${CURRENT_EXPORT_VERSION})`);
    }
  }

  // Check content
  if (!obj['content'] || typeof obj['content'] !== 'object') {
    errors.push('Missing or invalid content section');
  } else {
    const content = obj['content'] as Record<string, unknown>;
    const requiredArrays = [
      'languages', 'modules', 'lessons', 'learningItems',
      'vocabulary', 'grammarInfo', 'examples', 'exercises',
    ];
    for (const field of requiredArrays) {
      if (!Array.isArray(content[field])) {
        errors.push(`Missing or invalid content.${field}: expected an array`);
      }
    }
  }

  // Check learner data
  if (!obj['learnerData'] || typeof obj['learnerData'] !== 'object') {
    errors.push('Missing or invalid learnerData section');
  } else {
    const learnerData = obj['learnerData'] as Record<string, unknown>;
    const requiredArrays = ['reviewStates', 'attempts', 'sessions', 'achievements'];
    for (const field of requiredArrays) {
      if (!Array.isArray(learnerData[field])) {
        errors.push(`Missing or invalid learnerData.${field}: expected an array`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a learner backup before importing.
 */
export function validateLearnerBackup(data: unknown): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data: expected an object'], warnings: [] };
  }

  const obj = data as Record<string, unknown>;

  // Check metadata
  if (!obj['metadata'] || typeof obj['metadata'] !== 'object') {
    errors.push('Missing or invalid metadata');
  } else {
    const metadata = obj['metadata'] as Record<string, unknown>;
    if (typeof metadata['version'] !== 'number') {
      errors.push('Missing or invalid version in metadata');
    } else if ((metadata['version'] as number) > CURRENT_EXPORT_VERSION) {
      errors.push(`Unsupported export version: ${metadata['version']} (max supported: ${CURRENT_EXPORT_VERSION})`);
    }
  }

  // Check learner data
  if (!obj['learnerData'] || typeof obj['learnerData'] !== 'object') {
    errors.push('Missing or invalid learnerData section');
  } else {
    const learnerData = obj['learnerData'] as Record<string, unknown>;
    const requiredArrays = ['reviewStates', 'attempts', 'sessions', 'achievements'];
    for (const field of requiredArrays) {
      if (!Array.isArray(learnerData[field])) {
        errors.push(`Missing or invalid learnerData.${field}: expected an array`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Import a full export, replacing all existing data.
 * All-or-nothing: validates before mutating.
 * 
 * @throws Error if validation fails
 */
export async function importAll(data: FullExport): Promise<void> {
  const validation = validateFullExport(data);
  if (!validation.valid) {
    throw new Error(`Import validation failed: ${validation.errors.join(', ')}`);
  }

  const db = getDatabase();

  await db.transaction(
    'rw',
    [
      db.languages,
      db.modules,
      db.lessons,
      db.learningItems,
      db.vocabulary,
      db.grammarInfo,
      db.examples,
      db.exercises,
      db.reviewStates,
      db.attempts,
      db.sessions,
      db.achievements,
      db.learnerProfile,
    ],
    async () => {
      // Clear existing data
      await Promise.all([
        db.languages.clear(),
        db.modules.clear(),
        db.lessons.clear(),
        db.learningItems.clear(),
        db.vocabulary.clear(),
        db.grammarInfo.clear(),
        db.examples.clear(),
        db.exercises.clear(),
        db.reviewStates.clear(),
        db.attempts.clear(),
        db.sessions.clear(),
        db.achievements.clear(),
        db.learnerProfile.clear(),
      ]);

      // Import content
      await Promise.all([
        db.languages.bulkPut(data.content.languages),
        db.modules.bulkPut(data.content.modules),
        db.lessons.bulkPut(data.content.lessons),
        db.learningItems.bulkPut(data.content.learningItems),
        db.vocabulary.bulkPut(data.content.vocabulary),
        db.grammarInfo.bulkPut(data.content.grammarInfo),
        db.examples.bulkPut(data.content.examples),
        db.exercises.bulkPut(data.content.exercises),
      ]);

      // Import learner data
      await Promise.all([
        db.reviewStates.bulkPut(data.learnerData.reviewStates),
        db.attempts.bulkPut(data.learnerData.attempts),
        db.sessions.bulkPut(data.learnerData.sessions),
        db.achievements.bulkPut(data.learnerData.achievements),
        data.learnerData.learnerProfile
          ? db.learnerProfile.put(data.learnerData.learnerProfile)
          : Promise.resolve(),
      ]);
    }
  );
}

/**
 * Import/restore learner data only, keeping existing content.
 * 
 * @throws Error if validation fails
 */
export async function importLearnerData(data: LearnerBackup): Promise<void> {
  const validation = validateLearnerBackup(data);
  if (!validation.valid) {
    throw new Error(`Import validation failed: ${validation.errors.join(', ')}`);
  }

  const db = getDatabase();

  await db.transaction(
    'rw',
    [db.reviewStates, db.attempts, db.sessions, db.achievements, db.learnerProfile],
    async () => {
      // Clear existing learner data
      await Promise.all([
        db.reviewStates.clear(),
        db.attempts.clear(),
        db.sessions.clear(),
        db.achievements.clear(),
        db.learnerProfile.clear(),
      ]);

      // Import learner data
      await Promise.all([
        db.reviewStates.bulkPut(data.learnerData.reviewStates),
        db.attempts.bulkPut(data.learnerData.attempts),
        db.sessions.bulkPut(data.learnerData.sessions),
        db.achievements.bulkPut(data.learnerData.achievements),
        data.learnerData.learnerProfile
          ? db.learnerProfile.put(data.learnerData.learnerProfile)
          : Promise.resolve(),
      ]);
    }
  );
}

// ============================================================================
// Deletion Functions
// ============================================================================

/**
 * Delete all learner data (R15.3).
 * Preserves content data.
 */
export async function deleteLearnerData(): Promise<void> {
  const db = getDatabase();

  await db.transaction(
    'rw',
    [db.reviewStates, db.attempts, db.sessions, db.achievements, db.learnerProfile],
    async () => {
      await Promise.all([
        db.reviewStates.clear(),
        db.attempts.clear(),
        db.sessions.clear(),
        db.achievements.clear(),
        db.learnerProfile.clear(),
      ]);
    }
  );
}

/**
 * Delete all data (learner + content).
 * Use with caution!
 */
export async function deleteAllData(): Promise<void> {
  const db = getDatabase();

  await db.transaction(
    'rw',
    [
      db.languages,
      db.modules,
      db.lessons,
      db.learningItems,
      db.vocabulary,
      db.grammarInfo,
      db.examples,
      db.exercises,
      db.reviewStates,
      db.attempts,
      db.sessions,
      db.achievements,
      db.learnerProfile,
    ],
    async () => {
      await Promise.all([
        db.languages.clear(),
        db.modules.clear(),
        db.lessons.clear(),
        db.learningItems.clear(),
        db.vocabulary.clear(),
        db.grammarInfo.clear(),
        db.examples.clear(),
        db.exercises.clear(),
        db.reviewStates.clear(),
        db.attempts.clear(),
        db.sessions.clear(),
        db.achievements.clear(),
        db.learnerProfile.clear(),
      ]);
    }
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert export data to a JSON string suitable for file download.
 */
export function exportToJson(data: FullExport | LearnerBackup): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Parse JSON string to export data.
 * @throws Error if JSON is invalid
 */
export function parseExportJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
}
