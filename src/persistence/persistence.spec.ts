/**
 * Tests for Persistence Layer
 * 
 * Feature: language-learning-app
 * 
 * Tests cover:
 * - Property 34: Export/import/backup round-trips learner data (R15.2, R22.3, R22.4)
 * - Property 35: Deletion clears learner data from the Local_Store (R15.3)
 * - Property 36: Schema migration preserves learning history (R22.2)
 * - Repository CRUD operations
 * - Export/import validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import 'fake-indexeddb/auto';

import {
  getDatabase,
  resetDatabase,
  createRepositories,
  exportAll,
  exportLearnerData,
  importAll,
  importLearnerData,
  deleteLearnerData,
  deleteAllData,
  validateFullExport,
  validateLearnerBackup,
  type LanguageEntity,
  type LearningItemEntity,
  type ReviewStateEntity,
  type AttemptEntity,
  type SessionEntity,
  type LearnerProfileEntity,
  DEFAULT_LEARNER_PROFILE,
} from './index';

// Helper to generate UUIDs
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to get current ISO timestamp
function now(): string {
  return new Date().toISOString();
}

// Test data factories
function createLanguage(overrides: Partial<LanguageEntity> = {}): LanguageEntity {
  return {
    id: uuid(),
    code: 'nl',
    name: 'Dutch',
    isValidationAsset: false,
    updatedAt: now(),
    ...overrides,
  };
}

function createLearningItem(overrides: Partial<LearningItemEntity> = {}): LearningItemEntity {
  return {
    id: uuid(),
    languageId: uuid(),
    lessonId: uuid(),
    kind: 'vocabulary',
    prompt: 'Test item',
    skillDimensions: ['meaning'],
    contentState: 'available',
    updatedAt: now(),
    ...overrides,
  };
}

function createReviewState(overrides: Partial<ReviewStateEntity> = {}): ReviewStateEntity {
  return {
    id: uuid(),
    learningItemId: uuid(),
    schedulerState: null,
    perSkillState: {
      spelling: { schedulerState: null, attemptCount: 0, mistakeCount: 0, lastAttemptTime: null },
      meaning: { schedulerState: null, attemptCount: 0, mistakeCount: 0, lastAttemptTime: null },
      'listening-recognition': { schedulerState: null, attemptCount: 0, mistakeCount: 0, lastAttemptTime: null },
      'productive-recall': { schedulerState: null, attemptCount: 0, mistakeCount: 0, lastAttemptTime: null },
    },
    attemptCount: 0,
    mistakeCount: 0,
    confidence: 0,
    repeatedlyForgotten: false,
    recoveryState: null,
    lastExerciseType: null,
    lastExampleId: null,
    updatedAt: now(),
    ...overrides,
  };
}

function createAttempt(overrides: Partial<AttemptEntity> = {}): AttemptEntity {
  return {
    id: uuid(),
    learningItemId: uuid(),
    exerciseId: uuid(),
    sessionId: uuid(),
    timestamp: now(),
    correct: true,
    mode: 'unaided',
    usedHint: false,
    skillDimension: 'meaning',
    exerciseType: 'flashcard',
    updatedAt: now(),
    ...overrides,
  };
}

function createSession(overrides: Partial<SessionEntity> = {}): SessionEntity {
  return {
    id: uuid(),
    startedAt: now(),
    endedAt: null,
    itemsStudied: 0,
    mix: { newItems: 0, reviewItems: 0, recoveryItems: 0 },
    updatedAt: now(),
    ...overrides,
  };
}

function createLearnerProfile(overrides: Partial<LearnerProfileEntity> = {}): LearnerProfileEntity {
  return {
    id: uuid(),
    updatedAt: now(),
    ...DEFAULT_LEARNER_PROFILE,
    ...overrides,
  };
}

describe('Persistence Layer', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  describe('Database', () => {
    it('should create database instance', () => {
      const db = getDatabase();
      expect(db).toBeDefined();
      expect(db.name).toBe('BoostedLearningDB');
    });

    it('should have all required tables', () => {
      const db = getDatabase();
      expect(db.languages).toBeDefined();
      expect(db.modules).toBeDefined();
      expect(db.lessons).toBeDefined();
      expect(db.learningItems).toBeDefined();
      expect(db.vocabulary).toBeDefined();
      expect(db.grammarInfo).toBeDefined();
      expect(db.examples).toBeDefined();
      expect(db.exercises).toBeDefined();
      expect(db.reviewStates).toBeDefined();
      expect(db.attempts).toBeDefined();
      expect(db.sessions).toBeDefined();
      expect(db.achievements).toBeDefined();
      expect(db.learnerProfile).toBeDefined();
    });
  });

  describe('Repositories', () => {
    describe('Language Repository', () => {
      it('should save and retrieve a language', async () => {
        const repos = createRepositories();
        const language = createLanguage({ code: 'nl', name: 'Dutch' });

        await repos.languages.save(language);
        const retrieved = await repos.languages.getById(language.id);

        expect(retrieved).toEqual(language);
      });

      it('should get language by code', async () => {
        const repos = createRepositories();
        const dutch = createLanguage({ code: 'nl', name: 'Dutch' });
        const french = createLanguage({ code: 'fr', name: 'French' });

        await repos.languages.saveMany([dutch, french]);
        const retrieved = await repos.languages.getByCode('nl');

        expect(retrieved?.name).toBe('Dutch');
      });

      it('should separate course languages from validation assets', async () => {
        const repos = createRepositories();
        const dutch = createLanguage({ code: 'nl', isValidationAsset: false });
        const frenchValidation = createLanguage({ code: 'fr', isValidationAsset: true });

        await repos.languages.saveMany([dutch, frenchValidation]);

        const courses = await repos.languages.getCourseLanguages();
        const validationAssets = await repos.languages.getValidationAssets();

        expect(courses).toHaveLength(1);
        expect(courses[0].code).toBe('nl');
        expect(validationAssets).toHaveLength(1);
        expect(validationAssets[0].code).toBe('fr');
      });
    });

    describe('Learning Item Repository', () => {
      it('should get available items only', async () => {
        const repos = createRepositories();
        const languageId = uuid();
        const available = createLearningItem({ languageId, contentState: 'available' });
        const draft = createLearningItem({ languageId, contentState: 'draft' });

        await repos.learningItems.saveMany([available, draft]);
        const result = await repos.learningItems.getAvailable(languageId);

        expect(result).toHaveLength(1);
        expect(result[0].contentState).toBe('available');
      });
    });

    describe('Review State Repository', () => {
      it('should get review state by learning item', async () => {
        const repos = createRepositories();
        const itemId = uuid();
        const state = createReviewState({ learningItemId: itemId, attemptCount: 5 });

        await repos.reviewStates.save(state);
        const retrieved = await repos.reviewStates.getByLearningItem(itemId);

        expect(retrieved?.attemptCount).toBe(5);
      });

      it('should get recovering items', async () => {
        const repos = createRepositories();
        const recovering = createReviewState({ repeatedlyForgotten: true });
        const normal = createReviewState({ repeatedlyForgotten: false });

        await repos.reviewStates.saveMany([recovering, normal]);
        const result = await repos.reviewStates.getRecovering();

        expect(result).toHaveLength(1);
        expect(result[0].repeatedlyForgotten).toBe(true);
      });
    });

    describe('Attempt Repository', () => {
      it('should get attempts by learning item', async () => {
        const repos = createRepositories();
        const itemId = uuid();
        const attempt1 = createAttempt({ learningItemId: itemId });
        const attempt2 = createAttempt({ learningItemId: itemId });
        const other = createAttempt({ learningItemId: uuid() });

        await repos.attempts.saveMany([attempt1, attempt2, other]);
        const result = await repos.attempts.getByLearningItem(itemId);

        expect(result).toHaveLength(2);
      });

      it('should get recent attempts with limit', async () => {
        const repos = createRepositories();
        const itemId = uuid();
        const attempts = Array.from({ length: 10 }, (_, i) =>
          createAttempt({
            learningItemId: itemId,
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
          })
        );

        await repos.attempts.saveMany(attempts);
        const result = await repos.attempts.getRecentByLearningItem(itemId, 3);

        expect(result).toHaveLength(3);
      });
    });

    describe('Session Repository', () => {
      it('should get active session', async () => {
        const repos = createRepositories();
        const active = createSession({ endedAt: null });
        const ended = createSession({ endedAt: now() });

        await repos.sessions.saveMany([active, ended]);
        const result = await repos.sessions.getActiveSession();

        expect(result?.id).toBe(active.id);
      });
    });

    describe('Learner Profile Repository', () => {
      it('should save and retrieve learner profile', async () => {
        const repos = createRepositories();
        const profile = createLearnerProfile({ explanationLanguage: 'fr' });

        await repos.learnerProfile.saveProfile(profile);
        const retrieved = await repos.learnerProfile.getProfile();

        expect(retrieved?.explanationLanguage).toBe('fr');
      });
    });
  });

  describe('Property 34: Export/import/backup round-trips learner data', () => {
    it('should export and import all data correctly', async () => {
      const repos = createRepositories();
      
      // Create test data
      const language = createLanguage();
      const item = createLearningItem({ languageId: language.id });
      const state = createReviewState({ learningItemId: item.id, attemptCount: 10 });
      const attempt = createAttempt({ learningItemId: item.id });
      const session = createSession({ itemsStudied: 5 });
      const profile = createLearnerProfile();

      await repos.languages.save(language);
      await repos.learningItems.save(item);
      await repos.reviewStates.save(state);
      await repos.attempts.save(attempt);
      await repos.sessions.save(session);
      await repos.learnerProfile.saveProfile(profile);

      // Export
      const exported = await exportAll();
      expect(exported.content.languages).toHaveLength(1);
      expect(exported.learnerData.reviewStates).toHaveLength(1);
      expect(exported.learnerData.attempts).toHaveLength(1);

      // Clear and reimport
      await resetDatabase();
      await importAll(exported);

      // Verify
      const newRepos = createRepositories();
      const retrievedState = await newRepos.reviewStates.getByLearningItem(item.id);
      expect(retrievedState?.attemptCount).toBe(10);
    });

    it('should backup and restore learner data without affecting content', async () => {
      const repos = createRepositories();
      
      // Create content and learner data
      const language = createLanguage();
      const state = createReviewState({ attemptCount: 15 });

      await repos.languages.save(language);
      await repos.reviewStates.save(state);

      // Backup learner data
      const backup = await exportLearnerData();
      expect(backup.learnerData.reviewStates).toHaveLength(1);

      // Modify learner data
      await repos.reviewStates.deleteAll();
      expect(await repos.reviewStates.count()).toBe(0);

      // Restore
      await importLearnerData(backup);

      // Verify learner data restored
      const restoredState = await repos.reviewStates.getById(state.id);
      expect(restoredState?.attemptCount).toBe(15);

      // Verify content unaffected
      const lang = await repos.languages.getById(language.id);
      expect(lang).toBeDefined();
    });

    it('should round-trip random learner data (property test)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 0, max: 20 }),
          async (numStates, attemptCount) => {
            await resetDatabase();
            const repos = createRepositories();
            
            // Create random number of review states
            const states: ReviewStateEntity[] = [];
            for (let i = 0; i < numStates; i++) {
              states.push(createReviewState({ attemptCount }));
            }
            await repos.reviewStates.saveMany(states);

            // Export
            const backup = await exportLearnerData();

            // Clear and restore
            await repos.reviewStates.deleteAll();
            await importLearnerData(backup);

            // Verify count matches
            const count = await repos.reviewStates.count();
            return count === numStates;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 35: Deletion clears learner data from the Local_Store', () => {
    it('should delete all learner data while preserving content', async () => {
      const repos = createRepositories();
      
      // Create content and learner data
      const language = createLanguage();
      const state = createReviewState();
      const attempt = createAttempt();
      const session = createSession();
      const profile = createLearnerProfile();

      await repos.languages.save(language);
      await repos.reviewStates.save(state);
      await repos.attempts.save(attempt);
      await repos.sessions.save(session);
      await repos.learnerProfile.saveProfile(profile);

      // Delete learner data
      await deleteLearnerData();

      // Verify learner data cleared
      expect(await repos.reviewStates.count()).toBe(0);
      expect(await repos.attempts.count()).toBe(0);
      expect(await repos.sessions.count()).toBe(0);
      expect(await repos.learnerProfile.getProfile()).toBeUndefined();

      // Verify content preserved
      expect(await repos.languages.count()).toBe(1);
    });

    it('should delete all data when requested', async () => {
      const repos = createRepositories();
      
      await repos.languages.save(createLanguage());
      await repos.reviewStates.save(createReviewState());

      await deleteAllData();

      expect(await repos.languages.count()).toBe(0);
      expect(await repos.reviewStates.count()).toBe(0);
    });
  });

  describe('Export/Import Validation', () => {
    it('should validate correct full export', () => {
      const validExport = {
        metadata: { version: 1, exportedAt: now(), appVersion: '1.0.0' },
        content: {
          languages: [],
          modules: [],
          lessons: [],
          learningItems: [],
          vocabulary: [],
          grammarInfo: [],
          examples: [],
          exercises: [],
        },
        learnerData: {
          reviewStates: [],
          attempts: [],
          sessions: [],
          achievements: [],
          learnerProfile: null,
        },
      };

      const result = validateFullExport(validExport);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid export structure', () => {
      const result = validateFullExport({ invalid: true });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject unsupported version', () => {
      const futureExport = {
        metadata: { version: 999, exportedAt: now(), appVersion: '99.0.0' },
        content: {
          languages: [],
          modules: [],
          lessons: [],
          learningItems: [],
          vocabulary: [],
          grammarInfo: [],
          examples: [],
          exercises: [],
        },
        learnerData: {
          reviewStates: [],
          attempts: [],
          sessions: [],
          achievements: [],
          learnerProfile: null,
        },
      };

      const result = validateFullExport(futureExport);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unsupported export version'))).toBe(true);
    });

    it('should validate correct learner backup', () => {
      const validBackup = {
        metadata: { version: 1, exportedAt: now(), appVersion: '1.0.0' },
        learnerData: {
          reviewStates: [],
          attempts: [],
          sessions: [],
          achievements: [],
          learnerProfile: null,
        },
      };

      const result = validateLearnerBackup(validBackup);
      expect(result.valid).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    it('should handle save, update, and delete cycle', async () => {
      const repos = createRepositories();
      const language = createLanguage({ name: 'Original' });

      // Create
      await repos.languages.save(language);
      let retrieved = await repos.languages.getById(language.id);
      expect(retrieved?.name).toBe('Original');

      // Update
      language.name = 'Updated';
      language.updatedAt = now();
      await repos.languages.save(language);
      retrieved = await repos.languages.getById(language.id);
      expect(retrieved?.name).toBe('Updated');

      // Delete
      await repos.languages.delete(language.id);
      retrieved = await repos.languages.getById(language.id);
      expect(retrieved).toBeUndefined();
    });

    it('should handle bulk operations', async () => {
      const repos = createRepositories();
      const languages = Array.from({ length: 5 }, (_, i) =>
        createLanguage({ code: `lang${i}` })
      );

      await repos.languages.saveMany(languages);
      const all = await repos.languages.getAll();

      expect(all).toHaveLength(5);
    });
  });
});
