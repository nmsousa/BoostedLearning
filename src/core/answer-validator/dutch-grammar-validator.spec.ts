/**
 * Tests for Dutch Grammar Validator
 * 
 * Feature: language-learning-app
 * 
 * Tests cover:
 * - Property 28: Dutch grammar responses validate against recorded forms (R9.4, R9.5)
 * - Article validation (de/het)
 * - Plural form validation
 * - Present tense conjugation validation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  DutchGrammarValidator,
  createDutchGrammarValidator,
  type DutchGrammarInfo,
  type ConjugationPronoun,
} from './dutch-grammar-validator';

describe('DutchGrammarValidator', () => {
  describe('createDutchGrammarValidator factory', () => {
    it('should create a valid validator instance', () => {
      const validator = createDutchGrammarValidator();
      expect(validator).toBeDefined();
      expect(typeof validator.validate).toBe('function');
    });
  });

  describe('Property 28: Dutch grammar responses validate against recorded forms', () => {
    describe('Article validation (R9.4)', () => {
      it('should accept correct "de" article', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { dutchArticle: 'de' };

        const result = validator.validateArticle('de', grammarInfo);
        expect(result.correct).toBe(true);
        expect(result.grammarAspect).toBe('article');
      });

      it('should accept correct "het" article', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { dutchArticle: 'het' };

        const result = validator.validateArticle('het', grammarInfo);
        expect(result.correct).toBe(true);
      });

      it('should reject wrong article', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { dutchArticle: 'de' };

        const result = validator.validateArticle('het', grammarInfo);
        expect(result.correct).toBe(false);
      });

      it('should accept article with case variation', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { dutchArticle: 'de' };

        expect(validator.validateArticle('De', grammarInfo).correct).toBe(true);
        expect(validator.validateArticle('DE', grammarInfo).correct).toBe(true);
      });

      it('should accept article when noun is included', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { dutchArticle: 'de' };

        const result = validator.validateArticle('de vader', grammarInfo);
        expect(result.correct).toBe(true);
      });

      it('should return false when no article is recorded', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { dutchArticle: null };

        const result = validator.validateArticle('de', grammarInfo);
        expect(result.correct).toBe(false);
      });
    });

    describe('Plural validation (R9.5)', () => {
      it('should accept correct plural form', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { pluralForm: 'kinderen' };

        const result = validator.validatePlural('kinderen', grammarInfo);
        expect(result.correct).toBe(true);
        expect(result.grammarAspect).toBe('plural');
      });

      it('should accept plural with "de" article (all plurals use de)', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { pluralForm: 'kinderen' };

        const result = validator.validatePlural('de kinderen', grammarInfo);
        expect(result.correct).toBe(true);
      });

      it('should reject wrong plural form', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { pluralForm: 'kinderen' };

        const result = validator.validatePlural('kinds', grammarInfo);
        expect(result.correct).toBe(false);
      });

      it('should handle case insensitivity', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { pluralForm: 'vaders' };

        expect(validator.validatePlural('Vaders', grammarInfo).correct).toBe(true);
        expect(validator.validatePlural('VADERS', grammarInfo).correct).toBe(true);
      });

      it('should return false when no plural is recorded', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { pluralForm: null };

        const result = validator.validatePlural('kinderen', grammarInfo);
        expect(result.correct).toBe(false);
      });
    });

    describe('Conjugation validation (R9.5)', () => {
      const zijnConjugation: DutchGrammarInfo = {
        presentTenseConjugation: {
          ik: 'ben',
          jij: 'bent',
          hij: 'is',
          wij: 'zijn',
          jullie: 'zijn',
          zij: 'zijn',
        },
      };

      it('should accept correct conjugation for "ik"', () => {
        const validator = new DutchGrammarValidator();

        const result = validator.validateConjugation('ben', 'ik', zijnConjugation);
        expect(result.correct).toBe(true);
        expect(result.grammarAspect).toBe('conjugation');
        expect(result.pronoun).toBe('ik');
      });

      it('should accept conjugation with pronoun included', () => {
        const validator = new DutchGrammarValidator();

        expect(validator.validateConjugation('ik ben', 'ik', zijnConjugation).correct).toBe(true);
        expect(validator.validateConjugation('jij bent', 'jij', zijnConjugation).correct).toBe(true);
        expect(validator.validateConjugation('hij is', 'hij', zijnConjugation).correct).toBe(true);
      });

      it('should accept informal pronoun variants', () => {
        const validator = new DutchGrammarValidator();

        // "je" for "jij"
        expect(validator.validateConjugation('je bent', 'jij', zijnConjugation).correct).toBe(true);
        // "we" for "wij"
        expect(validator.validateConjugation('we zijn', 'wij', zijnConjugation).correct).toBe(true);
        // "ze" for "zij"
        expect(validator.validateConjugation('ze zijn', 'zij', zijnConjugation).correct).toBe(true);
      });

      it('should reject wrong conjugation', () => {
        const validator = new DutchGrammarValidator();

        expect(validator.validateConjugation('is', 'ik', zijnConjugation).correct).toBe(false);
        expect(validator.validateConjugation('ben', 'hij', zijnConjugation).correct).toBe(false);
      });

      it('should handle all pronouns correctly', () => {
        const validator = new DutchGrammarValidator();
        const pronouns: ConjugationPronoun[] = ['ik', 'jij', 'hij', 'wij', 'jullie', 'zij'];
        const expected = ['ben', 'bent', 'is', 'zijn', 'zijn', 'zijn'];

        for (let i = 0; i < pronouns.length; i++) {
          const result = validator.validateConjugation(expected[i], pronouns[i], zijnConjugation);
          expect(result.correct).toBe(true);
        }
      });

      it('should return false when no conjugation is recorded', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { presentTenseConjugation: null };

        const result = validator.validateConjugation('ben', 'ik', grammarInfo);
        expect(result.correct).toBe(false);
      });
    });

    describe('Generic validate method', () => {
      it('should route to correct validation method', () => {
        const validator = new DutchGrammarValidator();

        const articleResult = validator.validate('de', 'article', { dutchArticle: 'de' });
        expect(articleResult.grammarAspect).toBe('article');

        const pluralResult = validator.validate('kinderen', 'plural', { pluralForm: 'kinderen' });
        expect(pluralResult.grammarAspect).toBe('plural');

        const conjResult = validator.validate('ben', 'conjugation', {
          presentTenseConjugation: {
            ik: 'ben', jij: 'bent', hij: 'is', wij: 'zijn', jullie: 'zijn', zij: 'zijn',
          },
        }, 'ik');
        expect(conjResult.grammarAspect).toBe('conjugation');
      });

      it('should throw error when conjugation called without pronoun', () => {
        const validator = new DutchGrammarValidator();

        expect(() => {
          validator.validate('ben', 'conjugation', {
            presentTenseConjugation: {
              ik: 'ben', jij: 'bent', hij: 'is', wij: 'zijn', jullie: 'zijn', zij: 'zijn',
            },
          });
        }).toThrow('Pronoun is required');
      });
    });

    describe('Property test: recorded forms are always accepted', () => {
      it('should always accept the exact recorded article', () => {
        const validator = new DutchGrammarValidator();

        fc.assert(
          fc.property(
            fc.constantFrom('de', 'het') as fc.Arbitrary<'de' | 'het'>,
            (article) => {
              const result = validator.validateArticle(article, { dutchArticle: article });
              return result.correct === true;
            }
          ),
          { numRuns: 20 }
        );
      });

      it('should always accept the exact recorded plural', () => {
        const validator = new DutchGrammarValidator();
        const testPlurals = ['kinderen', 'vaders', 'moeders', 'huizen', 'boeken'];

        for (const plural of testPlurals) {
          const result = validator.validatePlural(plural, { pluralForm: plural });
          expect(result.correct).toBe(true);
        }
      });

      it('should always accept the exact recorded conjugation for each pronoun', () => {
        const validator = new DutchGrammarValidator();
        const hebben: DutchGrammarInfo = {
          presentTenseConjugation: {
            ik: 'heb',
            jij: 'hebt',
            hij: 'heeft',
            wij: 'hebben',
            jullie: 'hebben',
            zij: 'hebben',
          },
        };

        const pronouns: ConjugationPronoun[] = ['ik', 'jij', 'hij', 'wij', 'jullie', 'zij'];

        for (const pronoun of pronouns) {
          const expectedForm = hebben.presentTenseConjugation![pronoun];
          const result = validator.validateConjugation(expectedForm, pronoun, hebben);
          expect(result.correct).toBe(true);
        }
      });
    });

    describe('Tolerance policy application', () => {
      it('should respect case sensitivity setting', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { pluralForm: 'kinderen' };

        // Default is case-insensitive
        expect(validator.validatePlural('KINDEREN', grammarInfo).correct).toBe(true);

        // With case sensitivity on
        expect(validator.validatePlural('KINDEREN', grammarInfo, { ignoreCase: false }).correct).toBe(false);
      });

      it('should respect whitespace tolerance', () => {
        const validator = new DutchGrammarValidator();
        const grammarInfo: DutchGrammarInfo = { pluralForm: 'kinderen' };

        // Default tolerates extra whitespace
        expect(validator.validatePlural('  kinderen  ', grammarInfo).correct).toBe(true);
      });
    });
  });
});
