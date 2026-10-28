/**
 * Match Result Type
 * 
 * Result of matching a submitted answer against expected answers.
 * 
 * @module core/answer-validator/match-result
 */

/**
 * Result of an answer matching operation.
 */
export interface MatchResult {
  /** Whether the answer matched */
  matched: boolean;
  /** The specific answer that was matched, if any */
  matchedAnswer: string | null;
  /** Normalized form of the submission */
  normalizedSubmission: string;
  /** Similarity score (0-1) for fuzzy matching */
  similarityScore?: number;
}
