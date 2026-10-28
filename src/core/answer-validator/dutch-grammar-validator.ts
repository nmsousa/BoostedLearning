/**
 * Dutch Grammar Validator
 * 
 * Validates article (de/het), plural, and present-tense conjugation responses
 * against the recorded GRAMMAR_INFO fields under the active tolerance policy.
 * 
 * Implements R9.4, R9.5:
 * - R9.4: Validate article responses against recorded de/het
 * - R9.5: Validate plural and conjugation responses against recorded forms
 * 
 * @module core/answer-validator/dutch-grammar-validator
 */

import type { TolerancePolicy, ValidationResult } from '../types';
import { AnswerValidator } from './answer-validator';

/**
 * Dutch article (definite article).
 */
export type DutchArticle = 'de' | 'het';

/**
 * Present tense conjugation for Dutch verbs.
 */
export interface DutchConjugation {
  ik: string;       // I
  jij: string;      // you (singular informal)
  hij: string;      // he/she/it (also zij/het for 3rd person singular)
  wij: string;      // we
  jullie: string;   // you (plural)
  zij: string;      // they
}

/**
 * Conjugation pronoun keys.
 */
export type ConjugationPronoun = keyof DutchConjugation;

/**
 * Grammar info for validation.
 */
export interface DutchGrammarInfo {
  /** Dutch article: 'de' or 'het' (for nouns) */
  dutchArticle?: DutchArticle | null;
  /** Plural form (for nouns) */
  pluralForm?: string | null;
  /** Present tense conjugation (for verbs) */
  presentTenseConjugation?: DutchConjugation | null;
}

/**
 * Result of a grammar validation.
 */
export interface GrammarValidationResult extends ValidationResult {
  /** The specific grammar aspect being tested */
  grammarAspect: 'article' | 'plural' | 'conjugation';
  /** For conjugation, which pronoun was tested */
  pronoun?: ConjugationPronoun;
}

/**
 * Dutch Grammar Validator
 * 
 * Extends the base AnswerValidator with Dutch-specific grammar validation.
 */
export class DutchGrammarValidator {
  private answerValidator: AnswerValidator;

  constructor() {
    this.answerValidator = new AnswerValidator();
  }

  /**
   * Validate an article response (de/het) against the recorded form.
   * 
   * @param submitted - The learner's answer (e.g., "de", "het", "de huis")
   * @param grammarInfo - The grammar info with the correct article
   * @param policy - Tolerance policy (default tolerances apply)
   * @returns Validation result
   */
  validateArticle(
    submitted: string,
    grammarInfo: DutchGrammarInfo,
    policy: Partial<TolerancePolicy> = {}
  ): GrammarValidationResult {
    const correctArticle = grammarInfo.dutchArticle;

    if (!correctArticle) {
      return {
        correct: false,
        matchedAnswer: null,
        normalizedSubmission: submitted,
        grammarAspect: 'article',
      };
    }

    // Accept both just the article and the article with the noun
    const acceptedAnswers = [correctArticle];

    // Apply tolerance policy
    const fullPolicy: TolerancePolicy = {
      ignoreCase: true,
      ignoreAccents: true,
      ignorePunctuationWhitespace: true,
      freeWordOrder: false,
      acceptInflectionsContractions: true,
      ...policy,
    };

    const result = this.answerValidator.validate({
      submitted: submitted.trim().toLowerCase(),
      acceptedAnswers,
      policy: fullPolicy,
    });

    // Also accept if the submitted answer starts with the correct article
    const normalizedSubmitted = submitted.trim().toLowerCase();
    const startsWithCorrectArticle = normalizedSubmitted.startsWith(correctArticle.toLowerCase());

    return {
      correct: result.correct || startsWithCorrectArticle,
      matchedAnswer: result.correct ? result.matchedAnswer : (startsWithCorrectArticle ? correctArticle : null),
      normalizedSubmission: result.normalizedSubmission,
      grammarAspect: 'article',
    };
  }

  /**
   * Validate a plural form response against the recorded form.
   * 
   * @param submitted - The learner's answer (e.g., "huizen", "de huizen")
   * @param grammarInfo - The grammar info with the correct plural
   * @param policy - Tolerance policy
   * @returns Validation result
   */
  validatePlural(
    submitted: string,
    grammarInfo: DutchGrammarInfo,
    policy: Partial<TolerancePolicy> = {}
  ): GrammarValidationResult {
    const correctPlural = grammarInfo.pluralForm;

    if (!correctPlural) {
      return {
        correct: false,
        matchedAnswer: null,
        normalizedSubmission: submitted,
        grammarAspect: 'plural',
      };
    }

    // Accept just the plural and with article "de" (all plurals use "de")
    const acceptedAnswers = [
      correctPlural,
      `de ${correctPlural}`,
    ];

    const fullPolicy: TolerancePolicy = {
      ignoreCase: true,
      ignoreAccents: true,
      ignorePunctuationWhitespace: true,
      freeWordOrder: false,
      acceptInflectionsContractions: true,
      ...policy,
    };

    const result = this.answerValidator.validate({
      submitted,
      acceptedAnswers,
      policy: fullPolicy,
    });

    return {
      ...result,
      grammarAspect: 'plural',
    };
  }

  /**
   * Validate a conjugation response against the recorded form for a specific pronoun.
   * 
   * @param submitted - The learner's answer (e.g., "ben", "ik ben")
   * @param pronoun - Which pronoun form is being tested
   * @param grammarInfo - The grammar info with conjugation
   * @param policy - Tolerance policy
   * @returns Validation result
   */
  validateConjugation(
    submitted: string,
    pronoun: ConjugationPronoun,
    grammarInfo: DutchGrammarInfo,
    policy: Partial<TolerancePolicy> = {}
  ): GrammarValidationResult {
    const conjugation = grammarInfo.presentTenseConjugation;

    if (!conjugation) {
      return {
        correct: false,
        matchedAnswer: null,
        normalizedSubmission: submitted,
        grammarAspect: 'conjugation',
        pronoun,
      };
    }

    const correctForm = conjugation[pronoun];

    if (!correctForm) {
      return {
        correct: false,
        matchedAnswer: null,
        normalizedSubmission: submitted,
        grammarAspect: 'conjugation',
        pronoun,
      };
    }

    // Accept just the verb form and with the pronoun
    const acceptedAnswers = [
      correctForm,
      `${pronoun} ${correctForm}`,
    ];

    // Handle "jij" -> also accept "je" as informal
    if (pronoun === 'jij') {
      acceptedAnswers.push(`je ${correctForm}`);
    }

    // Handle "zij" -> also accept "ze" as informal
    if (pronoun === 'zij') {
      acceptedAnswers.push(`ze ${correctForm}`);
    }

    // Handle "wij" -> also accept "we" as informal
    if (pronoun === 'wij') {
      acceptedAnswers.push(`we ${correctForm}`);
    }

    const fullPolicy: TolerancePolicy = {
      ignoreCase: true,
      ignoreAccents: true,
      ignorePunctuationWhitespace: true,
      freeWordOrder: false,
      acceptInflectionsContractions: true,
      ...policy,
    };

    const result = this.answerValidator.validate({
      submitted,
      acceptedAnswers,
      policy: fullPolicy,
    });

    return {
      ...result,
      grammarAspect: 'conjugation',
      pronoun,
    };
  }

  /**
   * Validate any grammar aspect based on the exercise configuration.
   * 
   * @param submitted - The learner's answer
   * @param aspect - Which grammar aspect to test
   * @param grammarInfo - The grammar info
   * @param pronoun - For conjugation, which pronoun
   * @param policy - Tolerance policy
   * @returns Validation result
   */
  validate(
    submitted: string,
    aspect: 'article' | 'plural' | 'conjugation',
    grammarInfo: DutchGrammarInfo,
    pronoun?: ConjugationPronoun,
    policy: Partial<TolerancePolicy> = {}
  ): GrammarValidationResult {
    switch (aspect) {
      case 'article':
        return this.validateArticle(submitted, grammarInfo, policy);
      case 'plural':
        return this.validatePlural(submitted, grammarInfo, policy);
      case 'conjugation':
        if (!pronoun) {
          throw new Error('Pronoun is required for conjugation validation');
        }
        return this.validateConjugation(submitted, pronoun, grammarInfo, policy);
      default:
        throw new Error(`Unknown grammar aspect: ${aspect}`);
    }
  }
}

/**
 * Factory function to create a Dutch Grammar Validator.
 */
export function createDutchGrammarValidator(): DutchGrammarValidator {
  return new DutchGrammarValidator();
}
