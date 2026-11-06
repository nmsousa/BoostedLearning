/**
 * Phrase Builder (French + Dutch)
 *
 * Generates simple "build the sentence" / fill-in-the-blank exercises for the
 * Journey Builder node and the Blanks mode from the raw deck vocabulary — NO
 * hand-authored phrase list. Given the words of the current chapter (plus
 * earlier chapters for review), it:
 *   1. classifies each single-word card into a grammatical bucket using the
 *      target language's closed-class lists + light heuristics on the English
 *      translation, then
 *   2. assembles a few short, mostly-correct phrases, each required to use at
 *      least one word from the CURRENT chapter.
 *
 * The goal is a working game motor, not 100% grammatical perfection. Phrases
 * are deliberately simple (article/possessive + noun, pronoun + verb [+ noun]).
 * Correctness can be refined later; this module is pure and framework-agnostic
 * so it can be unit-tested and tuned in isolation.
 *
 * Multilingual: pass `lang` ('fr' | 'nl'). It defaults to 'fr' so the original
 * French callers/tests keep their behaviour unchanged.
 *
 * @module core/phrase-builder
 */

/** Languages the builder knows closed-class vocabulary for. */
export type BuilderLang = 'fr' | 'nl';

/** A word available to the builder, with its grammatical bucket. */
export interface BuilderToken {
  /** The target-language surface form, e.g. "mère" / "hond". */
  text: string;
  /** Best English translation (for display / debugging). */
  translation: string;
  category: WordCategory;
  /**
   * Grammatical gender for French nouns, when known ('m' | 'f'). Dutch uses
   * de/het rather than m/f, so it stays undefined there (article choice is
   * handled by a de/het lookup instead).
   */
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
  /** Ordered target-language tokens the user must assemble. */
  tokens: string[];
  /** The full sentence (tokens joined), for audio + the "done" screen. */
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

// ── Per-language closed-class word lists ─────────────────────────────────────

interface LangLists {
  articles: Set<string>;
  possessives: Set<string>;
  pronouns: Set<string>;
  connectors: Set<string>;
  expressions: Set<string>;
  /** Articles that mark a masculine noun when they lead the card text (FR). */
  mascArticles: Set<string>;
  /** Articles that mark a feminine noun when they lead the card text (FR). */
  femArticles: Set<string>;
}

// French —————————————————————————————————————————————————————————————————————
const FR: LangLists = {
  articles: new Set(['le', 'la', 'les', 'un', 'une', 'des', "l'", 'du', 'de la']),
  possessives: new Set([
    'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
    'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  ]),
  pronouns: new Set(['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles']),
  connectors: new Set(['et', 'mais', 'ou', 'aussi', 'donc', 'car', 'puis', 'alors']),
  expressions: new Set([
    'bonjour', 'bonsoir', 'salut', 'au revoir', 'merci', 'oui', 'non', 'madame',
    'monsieur', 'mademoiselle', "s'il vous plaît", "s'il te plaît", 'pardon',
    'enchanté', 'enchantée', 'à bientôt', 'de rien', 'bienvenue',
  ]),
  mascArticles: new Set(['le', 'un', 'du']),
  femArticles: new Set(['la', 'une', 'de la']),
};

// Dutch ———————————————————————————————————————————————————————————————————————
// Dutch nouns take "de" (common gender) or "het" (neuter); there's no m/f, so
// the article is chosen from a de/het lookup rather than inferred from the card.
const NL: LangLists = {
  // "het" is treated as an ARTICLE here (not a pronoun): the neuter definite
  // article is what the noun templates need, and "het" as an object pronoun is
  // rare at this level. "je"/"zijn"/"haar" double as possessives; we list them
  // as pronouns and rely on dedicated possessives ("mijn" etc.) for that slot.
  articles: new Set(['de', 'het', 'een']),
  possessives: new Set(['mijn', 'jouw', 'zijn', 'haar', 'ons', 'onze', 'jullie', 'hun', 'uw']),
  pronouns: new Set(['ik', 'jij', 'je', 'hij', 'zij', 'ze', 'wij', 'we', 'jullie', 'u']),
  connectors: new Set(['en', 'maar', 'of', 'ook', 'dus', 'want', 'dan']),
  expressions: new Set([
    'hallo', 'hoi', 'dag', 'doei', 'tot ziens', 'dank je', 'dank u', 'bedankt',
    'ja', 'nee', 'alstublieft', 'alsjeblieft', 'sorry', 'pardon', 'graag gedaan',
    'welkom', 'tot straks', 'mevrouw', 'meneer',
  ]),
  mascArticles: new Set(),
  femArticles: new Set(),
};

const LISTS: Record<BuilderLang, LangLists> = { fr: FR, nl: NL };

/**
 * de/het for the Dutch nouns we're likely to see in the A1 deck. Anything not
 * listed falls back to "de" (the more common article), which keeps phrases
 * readable even when the exact article is unknown.
 */
const NL_HET_NOUNS = new Set([
  'kind', 'huis', 'brood', 'water', 'boek', 'bier', 'glas', 'meisje', 'jongen',
  'ei', 'kopje', 'bed', 'raam', 'bord', 'mes', 'land', 'jaar', 'uur', 'geld',
  'werk', 'feest', 'lied', 'woord', 'gezin', 'dorp', 'station', 'vliegtuig',
  'kantoor', 'ziekenhuis', 'museum', 'restaurant', 'hotel', 'weer', 'spel',
]);

// ── Classification ───────────────────────────────────────────────────────────

/** Normalize for list lookups (lowercase, trim). Keeps apostrophes/accents. */
function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Classify one card into a grammatical bucket. Uses the target language's
 * closed-class lists first (reliable), then light heuristics on the English
 * translation for open classes (noun/verb/adjective). Multi-word entries that
 * aren't a known expression are treated as a verb phrase when their translation
 * looks verbal, else a noun (FR, via a leading article) or 'other'.
 */
export function classifyCard(
  card: SourceCard,
  lang: BuilderLang = 'fr',
): { category: WordCategory; gender?: 'm' | 'f' } {
  const L = LISTS[lang];
  const text = norm(card.text);
  const en = norm(card.translations?.[0] ?? '');

  // Closed classes first. For Dutch, some forms are both a pronoun and a
  // possessive (je, zijn, haar): classify as pronoun — the generator prefers
  // dedicated possessives for the possessive slot anyway.
  if (L.pronouns.has(text)) return { category: 'pronoun' };
  if (L.articles.has(text)) return { category: 'article' };
  if (L.possessives.has(text)) return { category: 'possessive' };
  if (L.connectors.has(text)) return { category: 'connector' };
  if (L.expressions.has(text)) return { category: 'expression' };

  const words = text.split(/\s+/);
  const multiWord = words.length > 1;

  // FR: a leading article in the card text marks a noun and gives its gender.
  const lead = words[0];
  if (multiWord && (L.mascArticles.has(lead) || L.femArticles.has(lead))) {
    return { category: 'noun', gender: L.mascArticles.has(lead) ? 'm' : 'f' };
  }

  // Verb phrases: multi-word AND the English looks verbal.
  if (multiWord && /^(to |i |he |she |you |we |they |i'd|i'm|i am|it's)/.test(en)) {
    return { category: 'verbPhrase' };
  }

  // Single word whose English starts with "to " → a verb (infinitive). The
  // Dutch generator builds noun phrases only (the deck stores bare infinitives
  // that can't be conjugated reliably), so we don't try to detect Dutch verbs
  // from their gloss — that only risks stealing nouns from the phrase pool.
  if (!multiWord && en.startsWith('to ')) return { category: 'verbPhrase' };

  // Adjective heuristic: common adjective translations (short, descriptive).
  if (!multiWord && ADJECTIVE_EN.has(en)) return { category: 'adjective' };

  // Noun heuristic: single word, English is a plain noun (no leading
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
  'dark', 'light', 'colorful', 'colourful', 'warm', 'expensive', 'cheap',
]);

/**
 * Build BuilderTokens from current-chapter + earlier cards. De-duplicates by
 * surface form (first occurrence wins) and tags each with its chapter origin.
 */
export function buildTokens(
  current: SourceCard[],
  earlier: SourceCard[],
  lang: BuilderLang = 'fr',
): BuilderToken[] {
  const seen = new Set<string>();
  const out: BuilderToken[] = [];
  const add = (card: SourceCard, fromCurrent: boolean) => {
    const key = norm(card.text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const { category, gender } = classifyCard(card, lang);
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
 *   - possessive + noun        → "ma mère" / "mijn hond"
 *   - article + noun           → "la mère" / "de hond" / "het huis"
 *   - article + noun + adj      → "un bon café"  (FR; NL puts the adjective
 *                                 before the noun, handled below)
 *   - pronoun + verb [+ noun]   → "ik eet brood"  (NL)
 *   - verbPhrase + article + noun → "je voudrais un café"  (FR)
 * Only templates whose required pieces are available are emitted. Nouns are
 * preferred from the current chapter so the chapter's words are exercised.
 */
export function generatePhrases(
  tokens: BuilderToken[],
  max = 6,
  lang: BuilderLang = 'fr',
): GeneratedPhrase[] {
  return lang === 'nl'
    ? generateDutch(tokens, max)
    : generateFrench(tokens, max);
}

// French generator (unchanged behaviour) —————————————————————————————————————
function generateFrench(tokens: BuilderToken[], max: number): GeneratedPhrase[] {
  const by = (c: WordCategory) => tokens.filter(t => t.category === c);
  const nouns = by('noun');
  const articles = by('article');
  const possessives = by('possessive');
  const adjectives = by('adjective');
  const verbs = by('verbPhrase');

  const currentNouns = nouns.filter(n => n.fromCurrentChapter);
  const nounPool = currentNouns.length ? currentNouns : nouns;

  const phrases: GeneratedPhrase[] = [];
  const pushed = new Set<string>();
  const emit = (toks: string[], en: string, blankIndex?: number, blankCategory?: WordCategory) => {
    const target = toks.join(' ');
    if (pushed.has(target) || toks.some(t => !t)) return;
    pushed.add(target);
    phrases.push({ tokens: toks, target, en, blankIndex, blankCategory });
  };

  const article = (gender?: 'm' | 'f') =>
    articles.find(a => (gender === 'f' ? FR.femArticles : FR.mascArticles).has(norm(a.text)))
    ?? articles.find(a => norm(a.text) === 'le' || norm(a.text) === 'la')
    ?? articles[0];

  for (const noun of nounPool) {
    if (phrases.length >= max) break;

    const poss = possessives.find(p => matchesGenderFr(p.text, noun.gender));
    if (poss) emit([poss.text, noun.text], `${englishPossFr(poss.text)} ${noun.translation}`, 1, 'noun');

    const art = article(noun.gender);
    if (art && phrases.length < max) {
      emit([art.text, noun.text], `the/a ${noun.translation}`, 1, 'noun');
    }

    if (art && adjectives.length && phrases.length < max) {
      const adj = adjectives[0];
      emit([art.text, noun.text, adj.text], `a ${adj.translation} ${noun.translation}`, 1, 'noun');
    }

    const verb = verbs.find(v => v.fromCurrentChapter) ?? verbs[0];
    if (verb && art && phrases.length < max) {
      emit([verb.text, art.text, noun.text], `${verb.translation} ${noun.translation}`, 0, 'verbPhrase');
    }
  }

  return phrases.slice(0, max);
}

// Dutch generator —————————————————————————————————————————————————————————————
//
// The Dutch A1 deck stores verbs as bare infinitives (eten, kopen, lezen), so
// a "pronoun + verb" template would read ungrammatically ("ik kopen"), and
// conjugating correctly is out of scope. We therefore build only NOUN phrases,
// which are unambiguously correct for a fill-in-the-blank choice:
//   - article + noun            → "de hond" / "het huis"
//   - possessive + noun         → "mijn hond"
//   - article + adjective + noun → "de grote hond" / "een groot huis"
// Dutch puts attributive adjectives before the noun and inflects them with -e,
// except an indefinite ("een") neuter noun keeps the bare form ("een groot
// huis"). We apply that single rule so the phrases read naturally.
function generateDutch(tokens: BuilderToken[], max: number): GeneratedPhrase[] {
  const by = (c: WordCategory) => tokens.filter(t => t.category === c);
  const nouns = by('noun');
  const possessives = by('possessive');
  const adjectives = by('adjective');
  const articles = by('article');

  const currentNouns = nouns.filter(n => n.fromCurrentChapter);
  const nounPool = currentNouns.length ? currentNouns : nouns;

  const phrases: GeneratedPhrase[] = [];
  const pushed = new Set<string>();
  const emit = (toks: string[], en: string, blankIndex?: number, blankCategory?: WordCategory) => {
    const target = toks.join(' ');
    if (pushed.has(target) || toks.some(t => !t)) return;
    pushed.add(target);
    phrases.push({ tokens: toks, target, en, blankIndex, blankCategory });
  };

  const isHet = (noun: BuilderToken) => NL_HET_NOUNS.has(norm(noun.text));
  const definiteArticle = (noun: BuilderToken) => {
    const want = isHet(noun) ? 'het' : 'de';
    return articles.find(a => norm(a.text) === want)
      ?? articles.find(a => norm(a.text) === 'de' || norm(a.text) === 'het');
  };
  const indefArticle = () => articles.find(a => norm(a.text) === 'een');

  for (const noun of nounPool) {
    if (phrases.length >= max) break;

    // possessive + noun → "mijn hond" (blank the noun, index 1)
    const poss = possessives.find(p => norm(p.text) === 'mijn')
      ?? possessives.find(p => ['jouw', 'zijn', 'haar', 'onze', 'hun'].includes(norm(p.text)));
    if (poss) emit([poss.text, noun.text], `${englishPossNl(poss.text)} ${noun.translation}`, 1, 'noun');

    // definite article + noun → "de hond" / "het huis" (blank the noun)
    const defArt = definiteArticle(noun);
    if (defArt && phrases.length < max) {
      emit([defArt.text, noun.text], `the ${noun.translation}`, 1, 'noun');
    }

    // article + adjective + noun → "de grote hond" / "een groot huis"
    // (blank the noun, index 2). Prefer the definite article so the adjective
    // always inflects (-e); only "een" + het-noun stays bare.
    if (adjectives.length && phrases.length < max) {
      const adj = adjectives[0];
      const useIndef = indefArticle();
      if (defArt) {
        emit([defArt.text, inflectAdjNl(adj.text, true), noun.text],
          `the ${adj.translation} ${noun.translation}`, 2, 'noun');
      } else if (useIndef) {
        const inflected = !isHet(noun); // een + de-noun → -e; een + het-noun → bare
        emit([useIndef.text, inflectAdjNl(adj.text, inflected), noun.text],
          `a ${adj.translation} ${noun.translation}`, 2, 'noun');
      }
    }
  }

  return phrases.slice(0, max);
}

/**
 * Attributive adjective inflection for Dutch: add -e when `inflected`, applying
 * the common spelling rules so the result reads naturally:
 *   - already ends in -e → unchanged (e.g. "oude" stays);
 *   - a doubled long vowel (aa/ee/oo/uu) before the final consonant shortens to
 *     a single vowel in the open syllable: "groot" → "grote", "laat" → "late"
 *     (the digraphs oe/ie/eu/ij are NOT shortened: "goed" → "goede");
 *   - final f/s devoices to v/z: "lief" → "lieve", "vies" → "vieze";
 *   - a single short vowel before a single final consonant doubles it:
 *     "dun" → "dunne", "dik" → "dikke".
 * Anything else just takes a plain "-e".
 */
export function inflectAdjNl(adj: string, inflected: boolean): string {
  let a = adj.trim();
  if (!inflected || /e$/i.test(a)) return a;

  // Final f/s → v/z before the ending.
  if (/f$/i.test(a)) a = a.slice(0, -1) + 'v';
  else if (/s$/i.test(a)) a = a.slice(0, -1) + 'z';

  // Doubled long vowel + single consonant → single vowel (groot → grote).
  const doubled = a.match(/(aa|ee|oo|uu)([bcdfgklmnprstvz])$/i);
  if (doubled) {
    const single = doubled[1][0];
    a = a.slice(0, a.length - 3) + single + doubled[2];
    return a + 'e';
  }

  // Short vowel + single consonant → double the consonant (dun → dunne). Skip
  // digraphs/long vowels and words ending in a vowel or multiple consonants.
  const shortCVC = a.match(/[^aeiou]([aeiou])([bcdfgklmnprst])$/i);
  if (shortCVC && !/(aa|ee|oo|uu|oe|ie|eu|ij|ou|ui|au|ei)[bcdfgklmnprst]$/i.test(a)) {
    a = a + a[a.length - 1];
  }

  return a + 'e';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function matchesGenderFr(possessive: string, gender?: 'm' | 'f'): boolean {
  const p = norm(possessive);
  if (gender === 'f') return ['ma', 'ta', 'sa', 'notre', 'votre', 'leur'].includes(p);
  if (gender === 'm') return ['mon', 'ton', 'son', 'notre', 'votre', 'leur'].includes(p);
  return ['mon', 'ma', 'ton', 'ta', 'son', 'sa'].includes(p);
}

function englishPossFr(possessive: string): string {
  const p = norm(possessive);
  if (['mon', 'ma', 'mes'].includes(p)) return 'my';
  if (['ton', 'ta', 'tes'].includes(p)) return 'your';
  if (['son', 'sa', 'ses'].includes(p)) return 'his/her';
  if (['notre', 'nos'].includes(p)) return 'our';
  if (['votre', 'vos'].includes(p)) return 'your';
  return 'their';
}

function englishPossNl(possessive: string): string {
  const p = norm(possessive);
  if (p === 'mijn') return 'my';
  if (['jouw', 'je', 'uw'].includes(p)) return 'your';
  if (p === 'zijn') return 'his';
  if (p === 'haar') return 'her';
  if (['ons', 'onze'].includes(p)) return 'our';
  if (['jullie', 'hun'].includes(p)) return 'their';
  return 'their';
}


