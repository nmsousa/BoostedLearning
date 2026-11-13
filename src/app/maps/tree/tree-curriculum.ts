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
 * @module app/maps/tree
 */

/** A single vocabulary item with the minimal French metadata we need. */
export interface CoreWord {
  /** French display form (noun shown WITH its article, e.g. "la maison"). */
  fr: string;
  /** English meaning(s). Gender/plural notes live here, e.g. "school (f.)". */
  en: string;
  /** Short usage/grammar note, shown in the Learn step (Core words). */
  note?: string;
  /** A representative emoji, shown in the Learn step (early theme words). */
  icon?: string;
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
      { fr: 'je', en: 'I', note: 'the subject “I”. Drops the e before a vowel sound: je + ai → j’ai.' },
      { fr: 'un', en: 'a (m.)', note: 'indefinite article for a masculine noun: un livre.' },
      { fr: 'une', en: 'a (f.)', note: 'indefinite article for a feminine noun: une pomme.' },
      { fr: 'le', en: 'the (m.)', note: '“the” before a masculine noun: le livre.' },
      { fr: 'la', en: 'the (f.)', note: '“the” before a feminine noun: la pomme.' },
      { fr: 'l’', en: 'the (before a vowel)', note: 'le/la both become l’ before a vowel or mute h: l’école, l’ami.' },
      { fr: 'et', en: 'and', note: 'joins two things: un café et un thé.' },
      { fr: 'ou', en: 'or', note: 'offers a choice: le café ou le thé ? (no accent — “où” with an accent means “where”).' },
      { fr: 'oui', en: 'yes' },
      { fr: 'non', en: 'no' },
      { fr: 'c’est', en: 'it is / this is', note: 'point something out: c’est une école. Short for “ce est”.' },
      { fr: 'j’ai', en: 'I have', note: '“I have”, from avoir. je + ai → j’ai.' },
      { fr: 'l’ami', en: 'friend (m.)', note: 'a male friend. The bare word is “ami”; with “the” it’s l’ami (a → l’).' },
      { fr: 'l’amie', en: 'friend (f.)', note: 'a female friend. Sounds the same as l’ami; the -e is only written.' },
    ],
  },
  {
    tier: 2, id: 'fr-core-2', cefr: 'Pre-A1',
    title: 'Be & have',
    outcome: 'Say who is where and who has what.',
    example: 'Je suis ici. / Tu as un livre, mais il a une question.',
    authored: true,
    words: [
      { fr: 'être', en: 'to be', note: 'the verb “to be”. Very irregular — learn its forms as set phrases: je suis, tu es, il/elle est…' },
      { fr: 'avoir', en: 'to have', note: 'the verb “to have”. Also used to build the past tense later. Forms: j’ai, tu as, il/elle a…' },
      { fr: 'je suis', en: 'I am', note: 'être with “I”: je suis ici.' },
      { fr: 'tu es', en: 'you are', note: 'être with informal “you” (one person you know): tu es là.' },
      { fr: 'il est', en: 'he is / it is', note: 'être with “he/it”. “il est” also tells the time later.' },
      { fr: 'elle est', en: 'she is / it is', note: 'être with “she/it (f.)”.' },
      { fr: 'tu as', en: 'you have', note: 'avoir with informal “you”: tu as un livre.' },
      { fr: 'il a', en: 'he has', note: 'avoir with “he/it”. The -a is silent-ish; don’t confuse with “à” (to/at).' },
      { fr: 'elle a', en: 'she has', note: 'avoir with “she/it (f.)”.' },
      { fr: 'ici', en: 'here', note: 'a place near the speaker: je suis ici.' },
      { fr: 'là', en: 'there', note: 'a place further away. Written with an accent to tell it apart from “la” (the).' },
      { fr: 'mais', en: 'but', note: 'contrasts two ideas: tu as un livre, mais j’ai un stylo.' },
    ],
  },
  {
    tier: 3, id: 'fr-core-3', cefr: 'A1',
    title: 'Describe',
    outcome: 'Say whose it is and what it is like.',
    example: 'C’est mon livre. / Une petite maison. / Elle est très contente.',
    authored: true,
    words: [
      { fr: 'mon', en: 'my (m.)', note: 'agrees with the THING owned, not the owner. Also used before any feminine noun starting with a vowel: mon école, mon amie.' },
      { fr: 'ma', en: 'my (f.)', note: 'before a feminine noun: ma mère. Becomes “mon” before a vowel sound (mon école).' },
      { fr: 'ton', en: 'your (m.)', note: 'informal “your” (tu). Also before a feminine vowel noun: ton amie.' },
      { fr: 'ta', en: 'your (f.)', note: 'informal “your” before a feminine noun: ta sœur. Becomes “ton” before a vowel.' },
      { fr: 'grand', en: 'big / tall', note: 'adjective. Feminine: grande. Usually goes BEFORE the noun: un grand livre.' },
      { fr: 'petit', en: 'small / little', note: 'feminine: petite. Goes before the noun: une petite maison.' },
      { fr: 'bon', en: 'good', note: 'feminine: bonne. Goes before the noun: un bon café.' },
      { fr: 'mauvais', en: 'bad', note: 'feminine: mauvaise (the masculine and plural look the same).' },
      { fr: 'nouveau', en: 'new', note: 'feminine: nouvelle. Before a masculine vowel noun it becomes “nouvel”: un nouvel ami.' },
      { fr: 'content', en: 'happy / glad', note: 'feminine: contente. Describes a person’s mood: elle est contente.' },
      { fr: 'très', en: 'very', note: 'strengthens an adjective or adverb: très grand, très bien.' },
      { fr: 'aussi', en: 'also / too', note: '“too / as well”, usually at the end: j’ai un chien aussi.' },
    ],
  },
  {
    tier: 4, id: 'fr-core-4', cefr: 'A1',
    title: 'More people, more things',
    outcome: 'Use plurals and every person of être / avoir.',
    example: 'Nous avons des livres. / Ils sont contents.',
    authored: true,
    words: [
      { fr: 'les', en: 'the (plural)', note: '“the” for plural nouns of either gender: les livres, les écoles.' },
      { fr: 'des', en: 'some (plural)', note: 'plural of un/une — “some”: des livres. English often drops it (“I have books”).' },
      { fr: 'on', en: 'we / people (informal)', note: 'very common spoken “we”. Takes the SAME verb form as il/elle: on a, on est.' },
      { fr: 'nous', en: 'we', note: 'the formal/written “we”: nous sommes, nous avons.' },
      { fr: 'vous', en: 'you (plural / polite)', note: 'for several people, or one person politely.' },
      { fr: 'ils', en: 'they (m. / mixed)', note: 'use for all-male OR a mixed group.' },
      { fr: 'elles', en: 'they (f.)', note: 'use only when every person/thing is feminine.' },
      { fr: 'nous sommes', en: 'we are', note: 'être with “we”.' },
      { fr: 'vous êtes', en: 'you are (plural / polite)', note: 'être with vous. Liaison: sounds like “vou-z-êtes”.' },
      { fr: 'ils sont', en: 'they are', note: 'être with ils/elles. Don’t confuse with “ils ont” (they have).' },
      { fr: 'nous avons', en: 'we have', note: 'avoir with “we”.' },
      { fr: 'vous avez', en: 'you have (plural / polite)', note: 'avoir with vous.' },
      { fr: 'ils ont', en: 'they have', note: 'avoir with ils/elles. “ils ont” = have, “ils sont” = are — listen for the liaison “ils-z-ont”.' },
    ],
  },
  {
    tier: 5, id: 'fr-core-5', cefr: 'A1',
    title: 'Where things are',
    outcome: 'Place people and things.',
    example: 'Le livre est sur la table. / Il y a un chat sous le lit.',
    authored: true,
    words: [
      { fr: 'dans', en: 'in / inside', note: 'inside something: dans la maison.' },
      { fr: 'sur', en: 'on', note: 'on top of a surface: sur la table.' },
      { fr: 'sous', en: 'under', note: 'underneath: sous le lit.' },
      { fr: 'devant', en: 'in front of', note: 'devant la porte.' },
      { fr: 'derrière', en: 'behind', note: 'derrière la maison.' },
      { fr: 'à côté de', en: 'next to', note: 'the “de” contracts: à côté du restaurant, à côté de la gare.' },
      { fr: 'avec', en: 'with', note: 'together with: avec un ami.' },
      { fr: 'sans', en: 'without', note: 'the opposite of avec: un café sans sucre.' },
      { fr: 'à', en: 'to / at / in', note: 'direction or location. Before “le/les” it MUST contract → au / aux.' },
      { fr: 'au', en: 'to the / at the (m.)', note: 'à + le = au: je vais au restaurant. (Never say “à le”.)' },
      { fr: 'à la', en: 'to the / at the (f.)', note: 'à does NOT contract with la or l’: à la gare, à l’école.' },
      { fr: 'il y a', en: 'there is / there are', note: 'fixed phrase for “there is/are”, singular or plural: il y a un chat.' },
    ],
  },
  {
    tier: 6, id: 'fr-core-6', cefr: 'A1',
    title: 'Everyday verbs',
    outcome: 'Say what you like, want, can do and where you go.',
    example: 'J’aime le café. / Je vais à la gare. / Je veux apprendre.',
    authored: true,
    words: [
      { fr: 'aimer', en: 'to like / to love', note: 'the infinitive (dictionary form). With a general noun use “the”: j’aime le café = I like coffee.' },
      { fr: 'aller', en: 'to go', note: 'irregular. Also builds the near future: je vais + verb = “I’m going to…”.' },
      { fr: 'faire', en: 'to do / to make', note: 'very common; also used for weather and activities: je fais du sport.' },
      { fr: 'vouloir', en: 'to want', note: 'to want. For a polite “I’d like”, use “je voudrais” (Core 11).' },
      { fr: 'pouvoir', en: 'can / to be able to', note: 'followed by another verb in the infinitive: je peux parler.' },
      { fr: 'parler', en: 'to speak / to talk', note: 'regular -er verb — a good model for conjugation: je parle, tu parles…' },
      { fr: 'j’aime', en: 'I like / I love', note: 'aimer with “I”. je + aime → j’aime.' },
      { fr: 'je vais', en: 'I go / I’m going', note: 'aller with “I”. je vais à la gare; je vais manger = I’m going to eat.' },
      { fr: 'je fais', en: 'I do / I make', note: 'faire with “I”: je fais mes devoirs.' },
      { fr: 'je veux', en: 'I want', note: 'direct. Softer: je voudrais (Core 11).' },
      { fr: 'je peux', en: 'I can', note: 'add an infinitive: je peux venir.' },
      { fr: 'je parle', en: 'I speak', note: 'je parle français; je parle un peu.' },
    ],
  },
  {
    tier: 7, id: 'fr-core-7', cefr: 'A1',
    title: 'Ask & say no',
    outcome: 'Ask simple questions, say “not” and give a reason.',
    example: 'Où est la gare ? / Ce n’est pas un livre.',
    authored: true,
    words: [
      { fr: 'qui', en: 'who', note: 'asks about a person: qui est-ce ?' },
      { fr: 'qu’est-ce que', en: 'what (in a question)', note: 'ready-made “what” at the start of a question: qu’est-ce que c’est ?' },
      { fr: 'où', en: 'where', note: 'asks about a place: où est la gare ? (accented “où”, not “ou” = or).' },
      { fr: 'quand', en: 'when', note: 'asks about time: quand est le cours ?' },
      { fr: 'comment', en: 'how', note: 'also “what?” when you didn’t hear, and in comment ça va ?' },
      { fr: 'pourquoi', en: 'why', note: 'answer it with “parce que…”.' },
      { fr: 'combien', en: 'how much / how many', note: 'for an amount. With a noun: combien de livres ? (Core 10).' },
      { fr: 'quel', en: 'which / what (m.)', note: 'goes with a masculine noun: quel livre ?' },
      { fr: 'quelle', en: 'which / what (f.)', note: 'feminine form (sounds the same): quelle école ?' },
      { fr: 'est-ce que', en: '(yes/no question marker)', note: 'put it in front of a statement to make a yes/no question: est-ce que tu as un livre ?' },
      { fr: 'ne… pas', en: 'not', note: 'wraps the verb: je ne suis pas ici. “ne” becomes n’ before a vowel: ce n’est pas…' },
      { fr: 'parce que', en: 'because', note: 'gives a reason. Before il/elle it elides: parce qu’il…' },
    ],
  },
  {
    tier: 8, id: 'fr-core-8', cefr: 'A1',
    title: 'About me & when',
    outcome: 'Introduce yourself and say when things happen.',
    example: 'J’habite ici. / J’ai un examen demain.',
    authored: true,
    words: [
      { fr: 's’appeler', en: 'to be called', note: 'a reflexive verb (literally “to call oneself”). Used to give names.' },
      { fr: 'je m’appelle', en: 'my name is', note: 'literally “I call myself”: je m’appelle André.' },
      { fr: 'habiter', en: 'to live (somewhere)', note: 'regular -er verb. Use with à + place: j’habite à Paris.' },
      { fr: 'j’habite', en: 'I live', note: 'the h is silent, so je → j’: j’habite ici.' },
      { fr: 'maintenant', en: 'now', note: 'at this moment: je suis ici maintenant.' },
      { fr: 'aujourd’hui', en: 'today', note: 'one word with an apostrophe inside; don’t add spaces.' },
      { fr: 'demain', en: 'tomorrow', note: 'the day after today: j’ai un examen demain.' },
      { fr: 'hier', en: 'yesterday', note: 'the day before today; used with the past tense.' },
      { fr: 'bien', en: 'well', note: 'describes HOW (an adverb): je vais bien = I’m doing well.' },
      { fr: 'beaucoup', en: 'a lot / very much', note: 'j’aime beaucoup le café. With a noun add “de”: beaucoup de livres (Core 10).' },
      { fr: 'un peu', en: 'a little', note: 'a small amount: je parle un peu.' },
      { fr: 'toujours', en: 'always / still', note: 'can mean “always” or “still”, depending on context.' },
    ],
  },
  {
    tier: 9, id: 'fr-core-9', cefr: 'A1 / A2',
    title: 'Daily actions',
    outcome: 'Take, eat, drink, buy, come and leave.',
    example: 'Je prends le train. / Je mange une pomme.',
    authored: true,
    words: [
      { fr: 'prendre', en: 'to take', note: 'irregular. Also “to have” food/drink: je prends un café.' },
      { fr: 'je prends', en: 'I take / I’ll have', note: 'je prends le train; je prends un café.' },
      { fr: 'manger', en: 'to eat', note: 'regular -er verb: je mange, tu manges…' },
      { fr: 'je mange', en: 'I eat', note: 'je mange une pomme.' },
      { fr: 'boire', en: 'to drink', note: 'irregular: je bois, tu bois…' },
      { fr: 'je bois', en: 'I drink', note: 'je bois de l’eau.' },
      { fr: 'acheter', en: 'to buy', note: 'note the accent change: j’achète (è) in the “I” form.' },
      { fr: 'j’achète', en: 'I buy', note: 'j’achète un billet.' },
      { fr: 'venir', en: 'to come', note: 'irregular. “venir de” + verb means “to have just…” (Core 12).' },
      { fr: 'je viens', en: 'I come', note: 'je viens avec un ami.' },
      { fr: 'partir', en: 'to leave', note: 'to leave/depart (go away), vs sortir (go out).' },
      { fr: 'je pars', en: 'I leave', note: 'je pars maintenant.' },
    ],
  },
  {
    tier: 10, id: 'fr-core-10', cefr: 'A2',
    title: 'How much & how often',
    outcome: 'Talk about quantities (some, a lot of) and frequency.',
    example: 'Je bois de l’eau. / J’ai beaucoup de livres.',
    authored: true,
    words: [
      { fr: 'du', en: 'some (m.)', note: 'partitive = an unspecified amount. de + le = du: je bois du café.' },
      { fr: 'de la', en: 'some (f.)', note: 'partitive before a feminine noun: de la viande. (de + la does NOT contract.)' },
      { fr: 'de l’', en: 'some (before a vowel)', note: 'partitive before a vowel: de l’eau.' },
      { fr: 'beaucoup de', en: 'a lot of', note: 'quantity words take plain “de” (never du/des): beaucoup de livres.' },
      { fr: 'un peu de', en: 'a little (of)', note: 'for uncountable things: un peu de sucre.' },
      { fr: 'trop de', en: 'too much / too many', note: 'always “de”: trop de travail.' },
      { fr: 'assez de', en: 'enough', note: 'assez de temps = enough time.' },
      { fr: 'souvent', en: 'often', note: 'frequency adverb, usually after the verb: je prends souvent le train.' },
      { fr: 'parfois', en: 'sometimes', note: 'occasionally.' },
      { fr: 'd’habitude', en: 'usually', note: 'often starts the sentence: d’habitude, je mange ici.' },
      { fr: 'rarement', en: 'rarely', note: 'not very often.' },
      { fr: 'combien de', en: 'how much / how many (of)', note: 'combien + de + noun: combien de livres ?' },
    ],
  },
  {
    tier: 11, id: 'fr-core-11', cefr: 'A2',
    title: 'Needs & wishes',
    outcome: 'Ask politely, say what you need, must or prefer.',
    example: 'Je voudrais un café. / J’ai besoin d’un billet.',
    authored: true,
    words: [
      { fr: 'je voudrais', en: 'I would like', note: 'the polite way to ask for something (softer than “je veux”): je voudrais un café.' },
      { fr: 'j’ai besoin de', en: 'I need', note: 'literally “I have need of”. Followed by de + noun/verb: j’ai besoin d’un billet.' },
      { fr: 'j’ai envie de', en: 'I feel like', note: 'to feel like / want: j’ai envie d’un café; j’ai envie de partir.' },
      { fr: 'il faut', en: 'you have to / it’s necessary', note: 'impersonal “one must”. Add an infinitive: il faut partir.' },
      { fr: 'devoir', en: 'must / to have to', note: 'obligation. Followed by an infinitive: je dois travailler.' },
      { fr: 'je dois', en: 'I must / I have to', note: 'devoir with “I”: je dois partir.' },
      { fr: 'préférer', en: 'to prefer', note: 'accents flip in the “I” form: je préfère.' },
      { fr: 'je préfère', en: 'I prefer', note: 'je préfère le thé.' },
      { fr: 'donc', en: 'so / therefore', note: 'states a result: je pense, donc je suis.' },
      { fr: 'alors', en: 'then / so', note: 'links ideas in speech, like English “so…”.' },
      { fr: 'si', en: 'if', note: 'introduces a condition. Becomes s’ before il/ils: s’il…' },
      { fr: 'ça va', en: 'how’s it going? / fine', note: 'both a question and an answer: “Ça va ?” / “Ça va.”' },
    ],
  },
  {
    tier: 12, id: 'fr-core-12', cefr: 'A2',
    title: 'Past & plans',
    outcome: 'Say what you did, just did, or are going to do.',
    example: 'J’ai fini le livre. / Elle est allée à la gare.',
    authored: true,
    words: [
      { fr: 'j’ai mangé', en: 'I ate / I have eaten', note: 'past tense (passé composé): avoir + past participle. Most verbs use avoir.' },
      { fr: 'j’ai fini', en: 'I finished / I have finished', note: 'past of finir. -ir verbs end the participle in -i.' },
      { fr: 'il est allé', en: 'he went', note: 'a few movement verbs use ÊTRE in the past, and the ending agrees with the subject.' },
      { fr: 'elle est allée', en: 'she went', note: 'feminine subject → add -e to the participle: allé → allée (sounds the same).' },
      { fr: 'je vais manger', en: 'I’m going to eat', note: 'near future: je vais + infinitive = “I’m going to…”.' },
      { fr: 'je viens de finir', en: 'I’ve just finished', note: 'recent past: venir de + infinitive = “to have just…”.' },
      { fr: 'd’abord', en: 'first', note: 'orders steps: d’abord…, ensuite…, enfin…' },
      { fr: 'ensuite', en: 'then / next', note: 'the next step after d’abord.' },
      { fr: 'enfin', en: 'finally', note: 'the last step in a sequence.' },
      { fr: 'avant', en: 'before', note: 'earlier in time. “avant de” + infinitive = before doing.' },
      { fr: 'après', en: 'after', note: 'later in time: après le dîner.' },
      { fr: 'pendant', en: 'during', note: 'for a stretch of time: pendant le cours.' },
    ],
  },
  {
    tier: 13, id: 'fr-core-13', cefr: 'A2',
    title: 'Routines',
    outcome: 'Describe your day with reflexive and common action verbs.',
    example: 'Je me lève. / Je dois fermer la porte.',
    authored: true,
    words: [
      { fr: 'se lever', en: 'to get up', note: 'reflexive: the action is on yourself. The “se” changes with the subject: je ME lève.' },
      { fr: 'se réveiller', en: 'to wake up', note: 'reflexive. Wake up (réveiller) vs get out of bed (se lever).' },
      { fr: 'se coucher', en: 'to go to bed', note: 'reflexive: je me couche.' },
      { fr: 's’habiller', en: 'to get dressed', note: 'reflexive; se → s’ before the vowel: je m’habille.' },
      { fr: 'je me lève', en: 'I get up', note: 'se lever with “I”: the “se” becomes “me”.' },
      { fr: 'commencer', en: 'to begin / to start', note: '“commencer à” + infinitive = start doing.' },
      { fr: 'terminer', en: 'to finish / to end', note: 'close in meaning to finir.' },
      { fr: 'continuer', en: 'to continue', note: '“continuer à” + infinitive = keep doing.' },
      { fr: 'oublier', en: 'to forget', note: 'regular -er verb: j’oublie.' },
      { fr: 'rencontrer', en: 'to meet', note: 'to meet someone (by chance or for the first time).' },
      { fr: 'ouvrir', en: 'to open', note: 'irregular: its “I” form is j’ouvre (like an -er verb).' },
      { fr: 'fermer', en: 'to close', note: 'the opposite of ouvrir: je ferme la porte.' },
    ],
  },
  {
    tier: 14, id: 'fr-core-14', cefr: 'A2',
    title: 'Linking ideas',
    outcome: 'Replace nouns with pronouns and link sentences.',
    example: 'Je le prends. / C’est le livre que je veux.',
    authored: true,
    words: [
      { fr: 'le', en: 'him / it (object)', note: 'object pronoun, placed BEFORE the verb: je le prends. (Different from the article “le”.)' },
      { fr: 'la', en: 'her / it (object)', note: 'object pronoun before the verb: je la vois. Becomes l’ before a vowel.' },
      { fr: 'les', en: 'them (object)', note: 'plural object pronoun before the verb: je les prends.' },
      { fr: 'lui', en: 'to him / to her', note: 'means “to him/her”. Used with verbs like parler: je lui parle.' },
      { fr: 'qui', en: 'who / which (relative)', note: 'links clauses as the SUBJECT: le livre qui est sur la table.' },
      { fr: 'que', en: 'that / which (relative)', note: 'links clauses as the OBJECT: le livre que je veux. Becomes qu’ before a vowel.' },
      { fr: 'pourtant', en: 'yet / however', note: 'signals a contrast / something surprising.' },
      { fr: 'récemment', en: 'recently', note: 'in the near past.' },
      { fr: 'depuis', en: 'since / for', note: 'how long something has been going on: j’habite ici depuis 2020.' },
      { fr: 'le souvenir', en: 'memory / souvenir', note: 'a masculine noun: un bon souvenir.' },
      { fr: 'le projet', en: 'plan / project', note: 'masculine noun: un nouveau projet.' },
      { fr: 'l’expérience', en: 'experience (f.)', note: 'feminine noun (the article hides the gender): une bonne expérience.' },
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

/**
 * Lazily-built index of every authored word (Core + themes) by its French
 * text, so the Learn step can look up a word's grammar note / emoji from the
 * deck card's text without threading the curriculum through the deck.
 */
let WORD_INDEX: Map<string, CoreWord> | null = null;
export function lookupCoreWord(fr: string): CoreWord | undefined {
  if (!WORD_INDEX) {
    WORD_INDEX = new Map();
    const add = (w: CoreWord) => { if (!WORD_INDEX!.has(w.fr)) WORD_INDEX!.set(w.fr, w); };
    for (const ct of CORE_TIERS) ct.words.forEach(add);
    for (const th of THEME_DEFS) th.tiers.forEach(t => t.forEach(add));
  }
  return WORD_INDEX.get(fr);
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
        { fr: 'le café', en: 'coffee', icon: '☕' }, { fr: 'le thé', en: 'tea', icon: '🍵' },
        { fr: 'l’eau', en: 'water (f.)', icon: '💧' }, { fr: 'le pain', en: 'bread', icon: '🥖' },
        { fr: 'la pomme', en: 'apple', icon: '🍎' }, { fr: 'le fromage', en: 'cheese', icon: '🧀' },
        { fr: 'le repas', en: 'meal', icon: '🍽️' }, { fr: 'le restaurant', en: 'restaurant', icon: '🍴' },
        { fr: 'manger', en: 'to eat', icon: '😋' }, { fr: 'boire', en: 'to drink', icon: '🥤' },
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
        { fr: 'la gare', en: 'train station', icon: '🚉' }, { fr: 'l’aéroport', en: 'airport (m.)', icon: '🛫' },
        { fr: 'le train', en: 'train', icon: '🚆' }, { fr: 'le billet', en: 'ticket', icon: '🎫' },
        { fr: 'l’hôtel', en: 'hotel (m.)', icon: '🏨' }, { fr: 'la valise', en: 'suitcase', icon: '🧳' },
        { fr: 'le voyage', en: 'trip / journey', icon: '🗺️' }, { fr: 'la route', en: 'road / way', icon: '🛣️' },
        { fr: 'voyager', en: 'to travel', icon: '✈️' }, { fr: 'partir', en: 'to leave / depart', icon: '👋' },
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
        { fr: 'la famille', en: 'family', icon: '👨‍👩‍👧‍👦' }, { fr: 'le fils', en: 'son', icon: '👦' },
        { fr: 'la fille', en: 'daughter', icon: '👧' }, { fr: 'la mère', en: 'mother', icon: '👩' },
        { fr: 'le père', en: 'father', icon: '👨' }, { fr: 'le frère', en: 'brother', icon: '👦' },
        { fr: 'la sœur', en: 'sister', icon: '👧' }, { fr: 'l’enfant', en: 'child (m./f.)', icon: '🧒' },
        { fr: 'aimer', en: 'to love / like', icon: '❤️' }, { fr: 'rencontrer', en: 'to meet', icon: '🤝' },
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
        { fr: 'la maison', en: 'house', icon: '🏠' }, { fr: 'l’appartement', en: 'apartment (m.)', icon: '🏢' },
        { fr: 'la chambre', en: 'bedroom', icon: '🛏️' }, { fr: 'la cuisine', en: 'kitchen', icon: '🍳' },
        { fr: 'la table', en: 'table', icon: '🪑' }, { fr: 'la chaise', en: 'chair', icon: '🪑' },
        { fr: 'le lit', en: 'bed', icon: '🛏️' }, { fr: 'la porte', en: 'door', icon: '🚪' },
        { fr: 'la fenêtre', en: 'window', icon: '🪟' }, { fr: 'habiter', en: 'to live (somewhere)', icon: '🏡' },
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
        { fr: 'le médecin', en: 'doctor', icon: '👩‍⚕️' }, { fr: 'la santé', en: 'health', icon: '💪' },
        { fr: 'la tête', en: 'head', icon: '🤕' }, { fr: 'le ventre', en: 'stomach / belly', icon: '🤰' },
        { fr: 'la douleur', en: 'pain', icon: '😣' }, { fr: 'le médicament', en: 'medicine', icon: '💊' },
        { fr: 'la pharmacie', en: 'pharmacy', icon: '💊' }, { fr: 'malade', en: 'sick / ill', icon: '🤒' },
        { fr: 'avoir mal à', en: 'to have pain in', icon: '😖' }, { fr: 'se sentir', en: 'to feel', icon: '🫤' },
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
        { fr: 'l’école', en: 'school (f.)', icon: '🏫' }, { fr: 'le cours', en: 'class / course', icon: '📚' },
        { fr: 'le professeur', en: 'teacher', icon: '👨‍🏫' }, { fr: 'l’élève', en: 'pupil (m./f.)', icon: '🧑‍🎓' },
        { fr: 'l’étudiant', en: 'student (m.)', icon: '🎓' }, { fr: 'le livre', en: 'book', icon: '📖' },
        { fr: 'l’examen', en: 'exam (m.)', icon: '📝' }, { fr: 'la leçon', en: 'lesson', icon: '📓' },
        { fr: 'la question', en: 'question', icon: '❓' },
        { fr: 'étudier', en: 'to study', icon: '🧑‍💻' }, { fr: 'apprendre', en: 'to learn', icon: '🧠' },
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
        { fr: 'le travail', en: 'job / work', icon: '💼' }, { fr: 'le bureau', en: 'office / desk', icon: '🖥️' },
        { fr: 'le collègue', en: 'colleague', icon: '🧑‍💼' }, { fr: 'la réunion', en: 'meeting', icon: '📅' },
        { fr: 'le patron', en: 'boss', icon: '👔' }, { fr: 'l’entreprise', en: 'company (f.)', icon: '🏢' },
        { fr: 'le projet', en: 'project', icon: '📊' }, { fr: 'l’argent', en: 'money (m.)', icon: '💶' },
        { fr: 'travailler', en: 'to work', icon: '⌨️' }, { fr: 'gagner', en: 'to earn / win', icon: '🏆' },
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
        { fr: 'le magasin', en: 'shop / store', icon: '🏬' }, { fr: 'le prix', en: 'price', icon: '🏷️' },
        { fr: 'les vêtements', en: 'clothes (m. pl.)', icon: '👕' }, { fr: 'la chemise', en: 'shirt', icon: '👔' },
        { fr: 'le pantalon', en: 'pair of trousers', icon: '👖' }, { fr: 'la chaussure', en: 'shoe', icon: '👟' },
        { fr: 'la taille', en: 'size', icon: '📏' }, { fr: 'la carte', en: 'card', icon: '💳' },
        { fr: 'acheter', en: 'to buy', icon: '🛒' }, { fr: 'payer', en: 'to pay', icon: '💰' },
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
        { fr: 'la musique', en: 'music', icon: '🎵' }, { fr: 'le film', en: 'film / movie', icon: '🎬' },
        { fr: 'le livre', en: 'book', icon: '📖' }, { fr: 'le concert', en: 'concert', icon: '🎤' },
        { fr: 'le théâtre', en: 'theatre', icon: '🎭' }, { fr: 'l’art', en: 'art (m.)', icon: '🎨' },
        { fr: 'le musée', en: 'museum', icon: '🏛️' }, { fr: 'la fête', en: 'party / festival', icon: '🎉' },
        { fr: 'écouter', en: 'to listen', icon: '👂' }, { fr: 'regarder', en: 'to watch', icon: '👀' },
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
        { fr: 'la nature', en: 'nature', icon: '🌿' }, { fr: 'l’arbre', en: 'tree (m.)', icon: '🌳' },
        { fr: 'la fleur', en: 'flower', icon: '🌸' }, { fr: 'l’animal', en: 'animal (m.)', icon: '🐾' },
        { fr: 'le chien', en: 'dog', icon: '🐶' }, { fr: 'le chat', en: 'cat', icon: '🐱' },
        { fr: 'le temps', en: 'weather / time', icon: '🌤️' }, { fr: 'la pluie', en: 'rain', icon: '🌧️' },
        { fr: 'le soleil', en: 'sun', icon: '☀️' }, { fr: 'il fait', en: 'it is (weather)', icon: '🌡️' },
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
        { fr: 'l’ordinateur', en: 'computer (m.)', icon: '💻' }, { fr: 'le téléphone', en: 'phone', icon: '📱' },
        { fr: 'l’écran', en: 'screen (m.)', icon: '🖥️' }, { fr: 'internet', en: 'internet (m.)', icon: '🌐' },
        { fr: 'l’application', en: 'app (f.)', icon: '📲' }, { fr: 'le message', en: 'message', icon: '💬' },
        { fr: 'la science', en: 'science', icon: '🔬' }, { fr: 'la technologie', en: 'technology', icon: '⚙️' },
        { fr: 'utiliser', en: 'to use', icon: '🛠️' }, { fr: 'envoyer', en: 'to send', icon: '📤' },
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
