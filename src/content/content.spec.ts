/**
 * Tests for Content Module
 * 
 * Feature: language-learning-app
 * 
 * Tests cover:
 * - Property 29: Only available content is ever presented (R12.1, R12.3, R12.4)
 * - Property 30: AI/automated content cannot bypass human approval (R12.5)
 * - Content state machine transitions
 * - Content validation
 * - Dutch grammar fields (R9.1, R9.2, R9.3)
 * - French validation set structure (R11.1, R11.2, R11.3)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import 'fake-indexeddb/auto';

import {
  transitionContentState,
  canPresentToLearners,
  requiresHumanApproval,
  validateVocabulary,
  validateGrammarInfo,
  validateContent,
  ContentStore,
  createContentStore,
  seedDutchA1Content,
  seedFrenchB2ValidationContent,
  seedAllContent,
  isContentSeeded,
  dutchA1Content,
  frenchB2ValidationContent,
  type ContentForValidation,
} from './index';

import {
  resetDatabase,
  createRepositories,
  type Repositories,
} from '../persistence';

import type {
  LearningItemEntity,
  VocabularyEntity,
  GrammarInfoEntity,
  ExampleEntity,
  ExerciseEntity,
} from '../persistence/entities';

import type { ContentState } from '../core/types';

// Helper to generate UUIDs
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const NOW = new Date().toISOString();

// Test data factories
function createItem(overrides: Partial<LearningItemEntity> = {}): LearningItemEntity {
  return {
    id: uuid(),
    languageId: uuid(),
    lessonId: uuid(),
    kind: 'vocabulary',
    prompt: 'Test item',
    skillDimensions: ['meaning'],
    contentState: 'draft',
    updatedAt: NOW,
    ...overrides,
  };
}

function createVocabulary(itemId: string, overrides: Partial<VocabularyEntity> = {}): VocabularyEntity {
  return {
    id: uuid(),
    learningItemId: itemId,
    targetText: 'test',
    acceptedAnswers: ['test'],
    alternativeTranslations: ['exam'],
    updatedAt: NOW,
    ...overrides,
  };
}

function createGrammarInfo(itemId: string, overrides: Partial<GrammarInfoEntity> = {}): GrammarInfoEntity {
  return {
    id: uuid(),
    learningItemId: itemId,
    partOfSpeech: 'noun',
    dutchArticle: 'de',
    pluralForm: 'tests',
    presentTenseConjugation: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function createExample(itemId: string, overrides: Partial<ExampleEntity> = {}): ExampleEntity {
  return {
    id: uuid(),
    learningItemId: itemId,
    sentenceTarget: 'Dit is een test.',
    sentenceExplanation: 'This is a test.',
    contentState: 'available',
    updatedAt: NOW,
    ...overrides,
  };
}

function createExercise(itemId: string, overrides: Partial<ExerciseEntity> = {}): ExerciseEntity {
  return {
    id: uuid(),
    learningItemId: itemId,
    type: 'flashcard',
    config: {},
    objective: 'Test exercise',
    contentState: 'available',
    updatedAt: NOW,
    ...overrides,
  };
}

describe('Content Module', () => {
  let repos: Repositories;

  beforeEach(async () => {
    await resetDatabase();
    repos = createRepositories();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  describe('Content State Machine', () => {
    describe('canPresentToLearners', () => {
      it('should return true only for available state', () => {
        expect(canPresentToLearners('draft')).toBe(false);
        expect(canPresentToLearners('validated')).toBe(false);
        expect(canPresentToLearners('available')).toBe(true);
      });
    });

    describe('requiresHumanApproval', () => {
      it('should require approval for AI and automated sources', () => {
        expect(requiresHumanApproval('human')).toBe(false);
        expect(requiresHumanApproval('ai')).toBe(true);
        expect(requiresHumanApproval('automated')).toBe(true);
      });
    });

    describe('transitionContentState', () => {
      it('should allow draft → validated with valid content and human source', () => {
        const result = transitionContentState('draft', 'validated', {
          source: 'human',
          validationResult: { valid: true, issues: [] },
        });
        expect(result.success).toBe(true);
        expect(result.newState).toBe('validated');
      });

      it('should allow validated → available', () => {
        const result = transitionContentState('validated', 'available', {});
        expect(result.success).toBe(true);
        expect(result.newState).toBe('available');
      });

      it('should allow available → draft (for re-editing)', () => {
        const result = transitionContentState('available', 'draft', {});
        expect(result.success).toBe(true);
        expect(result.newState).toBe('draft');
      });

      it('should reject invalid transitions', () => {
        // Cannot go directly from draft to available
        const result = transitionContentState('draft', 'available', {
          validationResult: { valid: true, issues: [] },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid transition');
      });

      it('should reject transition with failed validation', () => {
        const result = transitionContentState('draft', 'validated', {
          validationResult: {
            valid: false,
            issues: [{ field: 'test', message: 'Test error', severity: 'error' }],
          },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('validation failed');
      });
    });

    describe('Property 30: AI/automated content cannot bypass human approval', () => {
      it('should reject AI content without human approval', () => {
        const result = transitionContentState('draft', 'validated', {
          source: 'ai',
          humanApproved: false,
          validationResult: { valid: true, issues: [] },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('human approval');
      });

      it('should reject automated content without human approval', () => {
        const result = transitionContentState('draft', 'validated', {
          source: 'automated',
          humanApproved: false,
          validationResult: { valid: true, issues: [] },
        });
        expect(result.success).toBe(false);
      });

      it('should allow AI content with explicit human approval', () => {
        const result = transitionContentState('draft', 'validated', {
          source: 'ai',
          humanApproved: true,
          validationResult: { valid: true, issues: [] },
        });
        expect(result.success).toBe(true);
      });

      it('should enforce human approval gate (property test)', () => {
        fc.assert(
          fc.property(
            fc.constantFrom('ai', 'automated') as fc.Arbitrary<'ai' | 'automated'>,
            (source) => {
              // Without human approval, AI/automated content cannot be validated
              const result = transitionContentState('draft', 'validated', {
                source,
                humanApproved: false,
                validationResult: { valid: true, issues: [] },
              });
              return !result.success;
            }
          ),
          { numRuns: 20 }
        );
      });
    });
  });

  describe('Content Validation', () => {
    describe('validateVocabulary', () => {
      it('should pass valid vocabulary', () => {
        const item = createItem({ kind: 'vocabulary' });
        const vocab = createVocabulary(item.id);
        const issues = validateVocabulary(item, vocab);
        const errors = issues.filter(i => i.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should fail vocabulary missing target text', () => {
        const item = createItem({ kind: 'vocabulary' });
        const vocab = createVocabulary(item.id, { targetText: '' });
        const issues = validateVocabulary(item, vocab);
        expect(issues.some(i => i.field.includes('targetText'))).toBe(true);
      });

      it('should fail vocabulary missing accepted answers', () => {
        const item = createItem({ kind: 'vocabulary' });
        const vocab = createVocabulary(item.id, { acceptedAnswers: [] });
        const issues = validateVocabulary(item, vocab);
        expect(issues.some(i => i.field.includes('acceptedAnswers'))).toBe(true);
      });
    });

    describe('validateGrammarInfo - Dutch specific (R9.1, R9.2, R9.3)', () => {
      it('should require article for Dutch nouns (R9.1)', () => {
        const item = createItem({ kind: 'grammar' });
        const grammar = createGrammarInfo(item.id, {
          partOfSpeech: 'noun',
          dutchArticle: null,
        });
        const issues = validateGrammarInfo(item, grammar);
        expect(issues.some(i => i.message.includes('article'))).toBe(true);
      });

      it('should require plural form for Dutch nouns (R9.2)', () => {
        const item = createItem({ kind: 'grammar' });
        const grammar = createGrammarInfo(item.id, {
          partOfSpeech: 'noun',
          pluralForm: null,
        });
        const issues = validateGrammarInfo(item, grammar);
        expect(issues.some(i => i.message.includes('plural'))).toBe(true);
      });

      it('should require present tense conjugation for verbs (R9.3)', () => {
        const item = createItem({ kind: 'grammar' });
        const grammar = createGrammarInfo(item.id, {
          partOfSpeech: 'verb',
          dutchArticle: null,
          pluralForm: null,
          presentTenseConjugation: null,
        });
        const issues = validateGrammarInfo(item, grammar);
        expect(issues.some(i => i.message.includes('conjugation'))).toBe(true);
      });

      it('should require all conjugation forms', () => {
        const item = createItem({ kind: 'grammar' });
        const grammar = createGrammarInfo(item.id, {
          partOfSpeech: 'verb',
          dutchArticle: null,
          pluralForm: null,
          presentTenseConjugation: {
            ik: 'ben',
            jij: 'bent',
            hij: '', // Missing
            wij: 'zijn',
            jullie: 'zijn',
            zij: 'zijn',
          },
        });
        const issues = validateGrammarInfo(item, grammar);
        expect(issues.some(i => i.field.includes('hij'))).toBe(true);
      });

      it('should pass valid Dutch noun', () => {
        const item = createItem({ kind: 'grammar' });
        const grammar = createGrammarInfo(item.id, {
          partOfSpeech: 'noun',
          dutchArticle: 'de',
          pluralForm: 'tests',
        });
        const issues = validateGrammarInfo(item, grammar);
        const errors = issues.filter(i => i.severity === 'error');
        expect(errors).toHaveLength(0);
      });

      it('should pass valid Dutch verb', () => {
        const item = createItem({ kind: 'grammar' });
        const grammar = createGrammarInfo(item.id, {
          partOfSpeech: 'verb',
          dutchArticle: null,
          pluralForm: null,
          presentTenseConjugation: {
            ik: 'ben',
            jij: 'bent',
            hij: 'is',
            wij: 'zijn',
            jullie: 'zijn',
            zij: 'zijn',
          },
        });
        const issues = validateGrammarInfo(item, grammar);
        const errors = issues.filter(i => i.severity === 'error');
        expect(errors).toHaveLength(0);
      });
    });

    describe('validateContent', () => {
      it('should validate complete content', () => {
        const item = createItem({ kind: 'vocabulary' });
        const content: ContentForValidation = {
          item,
          vocabulary: createVocabulary(item.id),
          examples: [createExample(item.id)],
          exercises: [createExercise(item.id)],
        };
        const result = validateContent(content);
        expect(result.valid).toBe(true);
      });

      it('should fail content with missing prompt', () => {
        const item = createItem({ kind: 'vocabulary', prompt: '' });
        const content: ContentForValidation = {
          item,
          vocabulary: createVocabulary(item.id),
          examples: [],
          exercises: [],
        };
        const result = validateContent(content);
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.field.includes('prompt'))).toBe(true);
      });
    });
  });

  describe('ContentStore', () => {
    describe('Property 29: Only available content is ever presented', () => {
      it('should only return available items', async () => {
        const languageId = uuid();
        
        // Create items with different states
        const availableItem = createItem({ languageId, contentState: 'available' });
        const draftItem = createItem({ languageId, contentState: 'draft' });
        const validatedItem = createItem({ languageId, contentState: 'validated' });

        await repos.learningItems.saveMany([availableItem, draftItem, validatedItem]);

        const store = createContentStore(repos);
        const items = await store.getAvailableItems(languageId);

        expect(items).toHaveLength(1);
        expect(items[0].contentState).toBe('available');
      });

      it('should return null for non-available item in getEnrichedItem', async () => {
        const draftItem = createItem({ contentState: 'draft' });
        await repos.learningItems.save(draftItem);

        const store = createContentStore(repos);
        const enriched = await store.getEnrichedItem(draftItem.id);

        expect(enriched).toBeNull();
        expect(store.getContentGapLog()).toHaveLength(1);
      });

      it('should only present available content (property test)', async () => {
        const languageId = uuid();
        const states: ContentState[] = ['draft', 'validated', 'available'];

        // Create items with random states
        const items = states.flatMap(state =>
          Array.from({ length: 3 }, () => createItem({ languageId, contentState: state }))
        );
        await repos.learningItems.saveMany(items);

        const store = createContentStore(repos);
        const available = await store.getAvailableItems(languageId);

        // All returned items must be available
        for (const item of available) {
          expect(item.contentState).toBe('available');
        }
      });
    });

    describe('Content Gap Logging', () => {
      it('should log missing references', async () => {
        const store = createContentStore(repos);
        const result = await store.getEnrichedItem('nonexistent-id');

        expect(result).toBeNull();
        const log = store.getContentGapLog();
        expect(log).toHaveLength(1);
        expect(log[0].type).toBe('missing_reference');
      });

      it('should log invalid references (non-available content)', async () => {
        const draftItem = createItem({ contentState: 'draft' });
        await repos.learningItems.save(draftItem);

        const store = createContentStore(repos);
        await store.getEnrichedItem(draftItem.id);

        const log = store.getContentGapLog();
        expect(log.some(e => e.type === 'invalid_reference')).toBe(true);
      });

      it('should clear log on request', async () => {
        const store = createContentStore(repos);
        await store.getEnrichedItem('nonexistent');
        expect(store.getContentGapLog().length).toBeGreaterThan(0);

        store.clearContentGapLog();
        expect(store.getContentGapLog()).toHaveLength(0);
      });
    });

    describe('Course vs Validation Asset separation', () => {
      it('should separate course languages from validation assets', async () => {
        await seedAllContent(repos);

        const store = createContentStore(repos);
        const courses = await store.getCourseLanguages();
        const validationAssets = await store.getValidationAssets();

        expect(courses.length).toBeGreaterThan(0);
        expect(validationAssets.length).toBeGreaterThan(0);

        // Course languages should not include validation assets
        for (const course of courses) {
          expect(course.isValidationAsset).toBe(false);
        }

        // Validation assets should all be flagged
        for (const asset of validationAssets) {
          expect(asset.isValidationAsset).toBe(true);
        }
      });
    });
  });

  describe('Content Seeding', () => {
    it('should seed Dutch A1 content', async () => {
      await seedDutchA1Content(repos);

      const languages = await repos.languages.getAll();
      const items = await repos.learningItems.getAll();
      const vocab = await repos.vocabulary.getAll();

      expect(languages.some(l => l.code === 'nl')).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      expect(vocab.length).toBeGreaterThan(0);
    });

    it('should seed French B2 validation content', async () => {
      await seedFrenchB2ValidationContent(repos);

      const languages = await repos.languages.getAll();
      const validationLang = languages.find(l => l.code === 'fr');

      expect(validationLang).toBeDefined();
      expect(validationLang?.isValidationAsset).toBe(true);
    });

    it('should detect if content is seeded', async () => {
      expect(await isContentSeeded(repos)).toBe(false);
      
      await seedAllContent(repos);
      
      expect(await isContentSeeded(repos)).toBe(true);
    });
  });

  describe('Dutch A1 Content Quality', () => {
    it('should have nouns with article and plural', () => {
      const nouns = dutchA1Content.grammarInfo.filter(g => g.partOfSpeech === 'noun');
      
      for (const noun of nouns) {
        expect(noun.dutchArticle).toBeDefined();
        expect(['de', 'het']).toContain(noun.dutchArticle);
        expect(noun.pluralForm).toBeDefined();
        expect(noun.pluralForm!.length).toBeGreaterThan(0);
      }
    });

    it('should have verbs with present tense conjugation', () => {
      const verbs = dutchA1Content.grammarInfo.filter(g => g.partOfSpeech === 'verb');
      
      for (const verb of verbs) {
        expect(verb.presentTenseConjugation).toBeDefined();
        const conj = verb.presentTenseConjugation!;
        expect(conj.ik).toBeDefined();
        expect(conj.jij).toBeDefined();
        expect(conj.hij).toBeDefined();
        expect(conj.wij).toBeDefined();
        expect(conj.jullie).toBeDefined();
        expect(conj.zij).toBeDefined();
      }
    });

    it('should have lessons with CEFR objectives', () => {
      for (const lesson of dutchA1Content.lessons) {
        expect(lesson.cefrObjective).toBeDefined();
        expect(lesson.cefrObjective.length).toBeGreaterThan(0);
      }
    });

    it('should have vocabulary with accepted answers', () => {
      for (const vocab of dutchA1Content.vocabulary) {
        expect(vocab.acceptedAnswers).toBeDefined();
        expect(vocab.acceptedAnswers.length).toBeGreaterThan(0);
      }
    });
  });

  describe('French B2 Validation Set Quality', () => {
    it('should be flagged as validation asset (R11.3)', () => {
      expect(frenchB2ValidationContent.language.isValidationAsset).toBe(true);
    });

    it('should include items for accent testing (R11.1)', () => {
      const accentItems = frenchB2ValidationContent.vocabulary.filter(v =>
        v.targetText.includes('é') ||
        v.targetText.includes('ï') ||
        v.targetText.includes('ç')
      );
      expect(accentItems.length).toBeGreaterThan(0);
    });

    it('should include items for contraction testing (R11.2)', () => {
      const contractionItems = frenchB2ValidationContent.vocabulary.filter(v =>
        v.targetText.includes("'")
      );
      expect(contractionItems.length).toBeGreaterThan(0);
    });

    it('should include items with alternative translations', () => {
      const itemsWithAlternatives = frenchB2ValidationContent.vocabulary.filter(v =>
        v.alternativeTranslations.length > 0
      );
      expect(itemsWithAlternatives.length).toBeGreaterThan(0);
    });
  });
});
