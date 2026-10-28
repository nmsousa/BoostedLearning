/**
 * Tests for Answer Validator
 * 
 * Feature: language-learning-app
 * 
 * Tests cover:
 * - Property 23: Any defined valid answer is accepted (R8.1, R8.5, R8.6, R8.7)
 * - Property 24: Accent tolerance applies except for accent practice (R8.2)
 * - Property 25: Punctuation and whitespace differences are tolerated (R8.3)
 * - Property 26: Free word order is accepted only where enabled (R8.4)
 * - Property 27: Non-matching answers are incorrect and recorded as mistakes (R8.8)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AnswerValidator, createAnswerValidator } from './answer-validator';
import type {
  ValidationRequest,
  TolerancePolicy,
  GradedObjective,
  AnswerValidatorInterface,
} from '../types';
import { DEFAULT_TOLERANCE_POLICY } from '../types';

// Helper to create a validation request with defaults
function createRequest(
  submitted: string,
  acceptedAnswers: string[],
  policyOverrides: Partial<TolerancePolicy> = {},
  gradedObjective?: GradedObjective
): ValidationRequest {
  return {
    submitted,
    acceptedAnswers,
    policy: { ...DEFAULT_TOLERANCE_POLICY, ...policyOverrides },
    gradedObjective,
  };
}

describe('AnswerValidator', () => {
  describe('createAnswerValidator factory', () => {
    it('should create a valid validator instance', () => {
      const validator = createAnswerValidator();
      expect(validator).toBeDefined();
      expect(typeof validator.validate).toBe('function');
    });
  });

  describe('Property 23: Any defined valid answer is accepted (R8.1, R8.5, R8.6, R8.7)', () => {
    it('should accept an exact match', () => {
      const validator = new AnswerValidator();
      const result = validator.validate(createRequest('hello', ['hello']));
      
      expect(result.correct).toBe(true);
      expect(result.matchedAnswer).toBe('hello');
    });

    it('should accept any answer from the accepted set', () => {
      const validator = new AnswerValidator();
      const acceptedAnswers = ['cat', 'kitty', 'feline'];
      
      for (const answer of acceptedAnswers) {
        const result = validator.validate(createRequest(answer, acceptedAnswers));
        expect(result.correct).toBe(true);
        expect(result.matchedAnswer).toBe(answer);
      }
    });

    it('should accept alternative translations (R8.5)', () => {
      const validator = new AnswerValidator();
      // Dutch "huis" can be translated as "house" or "home"
      const result = validator.validate(createRequest('home', ['house', 'home']));
      
      expect(result.correct).toBe(true);
      expect(result.matchedAnswer).toBe('home');
    });

    it('should accept defined inflections and contractions (R8.6)', () => {
      const validator = new AnswerValidator();
      // Accept "don't" as equivalent to "do not"
      const result = validator.validate(
        createRequest("don't", ["do not", "don't"])
      );
      
      expect(result.correct).toBe(true);
    });

    it('should never reject a valid answer just because it differs from one expected string (R8.7)', () => {
      const validator = new AnswerValidator();
      // Multiple valid forms: the validator must try all of them
      const acceptedAnswers = ['I am', "I'm", 'i am'];
      
      const result1 = validator.validate(createRequest("I'm", acceptedAnswers));
      const result2 = validator.validate(createRequest('i am', acceptedAnswers));
      
      expect(result1.correct).toBe(true);
      expect(result2.correct).toBe(true);
    });

    it('should accept any valid answer from a set (property test)', () => {
      const validator = new AnswerValidator();
      
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 })
              .filter(s => /\p{L}/u.test(s)), // Only strings with at least one letter
            { minLength: 1, maxLength: 5 }
          ),
          (acceptedAnswers) => {
            // Filter out strings that become empty after normalization
            const validAnswers = acceptedAnswers
              .map(s => s.trim())
              .filter(s => s.length > 0 && /\p{L}/u.test(s)); // Must have at least one letter
            
            if (validAnswers.length === 0) return true;
            
            // Pick a random valid answer and submit it
            const chosenAnswer = validAnswers[0];
            const result = validator.validate(createRequest(chosenAnswer, validAnswers));
            
            return result.correct === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 24: Accent tolerance applies except for accent practice (R8.2)', () => {
    it('should accept answers with different accents by default', () => {
      const validator = new AnswerValidator();
      
      // "café" should match "cafe" with ignoreAccents: true
      const result = validator.validate(createRequest('cafe', ['café']));
      
      expect(result.correct).toBe(true);
    });

    it('should accept various accent variations', () => {
      const validator = new AnswerValidator();
      
      const testCases = [
        { submitted: 'resume', accepted: ['résumé'] },
        { submitted: 'naive', accepted: ['naïve'] },
        { submitted: 'Noel', accepted: ['Noël'] },
        { submitted: 'francais', accepted: ['français'] },
        { submitted: 'garcon', accepted: ['garçon'] },
      ];
      
      for (const { submitted, accepted } of testCases) {
        const result = validator.validate(createRequest(submitted, accepted));
        expect(result.correct).toBe(true);
      }
    });

    it('should reject accent differences when gradedObjective is "accents"', () => {
      const validator = new AnswerValidator();
      
      // For accent practice, "cafe" should NOT match "café"
      const result = validator.validate(
        createRequest('cafe', ['café'], {}, 'accents')
      );
      
      expect(result.correct).toBe(false);
    });

    it('should accept exact accented answer when gradedObjective is "accents"', () => {
      const validator = new AnswerValidator();
      
      // Correct accent should still match
      const result = validator.validate(
        createRequest('café', ['café'], {}, 'accents')
      );
      
      expect(result.correct).toBe(true);
    });

    it('should reject accent differences when ignoreAccents is false', () => {
      const validator = new AnswerValidator();
      
      const result = validator.validate(
        createRequest('cafe', ['café'], { ignoreAccents: false })
      );
      
      expect(result.correct).toBe(false);
    });

    it('should handle accent normalization consistently (property test)', () => {
      const validator = new AnswerValidator();
      
      // Test that accent-stripped versions match when tolerance is on
      const accentedWords = ['café', 'résumé', 'naïve', 'Noël', 'français'];
      const unaccentedWords = ['cafe', 'resume', 'naive', 'Noel', 'francais'];
      
      for (let i = 0; i < accentedWords.length; i++) {
        const withAccentTolerance = validator.validate(
          createRequest(unaccentedWords[i], [accentedWords[i]], { ignoreAccents: true })
        );
        const withoutAccentTolerance = validator.validate(
          createRequest(unaccentedWords[i], [accentedWords[i]], { ignoreAccents: false })
        );
        
        expect(withAccentTolerance.correct).toBe(true);
        expect(withoutAccentTolerance.correct).toBe(false);
      }
    });
  });

  describe('Property 25: Punctuation and whitespace differences are tolerated (R8.3)', () => {
    it('should accept answers with different punctuation', () => {
      const validator = new AnswerValidator();
      
      const testCases = [
        { submitted: 'Hello world', accepted: ['Hello, world!'] },
        { submitted: 'Its fine', accepted: ["It's fine."] },
        { submitted: 'What is this', accepted: ['What is this?'] },
      ];
      
      for (const { submitted, accepted } of testCases) {
        const result = validator.validate(createRequest(submitted, accepted));
        expect(result.correct).toBe(true);
      }
    });

    it('should accept answers with different whitespace', () => {
      const validator = new AnswerValidator();
      
      const testCases = [
        { submitted: 'hello  world', accepted: ['hello world'] },
        { submitted: '  hello world  ', accepted: ['hello world'] },
        { submitted: 'hello\tworld', accepted: ['hello world'] },
      ];
      
      for (const { submitted, accepted } of testCases) {
        const result = validator.validate(createRequest(submitted, accepted));
        expect(result.correct).toBe(true);
      }
    });

    it('should handle apostrophes in contractions', () => {
      const validator = new AnswerValidator();
      
      // With punctuation tolerance, "don't" and "dont" are equivalent
      // because apostrophe is removed
      const result1 = validator.validate(createRequest("don't", ["don't"]));
      expect(result1.correct).toBe(true);
      
      // "dont" should also match "don't" when punctuation is ignored
      const result2 = validator.validate(createRequest("dont", ["don't"]));
      expect(result2.correct).toBe(true);
      
      // When punctuation is NOT ignored, they should be different
      const result3 = validator.validate(
        createRequest("dont", ["don't"], { ignorePunctuationWhitespace: false })
      );
      expect(result3.correct).toBe(false);
    });

    it('should reject punctuation differences when ignorePunctuationWhitespace is false', () => {
      const validator = new AnswerValidator();
      
      const result = validator.validate(
        createRequest('Hello world', ['Hello, world!'], { ignorePunctuationWhitespace: false })
      );
      
      expect(result.correct).toBe(false);
    });
  });

  describe('Property 26: Free word order is accepted only where enabled (R8.4)', () => {
    it('should reject different word order by default', () => {
      const validator = new AnswerValidator();
      
      const result = validator.validate(
        createRequest('world hello', ['hello world'], { freeWordOrder: false })
      );
      
      expect(result.correct).toBe(false);
    });

    it('should accept different word order when freeWordOrder is true', () => {
      const validator = new AnswerValidator();
      
      const result = validator.validate(
        createRequest('world hello', ['hello world'], { freeWordOrder: true })
      );
      
      expect(result.correct).toBe(true);
    });

    it('should handle multi-word reorderings with freeWordOrder', () => {
      const validator = new AnswerValidator();
      
      const testCases = [
        { submitted: 'cat the black', accepted: ['the black cat'] },
        { submitted: 'quickly ran she', accepted: ['she ran quickly'] },
        { submitted: 'apples red three', accepted: ['three red apples'] },
      ];
      
      for (const { submitted, accepted } of testCases) {
        const result = validator.validate(
          createRequest(submitted, accepted, { freeWordOrder: true })
        );
        expect(result.correct).toBe(true);
      }
    });

    it('should require all words to be present with freeWordOrder', () => {
      const validator = new AnswerValidator();
      
      // Missing word should fail
      const result1 = validator.validate(
        createRequest('hello', ['hello world'], { freeWordOrder: true })
      );
      expect(result1.correct).toBe(false);
      
      // Extra word should fail
      const result2 = validator.validate(
        createRequest('hello world today', ['hello world'], { freeWordOrder: true })
      );
      expect(result2.correct).toBe(false);
    });

    it('should handle duplicate words correctly with freeWordOrder', () => {
      const validator = new AnswerValidator();
      
      // Same words in different order with duplicates
      const result1 = validator.validate(
        createRequest('the the cat', ['the cat the'], { freeWordOrder: true })
      );
      expect(result1.correct).toBe(true);
      
      // Different count of duplicates should fail
      const result2 = validator.validate(
        createRequest('the cat', ['the the cat'], { freeWordOrder: true })
      );
      expect(result2.correct).toBe(false);
    });
  });

  describe('Property 27: Non-matching answers are incorrect and recorded as mistakes (R8.8)', () => {
    it('should reject incorrect answers', () => {
      const validator = new AnswerValidator();
      
      const result = validator.validate(createRequest('dog', ['cat']));
      
      expect(result.correct).toBe(false);
      expect(result.matchedAnswer).toBeNull();
    });

    it('should reject completely wrong answers', () => {
      const validator = new AnswerValidator();
      
      const testCases = [
        { submitted: 'xyz', accepted: ['hello', 'hi', 'hey'] },
        { submitted: '12345', accepted: ['one', 'two', 'three'] },
        { submitted: 'completely wrong', accepted: ['the correct answer'] },
      ];
      
      for (const { submitted, accepted } of testCases) {
        const result = validator.validate(createRequest(submitted, accepted));
        expect(result.correct).toBe(false);
        expect(result.matchedAnswer).toBeNull();
      }
    });

    it('should reject empty submissions', () => {
      const validator = new AnswerValidator();
      
      const result1 = validator.validate(createRequest('', ['hello']));
      expect(result1.correct).toBe(false);
      
      const result2 = validator.validate(createRequest('   ', ['hello']));
      expect(result2.correct).toBe(false);
    });

    it('should handle edge inputs gracefully', () => {
      const validator = new AnswerValidator();
      
      // Various edge cases that should not throw
      const edgeCases = [
        { submitted: '', accepted: ['valid'] },
        { submitted: '   ', accepted: ['valid'] },
        { submitted: '\t\n', accepted: ['valid'] },
        { submitted: '...', accepted: ['valid'] },
        { submitted: '!!!', accepted: ['valid'] },
        { submitted: '\u200B', accepted: ['valid'] }, // zero-width space
      ];
      
      for (const { submitted, accepted } of edgeCases) {
        expect(() => {
          validator.validate(createRequest(submitted, accepted));
        }).not.toThrow();
      }
    });

    it('should reject answers not in the accepted set (property test)', () => {
      const validator = new AnswerValidator();
      
      // Helper to normalize like the validator does (case, punctuation, whitespace)
      const normalize = (s: string): string => 
        s.toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, '')
          .replace(/\s+/g, ' ')
          .trim();
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          (submitted, acceptedBase) => {
            const normalizedSubmitted = normalize(submitted);
            
            // Skip if submitted normalizes to empty
            if (normalizedSubmitted.length === 0) return true;
            
            // Make sure submitted is not in accepted set (after normalization)
            const accepted = acceptedBase.filter(a => 
              normalize(a) !== normalizedSubmitted
            );
            
            // Skip if all filtered out or all accepted normalize to empty
            if (accepted.length === 0 || accepted.every(a => normalize(a).length === 0)) {
              return true;
            }
            
            const result = validator.validate(createRequest(submitted, accepted));
            
            // The result should be incorrect since we filtered out matches
            return result.correct === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Case sensitivity', () => {
    it('should ignore case by default', () => {
      const validator = new AnswerValidator();
      
      const result = validator.validate(createRequest('HELLO', ['hello']));
      expect(result.correct).toBe(true);
    });

    it('should respect case when ignoreCase is false', () => {
      const validator = new AnswerValidator();
      
      const result = validator.validate(
        createRequest('HELLO', ['hello'], { ignoreCase: false })
      );
      expect(result.correct).toBe(false);
    });
  });

  describe('Combined tolerances', () => {
    it('should apply multiple tolerances together', () => {
      const validator = new AnswerValidator();
      
      // Combines case, accent, and punctuation tolerance
      const result = validator.validate(
        createRequest('CAFE!', ['café'])
      );
      expect(result.correct).toBe(true);
    });

    it('should handle complex real-world scenarios', () => {
      const validator = new AnswerValidator();
      
      // Dutch sentence with various normalization needs
      const result1 = validator.validate(
        createRequest(
          'Ik hou van jou',
          ['Ik hou van jou', 'Ik houd van jou', 'Ik hou van je']
        )
      );
      expect(result1.correct).toBe(true);
      
      // French with accents and punctuation
      const result2 = validator.validate(
        createRequest(
          "C'est la vie",
          ["C'est la vie!", "C'est la vie"]
        )
      );
      expect(result2.correct).toBe(true);
    });

    it('should handle the graded spelling objective', () => {
      const validator = new AnswerValidator();
      
      // For spelling practice, case might still be ignored but we could
      // be stricter on other aspects. The implementation currently 
      // only has explicit carve-out for 'accents'.
      const result = validator.validate(
        createRequest('cafe', ['café'], {}, 'spelling')
      );
      // With 'spelling' objective (not 'accents'), accent tolerance still applies
      expect(result.correct).toBe(true);
    });
  });

  describe('Unicode handling', () => {
    it('should handle various Unicode characters', () => {
      const validator = new AnswerValidator();
      
      // German umlauts
      const result1 = validator.validate(createRequest('uber', ['über']));
      expect(result1.correct).toBe(true);
      
      // Spanish ñ
      const result2 = validator.validate(createRequest('nino', ['niño']));
      expect(result2.correct).toBe(true);
      
      // Nordic characters
      const result3 = validator.validate(createRequest('rod', ['rød']));
      expect(result3.correct).toBe(true);
    });

    it('should handle composed vs decomposed Unicode', () => {
      const validator = new AnswerValidator();
      
      // é can be represented as single char or e + combining accent
      const composed = 'café'; // single é character
      const decomposed = 'cafe\u0301'; // e + combining acute accent
      
      const result = validator.validate(createRequest(decomposed, [composed]));
      expect(result.correct).toBe(true);
    });
  });
});
