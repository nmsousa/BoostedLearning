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
    tiers: [
      [
        { fr: 'le café', en: 'coffee' }, { fr: 'le thé', en: 'tea' },
        { fr: 'l’eau (f.)', en: 'water' }, { fr: 'le pain', en: 'bread' },
        { fr: 'la pomme', en: 'apple' }, { fr: 'le fromage', en: 'cheese' },
        { fr: 'le repas', en: 'meal' }, { fr: 'le restaurant', en: 'restaurant' },
        { fr: 'manger', en: 'to eat' }, { fr: 'boire', en: 'to drink' },
      ],
      [ // L2 — quantities, ingredients, preferences, menu, prices
        { fr: 'le menu', en: 'menu' }, { fr: 'l’addition (f.)', en: 'the bill' },
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
        { fr: 'la gare', en: 'train station' }, { fr: 'l’aéroport (m.)', en: 'airport' },
        { fr: 'le train', en: 'train' }, { fr: 'le billet', en: 'ticket' },
        { fr: 'l’hôtel (m.)', en: 'hotel' }, { fr: 'la valise', en: 'suitcase' },
        { fr: 'le voyage', en: 'trip / journey' }, { fr: 'la route', en: 'road / way' },
        { fr: 'voyager', en: 'to travel' }, { fr: 'partir', en: 'to leave / depart' },
      ],
      [ // L2 — booking, prices, times, luggage, help
        { fr: 'le vol', en: 'flight' }, { fr: 'le bagage', en: 'luggage' },
        { fr: 'la chambre', en: 'room' }, { fr: 'la clé', en: 'key' },
        { fr: 'l’horaire (m.)', en: 'timetable' }, { fr: 'le quai', en: 'platform' },
        { fr: 'le plan', en: 'map' }, { fr: 'à gauche', en: 'on the left' },
        { fr: 'à droite', en: 'on the right' }, { fr: 'tout droit', en: 'straight ahead' },
      ],
      [ // L3 — past trips, delays, experiences, future itinerary
        { fr: 'les vacances (f.)', en: 'holidays / vacation' }, { fr: 'le retard', en: 'delay' },
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
        { fr: 'la famille', en: 'family' }, { fr: 'l’ami (m.)', en: 'friend (m.)' },
        { fr: 'l’amie (f.)', en: 'friend (f.)' }, { fr: 'la mère', en: 'mother' },
        { fr: 'le père', en: 'father' }, { fr: 'le frère', en: 'brother' },
        { fr: 'la sœur', en: 'sister' }, { fr: 'l’enfant', en: 'child' },
        { fr: 'aimer', en: 'to love / like' }, { fr: 'rencontrer', en: 'to meet' },
      ],
      [ // L2 — personality, invitations, feelings, social
        { fr: 'le voisin', en: 'neighbour' }, { fr: 'le collègue', en: 'colleague' },
        { fr: 'gentil', en: 'kind / nice' }, { fr: 'sympa', en: 'friendly (informal)' },
        { fr: 'timide', en: 'shy' }, { fr: 'l’invitation (f.)', en: 'invitation' },
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
        { fr: 'la maison', en: 'house' }, { fr: 'l’appartement (m.)', en: 'apartment' },
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
        { fr: 'l’immeuble (m.)', en: 'building' }, { fr: 'l’étage (m.)', en: 'floor / storey' },
        { fr: 'déménager', en: 'to move house' }, { fr: 'louer', en: 'to rent' },
        { fr: 'réparer', en: 'to repair' }, { fr: 'construire', en: 'to build' },
        { fr: 'l’ascenseur (m.)', en: 'lift / elevator' }, { fr: 'le propriétaire', en: 'owner / landlord' },
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
        { fr: 'le rendez-vous', en: 'appointment' }, { fr: 'l’ordonnance (f.)', en: 'prescription' },
        { fr: 'la fièvre', en: 'fever' }, { fr: 'le rhume', en: 'a cold' },
        { fr: 'le dos', en: 'back' }, { fr: 'la gorge', en: 'throat' },
        { fr: 'la dent', en: 'tooth' }, { fr: 'guérir', en: 'to heal / recover' },
        { fr: 'se reposer', en: 'to rest' }, { fr: 'fatigué', en: 'tired' },
      ],
      [ // L3 — past illness/injury, symptoms over time, visits
        { fr: 'l’hôpital (m.)', en: 'hospital' }, { fr: 'l’infirmier (m.)', en: 'nurse' },
        { fr: 'la blessure', en: 'injury' }, { fr: 'l’accident (m.)', en: 'accident' },
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
        { fr: 'l’école (f.)', en: 'school' }, { fr: 'le cours', en: 'class / course' },
        { fr: 'le professeur', en: 'teacher' }, { fr: 'l’étudiant (m.)', en: 'student' },
        { fr: 'le livre', en: 'book' }, { fr: 'l’examen (m.)', en: 'exam' },
        { fr: 'la leçon', en: 'lesson' }, { fr: 'la question', en: 'question' },
        { fr: 'étudier', en: 'to study' }, { fr: 'apprendre', en: 'to learn' },
      ],
      [ // L2 — timetable, exams, skills, courses, asking for help
        { fr: 'le cahier', en: 'notebook' }, { fr: 'le stylo', en: 'pen' },
        { fr: 'la note', en: 'grade / mark' }, { fr: 'le devoir', en: 'homework' },
        { fr: 'la matière', en: 'subject' }, { fr: 'la bibliothèque', en: 'library' },
        { fr: 'expliquer', en: 'to explain' }, { fr: 'comprendre', en: 'to understand' },
        { fr: 'réviser', en: 'to revise' }, { fr: 'réussir', en: 'to succeed / pass' },
      ],
      [ // L3 — past studies, learning experiences, future goals
        { fr: 'l’université (f.)', en: 'university' }, { fr: 'le diplôme', en: 'diploma / degree' },
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
        { fr: 'le travail', en: 'work / job' }, { fr: 'le bureau', en: 'office / desk' },
        { fr: 'le collègue', en: 'colleague' }, { fr: 'la réunion', en: 'meeting' },
        { fr: 'le patron', en: 'boss' }, { fr: 'l’entreprise (f.)', en: 'company' },
        { fr: 'le projet', en: 'project' }, { fr: 'l’argent (m.)', en: 'money' },
        { fr: 'travailler', en: 'to work' }, { fr: 'gagner', en: 'to earn / win' },
      ],
      [ // L2 — schedule, responsibilities, simple requests, emails
        { fr: 'le client', en: 'client / customer' }, { fr: 'le salaire', en: 'salary' },
        { fr: 'le contrat', en: 'contract' }, { fr: 'la tâche', en: 'task' },
        { fr: 'le courriel', en: 'email' }, { fr: 'l’horaire (m.)', en: 'schedule' },
        { fr: 'envoyer', en: 'to send' }, { fr: 'organiser', en: 'to organise' },
        { fr: 'occupé', en: 'busy' }, { fr: 'ensemble', en: 'together' },
      ],
      [ // L3 — work experience, projects, achievements, future plans
        { fr: 'le métier', en: 'profession / trade' }, { fr: 'l’emploi (m.)', en: 'job / employment' },
        { fr: 'l’entretien (m.)', en: 'interview' }, { fr: 'le chômage', en: 'unemployment' },
        { fr: 'embaucher', en: 'to hire' }, { fr: 'démissionner', en: 'to resign' },
        { fr: 'diriger', en: 'to manage / lead' }, { fr: 'réussir', en: 'to succeed' },
        { fr: 'l’objectif (m.)', en: 'goal / objective' }, { fr: 'la promotion', en: 'promotion' },
      ],
    ],
  },
  {
    id: 'shopping', nameKey: 'tree.theme.shopping', emoji: '🛍️', hue: 30,
    tiers: [
      [
        { fr: 'le magasin', en: 'shop / store' }, { fr: 'le prix', en: 'price' },
        { fr: 'les vêtements (m.)', en: 'clothes' }, { fr: 'la chemise', en: 'shirt' },
        { fr: 'le pantalon', en: 'trousers' }, { fr: 'la chaussure', en: 'shoe' },
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
        { fr: 'le marché', en: 'market' }, { fr: 'les soldes (m.)', en: 'the sales' },
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
        { fr: 'le théâtre', en: 'theatre' }, { fr: 'l’art (m.)', en: 'art' },
        { fr: 'le musée', en: 'museum' }, { fr: 'la fête', en: 'party / festival' },
        { fr: 'écouter', en: 'to listen' }, { fr: 'regarder', en: 'to watch' },
      ],
      [ // L2 — describe a work/event, make plans and recommendations
        { fr: 'la chanson', en: 'song' }, { fr: 'l’acteur (m.)', en: 'actor' },
        { fr: 'le roman', en: 'novel' }, { fr: 'le billet', en: 'ticket' },
        { fr: 'la scène', en: 'stage / scene' }, { fr: 'le spectacle', en: 'show' },
        { fr: 'jouer', en: 'to play / act' }, { fr: 'chanter', en: 'to sing' },
        { fr: 'danser', en: 'to dance' }, { fr: 'préférer', en: 'to prefer' },
      ],
      [ // L3 — a performance/exhibition experienced, compare genres
        { fr: 'l’exposition (f.)', en: 'exhibition' }, { fr: 'le festival', en: 'festival' },
        { fr: 'l’artiste', en: 'artist' }, { fr: 'le public', en: 'audience' },
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
        { fr: 'la nature', en: 'nature' }, { fr: 'l’arbre (m.)', en: 'tree' },
        { fr: 'la fleur', en: 'flower' }, { fr: 'l’animal (m.)', en: 'animal' },
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
        { fr: 'l’oiseau (m.)', en: 'bird' }, { fr: 'la saison', en: 'season' },
        { fr: 'l’orage (m.)', en: 'storm' }, { fr: 'la température', en: 'temperature' },
        { fr: 'protéger', en: 'to protect' }, { fr: 'polluer', en: 'to pollute' },
        { fr: 'le déchet', en: 'waste / rubbish' }, { fr: 'le climat', en: 'climate' },
      ],
    ],
  },
  {
    id: 'science', nameKey: 'tree.theme.science', emoji: '🔬', hue: 85,
    tiers: [
      [
        { fr: 'l’ordinateur (m.)', en: 'computer' }, { fr: 'le téléphone', en: 'phone' },
        { fr: 'l’écran (m.)', en: 'screen' }, { fr: 'internet (m.)', en: 'internet' },
        { fr: 'l’application (f.)', en: 'app' }, { fr: 'le message', en: 'message' },
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
        { fr: 'le logiciel', en: 'software' }, { fr: 'la panne', en: 'breakdown / outage' },
        { fr: 'la mise à jour', en: 'update' }, { fr: 'la données', en: 'data' },
        { fr: 'le robot', en: 'robot' }, { fr: 'l’intelligence artificielle (f.)', en: 'AI' },
        { fr: 'réparer', en: 'to fix' }, { fr: 'sauvegarder', en: 'to save / back up' },
        { fr: 'connecter', en: 'to connect' }, { fr: 'inventer', en: 'to invent' },
      ],
    ],
  },
];
