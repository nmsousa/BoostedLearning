/** Placement-test item contract (see placement-bank.ts, generated). */

/** CEFR bands the tests cover (wider than the lessons, which stop at B2). */
export type PlacementBand = 'pre-a1' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2';

/** languageUse = grammar in context. */
export type PlacementSkill = 'languageUse' | 'reading' | 'listening' | 'vocabulary';

export interface PlacementItem {
  id: string;
  band: PlacementBand;
  skill: PlacementSkill;
  /** Instruction + text (reading items include the text). Never the audio transcript. */
  prompt: string;
  options: string[];
  /** Index of the correct option. */
  answer: number;
  /** Shown after answering. */
  explanation: string;
  /** Listening items: what to read aloud (never displayed). */
  audio?: string;
}
