/**
 * Tree curriculum — French Core Vocabulary + thematic progression.
 *
 * Implements the curriculum brief in
 * mockups/Boostionary_French_Core_Vocabulary_Curriculum_for_Kiro.md, with the
 * Core split into SMALL tiers (about a dozen words each) so the learner can
 * start building phrases almost immediately:
 *  - Core 1 is the bare minimum to name things and join them
 *    ("un professeur et un élève", "c’est une école", "j’ai un livre");
 *  - each next tier adds ONE grammar idea (être/avoir, describing, plurals,
 *    places, everyday verbs, questions/negation, time, …);
 *  - thematic branches (Travel, Food, Health, …) have their own tiers; theme
 *    tier N becomes available once Core tier N is complete.
 *
 * Authoring rules (keep the Write mode fair):
 *  - the French side is exactly what the learner types: no "(m.)" notes and no
 *    "a / b" alternatives in `fr`. Grammar hints (gender, plural) go on the
 *    ENGLISH side, e.g. { fr: 'l’école', en: 'school (f.)' };
 *  - nouns are shown WITH their article; nouns starting with l’ (or plural
 *    les) carry their gender in the English note so the phrase builder can
 *    pick un/une correctly;
 *  - English prompts must be unique within a tier (the deck de-duplicates
 *    cards by English prompt inside a level).
 *
 * This is a DATA module (no Angular). The unlock engine (tree-progression.ts)
 * and the Tree page read from it. The number of tiers and the "distinct themes
 * to advance" threshold are config values here, never hard-coded in the UI.
 *
 * ⚠️ CONTENT REVIEW: the French here is authored to be grammatically careful,
 * but it has NOT been validated by a native reviewer. Per the brief it must be
 * reviewed before being treated as final/production content. It ships behind
 * the experimental Tree mode as a reviewable first draft.
 *
 * @module app/flashcards/tree
 */

/** A single vocabulary item with the minimal French metadata we need. */
export interface CoreWord {
  /** French display form (noun shown WITH its article, e.g. "la maison"). */
  fr: string;
  /** English meaning(s). Gender/plural notes live here, e.g. "school (f.)". */
  en: string;
  /** Optional grammatical note (documentation; not shown in exercises). */
  note?: string;
}

/** A Core tier: a reusable grammar/vocabulary toolkit step. */
export interface CoreTierDef {
  tier: number;                 // 1..N
  id: string;                   // "fr-core-1"
  cefr: string;                 // "Pre-A1"
  /** i18n-free short English title (the UI can wrap/translate the label). */
  title: string;
  /** The "sentence evolution" outcome for this tier. */
  outcome: string;
  /** Example sentence that this tier enables (illustrative). */
  example: string;
  words: CoreWord[];
  /** True once authored & playable; false = defined but "coming soon". */
  authored: boolean;
}

/** A theme (thematic branch). Its per-tier vocab lives in `tiers`. */
export interface ThemeDef2 {
  id: string;                   // "health"
  nameKey: string;              // tree.theme.health
  emoji: string;
  hue: number;
  /** Target vocabulary by tier (1-based). tiers[0] = L1. */
  tiers: CoreWord[][];
}

// ───────────────────────────────────────────────────────────────────────────
// CORE TIERS — small steps. Tiers 1–14 are authored; 15–17 keep the brief's
// later targets (connected discourse, nuance) as "coming soon".
// ───────────────────────────────────────────────────────────────────────────

export const CORE_TIERS: CoreTierDef[] = [
  {
    tier: 1, id: 'fr-core-1', cefr: 'Pre-A1',
    title: 'Name things',
    outcome: 'Name people and things, and join them with “and” / “or”.',
    example: 'Un professeur et un élève. / C’est une école. / J’ai un livre.',
    authored: true,
    words: [
      { fr: 'je', en: 'I', note: 'becomes j’ before a vowel (j’ai)' },
      { fr: 'un', en: 'a (m.)' },
      { fr: 'une', en: 'a (f.)' },
      { fr: 'le', en: 'the (m.)' },
      { fr: 'la', en: 'the (f.)' },
      { fr: 'l’', en: 'the (before a vowel)', note: 'l’école, l’ami' },
      { fr: 'et', en: 'and' },
      { fr: 'ou', en: 'or' },
      { fr: 'oui', en: 'yes' },
      { fr: 'non', en: 'no' },
      { fr: 'c’est', en: 'it is / this is' },
      { fr: 'j’ai', en: 'I have' },
      { fr: 'l’ami', en: 'friend (m.)' },
      { fr: 'l’amie', en: 'friend (f.)' },
    ],
  },
  {
    tier: 2, id: 'fr-core-2', cefr: 'Pre-A1',
    title: 'Be & have',
    outcome: 'Say who is where and who has what.',
    example: 'Je suis ici. / Tu as un livre, mais il a une question.',
    authored: true,
    words: [
      { fr: 'être', en: 'to be' },
      { fr: 'avoir', en: 'to have' },
      { fr: 'je suis', en: 'I am' },
      { fr: 'tu es', en: 'you are' },
      { fr: 'il est', en: 'he is / it is' },
      { fr: 'elle est', en: 'she is / it is' },
      { fr: 'tu as', en: 'you have' },
      { fr: 'il a', en: 'he has' },
      { fr: 'elle a', en: 'she has' },
      { fr: 'ici', en: 'here' },
      { fr: 'là', en: 'there' },
      { fr: 'mais', en: 'but' },
    ],
  },
  {
    tier: 3, id: 'fr-core-3', cefr: 'A1',
    title: 'Describe',
    outcome: 'Say whose it is and what it is like.',
    example: 'C’est mon livre. / Une petite maison. / Elle est très contente.',
    authored: true,
    words: [
      { fr: 'mon', en: 'my (m.)', note: 'also before a vowel: mon école' },
      { fr: 'ma', en: 'my (f.)' },
      { fr: 'ton', en: 'your (m.)', note: 'informal (tu)' },
      { fr: 'ta', en: 'your (f.)', note: 'informal (tu)' },
      { fr: 'grand', en: 'big / tall', note: 'f. grande' },
      { fr: 'petit', en: 'small / little', note: 'f. petite' },
      { fr: 'bon', en: 'good', note: 'f. bonne' },
      { fr: 'mauvais', en: 'bad', note: 'f. mauvaise' },
      { fr: 'nouveau', en: 'new', note: 'f. nouvelle; nouvel before a vowel' },
      { fr: 'content', en: 'happy / glad', note: 'f. contente' },
      { fr: 'très', en: 'very' },
      { fr: 'aussi', en: 'also / too' },
    ],
  },
  {
    tier: 4, id: 'fr-core-4', cefr: 'A1',
    title: 'More people, more things',
    outcome: 'Use plurals and every person of être / avoir.',
    example: 'Nous avons des livres. / Ils sont contents.',
    authored: true,
    words: [
      { fr: 'les', en: 'the (plural)' },
      { fr: 'des', en: 'some (plural)' },
      { fr: 'on', en: 'we / people (informal)' },
      { fr: 'nous', en: 'we' },
      { fr: 'vous', en: 'you (plural / polite)' },
      { fr: 'ils', en: 'they (m. / mixed)' },
      { fr: 'elles', en: 'they (f.)' },
      { fr: 'nous sommes', en: 'we are' },
      { fr: 'vous êtes', en: 'you are (plural / polite)' },
      { fr: 'ils sont', en: 'they are' },
      { fr: 'nous avons', en: 'we have' },
      { fr: 'vous avez', en: 'you have (plural / polite)' },
      { fr: 'ils ont', en: 'they have' },
    ],
  },
  {
    tier: 5, id: 'fr-core-5', cefr: 'A1',
    title: 'Where things are',
    outcome: 'Place people and things.',
    example: 'Le livre est sur la table. / Il y a un chat sous le lit.',
    authored: true,
    words: [
      { fr: 'dans', en: 'in / inside' },
      { fr: 'sur', en: 'on' },
      { fr: 'sous', en: 'under' },
      { fr: 'devant', en: 'in front of' },
      { fr: 'derrière', en: 'behind' },
      { fr: 'à côté de', en: 'next to' },
      { fr: 'avec', en: 'with' },
      { fr: 'sans', en: 'without' },
      { fr: 'à', en: 'to / at / in' },
      { fr: 'au', en: 'to the / at the (m.)', note: 'à + le' },
      { fr: 'à la', en: 'to the / at the (f.)' },
      { fr: 'il y a', en: 'there is / there are' },
    ],
  },
  {
    tier: 6, id: 'fr-core-6', cefr: 'A1',
    title: 'Everyday verbs',
    outcome: 'Say what you like, want, can do and where you go.',
    example: 'J’aime le café. / Je vais à la gare. / Je veux apprendre.',
    authored: true,
    words: [
      { fr: 'aimer', en: 'to like / to love' },
      { fr: 'aller', en: 'to go' },
      { fr: 'faire', en: 'to do / to make' },
      { fr: 'vouloir', en: 'to want' },
      { fr: 'pouvoir', en: 'can / to be able to' },
      { fr: 'parler', en: 'to speak / to talk' },
      { fr: 'j’aime', en: 'I like / I love' },
      { fr: 'je vais', en: 'I go / I’m going' },
      { fr: 'je fais', en: 'I do / I make' },
      { fr: 'je veux', en: 'I want' },
      { fr: 'je peux', en: 'I can' },
      { fr: 'je parle', en: 'I speak' },
    ],
  },
  {
    tier: 7, id: 'fr-core-7', cefr: 'A1',
    title: 'Ask & say no',
    outcome: 'Ask simple questions, say “not” and give a reason.',
    example: 'Où est la gare ? / Ce n’est pas un livre.',
    authored: true,
    words: [
      { fr: 'qui', en: 'who' },
      { fr: 'qu’est-ce que', en: 'what (in a question)' },
      { fr: 'où', en: 'where' },
      { fr: 'quand', en: 'when' },
      { fr: 'comment', en: 'how' },
      { fr: 'pourquoi', en: 'why' },
      { fr: 'combien', en: 'how much / how many' },
      { fr: 'quel', en: 'which / what (m.)' },
      { fr: 'quelle', en: 'which / what (f.)' },
      { fr: 'est-ce que', en: '(yes/no question marker)' },
      { fr: 'ne… pas', en: 'not', note: 'goes around the verb: je ne suis pas…' },
      { fr: 'parce que', en: 'because' },
    ],
  },
  {
    tier: 8, id: 'fr-core-8', cefr: 'A1',
    title: 'About me & when',
    outcome: 'Introduce yourself and say when things happen.',
    example: 'J’habite ici. / J’ai un examen demain.',
    authored: true,
    words: [
      { fr: 's’appeler', en: 'to be called' },
      { fr: 'je m’appelle', en: 'my name is' },
      { fr: 'habiter', en: 'to live (somewhere)' },
      { fr: 'j’habite', en: 'I live' },
      { fr: 'maintenant', en: 'now' },
      { fr: 'aujourd’hui', en: 'today' },
      { fr: 'demain', en: 'tomorrow' },
      { fr: 'hier', en: 'yesterday' },
      { fr: 'bien', en: 'well' },
      { fr: 'beaucoup', en: 'a lot / very much' },
      { fr: 'un peu', en: 'a little' },
      { fr: 'toujours', en: 'always / still' },
    ],
  },
  {
    tier: 9, id: 'fr-core-9', cefr: 'A1 / A2',
    title: 'Daily actions',
    outcome: 'Take, eat, drink, buy, come and leave.',
    example: 'Je prends le train. / Je mange une pomme.',
    authored: true,
    words: [
      { fr: 'prendre', en: 'to take' },
      { fr: 'je prends', en: 'I take / I’ll have' },
      { fr: 'manger', en: 'to eat' },
      { fr: 'je mange', en: 'I eat' },
      { fr: 'boire', en: 'to drink' },
      { fr: 'je bois', en: 'I drink' },
      { fr: 'acheter', en: 'to buy' },
      { fr: 'j’achète', en: 'I buy' },
      { fr: 'venir', en: 'to come' },
      { fr: 'je viens', en: 'I come' },
      { fr: 'partir', en: 'to leave' },
      { fr: 'je pars', en: 'I leave' },
    ],
  },
  {
    tier: 10, id: 'fr-core-10', cefr: 'A2',
    title: 'How much & how often',
    outcome: 'Talk about quantities (some, a lot of) and frequency.',
    example: 'Je bois de l’eau. / J’ai beaucoup de livres.',
    authored: true,
    words: [
      { fr: 'du', en: 'some (m.)', note: 'de + le' },
      { fr: 'de la', en: 'some (f.)' },
      { fr: 'de l’', en: 'some (before a vowel)' },
      { fr: 'beaucoup de', en: 'a lot of' },
      { fr: 'un peu de', en: 'a little (of)' },
      { fr: 'trop de', en: 'too much / too many' },
      { fr: 'assez de', en: 'enough' },
      { fr: 'souvent', en: 'often' },
      { fr: 'parfois', en: 'sometimes' },
      { fr: 'd’habitude', en: 'usually' },
      { fr: 'rarement', en: 'rarely' },
      { fr: 'combien de', en: 'how much / how many (of)' },
    ],
  },
  {
    tier: 11, id: 'fr-core-11', cefr: 'A2',
    title: 'Needs & wishes',
    outcome: 'Ask politely, say what you need, must or prefer.',
    example: 'Je voudrais un café. / J’ai besoin d’un billet.',
    authored: true,
    words: [
      { fr: 'je voudrais', en: 'I would like' },
      { fr: 'j’ai besoin de', en: 'I need' },
      { fr: 'j’ai envie de', en: 'I feel like' },
      { fr: 'il faut', en: 'you have to / it’s necessary' },
      { fr: 'devoir', en: 'must / to have to' },
      { fr: 'je dois', en: 'I must / I have to' },
      { fr: 'préférer', en: 'to prefer' },
      { fr: 'je préfère', en: 'I prefer' },
      { fr: 'donc', en: 'so / therefore' },
      { fr: 'alors', en: 'then / so' },
      { fr: 'si', en: 'if' },
      { fr: 'ça va', en: 'how’s it going? / fine' },
    ],
  },
  {
    tier: 12, id: 'fr-core-12', cefr: 'A2',
    title: 'Past & plans',
    outcome: 'Say what you did, just did, or are going to do.',
    example: 'J’ai fini le livre. / Elle est allée à la gare.',
    authored: true,
    words: [
      { fr: 'j’ai mangé', en: 'I ate / I have eaten', note: 'passé composé (avoir)' },
      { fr: 'j’ai fini', en: 'I finished / I have finished' },
      { fr: 'il est allé', en: 'he went', note: 'passé composé (être)' },
      { fr: 'elle est allée', en: 'she went' },
      { fr: 'je vais manger', en: 'I’m going to eat', note: 'futur proche' },
      { fr: 'je viens de finir', en: 'I’ve just finished', note: 'passé récent' },
      { fr: 'd’abord', en: 'first' },
      { fr: 'ensuite', en: 'then / next' },
      { fr: 'enfin', en: 'finally' },
      { fr: 'avant', en: 'before' },
      { fr: 'après', en: 'after' },
      { fr: 'pendant', en: 'during' },
    ],
  },
  {
    tier: 13, id: 'fr-core-13', cefr: 'A2',
    title: 'Routines',
    outcome: 'Describe your day with reflexive and common action verbs.',
    example: 'Je me lève. / Je dois fermer la porte.',
    authored: true,
    words: [
      { fr: 'se lever', en: 'to get up' },
      { fr: 'se réveiller', en: 'to wake up' },
      { fr: 'se coucher', en: 'to go to bed' },
      { fr: 's’habiller', en: 'to get dressed' },
      { fr: 'je me lève', en: 'I get up' },
      { fr: 'commencer', en: 'to begin / to start' },
      { fr: 'terminer', en: 'to finish / to end' },
      { fr: 'continuer', en: 'to continue' },
      { fr: 'oublier', en: 'to forget' },
      { fr: 'rencontrer', en: 'to meet' },
      { fr: 'ouvrir', en: 'to open' },
      { fr: 'fermer', en: 'to close' },
    ],
  },
  {
    tier: 14, id: 'fr-core-14', cefr: 'A2',
    title: 'Linking ideas',
    outcome: 'Replace nouns with pronouns and link sentences.',
    example: 'Je le prends. / C’est le livre que je veux.',
    authored: true,
    words: [
      { fr: 'le', en: 'him / it (object)' },
      { fr: 'la', en: 'her / it (object)' },
      { fr: 'les', en: 'them (object)' },
      { fr: 'lui', en: 'to him / to her' },
      { fr: 'qui', en: 'who / which (relative)' },
      { fr: 'que', en: 'that / which (relative)' },
      { fr: 'pourtant', en: 'yet / however' },
      { fr: 'récemment', en: 'recently' },
      { fr: 'depuis', en: 'since / for' },
      { fr: 'le souvenir', en: 'memory / souvenir' },
      { fr: 'le projet', en: 'plan / project' },
      { fr: 'l’expérience', en: 'experience (f.)' },
    ],
  },
  {
    tier: 15, id: 'fr-core-15', cefr: 'A2 / B1',
    title: 'Flexible sentences & linking ideas',
    outcome: 'Compare, explain reasons, use pronouns and conditionals.',
    example: 'C’est le meilleur choix parce qu’il est pratique.',
    authored: false,
    words: [
      { fr: 'imparfait', en: '(habitual/background past)' },
      { fr: 'plus… que', en: 'more… than' }, { fr: 'moins… que', en: 'less… than' },
      { fr: 'y', en: 'there / to it' }, { fr: 'en', en: 'some / of it' },
      { fr: 'qui / que / où', en: 'who / that / where (relative)' },
      { fr: 'cependant', en: 'however' }, { fr: 'grâce à', en: 'thanks to' },
      { fr: 'à cause de', en: 'because of' }, { fr: 'pour + inf.', en: 'in order to' },
    ],
  },
  {
    tier: 16, id: 'fr-core-16', cefr: 'B1',
    title: 'Connected discourse & opinions',
    outcome: 'Narrate, give opinions, hypothesise and justify.',
    example: 'À mon avis, cette solution est plus efficace.',
    authored: false,
    words: [
      { fr: 'à mon avis', en: 'in my opinion' }, { fr: 'je trouve que', en: 'I find that' },
      { fr: 'je pense que', en: 'I think that' }, { fr: 'bien que', en: 'although' },
      { fr: 'si + imparfait', en: '(hypothetical “if”)' }, { fr: 'en effet', en: 'indeed' },
      { fr: 'par conséquent', en: 'consequently' }, { fr: 'néanmoins', en: 'nevertheless' },
      { fr: 'croire', en: 'to believe' }, { fr: 'reconnaître', en: 'to acknowledge' },
    ],
  },
  {
    tier: 17, id: 'fr-core-17', cefr: 'B1 / B2',
    title: 'Precision, nuance & argument',
    outcome: 'Qualify claims, structure arguments, discuss abstractions.',
    example: 'Bien que cette technologie présente des avantages…',
    authored: false,
    words: [
      { fr: 'toutefois', en: 'however / nonetheless' }, { fr: 'en outre', en: 'moreover' },
      { fr: 'autrement dit', en: 'in other words' }, { fr: 'dans la mesure où', en: 'insofar as' },
      { fr: 'à condition que', en: 'provided that' }, { fr: 'souligner', en: 'to emphasise' },
      { fr: 'démontrer', en: 'to demonstrate' }, { fr: 'envisager', en: 'to consider' },
      { fr: 'un enjeu', en: 'a stake / issue' }, { fr: 'une tendance', en: 'a trend' },
    ],
  },
];

/** Config: tiers + the distinct-themes-per-tier threshold (brief §6.1). */
export const TREE_CONFIG = {
  coreTiers: CORE_TIERS.length,
  /** Distinct theme milestones at tier N needed to unlock Core tier N+1. */
  themesToAdvance: 3,
};

/**
 * Stable deck-level layout. Every Core tier and every theme tier owns a FIXED
 * level number, so adding content later (more Core tiers, theme L4+) never
 * shifts existing levels — progress is stored per level number.
 *   Core tier t           → level t                       (t = 1..coreSlots)
 *   Theme #i (0-based), t → level coreSlots + i*themeSlots + t
 * Slots without authored content are registered as a "—" placeholder level.
 */
export const TREE_LAYOUT = {
  coreSlots: 20,
  themeSlots: 20,
};

/** Deck level of a Core tier (1-based). */
export function coreLevelOf(tier: number): number {
  return tier;
}

/** Deck level of a theme tier (theme index in THEME_DEFS, tier 1-based). */
export function themeLevelOf(themeIndex: number, tier: number): number {
  return TREE_LAYOUT.coreSlots + themeIndex * TREE_LAYOUT.themeSlots + tier;
}

// ───────────────────────────────────────────────────────────────────────────
// THEME TIERS — ~10 topic words per theme tier (brief §5.2). Theme tier N is
// meant to be practised with Core tiers 1..N.
// ───────────────────────────────────────────────────────────────────────────

export const THEME_DEFS: ThemeDef2[] = [
  {
    id: 'food', nameKey: 'tree.theme.food', emoji: '🍽️', hue: 140,
    tiers: [
      [
        { fr: 'le café', en: 'coffee' }, { fr: 'le thé', en: 'tea' },
        { fr: 'l’eau', en: 'water (f.)' }, { fr: 'le pain', en: 'bread' },
        { fr: 'la pomme', en: 'apple' }, { fr: 'le fromage', en: 'cheese' },
        { fr: 'le repas', en: 'meal' }, { fr: 'le restaurant', en: 'restaurant' },
        { fr: 'manger', en: 'to eat' }, { fr: 'boire', en: 'to drink' },
      ],
      [ // L2 — quantities, ingredients, preferences, menu, prices
        { fr: 'le menu', en: 'menu' }, { fr: 'l’addition', en: 'bill (f.)' },
        { fr: 'le légume', en: 'vegetable' }, { fr: 'la viande', en: 'meat' },
        { fr: 'le poisson', en: 'fish' }, { fr: 'le dessert', en: 'dessert' },
        { fr: 'le sucre', en: 'sugar' }, { fr: 'le sel', en: 'salt' },
        { fr: 'commander', en: 'to order' }, { fr: 'coûter', en: 'to cost' },
      ],
      [ // L3 — meals, cooking routines, past restaurant experiences
        { fr: 'le petit-déjeuner', en: 'breakfast' }, { fr: 'le déjeuner', en: 'lunch' },
        { fr: 'le dîner', en: 'dinner' }, { fr: 'la recette', en: 'recipe' },
        { fr: 'cuisiner', en: 'to cook' }, { fr: 'goûter', en: 'to taste' },
        { fr: 'préparer', en: 'to prepare' }, { fr: 'délicieux', en: 'delicious' },
        { fr: 'servir', en: 'to serve' }, { fr: 'réserver', en: 'to book / reserve' },
      ],
    ],
  },
  {
    id: 'travel', nameKey: 'tree.theme.travel', emoji: '✈️', hue: 350,
    tiers: [
      [
        { fr: 'la gare', en: 'train station' }, { fr: 'l’aéroport', en: 'airport (m.)' },
        { fr: 'le train', en: 'train' }, { fr: 'le billet', en: 'ticket' },
        { fr: 'l’hôtel', en: 'hotel (m.)' }, { fr: 'la valise', en: 'suitcase' },
        { fr: 'le voyage', en: 'trip / journey' }, { fr: 'la route', en: 'road / way' },
        { fr: 'voyager', en: 'to travel' }, { fr: 'partir', en: 'to leave / depart' },
      ],
      [ // L2 — booking, prices, times, luggage, help
        { fr: 'le vol', en: 'flight' }, { fr: 'le bagage', en: 'bag / luggage' },
        { fr: 'la chambre', en: 'room' }, { fr: 'la clé', en: 'key' },
        { fr: 'l’horaire', en: 'timetable (m.)' }, { fr: 'le quai', en: 'platform' },
        { fr: 'le plan', en: 'map' }, { fr: 'à gauche', en: 'on the left' },
        { fr: 'à droite', en: 'on the right' }, { fr: 'tout droit', en: 'straight ahead' },
      ],
      [ // L3 — past trips, delays, experiences, future itinerary
        { fr: 'les vacances', en: 'holidays / vacation (f. pl.)' }, { fr: 'le retard', en: 'delay' },
        { fr: 'la frontière', en: 'border' }, { fr: 'le passeport', en: 'passport' },
        { fr: 'la douane', en: 'customs' }, { fr: 'le séjour', en: 'stay' },
        { fr: 'visiter', en: 'to visit' }, { fr: 'arriver', en: 'to arrive' },
        { fr: 'rater', en: 'to miss (a train)' }, { fr: 'découvrir', en: 'to discover' },
      ],
    ],
  },
  {
    id: 'relationships', nameKey: 'tree.theme.relationships', emoji: '❤️', hue: 275,
    tiers: [
      [
        { fr: 'la famille', en: 'family' }, { fr: 'le fils', en: 'son' },
        { fr: 'la fille', en: 'daughter' }, { fr: 'la mère', en: 'mother' },
        { fr: 'le père', en: 'father' }, { fr: 'le frère', en: 'brother' },
        { fr: 'la sœur', en: 'sister' }, { fr: 'l’enfant', en: 'child (m./f.)' },
        { fr: 'aimer', en: 'to love / like' }, { fr: 'rencontrer', en: 'to meet' },
      ],
      [ // L2 — personality, invitations, feelings, social
        { fr: 'le voisin', en: 'neighbour' }, { fr: 'le collègue', en: 'colleague' },
        { fr: 'gentil', en: 'kind / nice' }, { fr: 'sympa', en: 'friendly (informal)' },
        { fr: 'timide', en: 'shy' }, { fr: 'l’invitation', en: 'invitation (f.)' },
        { fr: 'inviter', en: 'to invite' }, { fr: 'sortir', en: 'to go out' },
        { fr: 'heureux', en: 'happy' }, { fr: 'triste', en: 'sad' },
      ],
      [ // L3 — meetings, friendships, past/future arrangements
        { fr: 'le couple', en: 'couple' }, { fr: 'le mariage', en: 'wedding / marriage' },
        { fr: 'le petit ami', en: 'boyfriend' }, { fr: 'la petite amie', en: 'girlfriend' },
        { fr: 'se marier', en: 'to get married' }, { fr: 'se disputer', en: 'to argue' },
        { fr: 'se réconcilier', en: 'to make up' }, { fr: 'le souvenir', en: 'memory' },
        { fr: 'se souvenir', en: 'to remember' }, { fr: 'promettre', en: 'to promise' },
      ],
    ],
  },
  {
    id: 'home', nameKey: 'tree.theme.home', emoji: '🏠', hue: 190,
    tiers: [
      [
        { fr: 'la maison', en: 'house' }, { fr: 'l’appartement', en: 'apartment (m.)' },
        { fr: 'la chambre', en: 'bedroom' }, { fr: 'la cuisine', en: 'kitchen' },
        { fr: 'la table', en: 'table' }, { fr: 'la chaise', en: 'chair' },
        { fr: 'le lit', en: 'bed' }, { fr: 'la porte', en: 'door' },
        { fr: 'la fenêtre', en: 'window' }, { fr: 'habiter', en: 'to live (somewhere)' },
      ],
      [ // L2 — household routines, chores, facilities, describing a place
        { fr: 'le salon', en: 'living room' }, { fr: 'la salle de bain', en: 'bathroom' },
        { fr: 'le jardin', en: 'garden' }, { fr: 'le meuble', en: 'piece of furniture' },
        { fr: 'le loyer', en: 'rent' }, { fr: 'le ménage', en: 'housework' },
        { fr: 'ranger', en: 'to tidy up' }, { fr: 'nettoyer', en: 'to clean' },
        { fr: 'confortable', en: 'comfortable' }, { fr: 'propre', en: 'clean' },
      ],
      [ // L3 — moving house, past arrangements, repairs, future plans
        { fr: 'le quartier', en: 'neighbourhood' }, { fr: 'le voisin', en: 'neighbour' },
        { fr: 'l’immeuble', en: 'building (m.)' }, { fr: 'l’étage', en: 'floor / storey (m.)' },
        { fr: 'déménager', en: 'to move house' }, { fr: 'louer', en: 'to rent' },
        { fr: 'réparer', en: 'to repair' }, { fr: 'construire', en: 'to build' },
        { fr: 'l’ascenseur', en: 'lift / elevator (m.)' }, { fr: 'le propriétaire', en: 'owner / landlord' },
      ],
    ],
  },
  {
    id: 'health', nameKey: 'tree.theme.health', emoji: '🩺', hue: 165,
    tiers: [
      [
        { fr: 'le médecin', en: 'doctor' }, { fr: 'la santé', en: 'health' },
        { fr: 'la tête', en: 'head' }, { fr: 'le ventre', en: 'stomach / belly' },
        { fr: 'la douleur', en: 'pain' }, { fr: 'le médicament', en: 'medicine' },
        { fr: 'la pharmacie', en: 'pharmacy' }, { fr: 'malade', en: 'sick / ill' },
        { fr: 'avoir mal à', en: 'to have pain in' }, { fr: 'se sentir', en: 'to feel' },
      ],
      [ // L2 — appointments, treatments, frequency, needs
        { fr: 'le rendez-vous', en: 'appointment' }, { fr: 'l’ordonnance', en: 'prescription (f.)' },
        { fr: 'la fièvre', en: 'fever' }, { fr: 'le rhume', en: 'cold (illness)' },
        { fr: 'le dos', en: 'back' }, { fr: 'la gorge', en: 'throat' },
        { fr: 'la dent', en: 'tooth' }, { fr: 'guérir', en: 'to heal / recover' },
        { fr: 'se reposer', en: 'to rest' }, { fr: 'fatigué', en: 'tired' },
      ],
      [ // L3 — past illness/injury, symptoms over time, visits
        { fr: 'l’hôpital', en: 'hospital (m.)' }, { fr: 'l’infirmier', en: 'nurse (m.)' },
        { fr: 'la blessure', en: 'injury' }, { fr: 'l’accident', en: 'accident (m.)' },
        { fr: 'tomber', en: 'to fall' }, { fr: 'se blesser', en: 'to get injured' },
        { fr: 'tousser', en: 'to cough' }, { fr: 'vacciner', en: 'to vaccinate' },
        { fr: 'grave', en: 'serious' }, { fr: 'le symptôme', en: 'symptom' },
      ],
    ],
  },
  {
    id: 'education', nameKey: 'tree.theme.education', emoji: '🎓', hue: 215,
    tiers: [
      [
        { fr: 'l’école', en: 'school (f.)' }, { fr: 'le cours', en: 'class / course' },
        { fr: 'le professeur', en: 'teacher' }, { fr: 'l’élève', en: 'pupil (m./f.)' },
        { fr: 'l’étudiant', en: 'student (m.)' }, { fr: 'le livre', en: 'book' },
        { fr: 'l’examen', en: 'exam (m.)' }, { fr: 'la leçon', en: 'lesson' },
        { fr: 'la question', en: 'question' },
        { fr: 'étudier', en: 'to study' }, { fr: 'apprendre', en: 'to learn' },
      ],
      [ // L2 — timetable, exams, skills, courses, asking for help
        { fr: 'le cahier', en: 'notebook' }, { fr: 'le stylo', en: 'pen' },
        { fr: 'la note', en: 'grade / mark' }, { fr: 'le devoir', en: 'assignment / homework' },
        { fr: 'la matière', en: 'subject' }, { fr: 'la bibliothèque', en: 'library' },
        { fr: 'expliquer', en: 'to explain' }, { fr: 'comprendre', en: 'to understand' },
        { fr: 'réviser', en: 'to revise' }, { fr: 'réussir', en: 'to succeed / pass' },
      ],
      [ // L3 — past studies, learning experiences, future goals
        { fr: 'l’université', en: 'university (f.)' }, { fr: 'le diplôme', en: 'diploma / degree' },
        { fr: 'la rentrée', en: 'back-to-school' }, { fr: 'le résultat', en: 'result' },
        { fr: 's’inscrire', en: 'to enrol' }, { fr: 'passer un examen', en: 'to take an exam' },
        { fr: 'échouer', en: 'to fail' }, { fr: 'obtenir', en: 'to obtain' },
        { fr: 'la carrière', en: 'career' }, { fr: 'le stage', en: 'internship' },
      ],
    ],
  },
  {
    id: 'work', nameKey: 'tree.theme.work', emoji: '💼', hue: 255,
    tiers: [
      [
        { fr: 'le travail', en: 'job / work' }, { fr: 'le bureau', en: 'office / desk' },
        { fr: 'le collègue', en: 'colleague' }, { fr: 'la réunion', en: 'meeting' },
        { fr: 'le patron', en: 'boss' }, { fr: 'l’entreprise', en: 'company (f.)' },
        { fr: 'le projet', en: 'project' }, { fr: 'l’argent', en: 'money (m.)' },
        { fr: 'travailler', en: 'to work' }, { fr: 'gagner', en: 'to earn / win' },
      ],
      [ // L2 — schedule, responsibilities, simple requests, emails
        { fr: 'le client', en: 'client / customer' }, { fr: 'le salaire', en: 'salary' },
        { fr: 'le contrat', en: 'contract' }, { fr: 'la tâche', en: 'task' },
        { fr: 'le courriel', en: 'email' }, { fr: 'l’horaire', en: 'schedule (m.)' },
        { fr: 'envoyer', en: 'to send' }, { fr: 'organiser', en: 'to organise' },
        { fr: 'occupé', en: 'busy' }, { fr: 'ensemble', en: 'together' },
      ],
      [ // L3 — work experience, projects, achievements, future plans
        { fr: 'le métier', en: 'profession / trade' }, { fr: 'l’emploi', en: 'job / employment (m.)' },
        { fr: 'l’entretien', en: 'interview (m.)' }, { fr: 'le chômage', en: 'unemployment' },
        { fr: 'embaucher', en: 'to hire' }, { fr: 'démissionner', en: 'to resign' },
        { fr: 'diriger', en: 'to manage / lead' }, { fr: 'réussir', en: 'to succeed' },
        { fr: 'l’objectif', en: 'goal / objective (m.)' }, { fr: 'la promotion', en: 'promotion' },
      ],
    ],
  },
  {
    id: 'shopping', nameKey: 'tree.theme.shopping', emoji: '🛍️', hue: 30,
    tiers: [
      [
        { fr: 'le magasin', en: 'shop / store' }, { fr: 'le prix', en: 'price' },
        { fr: 'les vêtements', en: 'clothes (m. pl.)' }, { fr: 'la chemise', en: 'shirt' },
        { fr: 'le pantalon', en: 'pair of trousers' }, { fr: 'la chaussure', en: 'shoe' },
        { fr: 'la taille', en: 'size' }, { fr: 'la carte', en: 'card' },
        { fr: 'acheter', en: 'to buy' }, { fr: 'payer', en: 'to pay' },
      ],
      [ // L2 — quantities, preferences, trying on, discounts
        { fr: 'la robe', en: 'dress' }, { fr: 'le manteau', en: 'coat' },
        { fr: 'la couleur', en: 'colour' }, { fr: 'la caisse', en: 'checkout / till' },
        { fr: 'la monnaie', en: 'change (money)' }, { fr: 'le reçu', en: 'receipt' },
        { fr: 'cher', en: 'expensive' }, { fr: 'bon marché', en: 'cheap' },
        { fr: 'essayer', en: 'to try on' }, { fr: 'choisir', en: 'to choose' },
      ],
      [ // L3 — past purchases, returns, comparisons, future plans
        { fr: 'le marché', en: 'market' }, { fr: 'les soldes', en: 'sales (m. pl.)' },
        { fr: 'la réduction', en: 'discount' }, { fr: 'la vitrine', en: 'shop window' },
        { fr: 'rembourser', en: 'to refund' }, { fr: 'échanger', en: 'to exchange' },
        { fr: 'dépenser', en: 'to spend' }, { fr: 'coûter cher', en: 'to be expensive' },
        { fr: 'la commande', en: 'order' }, { fr: 'livrer', en: 'to deliver' },
      ],
    ],
  },
  {
    id: 'culture', nameKey: 'tree.theme.culture', emoji: '🎭', hue: 50,
    tiers: [
      [
        { fr: 'la musique', en: 'music' }, { fr: 'le film', en: 'film / movie' },
        { fr: 'le livre', en: 'book' }, { fr: 'le concert', en: 'concert' },
        { fr: 'le théâtre', en: 'theatre' }, { fr: 'l’art', en: 'art (m.)' },
        { fr: 'le musée', en: 'museum' }, { fr: 'la fête', en: 'party / festival' },
        { fr: 'écouter', en: 'to listen' }, { fr: 'regarder', en: 'to watch' },
      ],
      [ // L2 — describe a work/event, make plans and recommendations
        { fr: 'la chanson', en: 'song' }, { fr: 'l’acteur', en: 'actor (m.)' },
        { fr: 'le roman', en: 'novel' }, { fr: 'le billet', en: 'ticket' },
        { fr: 'la scène', en: 'stage / scene' }, { fr: 'le spectacle', en: 'show' },
        { fr: 'jouer', en: 'to play / act' }, { fr: 'chanter', en: 'to sing' },
        { fr: 'danser', en: 'to dance' }, { fr: 'préférer', en: 'to prefer' },
      ],
      [ // L3 — a performance/exhibition experienced, compare genres
        { fr: 'l’exposition', en: 'exhibition (f.)' }, { fr: 'le festival', en: 'festival' },
        { fr: 'l’artiste', en: 'artist (m./f.)' }, { fr: 'le public', en: 'audience' },
        { fr: 'le tableau', en: 'painting' }, { fr: 'la critique', en: 'review' },
        { fr: 'applaudir', en: 'to applaud' }, { fr: 'assister à', en: 'to attend' },
        { fr: 'célèbre', en: 'famous' }, { fr: 'ennuyeux', en: 'boring' },
      ],
    ],
  },
  {
    id: 'nature', nameKey: 'tree.theme.nature', emoji: '🌳', hue: 100,
    tiers: [
      [
        { fr: 'la nature', en: 'nature' }, { fr: 'l’arbre', en: 'tree (m.)' },
        { fr: 'la fleur', en: 'flower' }, { fr: 'l’animal', en: 'animal (m.)' },
        { fr: 'le chien', en: 'dog' }, { fr: 'le chat', en: 'cat' },
        { fr: 'le temps', en: 'weather / time' }, { fr: 'la pluie', en: 'rain' },
        { fr: 'le soleil', en: 'sun' }, { fr: 'il fait', en: 'it is (weather)' },
      ],
      [ // L2 — weather, locations, outdoor activities, simple actions
        { fr: 'la montagne', en: 'mountain' }, { fr: 'la mer', en: 'sea' },
        { fr: 'la forêt', en: 'forest' }, { fr: 'le lac', en: 'lake' },
        { fr: 'le vent', en: 'wind' }, { fr: 'la neige', en: 'snow' },
        { fr: 'le nuage', en: 'cloud' }, { fr: 'chaud', en: 'hot' },
        { fr: 'froid', en: 'cold' }, { fr: 'se promener', en: 'to go for a walk' },
      ],
      [ // L3 — an outdoor experience, weather events, changes
        { fr: 'la rivière', en: 'river' }, { fr: 'la plage', en: 'beach' },
        { fr: 'l’oiseau', en: 'bird (m.)' }, { fr: 'la saison', en: 'season' },
        { fr: 'l’orage', en: 'storm (m.)' }, { fr: 'la température', en: 'temperature' },
        { fr: 'protéger', en: 'to protect' }, { fr: 'polluer', en: 'to pollute' },
        { fr: 'le déchet', en: 'piece of rubbish / waste' }, { fr: 'le climat', en: 'climate' },
      ],
    ],
  },
  {
    id: 'science', nameKey: 'tree.theme.science', emoji: '🔬', hue: 85,
    tiers: [
      [
        { fr: 'l’ordinateur', en: 'computer (m.)' }, { fr: 'le téléphone', en: 'phone' },
        { fr: 'l’écran', en: 'screen (m.)' }, { fr: 'internet', en: 'internet (m.)' },
        { fr: 'l’application', en: 'app (f.)' }, { fr: 'le message', en: 'message' },
        { fr: 'la science', en: 'science' }, { fr: 'la technologie', en: 'technology' },
        { fr: 'utiliser', en: 'to use' }, { fr: 'envoyer', en: 'to send' },
      ],
      [ // L2 — apps, settings, common problems, instructions
        { fr: 'le clavier', en: 'keyboard' }, { fr: 'la souris', en: 'mouse' },
        { fr: 'le fichier', en: 'file' }, { fr: 'le mot de passe', en: 'password' },
        { fr: 'le réseau', en: 'network' }, { fr: 'la batterie', en: 'battery' },
        { fr: 'télécharger', en: 'to download' }, { fr: 'cliquer', en: 'to click' },
        { fr: 'allumer', en: 'to turn on' }, { fr: 'éteindre', en: 'to turn off' },
      ],
      [ // L3 — a technical issue, past experience, planned solution
        { fr: 'le logiciel', en: 'program / software' }, { fr: 'la panne', en: 'breakdown / outage' },
        { fr: 'la mise à jour', en: 'update' }, { fr: 'les données', en: 'data (f. pl.)' },
        { fr: 'le robot', en: 'robot' }, { fr: 'l’intelligence artificielle', en: 'AI (f.)' },
        { fr: 'réparer', en: 'to fix' }, { fr: 'sauvegarder', en: 'to save / back up' },
        { fr: 'connecter', en: 'to connect' }, { fr: 'inventer', en: 'to invent' },
      ],
    ],
  },
];
