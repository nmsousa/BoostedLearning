/**
 * Tree curriculum — French Core Vocabulary + thematic progression.
 *
 * Implements the curriculum brief in
 * mockups/Boostionary_French_Core_Vocabulary_Curriculum_for_Kiro.md:
 *  - SIX Core tiers (Pre-A1/A1 → B1/B2), each the "sentence-evolution" step
 *    (L1 = subject+verb … L6 = subordinate clauses + connectors + nuance);
 *  - thematic branches (Travel, Food, Health, …) with their own tiers;
 *  - the Core words per tier are taken from the brief; each theme has ~10
 *    topic words at L1 (more tiers to be authored later).
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
  /** English meaning(s). */
  en: string;
  /** Optional grammatical note shown to English speakers. */
  note?: string;
}

/** A Core tier: a reusable grammar/vocabulary toolkit step. */
export interface CoreTierDef {
  tier: number;                 // 1..6
  id: string;                   // "fr-core-1"
  cefr: string;                 // "Pre-A1 / A1"
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

/** Config: tiers + the distinct-themes-per-tier threshold (brief §6.1). */
export const TREE_CONFIG = {
  coreTiers: 6,
  /** Distinct theme milestones at tier N needed to unlock Core tier N+1. */
  themesToAdvance: 3,
};

// ───────────────────────────────────────────────────────────────────────────
// CORE TIERS — words taken from the curriculum brief (§4). Only L1 is fully
// authored/playable for now; L2–L6 list their target words from the brief but
// are marked authored:false until their lessons + review are done.
// ───────────────────────────────────────────────────────────────────────────

export const CORE_TIERS: CoreTierDef[] = [
  {
    tier: 1, id: 'fr-core-1', cefr: 'Pre-A1 / A1',
    title: 'The basic sentence',
    outcome: 'Subject + verb: say who you are and what you do.',
    example: 'Je suis étudiant. / J’aime le café.',
    authored: true,
    words: [
      // Subject pronouns
      { fr: 'je / j’', en: 'I', note: 'j’ before a vowel or mute h' },
      { fr: 'tu', en: 'you (informal)' },
      { fr: 'il', en: 'he / it (m.)' },
      { fr: 'elle', en: 'she / it (f.)' },
      { fr: 'on', en: 'we / one / people', note: 'very common spoken “we”' },
      { fr: 'nous', en: 'we' },
      { fr: 'vous', en: 'you (plural / polite)' },
      { fr: 'ils', en: 'they (m. / mixed)' },
      { fr: 'elles', en: 'they (f.)' },
      // Articles
      { fr: 'le / la / l’ / les', en: 'the', note: 'definite articles' },
      { fr: 'un / une / des', en: 'a / an / some', note: 'indefinite articles' },
      // Foundational verbs (lemma + key use)
      { fr: 'être', en: 'to be', note: 'je suis, tu es, il/elle est…' },
      { fr: 'avoir', en: 'to have', note: 'j’ai, tu as, il/elle a…' },
      { fr: 's’appeler', en: 'to be called', note: 'je m’appelle…' },
      { fr: 'habiter', en: 'to live / reside', note: 'j’habite à…' },
      { fr: 'aimer', en: 'to like / love', note: 'j’aime…, je n’aime pas…' },
      { fr: 'parler', en: 'to speak', note: 'je parle français' },
      { fr: 'aller', en: 'to go', note: 'je vais à…' },
      { fr: 'faire', en: 'to do / make', note: 'je fais…; il fait…' },
      { fr: 'vouloir', en: 'to want', note: 'je veux…' },
      { fr: 'pouvoir', en: 'can / to be able', note: 'je peux…' },
      // Possessives / determiners
      { fr: 'mon / ma / mes', en: 'my' },
      { fr: 'ton / ta / tes', en: 'your (informal)' },
      { fr: 'son / sa / ses', en: 'his / her / its', note: 'agrees with the noun, not the owner' },
      { fr: 'ce / cet / cette / ces', en: 'this / that / these' },
      // Sentence glue
      { fr: 'et', en: 'and' },
      { fr: 'ou', en: 'or' },
      { fr: 'mais', en: 'but' },
      { fr: 'avec', en: 'with' },
      { fr: 'sans', en: 'without' },
      { fr: 'à', en: 'to / at / in', note: 'context-dependent' },
      { fr: 'de / d’', en: 'of / from', note: 'context-dependent' },
      { fr: 'dans', en: 'in / inside' },
      { fr: 'sur', en: 'on' },
      { fr: 'ici', en: 'here' },
      { fr: 'là', en: 'there' },
      { fr: 'oui', en: 'yes' },
      { fr: 'non', en: 'no' },
      { fr: 'ne… pas', en: 'not', note: 'a paired construction around the verb' },
      // Question words
      { fr: 'qui', en: 'who' },
      { fr: 'qu’est-ce que', en: 'what' },
      { fr: 'où', en: 'where' },
      { fr: 'quand', en: 'when' },
      { fr: 'comment', en: 'how' },
      { fr: 'pourquoi', en: 'why' },
      { fr: 'combien', en: 'how much / many' },
      { fr: 'quel / quelle', en: 'which / what', note: 'agrees with the noun' },
      { fr: 'est-ce que', en: '(question marker)' },
      // Core adjectives
      { fr: 'bon / bonne', en: 'good' },
      { fr: 'mauvais / mauvaise', en: 'bad' },
      { fr: 'grand / grande', en: 'big / tall' },
      { fr: 'petit / petite', en: 'small' },
      { fr: 'nouveau / nouvelle', en: 'new' },
      { fr: 'content / contente', en: 'happy / glad' },
      { fr: 'français / française', en: 'French' },
      // Adverbs / expressions
      { fr: 'très', en: 'very' },
      { fr: 'bien', en: 'well' },
      { fr: 'aussi', en: 'also / too' },
      { fr: 'beaucoup', en: 'a lot' },
      { fr: 'un peu', en: 'a little' },
      { fr: 'maintenant', en: 'now' },
      { fr: 'aujourd’hui', en: 'today' },
      { fr: 'c’est', en: 'it is / this is' },
      { fr: 'il y a', en: 'there is / there are' },
    ],
  },
  {
    tier: 2, id: 'fr-core-2', cefr: 'A1 / A2',
    title: 'Expand, describe, ask, locate',
    outcome: 'Add objects, questions, negation, quantity and place.',
    example: 'Je voudrais un café. / Je ne mange jamais ici.',
    authored: false,
    words: [
      { fr: 'prendre', en: 'to take' }, { fr: 'venir', en: 'to come' },
      { fr: 'partir', en: 'to leave' }, { fr: 'acheter', en: 'to buy' },
      { fr: 'manger', en: 'to eat' }, { fr: 'boire', en: 'to drink' },
      { fr: 'devoir', en: 'must / to have to' }, { fr: 'préférer', en: 'to prefer' },
      { fr: 'du / de la / des', en: 'some (partitive)' }, { fr: 'au / aux', en: 'to the / at the' },
      { fr: 'parce que', en: 'because' }, { fr: 'donc', en: 'so / therefore' },
      { fr: 'souvent', en: 'often' }, { fr: 'ne… jamais', en: 'never' },
      { fr: 'je voudrais', en: 'I would like' }, { fr: 'il faut', en: 'it is necessary' },
    ],
  },
  {
    tier: 3, id: 'fr-core-3', cefr: 'A2',
    title: 'Time, experience and plans',
    outcome: 'Talk about the past, routines and near-future plans.',
    example: 'Hier, j’ai travaillé. / Je vais visiter Paris.',
    authored: false,
    words: [
      { fr: 'passé composé', en: '(past tense with avoir/être)' },
      { fr: 'futur proche', en: '(aller + infinitive)' },
      { fr: 'venir de', en: 'to have just (done)' },
      { fr: 'se lever', en: 'to get up' }, { fr: 'hier', en: 'yesterday' },
      { fr: 'demain', en: 'tomorrow' }, { fr: 'd’abord', en: 'first' },
      { fr: 'ensuite', en: 'then / next' }, { fr: 'enfin', en: 'finally' },
      { fr: 'depuis', en: 'since / for' },
    ],
  },
  {
    tier: 4, id: 'fr-core-4', cefr: 'A2 / B1',
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
    tier: 5, id: 'fr-core-5', cefr: 'B1',
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
    tier: 6, id: 'fr-core-6', cefr: 'B1 / B2',
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

// ───────────────────────────────────────────────────────────────────────────
// THEME TIERS — ~10 L1 topic words per theme (brief §5.2). Higher tiers to be
// authored later; L1 is the playable milestone for each theme.
// ───────────────────────────────────────────────────────────────────────────

export const THEME_DEFS: ThemeDef2[] = [
  {
    id: 'food', nameKey: 'tree.theme.food', emoji: '🍽️', hue: 140,
    tiers: [[
      { fr: 'le café', en: 'coffee' }, { fr: 'le thé', en: 'tea' },
      { fr: 'l’eau (f.)', en: 'water' }, { fr: 'le pain', en: 'bread' },
      { fr: 'la pomme', en: 'apple' }, { fr: 'le fromage', en: 'cheese' },
      { fr: 'le repas', en: 'meal' }, { fr: 'le restaurant', en: 'restaurant' },
      { fr: 'manger', en: 'to eat' }, { fr: 'boire', en: 'to drink' },
    ]],
  },
  {
    id: 'travel', nameKey: 'tree.theme.travel', emoji: '✈️', hue: 350,
    tiers: [[
      { fr: 'la gare', en: 'train station' }, { fr: 'l’aéroport (m.)', en: 'airport' },
      { fr: 'le train', en: 'train' }, { fr: 'le billet', en: 'ticket' },
      { fr: 'l’hôtel (m.)', en: 'hotel' }, { fr: 'la valise', en: 'suitcase' },
      { fr: 'le voyage', en: 'trip / journey' }, { fr: 'la route', en: 'road / way' },
      { fr: 'voyager', en: 'to travel' }, { fr: 'partir', en: 'to leave / depart' },
    ]],
  },
  {
    id: 'relationships', nameKey: 'tree.theme.relationships', emoji: '❤️', hue: 275,
    tiers: [[
      { fr: 'la famille', en: 'family' }, { fr: 'l’ami (m.)', en: 'friend (m.)' },
      { fr: 'l’amie (f.)', en: 'friend (f.)' }, { fr: 'la mère', en: 'mother' },
      { fr: 'le père', en: 'father' }, { fr: 'le frère', en: 'brother' },
      { fr: 'la sœur', en: 'sister' }, { fr: 'l’enfant', en: 'child' },
      { fr: 'aimer', en: 'to love / like' }, { fr: 'rencontrer', en: 'to meet' },
    ]],
  },
  {
    id: 'home', nameKey: 'tree.theme.home', emoji: '🏠', hue: 190,
    tiers: [[
      { fr: 'la maison', en: 'house' }, { fr: 'l’appartement (m.)', en: 'apartment' },
      { fr: 'la chambre', en: 'bedroom' }, { fr: 'la cuisine', en: 'kitchen' },
      { fr: 'la table', en: 'table' }, { fr: 'la chaise', en: 'chair' },
      { fr: 'le lit', en: 'bed' }, { fr: 'la porte', en: 'door' },
      { fr: 'la fenêtre', en: 'window' }, { fr: 'habiter', en: 'to live (somewhere)' },
    ]],
  },
  {
    id: 'health', nameKey: 'tree.theme.health', emoji: '🩺', hue: 165,
    tiers: [[
      { fr: 'le médecin', en: 'doctor' }, { fr: 'la santé', en: 'health' },
      { fr: 'la tête', en: 'head' }, { fr: 'le ventre', en: 'stomach / belly' },
      { fr: 'la douleur', en: 'pain' }, { fr: 'le médicament', en: 'medicine' },
      { fr: 'la pharmacie', en: 'pharmacy' }, { fr: 'malade', en: 'sick / ill' },
      { fr: 'avoir mal à', en: 'to have pain in' }, { fr: 'se sentir', en: 'to feel' },
    ]],
  },
  {
    id: 'education', nameKey: 'tree.theme.education', emoji: '🎓', hue: 215,
    tiers: [[
      { fr: 'l’école (f.)', en: 'school' }, { fr: 'le cours', en: 'class / course' },
      { fr: 'le professeur', en: 'teacher' }, { fr: 'l’étudiant (m.)', en: 'student' },
      { fr: 'le livre', en: 'book' }, { fr: 'l’examen (m.)', en: 'exam' },
      { fr: 'la leçon', en: 'lesson' }, { fr: 'la question', en: 'question' },
      { fr: 'étudier', en: 'to study' }, { fr: 'apprendre', en: 'to learn' },
    ]],
  },
  {
    id: 'work', nameKey: 'tree.theme.work', emoji: '💼', hue: 255,
    tiers: [[
      { fr: 'le travail', en: 'work / job' }, { fr: 'le bureau', en: 'office / desk' },
      { fr: 'le collègue', en: 'colleague' }, { fr: 'la réunion', en: 'meeting' },
      { fr: 'le patron', en: 'boss' }, { fr: 'l’entreprise (f.)', en: 'company' },
      { fr: 'le projet', en: 'project' }, { fr: 'l’argent (m.)', en: 'money' },
      { fr: 'travailler', en: 'to work' }, { fr: 'gagner', en: 'to earn / win' },
    ]],
  },
  {
    id: 'shopping', nameKey: 'tree.theme.shopping', emoji: '🛍️', hue: 30,
    tiers: [[
      { fr: 'le magasin', en: 'shop / store' }, { fr: 'le prix', en: 'price' },
      { fr: 'les vêtements (m.)', en: 'clothes' }, { fr: 'la chemise', en: 'shirt' },
      { fr: 'le pantalon', en: 'trousers' }, { fr: 'la chaussure', en: 'shoe' },
      { fr: 'la taille', en: 'size' }, { fr: 'la carte', en: 'card' },
      { fr: 'acheter', en: 'to buy' }, { fr: 'payer', en: 'to pay' },
    ]],
  },
  {
    id: 'culture', nameKey: 'tree.theme.culture', emoji: '🎭', hue: 50,
    tiers: [[
      { fr: 'la musique', en: 'music' }, { fr: 'le film', en: 'film / movie' },
      { fr: 'le livre', en: 'book' }, { fr: 'le concert', en: 'concert' },
      { fr: 'le théâtre', en: 'theatre' }, { fr: 'l’art (m.)', en: 'art' },
      { fr: 'le musée', en: 'museum' }, { fr: 'la fête', en: 'party / festival' },
      { fr: 'écouter', en: 'to listen' }, { fr: 'regarder', en: 'to watch' },
    ]],
  },
  {
    id: 'nature', nameKey: 'tree.theme.nature', emoji: '🌳', hue: 100,
    tiers: [[
      { fr: 'la nature', en: 'nature' }, { fr: 'l’arbre (m.)', en: 'tree' },
      { fr: 'la fleur', en: 'flower' }, { fr: 'l’animal (m.)', en: 'animal' },
      { fr: 'le chien', en: 'dog' }, { fr: 'le chat', en: 'cat' },
      { fr: 'le temps', en: 'weather / time' }, { fr: 'la pluie', en: 'rain' },
      { fr: 'le soleil', en: 'sun' }, { fr: 'il fait', en: 'it is (weather)' },
    ]],
  },
  {
    id: 'science', nameKey: 'tree.theme.science', emoji: '🔬', hue: 85,
    tiers: [[
      { fr: 'l’ordinateur (m.)', en: 'computer' }, { fr: 'le téléphone', en: 'phone' },
      { fr: 'l’écran (m.)', en: 'screen' }, { fr: 'internet (m.)', en: 'internet' },
      { fr: 'l’application (f.)', en: 'app' }, { fr: 'le message', en: 'message' },
      { fr: 'la science', en: 'science' }, { fr: 'la technologie', en: 'technology' },
      { fr: 'utiliser', en: 'to use' }, { fr: 'envoyer', en: 'to send' },
    ]],
  },
];
