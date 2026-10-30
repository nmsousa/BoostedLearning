/**
 * Catalog of Duolingo "from English" courses available on duome.eu, used to
 * populate the import dropdown so users pick a language instead of typing
 * codes. Source: https://duome.eu/vocabulary/en (rarely changes).
 *
 * `code` is duome's target-language code (used to build the skills URL);
 * `name` is the learning language's display name; `words` is an approximate
 * vocabulary size for display.
 */
export interface DuomeCourse {
  /** Base language code (the language you already know). */
  base: string;
  /** Target language code (the language you're learning). */
  code: string;
  /** Display name of the learning language. */
  name: string;
  /** Approximate word count (for display). */
  words: number;
}

export const DUOME_COURSES: DuomeCourse[] = [
  { base: 'en', code: 'ar', name: 'Arabic', words: 970 },
  { base: 'en', code: 'cs', name: 'Czech', words: 1637 },
  { base: 'en', code: 'cy', name: 'Welsh', words: 2019 },
  { base: 'en', code: 'da', name: 'Danish', words: 1524 },
  { base: 'en', code: 'de', name: 'German', words: 8015 },
  { base: 'en', code: 'dn', name: 'Dutch', words: 2564 },
  { base: 'en', code: 'el', name: 'Greek', words: 2668 },
  { base: 'en', code: 'eo', name: 'Esperanto', words: 2018 },
  { base: 'en', code: 'es', name: 'Spanish', words: 6650 },
  { base: 'en', code: 'fi', name: 'Finnish', words: 658 },
  { base: 'en', code: 'fr', name: 'French', words: 6482 },
  { base: 'en', code: 'ga', name: 'Irish', words: 1529 },
  { base: 'en', code: 'gd', name: 'Scottish Gaelic', words: 2552 },
  { base: 'en', code: 'he', name: 'Hebrew', words: 2190 },
  { base: 'en', code: 'hi', name: 'Hindi', words: 617 },
  { base: 'en', code: 'ht', name: 'Haitian Creole', words: 1140 },
  { base: 'en', code: 'hu', name: 'Hungarian', words: 2490 },
  { base: 'en', code: 'hv', name: 'High Valyrian', words: 714 },
  { base: 'en', code: 'hw', name: 'Hawaiian', words: 930 },
  { base: 'en', code: 'id', name: 'Indonesian', words: 1839 },
  { base: 'en', code: 'it', name: 'Italian', words: 6578 },
  { base: 'en', code: 'ja', name: 'Japanese', words: 8415 },
  { base: 'en', code: 'kl', name: 'Klingon', words: 1057 },
  { base: 'en', code: 'ko', name: 'Korean', words: 6281 },
  { base: 'en', code: 'la', name: 'Latin', words: 458 },
  { base: 'en', code: 'nb', name: 'Norwegian (Bokmål)', words: 4703 },
  { base: 'en', code: 'nv', name: 'Navajo', words: 134 },
  { base: 'en', code: 'pl', name: 'Polish', words: 1670 },
  { base: 'en', code: 'pt', name: 'Portuguese', words: 6450 },
  { base: 'en', code: 'ro', name: 'Romanian', words: 2252 },
  { base: 'en', code: 'ru', name: 'Russian', words: 2176 },
  { base: 'en', code: 'sv', name: 'Swedish', words: 2249 },
  { base: 'en', code: 'sw', name: 'Swahili', words: 1149 },
  { base: 'en', code: 'tr', name: 'Turkish', words: 1258 },
  { base: 'en', code: 'uk', name: 'Ukrainian', words: 989 },
  { base: 'en', code: 'vi', name: 'Vietnamese', words: 1643 },
  { base: 'en', code: 'yi', name: 'Yiddish', words: 1834 },
  { base: 'en', code: 'zs', name: 'Chinese', words: 6118 },
  { base: 'en', code: 'zu', name: 'Zulu', words: 740 },
];
