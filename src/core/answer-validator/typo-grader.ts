/**
 * Typo grader (Duolingo-style "close enough" acceptance).
 *
 * Decides whether a typed answer should be ACCEPTED despite not being a perfect
 * match, and if so why. The rules (documented in docs/LEVEL-ALGORITHM.md §9) are
 * deliberately simple and language-agnostic:
 *
 *  - A "typo" is AT MOST ONE letter wrong, measured PER WORD and summed over the
 *    whole answer (so the whole answer may contain a single typo). Per word, any
 *    one of these counts as the single allowed edit:
 *      • one extra letter          (gath → gaath)
 *      • one missing letter        (gath → gth)
 *      • one changed letter        (gath → cath)
 *      • two ADJACENT letters swapped (gath → gaht)
 *  - Word boundaries are respected: the two answers must have the SAME number of
 *    words. Joining two words, splitting one, an extra word, or a missing word
 *    (even a one-letter word) is an ERROR, not a typo.
 *  - Apostrophes count as word separators: "i'r" is two words, "ir" is one, so
 *    they don't align → wrong.
 *  - Accents are ignored for the edit count, BUT if everything else is perfect
 *    and only accents differ, the result is 'accent' (accepted, "mind the
 *    accents"). If there is also a letter edit, it's still just 'typo'.
 *  - A "letter" is a plain character (English notion); no digraph special-casing.
 *
 * Pure + framework-free so it can be unit-tested and reused.
 *
 * @module core/answer-validator
 */

/** Outcome of grading a submission against ONE expected answer. */
export type TypoGrade =
  | 'exact'   // identical (ignoring case / surrounding punctuation), accents incl.
  | 'accent'  // identical except for diacritics
  | 'typo'    // within the single-typo allowance above
  | 'wrong';  // too different to accept

/** Strip diacritics and lowercase; keep the raw letters/apostrophes/spaces. */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalise for tokenisation: lowercase, drop sentence punctuation, turn
 * apostrophes AND whitespace into a single space separator, collapse/trim.
 * Apostrophes become separators ON PURPOSE (see module docs).
 */
function normalize(s: string, { keepAccents }: { keepAccents: boolean }): string {
  let r = (s ?? '').toLowerCase();
  if (!keepAccents) r = stripAccents(r);
  return r
    // apostrophes (straight + smart) → space (word separator)
    .replace(/['\u2018\u2019]/g, ' ')
    // drop sentence punctuation
    .replace(/[?!.,;:«»"“”¿¡]/g, '')
    // hyphens/dashes → space
    .replace(/[\u2014\u2013-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(s: string, keepAccents: boolean): string[] {
  const n = normalize(s, { keepAccents });
  return n.length ? n.split(' ') : [];
}

/**
 * Minimum edits (Damerau–Levenshtein with adjacent transposition) between two
 * words, but we only ever care whether it is 0, 1, or ">1", so we early-out.
 * Returns the distance capped at 2.
 */
function wordEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  // Optimal String Alignment distance (handles one adjacent swap as 1).
  const al = a.length, bl = b.length;
  if (Math.abs(al - bl) > 1) return 2; // can't be a single-letter typo
  const d: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // adjacent transposition
      }
    }
  }
  return Math.min(2, d[al][bl]);
}

/**
 * Grade `submitted` against a single `expected` answer.
 * See the module docs / TypoGrade for the meaning of each result.
 */
export function gradeAgainst(submitted: string, expected: string): TypoGrade {
  // Accent-sensitive exact check first (ignoring case + surrounding punctuation).
  const subAcc = words(submitted, true);
  const expAcc = words(expected, true);
  if (subAcc.length > 0 && subAcc.join(' ') === expAcc.join(' ')) return 'exact';

  // Accent-insensitive word lists for the typo count.
  const sub = words(submitted, false);
  const exp = words(expected, false);

  // Word count MUST match (apostrophes already split words).
  if (sub.length === 0 || sub.length !== exp.length) return 'wrong';

  // Sum single-letter edits across aligned words; allow at most ONE in total.
  let totalEdits = 0;
  for (let i = 0; i < exp.length; i++) {
    const dist = wordEditDistance(sub[i], exp[i]);
    if (dist >= 2) return 'wrong';       // a word is more than one letter off
    totalEdits += dist;
    if (totalEdits > 1) return 'wrong';  // more than one typo overall
  }

  if (totalEdits === 1) return 'typo';

  // Zero letter edits but we didn't hit the accent-sensitive exact match above,
  // so the ONLY difference is accents.
  return 'accent';
}

/**
 * Grade `submitted` against MANY accepted answers, returning the best outcome
 * and which answer it matched. Preference order: exact > accent > typo > wrong.
 */
export function gradeAnswer(
  submitted: string,
  accepted: string[],
): { grade: TypoGrade; matched: string } {
  const rank: Record<TypoGrade, number> = { exact: 3, accent: 2, typo: 1, wrong: 0 };
  let best: { grade: TypoGrade; matched: string } = { grade: 'wrong', matched: accepted[0] ?? '' };
  for (const a of accepted) {
    const g = gradeAgainst(submitted, a);
    if (rank[g] > rank[best.grade]) best = { grade: g, matched: a };
    if (g === 'exact') break;
  }
  return best;
}
