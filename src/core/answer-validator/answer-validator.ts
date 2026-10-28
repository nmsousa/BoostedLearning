/**
 * Answer Validator
 * 
 * A normalization pipeline with independently toggleable tolerance dimensions,
 * plus curated multi-valid-answer matching.
 * 
 * Implements R8 (Answer Validation):
 * - R8.1: Accept any answer from a defined set of valid answers
 * - R8.2: Accent tolerance, except for accent-practice exercises (graded objective carve-out)
 * - R8.3: Punctuation and whitespace tolerance
 * - R8.4: Free word order where enabled
 * - R8.5: Accept legitimate alternative translations
 * - R8.6: Accept defined inflections and contractions
 * - R8.7: Never reject a valid answer just because it differs from one expected string
 * - R8.8: Incorrect answers are recorded as mistakes
 * 
 * @module core/answer-validator
 */

import type {
  ValidationRequest,
  ValidationResult,
  TolerancePolicy,
  GradedObjective,
  AnswerValidatorInterface,
} from '../types';

/**
 * Remove diacritics/accents from a string.
 * Uses Unicode normalization to decompose characters, then removes combining marks.
 * Also handles special characters like ø, æ, ß that don't decompose.
 */
function removeAccents(str: string): string {
  // NFD decomposes é into e + combining acute accent, then we remove the combining marks
  let result = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Handle special characters that don't decompose with NFD
  result = result
    .replace(/ø/g, 'o')
    .replace(/Ø/g, 'O')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/ß/g, 'ss')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L');
  
  return result;
}

/**
 * Remove punctuation and normalize whitespace.
 * When removing punctuation, apostrophes are also removed (so "It's" becomes "Its").
 */
function removePunctuationAndNormalizeWhitespace(str: string): string {
  let result = str
    // Replace em-dashes, en-dashes, and hyphens with spaces (word separators)
    .replace(/[—–-]/g, ' ')
    // Remove all other punctuation including apostrophes (not spaces!)
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    // Normalize whitespace: collapse multiple spaces, trim
    .replace(/\s+/g, ' ')
    .trim();
  
  return result;
}

/**
 * Tokenize a string into words for word-order comparison.
 */
function tokenize(str: string): string[] {
  return str.split(/\s+/).filter(token => token.length > 0);
}

/**
 * Compare two arrays as multisets (bags) - order doesn't matter, count does.
 */
function multisetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  
  const countA = new Map<string, number>();
  const countB = new Map<string, number>();
  
  for (const item of a) {
    countA.set(item, (countA.get(item) ?? 0) + 1);
  }
  for (const item of b) {
    countB.set(item, (countB.get(item) ?? 0) + 1);
  }
  
  if (countA.size !== countB.size) return false;
  
  for (const [key, count] of countA) {
    if (countB.get(key) !== count) return false;
  }
  
  return true;
}

/**
 * Apply the tolerance policy normalization to a string.
 * The graded objective can override certain tolerances.
 */
function normalizeString(
  str: string,
  policy: TolerancePolicy,
  gradedObjective: GradedObjective | undefined
): string {
  let result = str;
  
  // Handle empty or whitespace-only input gracefully
  if (!result || result.trim().length === 0) {
    return '';
  }
  
  // Normalize Unicode to a canonical form first (NFC)
  result = result.normalize('NFC');
  
  // Apply case normalization
  if (policy.ignoreCase) {
    result = result.toLowerCase();
  }
  
  // Apply accent normalization (with graded objective carve-out)
  // R8.2: When gradedObjective === 'accents', accent normalizer is forced OFF
  const shouldRemoveAccents = policy.ignoreAccents && gradedObjective !== 'accents';
  if (shouldRemoveAccents) {
    result = removeAccents(result);
  }
  
  // Apply punctuation/whitespace normalization
  if (policy.ignorePunctuationWhitespace) {
    result = removePunctuationAndNormalizeWhitespace(result);
  }
  
  return result;
}

/**
 * Compare normalized strings, optionally using free word order.
 */
function compareNormalized(
  normalizedSubmission: string,
  normalizedAccepted: string,
  freeWordOrder: boolean
): boolean {
  if (freeWordOrder) {
    // Compare as multisets (bags) of words
    const submissionTokens = tokenize(normalizedSubmission);
    const acceptedTokens = tokenize(normalizedAccepted);
    return multisetEqual(submissionTokens, acceptedTokens);
  } else {
    // Direct string comparison
    return normalizedSubmission === normalizedAccepted;
  }
}

/**
 * Answer Validator implementation.
 */
export class AnswerValidator implements AnswerValidatorInterface {
  /**
   * Validate a submitted answer against accepted answers.
   * 
   * Pipeline:
   * 1. Normalize the submission using the tolerance policy
   * 2. For each accepted answer, normalize and compare
   * 3. Return correct if any accepted answer matches
   * 
   * @param request - The validation request
   * @returns The validation result
   */
  validate(request: ValidationRequest): ValidationResult {
    const { submitted, acceptedAnswers, policy, gradedObjective } = request;
    
    // Handle empty/null submissions gracefully (R8 edge cases)
    if (submitted === null || submitted === undefined) {
      return {
        correct: false,
        matchedAnswer: null,
        normalizedSubmission: '',
      };
    }
    
    // Normalize the submission
    const normalizedSubmission = normalizeString(submitted, policy, gradedObjective);
    
    // Empty submission after normalization is incorrect
    if (normalizedSubmission.length === 0) {
      return {
        correct: false,
        matchedAnswer: null,
        normalizedSubmission: '',
      };
    }
    
    // Check against each accepted answer
    for (const accepted of acceptedAnswers) {
      const normalizedAccepted = normalizeString(accepted, policy, gradedObjective);
      
      // Skip empty accepted answers
      if (normalizedAccepted.length === 0) {
        continue;
      }
      
      if (compareNormalized(normalizedSubmission, normalizedAccepted, policy.freeWordOrder)) {
        return {
          correct: true,
          matchedAnswer: accepted,
          normalizedSubmission,
        };
      }
    }
    
    // No match found - incorrect answer (R8.8)
    return {
      correct: false,
      matchedAnswer: null,
      normalizedSubmission,
    };
  }
}

/**
 * Factory function to create an Answer Validator instance.
 */
export function createAnswerValidator(): AnswerValidatorInterface {
  return new AnswerValidator();
}
