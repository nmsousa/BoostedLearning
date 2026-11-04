/**
 * Phrase Builder (French)
 *
 * Generates simple "build the sentence" exercises for the Journey Builder node
 * from the raw deck vocabulary — NO hand-authored phrase list. Given the words
 * of the current chapter (plus earlier chapters for review), it:
 *   1. classifies each single-word card into a grammatical bucket using French
 *      closed-class lists + light heuristics on the English translation, then
 *   2. assembles a few short, mostly-correct phrases, each required to use at
 *      least one word from the CURRENT chapter.
 *
 * The goal is a working game motor, not 100% grammatical perfection. Phrases
 * are deliberately simple (article/possessive + noun, pronoun + verb [+ noun]).
 * Correctness can be refined later; this module is pure and framework-agnostic
 * so it can be unit-tested and tuned in isolation.
 *
 * @module core/phrase-builder
 */

/** A word available to the builder, with its grammatical bucket. */
export interface BuilderToken {
  /** The French surface form, e.g. "mère". */
  text: string;
  /** Best English translation (for display / debugging). */
  translation: string;
  category: WordCategory;
  /** Grammatical gender for nouns, when known ('m' | 'f'); undefined otherwise. */
  gender?: 'm' | 'f';
  /** True if this word belongs to the CURRENT chapter (vs an earlier one). */
  fromCurrentChapter: boolean;
}

export type WordCategory =
  | 'article'
  | 'possessive'
  | 'pronoun'
  | 'noun'
  | 'verbPhrase'   // an already-inflected verb phrase, e.g. "je voudrais"
  | 'adjective'
  | 'connector'    // et, mais, ou, aussi…
  | 'expression'   // bonjour, merci, oui… (standalone)
  | 'other';

/** A generated phrase exercise: the correct ordered tokens + an English gloss. */
export interface GeneratedPhrase {
  /** Ordered French tokens the user must assemble. */
  tokens: string[];
  /** The full French sentence (tokens joined), for audio + the "done" screen. */
  target: string;
  /** A rough English gloss for the prompt. */
  en: string;
  /**
   * Index into `tokens` of the "key" word (the content word the phrase is built
   * around — a current-chapter noun/verb). The Blanks mode blanks this token
   * and asks the user to choose it from options. Undefined if not identified.
   */
  blankIndex?: number;
  /** Grammatical category of the blanked token, for picking plausible options. */
  blankCategory?: WordCategory;
}

/** A raw card the generator consumes (subset of the app's Flashcard). */
export interface SourceCard {
  text: string;
  translations: string[];
}

// ── French closed-class word lists ──────────────────────────────────────────

const ARTICLES = new Set(['le', 'la', 'les', 'un', 'une', 'des', "l'", 'du', 'de la']);
const POSSESSIVES = new Set([
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
]);
const PRONOUNS = new Set(['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles']);
const CONNECTORS = new Set(['et', 'mais', 'ou', 'aussi', 'donc', 'car', 'puis', 'alors']);
/** Standalone expressions that don't combine into our simple templates. */
const EXPRESSIONS = new Set([
  'bonjour', 'bonsoir', 'salut', 'au revoir', 'merci', 'oui', 'non', 'madame',
  'monsieur', 'mademoiselle', "s'il vous plaît", "s'il te plaît", 'pardon',
  'enchanté', 'enchantée', 'à bientôt', 'de rien', 'bienvenue',
]);

/** Masculine/feminine hints from the noun's article when the card carries one. */
const MASC_ARTICLES = new Set(['le', 'un', 'du']);
const FEM_ARTICLES = new Set(['la', 'une', 'de la']);

// ── Classification ───────────────────────────────────────────────────────────

/** Normalize for list lookups (lowercase, trim). Keeps apostrophes/accents. */
function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Classify one French card into a grammatical bucket. Uses the closed-class
 * lists first (reliable), then light heuristics on the English translation for
 * open classes (noun/verb/adjective). Multi-word French entries that aren't a
 * known expression are treated as a verb phrase when their translation looks
 * verbal, else 'other'.
 */
export function classifyCard(card: SourceCard): { category: WordCategory; gender?: 'm' | 'f' } {
  const text = norm(card.text);
  const en = norm(card.translations?.[0] ?? '');

  if (ARTICLES.has(text)) return { category: 'article' };
  if (POSSESSIVES.has(text)) return { category: 'possessive' };
  if (PRONOUNS.has(text)) return { category: 'pronoun' };
  if (CONNECTORS.has(text)) return { category: 'connector' };
  if (EXPRESSIONS.has(text)) return { category: 'expression' };

  const words = text.split(/\s+/);
  const multiWord = words.length > 1;

  // A leading article in the card text marks a noun and gives its gender.
  const lead = words[0];
  if (multiWord && (MASC_ARTICLES.has(lead) || FEM_ARTICLES.has(lead))) {
    return { category: 'noun', gender: MASC_ARTICLES.has(lead) ? 'm' : 'f' };
  }

  // Verb phrases: the French is multi-word AND the English looks verbal
  // (starts with "to ", "I ", "he ", "she ", "you ", or is a known pattern).
  if (multiWord && /^(to |i |he |she |you |we |they |i'd|i'm|i am|it's)/.test(en)) {
    return { category: 'verbPhrase' };
  }

  // Single French word whose English starts with "to " → a verb (infinitive).
  if (!multiWord && en.startsWith('to ')) return { category: 'verbPhrase' };

  // Adjective heuristic: common adjective translations (short, descriptive).
  if (!multiWord && ADJECTIVE_EN.has(en)) return { category: 'adjective' };

  // Noun heuristic: single French word, English is a plain noun (no leading
  // "to "/pronoun, not in other buckets). Gender unknown here.
  if (!multiWord && en && !/^(to |i |he |she |you |we |they )/.test(en)) {
    return { category: 'noun' };
  }

  return { category: 'other' };
}

/** A small set of frequent adjective English glosses for the heuristic. */
const ADJECTIVE_EN = new Set([
  'big', 'small', 'good', 'bad', 'hot', 'cold', 'new', 'old', 'happy', 'sad',
  'beautiful', 'pretty', 'ugly', 'tall', 'short', 'long', 'tasty', 'nice',
  'red', 'blue', 'green', 'yellow', 'black', 'white', 'tired', 'hungry',
]);

/**
 * Build BuilderTokens from current-chapter + earlier cards. De-duplicates by
 * surface form (first occurrence wins) and tags each with its chapter origin.
 */
export function buildTokens(current: SourceCard[], earlier: SourceCard[]): BuilderToken[] {
  const seen = new Set<string>();
  const out: BuilderToken[] = [];
  const add = (card: SourceCard, fromCurrent: boolean) => {
    const key = norm(card.text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const { category, gender } = classifyCard(card);
    out.push({
      text: card.text.trim(),
      translation: card.translations?.[0] ?? card.text,
      category,
      gender,
      fromCurrentChapter: fromCurrent,
    });
  };
  for (const c of current) add(c, true);
  for (const c of earlier) add(c, false);
  return out;
}

// ── Phrase generation ────────────────────────────────────────────────────────

/**
 * Generate up to `max` simple phrases from the tokens. Each phrase MUST include
 * at least one current-chapter word. Templates (in rough priority order):
 *   - possessive + noun       → "ma mère"
 *   - article + noun          → "la mère" / "un café"
 *   - article + noun + adj    → "un bon café"
 *   - verbPhrase + article + noun → "je voudrais un café"
 * Only templates whose required pieces are available are emitted. Nouns are
 * preferred from the current chapter so the chapter's words are exercised.
 */
export function generatePhrases(tokens: BuilderToken[], max = 6): GeneratedPhrase[] {
  const by = (c: WordCategory) => tokens.filter(t => t.category === c);
  const nouns = by('noun');
  const articles = by('article');
  const possessives = by('possessive');
  const adjectives = by('adjective');
  const verbs = by('verbPhrase');

  // Prefer current-chapter nouns; fall back to any noun so templates can fire.
  const currentNouns = nouns.filter(n => n.fromCurrentChapter);
  const nounPool = currentNouns.length ? currentNouns : nouns;

  const phrases: GeneratedPhrase[] = [];
  const pushed = new Set<string>();
  // `blankIndex`/`blankCategory` mark the content word to blank for the Blanks
  // mode (the noun or verb the phrase is built around).
  const emit = (toks: string[], en: string, blankIndex?: number, blankCategory?: WordCategory) => {
    const target = toks.join(' ');
    if (pushed.has(target) || toks.some(t => !t)) return;
    pushed.add(target);
    phrases.push({ tokens: toks, target, en, blankIndex, blankCategory });
  };

  const article = (gender?: 'm' | 'f') =>
    articles.find(a => (gender === 'f' ? FEM_ARTICLES : MASC_ARTICLES).has(norm(a.text)))
    ?? articles.find(a => norm(a.text) === 'le' || norm(a.text) === 'la')
    ?? articles[0];

  for (const noun of nounPool) {
    if (phrases.length >= max) break;

    // possessive + noun  (blank the noun, index 1)
    const poss = possessives.find(p => matchesGender(p.text, noun.gender));
    if (poss) emit([poss.text, noun.text], `${englishPoss(poss.text)} ${noun.translation}`, 1, 'noun');

    // article + noun  (blank the noun, index 1)
    const art = article(noun.gender);
    if (art && phrases.length < max) {
      emit([art.text, noun.text], `the/a ${noun.translation}`, 1, 'noun');
    }

    // article + noun + adjective  (blank the noun, index 1)
    if (art && adjectives.length && phrases.length < max) {
      const adj = adjectives[0];
      emit([art.text, noun.text, adj.text], `a ${adj.translation} ${noun.translation}`, 1, 'noun');
    }

    // verbPhrase + article + noun  (e.g. "je voudrais un café") — blank the
    // verb (index 0), a different, often harder target than the noun.
    const verb = verbs.find(v => v.fromCurrentChapter) ?? verbs[0];
    if (verb && art && phrases.length < max) {
      emit([verb.text, art.text, noun.text], `${verb.translation} ${noun.translation}`, 0, 'verbPhrase');
    }
  }

  return phrases.slice(0, max);
}

function matchesGender(possessive: string, gender?: 'm' | 'f'): boolean {
  const p = norm(possessive);
  if (gender === 'f') return ['ma', 'ta', 'sa', 'notre', 'votre', 'leur'].includes(p);
  if (gender === 'm') return ['mon', 'ton', 'son', 'notre', 'votre', 'leur'].includes(p);
  // Unknown gender: accept the common ones.
  return ['mon', 'ma', 'ton', 'ta', 'son', 'sa'].includes(p);
}

function englishPoss(possessive: string): string {
  const p = norm(possessive);
  if (['mon', 'ma', 'mes'].includes(p)) return 'my';
  if (['ton', 'ta', 'tes'].includes(p)) return 'your';
  if (['son', 'sa', 'ses'].includes(p)) return 'his/her';
  if (['notre', 'nos'].includes(p)) return 'our';
  if (['votre', 'vos'].includes(p)) return 'your';
  return 'their';
}
