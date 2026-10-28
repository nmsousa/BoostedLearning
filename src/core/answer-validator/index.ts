/**
 * Answer Validator Module
 * 
 * Contains validators for checking user answers against expected responses:
 * - AnswerValidator: Core string comparison with tolerance policies
 * - DutchGrammarValidator: Dutch-specific grammar validation (articles, plurals, conjugations)
 * 
 * @module core/answer-validator
 */

export {
  createAnswerValidator,
  AnswerValidator,
} from './answer-validator';

// Re-export types from core/types
export { DEFAULT_TOLERANCE_POLICY, TolerancePolicy } from '../types';
export type { MatchResult } from './match-result';

export {
  createDutchGrammarValidator,
  DutchGrammarValidator,
  type GrammarValidationResult,
  type DutchGrammarInfo,
  type DutchArticle,
  type DutchConjugation,
  type ConjugationPronoun,
} from './dutch-grammar-validator';
