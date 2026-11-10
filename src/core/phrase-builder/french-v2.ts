/**
 * French phrase generator v2 — used by the Tree curriculum Builder.
 *
 * The legacy generator (phrase-builder.ts) was written for the scraped course
 * deck (bare nouns, unknown gender). The Tree deck is AUTHORED content: nouns
 * come with their article ("le professeur", "l’école" + "school (f.)"), and
 * the Core tiers teach small reusable chunks ("c’est", "j’ai", "il est",
 * "je veux"…). v2 uses that to build short, grammatical phrases:
 *
 *   Core 1 + Education L1  → "un professeur et un élève", "c’est une école",
 *                            "j’ai un livre"
 *   + Core 2 (être/avoir)  → "le livre est ici", "tu as une question mais
 *                            j’ai un livre"
 *   + Core 3 (describe)    → "c’est mon école", "une petite maison",
 *                            "la maison est très grande" …
 *
 * Grammar handled: gender + elision of articles (le/la/l’, un/une), à/de
 * contractions (au, à la, à l’, du, de la, de l’, d’un), possessives (mon
 * before a vowel), adjective agreement and position (petit/grand/bon… before
 * the noun, nouvel before a vowel), plural nouns/adjectives, ne… pas elision.
 * A small semantic lexicon of the curriculum nouns keeps phrases sensible
 * ("je mange une pomme", never "je mange un livre").
 *
 * Every phrase must contain at least one word from the CURRENT level, so a
 * theme level practises its theme words and a Core level its new chunks.
 * Pure and framework-agnostic.
 *
 * @module core/phrase-builder
 */

import type { BuilderToken, GeneratedPhrase, WordCategory } from './phrase-builder';

// ── Normalisation ────────────────────────────────────────────────────────────

/** Lowercase, NFC, straight apostrophes, single spaces. */
export function normFr(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[’‘ʼ`´]/g, "'")
    .replace(/…/g, '...')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Output form: typographic apostrophe, as in the Tree cards. */
function typo(s: string): string {
  return s.replace(/'/g, '’');
}

const VOWEL_START = /^[aeiouyàâäéèêëîïôöùûüœæ]/;
/** h aspiré — no elision ("le héros", "le haricot"). */
const ASPIRATED_H = new Set([
  'haricot', 'héros', 'hibou', 'hasard', 'hockey', 'hamburger', 'honte', 'hall', 'haut',
  'hauteur', 'hache', 'haine', 'hangar', 'handicap', 'harpe', 'hérisson', 'homard', 'housse',
  'huit', 'hublot',
]);

/** True when a French word elides a preceding le/la/de/que/ne (vowel or mute h). */
export function elides(word: string): boolean {
  const w = normFr(word);
  if (VOWEL_START.test(w)) return true;
  if (w.startsWith('h')) return !ASPIRATED_H.has(w.split(/[\s-]/)[0]);
  return false;
}

// ── Lexicon: function words & frames (keyed by normalised French) ───────────

/** Closed-class words the templates know how to use. */
const FUNCTION_WORDS = new Set([
  'le', 'la', "l'", 'les', 'un', 'une', 'des',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'et', 'ou', 'mais', 'ici', 'là', 'très', 'aussi',
  'dans', 'sur', 'sous', 'devant', 'derrière', 'à côté de', 'avec', 'sans', 'à', 'au', 'à la',
  'après', 'avant', 'pendant',
  'maintenant', "aujourd'hui", 'demain', 'hier', 'toujours', 'souvent', 'parfois', 'rarement',
  'bien', 'beaucoup', 'un peu', 'récemment',
  'du', 'de la', "de l'", 'beaucoup de', 'un peu de', 'trop de', 'assez de',
  'où', 'qui', 'quand', 'quel', 'quelle', 'est-ce que', "qu'est-ce que", 'ne pas', 'parce que',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'lui', 'que',
  'oui', 'non',
]);

type Subj = 'je' | 'tu' | 'il' | 'elle' | 'on' | 'nous' | 'vous' | 'ils' | 'elles' | 'ce' | 'impers';
type FrameKind =
  | 'cest' | 'ilya' | 'have' | 'be' | 'like' | 'want' | 'modal' | 'faut' | 'go' | 'speak' | 'live'
  | 'take' | 'eat' | 'drink' | 'buy' | 'come' | 'leave' | 'need' | 'feel' | 'ate' | 'finished'
  | 'went' | 'goingeat' | 'justfinished' | 'getup' | 'weather';

interface FrameDef {
  subj: Subj;
  kind: FrameKind;
  /** English for the frame, e.g. "I have". */
  en: string;
  /** Subject gender / number for adjective agreement (être frames). */
  g?: 'm' | 'f';
  pl?: boolean;
}

const FRAMES: Record<string, FrameDef> = {
  "c'est": { subj: 'ce', kind: 'cest', en: "it's" },
  'il y a': { subj: 'impers', kind: 'ilya', en: 'there is' },
  'il fait': { subj: 'impers', kind: 'weather', en: "it's" },
  "j'ai": { subj: 'je', kind: 'have', en: 'I have' },
  'tu as': { subj: 'tu', kind: 'have', en: 'you have' },
  'il a': { subj: 'il', kind: 'have', en: 'he has' },
  'elle a': { subj: 'elle', kind: 'have', en: 'she has' },
  'on a': { subj: 'on', kind: 'have', en: 'we have' },
  'nous avons': { subj: 'nous', kind: 'have', en: 'we have', pl: true },
  'vous avez': { subj: 'vous', kind: 'have', en: 'you have' },
  'ils ont': { subj: 'ils', kind: 'have', en: 'they have', pl: true },
  'elles ont': { subj: 'elles', kind: 'have', en: 'they have', pl: true },
  'je suis': { subj: 'je', kind: 'be', en: 'I am' },
  'tu es': { subj: 'tu', kind: 'be', en: 'you are' },
  'il est': { subj: 'il', kind: 'be', en: 'he is', g: 'm' },
  'elle est': { subj: 'elle', kind: 'be', en: 'she is', g: 'f' },
  'nous sommes': { subj: 'nous', kind: 'be', en: 'we are', pl: true },
  'vous êtes': { subj: 'vous', kind: 'be', en: 'you are' },
  'ils sont': { subj: 'ils', kind: 'be', en: 'they are', g: 'm', pl: true },
  'elles sont': { subj: 'elles', kind: 'be', en: 'they are', g: 'f', pl: true },
  "j'aime": { subj: 'je', kind: 'like', en: 'I like' },
  'je préfère': { subj: 'je', kind: 'like', en: 'I prefer' },
  'je veux': { subj: 'je', kind: 'want', en: 'I want' },
  'je voudrais': { subj: 'je', kind: 'want', en: 'I would like' },
  'je peux': { subj: 'je', kind: 'modal', en: 'I can' },
  'je dois': { subj: 'je', kind: 'modal', en: 'I have to' },
  'il faut': { subj: 'impers', kind: 'faut', en: 'you need' },
  'je vais': { subj: 'je', kind: 'go', en: "I'm going" },
  'je parle': { subj: 'je', kind: 'speak', en: 'I speak' },
  "j'habite": { subj: 'je', kind: 'live', en: 'I live' },
  'je prends': { subj: 'je', kind: 'take', en: 'I take' },
  'je mange': { subj: 'je', kind: 'eat', en: 'I eat' },
  'je bois': { subj: 'je', kind: 'drink', en: 'I drink' },
  "j'achète": { subj: 'je', kind: 'buy', en: 'I buy' },
  'je viens': { subj: 'je', kind: 'come', en: "I'm coming" },
  'je pars': { subj: 'je', kind: 'leave', en: "I'm leaving" },
  "j'ai besoin de": { subj: 'je', kind: 'need', en: 'I need' },
  "j'ai envie de": { subj: 'je', kind: 'feel', en: 'I feel like' },
  "j'ai mangé": { subj: 'je', kind: 'ate', en: 'I ate' },
  "j'ai fini": { subj: 'je', kind: 'finished', en: 'I finished' },
  'il est allé': { subj: 'il', kind: 'went', en: 'he went' },
  'elle est allée': { subj: 'elle', kind: 'went', en: 'she went' },
  'je vais manger': { subj: 'je', kind: 'goingeat', en: "I'm going to eat" },
  'je viens de finir': { subj: 'je', kind: 'justfinished', en: "I've just finished" },
  'je me lève': { subj: 'je', kind: 'getup', en: 'I get up' },
};

// ── Semantic lexicon of the curriculum nouns (bare form, straight ') ───────

type Cls =
  | 'person' | 'family' | 'animal' | 'place' | 'dwelling' | 'room' | 'furniture' | 'surface'
  | 'container' | 'food' | 'drink' | 'transport' | 'body' | 'problem' | 'event' | 'task'
  | 'work' | 'weather' | 'abstract' | 'clothing' | 'device' | 'ownablePlace' | 'object';

const set = (s: string) => new Set(s.split('|'));

const CLASS_SRC: Record<Exclude<Cls, 'object'>, Set<string>> = {
  person: set('ami|amie|mère|père|frère|sœur|enfant|fils|fille|famille|voisin|collègue|couple|petit ami|petite amie|médecin|infirmier|professeur|étudiant|élève|patron|client|propriétaire|acteur|artiste|public'),
  family: set('mère|père|frère|sœur|enfant|fils|fille|famille|petit ami|petite amie|couple'),
  animal: set('animal|chien|chat|oiseau'),
  place: set('restaurant|gare|aéroport|hôtel|route|quai|frontière|douane|jardin|quartier|pharmacie|hôpital|école|bibliothèque|université|bureau|entreprise|magasin|marché|théâtre|musée|scène|montagne|mer|forêt|lac|rivière|plage|cuisine|salon|salle de bain|chambre|maison|appartement|immeuble|caisse'),
  dwelling: set('maison|appartement|immeuble|quartier'),
  room: set('cuisine|salon|salle de bain|chambre'),
  furniture: set('table|chaise|lit|meuble|bureau'),
  surface: set('table|chaise|lit|bureau|quai|route|plage|scène|écran|plan|carte|meuble'),
  container: set('valise|bagage|cahier|livre|train|jardin|forêt|magasin|restaurant|école|bibliothèque|musée|théâtre|hôpital|pharmacie|bureau|maison|appartement|chambre|cuisine|salon|salle de bain|gare|aéroport|hôtel|immeuble|quartier|entreprise|université'),
  food: set('pain|pomme|fromage|repas|légume|viande|poisson|dessert|sucre|sel|petit-déjeuner|déjeuner|dîner'),
  drink: set('café|thé|eau'),
  transport: set('train|vol'),
  body: set('tête|ventre|dos|gorge|dent'),
  problem: set('douleur|fièvre|rhume|blessure|accident|symptôme|panne|retard'),
  event: set('voyage|vacances|séjour|mariage|fête|concert|spectacle|exposition|festival|réunion|cours|leçon|examen|rendez-vous|rentrée|stage|entretien|soldes|repas|petit-déjeuner|déjeuner|dîner'),
  task: set('projet|travail|devoir|tâche|ménage|examen|cours|leçon|livre|repas|réunion|stage|film|commande|dîner|déjeuner'),
  work: set('livre|film|chanson|roman|tableau|critique|musique|art|spectacle'),
  weather: set('temps|pluie|soleil|vent|neige|nuage|orage|climat|température'),
  abstract: set('question|note|matière|résultat|carrière|objectif|métier|emploi|salaire|prix|taille|couleur|réduction|promotion|saison|horaire|loyer|travail|expérience|souvenir|santé|nature|science|technologie|argent|chômage|ménage|monnaie|données|intelligence artificielle|invitation|commande|recette|addition|menu|projet'),
  clothing: set('chemise|pantalon|chaussure|robe|manteau|vêtements'),
  device: set('ordinateur|téléphone|écran|application|clavier|souris|robot|batterie'),
  ownablePlace: set('restaurant|magasin|bureau|entreprise|jardin|hôtel'),
};
CLASS_SRC.abstract.add('logiciel').add('mise à jour');

/** Uncountable in French at this level: no un/une (use le/la, or du/de la). */
const MASS = set('eau|pain|fromage|viande|sucre|sel|argent|santé|nature|temps|pluie|soleil|vent|neige|science|technologie|musique|art|ménage|monnaie|chômage|fièvre|intelligence artificielle|climat|données|rentrée');
const MEALS = set('repas|petit-déjeuner|déjeuner|dîner');
/** Count nouns that still don't make sense after "j'ai / tu as …". */
const NO_HAVE = set(
  'taille|prix|couleur|saison|matière|rentrée|soldes|séjour|festival|public|couple|loyer|horaire|critique|retard|' +
  'température|menu|addition|nuage|orage|internet|repas|petit-déjeuner|déjeuner|dîner|porte|fenêtre|étage|quartier|' +
  'accident|acteur|artiste|infirmier|propriétaire|vitrine|déchet|réseau|mise à jour|souvenir|expérience',
);
NO_HAVE.add('ascenseur');
/** Nouns that read oddly with mon / ton ("mon ascenseur", "ta saison"). */
const NO_POSS = set('ascenseur|vitrine|festival|public|soldes|rentrée|saison|retard|chômage|temps|mise à jour|exposition|douleur|couple|artiste|acteur');
/** Nouns that read oddly after "c'est un/une …". */
const NO_CEST = set('prix|taille|loyer|retard|données|horaire|rentrée|addition|frontière|douane|quai');
/** Never coordinated ("la santé et le médecin", "le repas et le pain"). */
const COORD_SKIP = set('santé|chômage|ménage|monnaie|taille|prix|loyer|horaire|nature|température|climat|famille|couple|public|rentrée|retard|temps|repas|petit-déjeuner|déjeuner|dîner|animal');
/** Nouns that never take a describing adjective here ("la rentrée est bonne"). */
const ADJ_SKIP = set('rentrée|soldes|frontière|douane|quai|caisse|étage|horaire|retard|données|chômage|ménage|monnaie|taille|passeport|reçu|ordonnance|mot de passe|fichier|clé|billet|vitrine');
/** Things with a price ("le billet est cher"), besides clothes, devices, homes… */
const PRICED = set('billet|voyage|concert|séjour|vacances|spectacle|menu|loyer|repas|restaurant|hôtel|magasin|valise|médicament|livre|tableau|robot');
/** Things you'd "feel like" having (j’ai envie d’un café). */
const ENVIE_OK = set('café|thé|pomme|dessert|voyage|fête|concert|film|gâteau');
/** Natural pairs for "X et Y" / "X ou Y". */
const COMPLEMENTS: Record<string, string> = {
  fils: 'fille', fille: 'fils', mère: 'père', père: 'mère', frère: 'sœur', sœur: 'frère', café: 'thé', thé: 'café',
  table: 'chaise', chaise: 'table', professeur: 'élève', élève: 'professeur', ami: 'amie', amie: 'ami',
  chien: 'chat', chat: 'chien', pain: 'fromage', fromage: 'pain', chemise: 'pantalon', pantalon: 'chemise',
  ordinateur: 'téléphone', téléphone: 'ordinateur', gare: 'aéroport', aéroport: 'gare', maison: 'appartement',
  appartement: 'maison', livre: 'cahier', cahier: 'stylo', stylo: 'cahier', pluie: 'soleil', soleil: 'pluie',
  musique: 'art', art: 'musique', robe: 'manteau', manteau: 'robe', science: 'technologie', technologie: 'science',
  clavier: 'souris', souris: 'clavier', théâtre: 'musée', musée: 'théâtre', concert: 'fête', fête: 'concert',
  viande: 'poisson', poisson: 'viande', montagne: 'mer', mer: 'montagne', vent: 'neige', neige: 'vent',
};
/** Places where "être à / aller à" works ("je suis à l'école", "je vais au restaurant"). */
const A_PLACES = set(
  'restaurant|gare|aéroport|hôtel|école|bibliothèque|université|bureau|pharmacie|hôpital|magasin|marché|théâtre|' +
  'musée|plage|montagne|mer|maison|caisse|frontière|douane|lac|concert|fête|réunion|cours|festival|' +
  'exposition|spectacle|mariage|rendez-vous|stage|entretien|travail',
);
/** Nature places: "la montagne est ici" sounds odd. */
const NATURE_PLACES = set('montagne|mer|forêt|lac|rivière');
/** People who can be "célèbre". */
const FAMOUS_PEOPLE = set('acteur|artiste|professeur|médecin');
/** Documents / small items that aren't "big" or "small". */
const NO_SIZE = set('billet|passeport|reçu|contrat|diplôme|ordonnance|courriel|message|invitation|mot de passe|fichier|frontière|douane|route|quai|caisse|scène|étage|clé');
/** Infinitives that make sense after "j'aime / je préfère / j'ai envie de". */
const LIKE_OK = set('étudier|apprendre|voyager|travailler|chanter|danser|cuisiner|jouer|sortir|parler|manger|boire|se promener');
/** Adjectives that don't take "très" (délicieux is already absolute). */
const NO_TRES = set('délicieux');
/** Never used by the templates (no article / not a plain noun). */
const SKIP_NOUNS = set('internet');
/** Abstract nouns that do take bon / mauvais ("une bonne question"). */
const QUALITY_ABSTRACT = set('question|note|résultat|prix|salaire|emploi|travail|métier|réduction|expérience|souvenir|recette|carrière|santé|musique|art|menu|projet|objectif');
/** Adjective + noun pairs that change meaning ("petit ami" = boyfriend,
 *  "grand-père", "petit-déjeuner", "bon marché") — never generated. */
const ADJ_NOUN_BLOCK = set(
  'petit:ami|petit:amie|petit:enfant|petit:fils|petit:fille|petit:déjeuner|petit:père|petit:mère|petit:pain|' +
  'grand:père|grand:mère|grand:fils|grand:fille|grand:enfant|grand:ami|grand:amie|grand:magasin|bon:marché',
);

function blockKey(adj: string, noun: string): boolean {
  return ADJ_NOUN_BLOCK.has(`${adj}:${noun}`);
}

/** Small containers: things go in them, people and animals don't. */
const SMALL_CONTAINERS = set('valise|bagage|cahier|livre');

// ── Adjectives ───────────────────────────────────────────────────────────────

type Fit = 'size' | 'quality' | 'new' | 'person' | 'living' | 'priced' | 'comfort' | 'clean' | 'temp' | 'tasty' | 'serious' | 'famous' | 'boring';

interface AdjInfo {
  f: string;
  mpl?: string;
  fpl?: string;
  en: string;
  /** English used when describing a person (grand → tall). */
  enPerson?: string;
  /** English before a family noun (petit frère → little brother). */
  enFamily?: string;
  /** Goes BEFORE the noun (BAGS). */
  pre?: boolean;
  /** Masculine form before a vowel (nouvel, bel, vieil). */
  mv?: string;
  fit: Fit;
  /** Usable after "il fait" (weather). */
  weather?: string;
}

const ADJ: Record<string, AdjInfo> = {
  grand: { f: 'grande', en: 'big', enPerson: 'tall', enFamily: 'big', pre: true, fit: 'size' },
  petit: { f: 'petite', en: 'small', enPerson: 'short', enFamily: 'little', pre: true, fit: 'size' },
  bon: { f: 'bonne', en: 'good', pre: true, fit: 'quality', weather: 'the weather is nice' },
  mauvais: { f: 'mauvaise', mpl: 'mauvais', en: 'bad', pre: true, fit: 'quality', weather: 'the weather is bad' },
  nouveau: { f: 'nouvelle', mpl: 'nouveaux', mv: 'nouvel', en: 'new', pre: true, fit: 'new' },
  beau: { f: 'belle', mpl: 'beaux', mv: 'bel', en: 'beautiful', pre: true, fit: 'quality', weather: 'the weather is nice' },
  vieux: { f: 'vieille', mpl: 'vieux', mv: 'vieil', en: 'old', pre: true, fit: 'new' },
  joli: { f: 'jolie', en: 'pretty', pre: true, fit: 'quality' },
  content: { f: 'contente', en: 'happy', fit: 'person' },
  heureux: { f: 'heureuse', mpl: 'heureux', en: 'happy', fit: 'person' },
  triste: { f: 'triste', en: 'sad', fit: 'person' },
  timide: { f: 'timide', en: 'shy', fit: 'person' },
  gentil: { f: 'gentille', en: 'kind', fit: 'person' },
  sympa: { f: 'sympa', en: 'nice', fit: 'person' },
  occupé: { f: 'occupée', en: 'busy', fit: 'person' },
  malade: { f: 'malade', en: 'sick', fit: 'living' },
  fatigué: { f: 'fatiguée', en: 'tired', fit: 'living' },
  cher: { f: 'chère', en: 'expensive', fit: 'priced' },
  'bon marché': { f: 'bon marché', mpl: 'bon marché', fpl: 'bon marché', en: 'cheap', fit: 'priced' },
  confortable: { f: 'confortable', en: 'comfortable', fit: 'comfort' },
  propre: { f: 'propre', en: 'clean', fit: 'clean' },
  chaud: { f: 'chaude', en: 'hot', fit: 'temp', weather: "it's hot" },
  froid: { f: 'froide', en: 'cold', fit: 'temp', weather: "it's cold" },
  délicieux: { f: 'délicieuse', mpl: 'délicieux', en: 'delicious', fit: 'tasty' },
  grave: { f: 'grave', en: 'serious', fit: 'serious' },
  célèbre: { f: 'célèbre', en: 'famous', fit: 'famous' },
  ennuyeux: { f: 'ennuyeuse', mpl: 'ennuyeux', en: 'boring', fit: 'boring' },
};

// ── Verbs (infinitives) ──────────────────────────────────────────────────────

/** Infinitives that read naturally on their own after "je veux / je peux…". */
const INTRANS = set('étudier|apprendre|voyager|travailler|partir|venir|parler|chanter|danser|cuisiner|jouer|sortir|arriver|gagner|réviser|guérir|applaudir|manger|boire|déménager|continuer|commencer');
/** Reflexive infinitives usable after a modal ("je dois me lever"). */
const REFLEXIVE_OK = set("se lever|se coucher|se réveiller|s'habiller|se reposer|se promener|se marier|s'inscrire");

interface VerbObj { nouns?: Set<string>; cls?: Cls[]; det: 'def' | 'indef' }

/** Transitive infinitives and the objects that make sense with them. */
const VERB_OBJ: Record<string, VerbObj> = {
  ouvrir: { nouns: set('porte|fenêtre|livre|valise|magasin|cahier|application|fichier'), det: 'def' },
  fermer: { nouns: set('porte|fenêtre|livre|valise|magasin|cahier|application|fichier'), det: 'def' },
  // (oublier is left out: "je dois oublier le livre" reads oddly.)
  commencer: { nouns: set('cours|projet|travail|livre|leçon|examen|réunion|film|stage|devoir|tâche'), det: 'def' },
  terminer: { nouns: set('cours|projet|travail|livre|leçon|examen|réunion|film|stage|devoir|tâche'), det: 'def' },
  continuer: { nouns: set('cours|projet|travail|livre|leçon|film|stage|voyage'), det: 'def' },
  rencontrer: { nouns: set('ami|amie|voisin|collègue|professeur|médecin|client|artiste|acteur'), det: 'indef' },
  visiter: { nouns: set('musée|école|université|maison|appartement|marché|théâtre|bibliothèque|quartier|jardin|hôtel'), det: 'def' },
  regarder: { nouns: set('film|écran|plan|carte|tableau|spectacle|vitrine'), det: 'def' },
  écouter: { nouns: set('musique|chanson|professeur|message|concert'), det: 'def' },
  utiliser: { cls: ['device'], det: 'def' },
  envoyer: { nouns: set('message|courriel|fichier|invitation'), det: 'indef' },
  payer: { nouns: set('addition|billet|loyer|repas|chambre'), det: 'def' },
  commander: { cls: ['food', 'drink'], det: 'indef' },
  réserver: { nouns: set('chambre|table|billet|hôtel|vol|restaurant'), det: 'indef' },
  essayer: { cls: ['clothing'], det: 'def' },
  préparer: { nouns: set('repas|dîner|déjeuner|petit-déjeuner|examen|valise|dessert|recette|réunion|cours|leçon'), det: 'def' },
  réparer: { nouns: set('ordinateur|téléphone|porte|fenêtre|table|chaise|lit|robot|écran|clavier|souris'), det: 'def' },
  nettoyer: { nouns: set('maison|appartement|chambre|cuisine|salon|salle de bain|table|fenêtre'), det: 'def' },
  ranger: { nouns: set('chambre|maison|cuisine|salon|livre|vêtements|cahier'), det: 'def' },
  louer: { nouns: set('appartement|maison|chambre'), det: 'indef' },
  télécharger: { nouns: set('fichier|application|logiciel|film|chanson'), det: 'def' },
  allumer: { nouns: set('ordinateur|téléphone|écran'), det: 'def' },
  éteindre: { nouns: set('ordinateur|téléphone|écran'), det: 'def' },
  sauvegarder: { nouns: set('fichier|données|message'), det: 'def' },
  inviter: { nouns: set('ami|amie|voisin|collègue'), det: 'indef' },
  expliquer: { nouns: set('leçon|question|résultat'), det: 'def' },
  comprendre: { nouns: set('question|leçon|message|film|livre|professeur'), det: 'def' },
  trouver: { nouns: set('clé|billet|livre|passeport|valise|téléphone|stylo|cahier|gare|hôtel|restaurant'), det: 'def' },
  attendre: { nouns: set('train|médecin|professeur|ami|amie'), det: 'def' },
  goûter: { cls: ['food', 'drink'], det: 'def' },
  découvrir: { nouns: set('nature|forêt|montagne|mer|plage|quartier|musée'), det: 'def' },
  rater: { nouns: set('train|vol|cours|examen|rendez-vous'), det: 'def' },
  protéger: { nouns: set('nature|forêt|mer|lac|rivière|plage|climat|animal|enfant'), det: 'def' },
  vacciner: { nouns: set('chien|chat|enfant|animal'), det: 'def' },
  diriger: { nouns: set('projet|entreprise|réunion|magasin'), det: 'def' },
  réussir: { nouns: set('examen|projet|stage|entretien'), det: 'def' },
  obtenir: { nouns: set('diplôme|résultat|promotion|emploi'), det: 'def' },
  servir: { cls: ['food', 'drink'], det: 'def' },
  organiser: { nouns: set('fête|réunion|voyage|concert|repas|mariage'), det: 'indef' },
  construire: { nouns: set('maison|immeuble|robot|application'), det: 'indef' },
  inventer: { nouns: set('robot|application|logiciel'), det: 'indef' },
  livrer: { nouns: set('commande|repas'), det: 'def' },
  échanger: { cls: ['clothing'], det: 'def' },
  acheter: { nouns: set('billet|livre|valise|maison|appartement|carte|stylo|cahier|médicament|fleur|pomme|ordinateur|téléphone|chemise|pantalon|robe|manteau|chaussure'), det: 'indef' },
  manger: { cls: ['food'], det: 'indef' },
  boire: { cls: ['drink'], det: 'indef' },
  étudier: { nouns: set('leçon|matière|science'), det: 'def' },
  apprendre: { nouns: set('leçon|chanson'), det: 'def' },
  chanter: { nouns: set('chanson'), det: 'indef' },
};

// ── Analysed lexicon ─────────────────────────────────────────────────────────

interface Noun {
  /** Bare noun (straight apostrophes), e.g. "école", "salle de bain". */
  bare: string;
  g?: 'm' | 'f';
  /** m./f. — e.g. l’élève. Built as masculine; gender swaps never offered. */
  epi: boolean;
  /** Inherently plural ("les vacances"). */
  pl: boolean;
  /** Elides a preceding le/la/de (vowel / mute h). */
  el: boolean;
  /** English head noun, e.g. "school". */
  en: string;
  /** Disambiguation shown in English when two nouns share a gloss (" (f.)"). */
  tag: string;
  cur: boolean;
  /** Compound (space or hyphen): no adjective / plural templates. */
  multi: boolean;
  mass: boolean;
  cls: Set<Cls>;
}

interface Adj { m: string; info: AdjInfo; cur: boolean }
interface Verb { inf: string; en: string; cur: boolean }

/** One piece of a phrase. `fr` may contain spaces (split into chips later). */
interface Seg { fr: string; cur: boolean; key?: boolean; cat?: WordCategory }

interface Cand {
  fam: string;
  segs: Seg[];
  en: string;
  q?: boolean;
  /** Nouns used (for variety across the session). */
  nouns: string[];
  /** Contains an epicene noun → never offer gender-swapped distractors. */
  epi?: boolean;
}

class Lex {
  readonly words = new Map<string, boolean>();
  readonly extras = new Map<string, boolean>();
  nouns: Noun[] = [];
  adjs: Adj[] = [];
  verbs: Verb[] = [];

  add(key: string, cur: boolean): void { this.words.set(key, (this.words.get(key) ?? false) || cur); }
  has(key: string): boolean { return this.words.has(key); }
  cur(key: string): boolean { return this.words.get(key) === true; }
  /** A segment for a known function word / frame. */
  w(key: string): Seg { return { fr: key, cur: this.cur(key) }; }
  verb(inf: string): Verb | undefined { return this.verbs.find(v => v.inf === inf); }
  /** "est" with a noun subject needs être (il est / elle est / être). */
  get hasEst(): boolean { return this.has('il est') || this.has('elle est') || this.has('être'); }
  get estCur(): boolean { return this.cur('il est') || this.cur('elle est') || this.cur('être'); }
  frames(kind: FrameKind): string[] {
    const keys = Object.keys(FRAMES).filter(k => FRAMES[k].kind === kind && this.has(k));
    // Current-level frames first so the new chunks get exercised.
    return [...keys.filter(k => this.cur(k)), ...keys.filter(k => !this.cur(k))];
  }
}

function genderTag(raw: string): { g?: 'm' | 'f'; epi: boolean; pl: boolean } | null {
  const groups = raw.match(/\(([^)]*)\)/g) ?? [];
  for (const grp of groups) {
    const inner = grp.slice(1, -1).trim().toLowerCase();
    const m = inner.match(/^(m|f)\.?\s*(?:\/\s*(m|f)\.?)?\s*(pl\.?)?$/);
    if (m) {
      const epi = !!m[2] && m[2] !== m[1];
      return { g: epi ? 'm' : (m[1] as 'm' | 'f'), epi, pl: !!m[3] };
    }
  }
  return null;
}

/** First English alternative, without notes or a leading article. */
function enHead(raw: string): string {
  let s = raw.replace(/\([^)]*\)/g, ' ');
  s = s.split('/')[0];
  s = s.replace(/\s+/g, ' ').trim();
  return s.replace(/^(the|a|an) /i, '');
}

function classesOf(bare: string): Set<Cls> {
  const out = new Set<Cls>();
  for (const [cls, words] of Object.entries(CLASS_SRC) as [Exclude<Cls, 'object'>, Set<string>][]) {
    if (words.has(bare)) out.add(cls);
  }
  // Physical items (a suitcase, a keyboard, a shirt…) are also plain "objects",
  // so they pair with each other in "X et Y".
  const physical = ['container', 'device', 'clothing', 'furniture', 'surface'].some(c => out.has(c as Cls));
  if (out.size === 0 || (physical && !out.has('place'))) out.add('object');
  return out;
}

function analyze(tokens: BuilderToken[]): Lex {
  const L = new Lex();
  const seenNoun = new Set<string>();
  for (const t of tokens) {
    const cur = t.fromCurrentChapter;
    const rawFr = normFr(t.text ?? '');
    if (!rawFr || rawFr === '—') continue;
    const frTag = genderTag(rawFr);
    const fr = rawFr.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const enRaw = (t.translation ?? '').trim();

    if (fr === 'ne... pas' || fr === 'ne pas') { L.add('ne pas', cur); continue; }
    // Object pronouns (le/la/les "it/them") and relative "qui" share their
    // spelling with the article / question word: keep them apart so an
    // article card never unlocks "je le prends" (and vice versa).
    if (['le', 'la', 'les'].includes(fr) && /object/i.test(enRaw)) { L.add(`${fr}:obj`, cur); continue; }
    if (fr === 'qui' && /relative/i.test(enRaw)) { L.add('qui:rel', cur); continue; }
    if (FUNCTION_WORDS.has(fr) || FRAMES[fr]) { L.add(fr, cur); continue; }
    if (fr.includes('/') || fr.includes('+') || fr.includes('...')) continue;

    // Nouns: a leading article gives the noun (+ gender).
    let art: string | null = null;
    let bare = '';
    if (fr.startsWith("l'")) { art = "l'"; bare = fr.slice(2).trim(); }
    else {
      const m = fr.match(/^(le|la|les|un|une) (.+)$/);
      if (m) { art = m[1]; bare = m[2]; }
    }
    if (art && bare) {
      if (SKIP_NOUNS.has(bare) || seenNoun.has(bare)) continue;
      const tag = genderTag(enRaw) ?? frTag;
      let g: 'm' | 'f' | undefined;
      if (art === 'le' || art === 'un') g = 'm';
      else if (art === 'la' || art === 'une') g = 'f';
      else g = tag?.g;
      const en = enHead(enRaw);
      if (!en) continue;
      seenNoun.add(bare);
      L.nouns.push({
        bare, g, epi: !!tag?.epi,
        pl: art === 'les' || !!tag?.pl,
        el: art === "l'" || (art !== 'le' && art !== 'la' && elides(bare)),
        en, tag: '', cur,
        multi: /[\s-]/.test(bare),
        mass: MASS.has(bare),
        cls: classesOf(bare),
      });
      continue;
    }

    const adj = ADJ[fr];
    if (adj) { if (!L.adjs.some(a => a.m === fr)) L.adjs.push({ m: fr, info: adj, cur }); continue; }

    if (/^to /i.test(enHead(enRaw)) || /^to /i.test(enRaw)) {
      const en = enHead(enRaw).replace(/^to /i, '').trim();
      if (!L.verbs.some(v => v.inf === fr)) L.verbs.push({ inf: fr, en, cur });
      if (fr === 'être') L.add('être', cur);
      continue;
    }

    // Other chunks some templates know (à gauche, tout droit…).
    L.extras.set(fr, (L.extras.get(fr) ?? false) || cur);
  }

  // Two nouns with the same English gloss but different genders (l’ami /
  // l’amie → "friend") keep a gender tag in English so the prompt says which
  // one to build.
  const byEn = new Map<string, Noun[]>();
  for (const n of L.nouns) byEn.set(n.en.toLowerCase(), [...(byEn.get(n.en.toLowerCase()) ?? []), n]);
  for (const list of byEn.values()) {
    if (list.length < 2 || new Set(list.map(n => n.g)).size < 2) continue;
    for (const n of list) if (n.g) n.tag = n.g === 'f' ? ' (f.)' : ' (m.)';
  }
  return L;
}

// ── English helpers ──────────────────────────────────────────────────────────

function aAn(word: string): string {
  const w = word.toLowerCase();
  if (/^(uni|use|usu|uti|eu|one|once)/.test(w)) return 'a';
  if (/^(hour|honest|honou?r|heir)/.test(w)) return 'an';
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}

const EN_PLURAL: Record<string, string> = {
  child: 'children', man: 'men', woman: 'women', person: 'people', foot: 'feet', tooth: 'teeth',
  mouse: 'mice', fish: 'fish', sheep: 'sheep', knife: 'knives', leaf: 'leaves', life: 'lives',
  wife: 'wives', shelf: 'shelves', luggage: 'luggage', furniture: 'furniture', homework: 'homework',
  money: 'money', news: 'news', trousers: 'trousers', clothes: 'clothes', holidays: 'holidays',
  data: 'data', sales: 'sales', potato: 'potatoes', tomato: 'tomatoes',
};

export function pluralEn(en: string): string {
  const of = en.match(/^(\S+)( of .+)$/);
  if (of) return pluralEn(of[1]) + of[2];
  const parts = en.split(' ');
  const last = parts.pop()!;
  const low = last.toLowerCase();
  let p: string;
  if (EN_PLURAL[low]) p = EN_PLURAL[low];
  else if (/[^aeiou]y$/i.test(last)) p = last.slice(0, -1) + 'ies';
  else if (/(s|x|z|ch|sh)$/i.test(last)) p = last + 'es';
  else p = last + 's';
  return [...parts, p].join(' ');
}

/** Present participle for "I feel like …ing". */
function gerund(v: string): string {
  const IRR: Record<string, string> = {
    travel: 'travelling', be: 'being', see: 'seeing', swim: 'swimming', run: 'running', get: 'getting',
    sit: 'sitting', shop: 'shopping', stop: 'stopping', plan: 'planning', win: 'winning',
    begin: 'beginning', forget: 'forgetting', chat: 'chatting', lie: 'lying', die: 'dying',
  };
  const [head, ...rest] = v.split(' ');
  let g: string;
  if (IRR[head]) g = IRR[head];
  else if (/ie$/.test(head)) g = head.slice(0, -2) + 'ying';
  else if (/[^aeiou]e$/.test(head)) g = head.slice(0, -1) + 'ing';
  else g = head + 'ing';
  return [g, ...rest].join(' ');
}

const enN = (n: Noun) => n.en + n.tag;
const enPl = (n: Noun) => (n.pl ? n.en : pluralEn(n.en)) + n.tag;

const POSS_EN: Record<string, string> = { mon: 'my', ma: 'my', mes: 'my', ton: 'your', ta: 'your', tes: 'your' };
const SUBJ_POSS_EN: Record<Subj, string> = {
  je: 'my', tu: 'your', il: 'his', elle: 'her', on: 'our', nous: 'our', vous: 'your', ils: 'their',
  elles: 'their', ce: 'its', impers: 'the',
};

// ── French morphology ────────────────────────────────────────────────────────

const FR_PLURAL_IRR: Record<string, string> = {
  travail: 'travaux', festival: 'festivals', bal: 'bals', carnaval: 'carnavals', pneu: 'pneus',
  bleu: 'bleus', bijou: 'bijoux', caillou: 'cailloux', chou: 'choux', genou: 'genoux', hibou: 'hiboux',
  œil: 'yeux', détail: 'détails',
};

/** Plural of a single-word French noun (null for compounds). */
export function pluralFr(bare: string): string | null {
  if (/[\s-]/.test(bare)) return null;
  if (FR_PLURAL_IRR[bare]) return FR_PLURAL_IRR[bare];
  if (/[sxz]$/.test(bare)) return bare;
  if (/(eau|au|eu)$/.test(bare)) return bare + 'x';
  if (/al$/.test(bare)) return bare.slice(0, -2) + 'aux';
  return bare + 's';
}

function adjForm(a: AdjInfo, m: string, g: 'm' | 'f' | undefined, pl: boolean, beforeVowel = false): string {
  const fem = g === 'f';
  if (pl) {
    if (fem) return a.fpl ?? a.f + 's';
    return a.mpl ?? (/[sx]$/.test(m) ? m : m + 's');
  }
  if (fem) return a.f;
  if (beforeVowel && a.mv) return a.mv;
  return m;
}

const invariableGender = (a: Adj) => a.info.f === a.m;

function has(n: Noun, ...cls: Cls[]): boolean { return cls.some(c => n.cls.has(c)); }

function fits(a: Adj, n: Noun): boolean {
  const person = has(n, 'person');
  if (ADJ_SKIP.has(n.bare)) return false;
  switch (a.info.fit) {
    case 'size':
      return !n.mass && !NO_SIZE.has(n.bare)
        && !has(n, 'body', 'weather', 'abstract', 'problem', 'event', 'food', 'drink');
    case 'quality':
      if (has(n, 'body', 'weather', 'problem')) return false;
      return !has(n, 'abstract') || QUALITY_ABSTRACT.has(n.bare);
    case 'new':
      if (n.mass || NATURE_PLACES.has(n.bare) || has(n, 'food', 'drink', 'body', 'weather', 'problem', 'family', 'event')) return false;
      return !has(n, 'abstract') || ['projet', 'emploi', 'métier', 'travail', 'objectif', 'question'].includes(n.bare);
    case 'person': return person;
    case 'living': return person || has(n, 'animal');
    case 'priced':
      if (person || n.mass) return false;
      return PRICED.has(n.bare) || has(n, 'clothing', 'device', 'dwelling', 'room', 'furniture')
        || (has(n, 'food', 'drink') && !MEALS.has(n.bare));
    case 'comfort': return has(n, 'dwelling', 'room', 'furniture', 'transport') || n.bare === 'hôtel';
    case 'clean': return !person && has(n, 'dwelling', 'room', 'furniture', 'clothing', 'place') && !NATURE_PLACES.has(n.bare);
    case 'temp': return has(n, 'drink', 'food', 'dwelling', 'room');
    case 'tasty': return has(n, 'food', 'drink');
    case 'serious': return has(n, 'problem');
    case 'famous': return FAMOUS_PEOPLE.has(n.bare) || (has(n, 'place', 'work') && !NATURE_PLACES.has(n.bare));
    case 'boring': return has(n, 'work', 'event') && !MEALS.has(n.bare);
  }
}

/** English for an adjective describing `n` (person-specific where it differs). */
function adjEn(a: Adj, n?: Noun, attributive = false): string {
  if (n && has(n, 'person')) {
    if (attributive && has(n, 'family') && a.info.enFamily) return a.info.enFamily;
    if (!attributive && a.info.enPerson) return a.info.enPerson;
  }
  return a.info.en;
}

/** Adjective allowed in FRONT of this noun (no meaning shift). */
function preAdjOk(a: Adj, n: Noun): boolean {
  if (!a.info.pre || n.multi || !fits(a, n) || blockKey(a.m, n.bare)) return false;
  // grand/petit before a (non-sibling) person change meaning ("un grand professeur").
  if ((a.m === 'grand' || a.m === 'petit') && has(n, 'person') && !['frère', 'sœur'].includes(n.bare)) return false;
  return true;
}

// ── Noun-phrase builders ─────────────────────────────────────────────────────

interface NP { segs: Seg[]; en: string; n: Noun }

const nseg = (n: Noun, fr = n.bare): Seg => ({ fr, cur: n.cur, key: true, cat: 'noun' });

function npIndef(L: Lex, n: Noun): NP | null {
  if (n.mass) return null;
  if (n.pl) return L.has('des') ? { segs: [L.w('des'), nseg(n)], en: enPl(n), n } : null;
  if (!n.g) return null;
  const a = n.g === 'f' ? 'une' : 'un';
  return L.has(a) ? { segs: [L.w(a), nseg(n)], en: `${aAn(n.en)} ${enN(n)}`, n } : null;
}

function npDef(L: Lex, n: Noun): NP | null {
  if (n.pl) return L.has('les') ? { segs: [L.w('les'), nseg(n)], en: `the ${enN(n)}`, n } : null;
  if (n.el) {
    if (!L.has("l'")) return null;
    return { segs: [{ fr: `l'${n.bare}`, cur: n.cur || L.cur("l'"), key: true, cat: 'noun' }], en: `the ${enN(n)}`, n };
  }
  if (!n.g) return null;
  const a = n.g === 'f' ? 'la' : 'le';
  return L.has(a) ? { segs: [L.w(a), nseg(n)], en: `the ${enN(n)}`, n } : null;
}

/** Plural of a singular count noun: les/des + plural form. */
function npPlural(L: Lex, n: Noun, det: 'les' | 'des'): NP | null {
  if (n.pl || n.mass || n.multi || !L.has(det)) return null;
  const p = pluralFr(n.bare);
  if (!p) return null;
  return { segs: [L.w(det), nseg(n, p)], en: det === 'les' ? `the ${pluralEn(n.en)}` : pluralEn(n.en), n };
}

function npPoss(L: Lex, person: 'my' | 'your', n: Noun): NP | null {
  const forms = person === 'my' ? ['mon', 'ma', 'mes'] : ['ton', 'ta', 'tes'];
  let f: string;
  if (n.pl) f = forms[2];
  else if (n.g === 'f' && !n.el) f = forms[1];
  else if (n.g === 'm' || n.el) f = forms[0];
  else return null;
  return L.has(f) ? { segs: [L.w(f), nseg(n)], en: `${POSS_EN[f]} ${enN(n)}`, n } : null;
}

/** Partitive (du / de la / de l’) + mass noun. English stays bare ("water"). */
function npPartitive(L: Lex, n: Noun): NP | null {
  if (!n.mass || n.pl) return null;
  if (n.el) {
    if (!L.has("de l'")) return null;
    return { segs: [{ fr: 'de', cur: L.cur("de l'") }, { fr: `l'${n.bare}`, cur: n.cur || L.cur("de l'"), key: true, cat: 'noun' }], en: enN(n), n };
  }
  const f = n.g === 'f' ? 'de la' : n.g === 'm' ? 'du' : null;
  return f && L.has(f) ? { segs: [L.w(f), nseg(n)], en: enN(n), n } : null;
}

/** à + definite article: au / à la / à l’ / aux + noun. */
function ppA(L: Lex, n: Noun): Seg[] | null {
  const aCur = L.cur('à');
  const canA = L.has('à');
  if (n.pl) return canA && L.has('les') ? [{ fr: 'aux', cur: aCur || L.cur('les') }, nseg(n)] : null;
  if (n.el) return canA && L.has("l'") ? [{ fr: 'à', cur: aCur }, { fr: `l'${n.bare}`, cur: n.cur || L.cur("l'"), key: true, cat: 'noun' }] : null;
  if (n.g === 'm') return L.has('au') || (canA && L.has('le')) ? [{ fr: 'au', cur: L.cur('au') || aCur }, nseg(n)] : null;
  if (n.g === 'f') return L.has('à la') || (canA && L.has('la')) ? [{ fr: 'à la', cur: L.cur('à la') || aCur }, nseg(n)] : null;
  return null;
}

/** "à côté de" + definite: du / de la / de l’ / des. */
function ppDe(L: Lex, lead: string, n: Noun): Seg[] | null {
  const head = lead.replace(/ de$/, '');
  const c = L.cur(lead);
  if (n.pl) return L.has('les') ? [{ fr: head, cur: c }, { fr: 'des', cur: c }, nseg(n)] : null;
  if (n.el) return L.has("l'") ? [{ fr: `${head} de`, cur: c }, { fr: `l'${n.bare}`, cur: n.cur || c, key: true, cat: 'noun' }] : null;
  if (n.g === 'm') return L.has('le') ? [{ fr: head, cur: c }, { fr: 'du', cur: c }, nseg(n)] : null;
  if (n.g === 'f') return L.has('la') ? [{ fr: `${head} de la`, cur: c }, nseg(n)] : null;
  return null;
}

/** "…de" frame + indefinite: d’un / d’une + noun (j’ai besoin d’un billet). */
function deIndef(L: Lex, n: Noun): Seg[] | null {
  if (n.mass || n.pl || !n.g) return null;
  const a = n.g === 'f' ? 'une' : 'un';
  return L.has(a) ? [{ fr: `d'${a}`, cur: L.cur(a) }, nseg(n)] : null;
}

/** A frame ending in "de" followed by a word: de / d’ elision. */
function withDe(frameKey: string, cur: boolean, next: string): Seg[] {
  const base = frameKey.replace(/ de$/, '');
  return elides(next) ? [{ fr: base, cur }, { fr: `d'${next}`, cur }] : [{ fr: `${base} de`, cur }, { fr: next, cur }];
}

// ── Candidate helpers ────────────────────────────────────────────────────────

const LIMIT = 10; // max candidates per family (keeps generation cheap)

function push(out: Cand[], fam: string, segs: (Seg | null | undefined)[], en: string, nouns: Noun[], q = false): void {
  if (segs.some(s => !s)) return;
  out.push({ fam, segs: segs as Seg[], en, q, nouns: nouns.map(n => n.bare), epi: nouns.some(n => n.epi) });
}

const famCount = (out: Cand[], fam: string) => out.filter(c => c.fam === fam).length;

function canHave(n: Noun): boolean {
  if (n.mass || NO_HAVE.has(n.bare) || has(n, 'body', 'weather', 'transport')) return false;
  if (has(n, 'place') && !has(n, 'dwelling', 'room', 'ownablePlace')) return false;
  return true;
}

/**
 * A partner noun for "A et B": a natural complement (fils/fille, café/thé)
 * first, else the NEXT noun sharing a class (searching cyclically after A so
 * pairs vary), else the next current noun.
 */
function partner(L: Lex, a: Noun, ok: (n: Noun) => boolean, strict = false): Noun | undefined {
  const comp = COMPLEMENTS[a.bare];
  const byComp = comp ? L.nouns.find(n => n.bare === comp && ok(n)) : undefined;
  if (byComp) return byComp;
  const i = L.nouns.indexOf(a);
  const ring = [...L.nouns.slice(i + 1), ...L.nouns.slice(0, Math.max(0, i))].filter(n => n !== a && ok(n));
  // Most specific family first (furniture, family, drink…), then plain objects.
  const specific = (n: Noun) => sharesClass(a, n, false);
  const loose = (n: Noun) => sharesClass(a, n, true);
  return ring.find(n => n.cur && specific(n)) ?? ring.find(specific)
    ?? ring.find(n => n.cur && loose(n)) ?? ring.find(loose)
    ?? (strict ? undefined : ring.find(n => n.cur) ?? ring[0]);
}

/** Same semantic family. Broad / functional classes (place, container…) don't
 *  count; plain "object" only counts when `allowObject`. */
function sharesClass(a: Noun, b: Noun, allowObject: boolean): boolean {
  const skip = new Set<Cls>(['abstract', 'container', 'surface', 'ownablePlace', 'place', 'task']);
  if (!allowObject) skip.add('object');
  return [...a.cls].some(c => !skip.has(c) && b.cls.has(c));
}

/** English lead-in before an infinitive: "I can" / "I want to" / "I'm going to". */
function infLead(frame: string): string {
  if (frame === 'je vais') return "I'm going to";
  const F = FRAMES[frame];
  return F.kind === 'modal' ? F.en : `${F.en} to`;
}

/** English for "à + place": at the station / at home; to the station / home. */
function atPlaceEn(n: Noun, motion: boolean): string {
  if (n.bare === 'maison') return motion ? 'home' : 'at home';
  return `${motion ? 'to' : 'at'} the ${enN(n)}`;
}

// ── Template families ────────────────────────────────────────────────────────

type Gen = (L: Lex, out: Cand[]) => void;

/** Theme-specific constructions (avoir mal à, se sentir, il fait, …). */
const genSpecial: Gen = (L, out) => {
  // j’ai mal à la tête → "my head hurts"
  const mal = L.verb('avoir mal à');
  if (mal) {
    // The chunk itself teaches "à" (+ its au / aux contractions).
    const aDef = (n: Noun): Seg[] | null => {
      if (n.pl) return [{ fr: 'aux', cur: mal.cur }, nseg(n)];
      if (n.el) return L.has("l'") ? [{ fr: 'à', cur: mal.cur }, { fr: `l'${n.bare}`, cur: n.cur, key: true, cat: 'noun' }] : null;
      if (n.g === 'm') return L.has('le') ? [{ fr: 'au', cur: mal.cur }, nseg(n)] : null;
      if (n.g === 'f') return L.has('la') ? [{ fr: 'à', cur: mal.cur }, L.w('la'), nseg(n)] : null;
      return null;
    };
    for (const f of L.frames('have').filter(k => ['je', 'tu', 'il', 'elle'].includes(FRAMES[k].subj))) {
      for (const n of L.nouns.filter(x => has(x, 'body'))) {
        const body = n.bare === 'dent' ? { ...n, bare: 'dents', pl: true } : n;
        const pp = aDef(body);
        if (!pp) continue;
        const verbEn = body.pl ? 'hurt' : 'hurts';
        push(out, 'special', [L.w(f), { fr: 'mal', cur: mal.cur }, ...pp],
          `${SUBJ_POSS_EN[FRAMES[f].subj]} ${body.pl ? pluralEn(n.en) : n.en} ${verbEn}`, [n]);
      }
    }
  }
  // je me sens malade → "I feel sick"
  const sentir = L.verb('se sentir');
  if (sentir && L.has('je')) {
    for (const a of L.adjs.filter(x => (x.info.fit === 'living' || x.info.fit === 'person') && invariableGender(x))) {
      push(out, 'special', [{ fr: 'je', cur: L.cur('je') }, { fr: 'me sens', cur: sentir.cur }, { fr: a.m, cur: a.cur, cat: 'adjective' }],
        `I feel ${a.info.en}`, []);
    }
  }
  // il fait chaud → "it's hot"
  if (L.has('il fait')) {
    for (const a of L.adjs.filter(x => x.info.weather)) {
      push(out, 'special', [L.w('il fait'), { fr: a.m, cur: a.cur, cat: 'adjective' }], a.info.weather!, []);
      for (const t of ["aujourd'hui", 'maintenant'].filter(k => L.has(k))) {
        push(out, 'special', [L.w('il fait'), { fr: a.m, cur: a.cur, cat: 'adjective' }, L.w(t)],
          `${a.info.weather} ${t === 'maintenant' ? 'now' : 'today'}`, []);
      }
    }
  }
  // le billet coûte cher → "the ticket is expensive"
  const cost = L.verb('coûter cher');
  if (cost) {
    for (const n of L.nouns.filter(x => fits({ m: 'cher', info: ADJ['cher'], cur: false }, x))) {
      const np = npDef(L, n);
      if (np) push(out, 'special', [...np.segs, { fr: n.pl ? 'coûtent cher' : 'coûte cher', cur: cost.cur }],
        `${np.en} ${n.pl ? 'are' : 'is'} expensive`, [n]);
    }
  }
  // la gare est à gauche → "the station is on the left"; c’est tout droit
  for (const dir of ['à gauche', 'à droite', 'tout droit']) {
    if (!L.extras.has(dir)) continue;
    const dCur = L.extras.get(dir)!;
    const dirEn = dir === 'à gauche' ? 'on the left' : dir === 'à droite' ? 'on the right' : 'straight ahead';
    if (L.has("c'est")) push(out, 'special', [L.w("c'est"), { fr: dir, cur: dCur }], `it's ${dirEn}`, []);
    if (L.hasEst) {
      for (const n of L.nouns.filter(x => has(x, 'place') && !x.pl).slice(0, 4)) {
        const np = npDef(L, n);
        if (np) push(out, 'special', [...np.segs, { fr: 'est', cur: L.estCur }, { fr: dir, cur: dCur }], `${np.en} is ${dirEn}`, [n]);
      }
    }
  }
  // je vais assister au concert / je dois passer un examen
  const attend = L.verb('assister à');
  const exam = L.verb('passer un examen');
  const modals = [...L.frames('modal'), ...L.frames('want'), ...(L.has('je vais') ? ['je vais'] : [])];
  for (const f of modals) {
    const fEn = infLead(f);
    if (attend) {
      for (const n of L.nouns.filter(x => has(x, 'event')).slice(0, 4)) {
        const pp = ppA(L, n);
        if (pp) push(out, 'special', [L.w(f), { fr: 'assister', cur: attend.cur }, ...pp], `${fEn} attend the ${enN(n)}`, [n]);
      }
    }
    if (exam) push(out, 'special', [L.w(f), { fr: 'passer un examen', cur: exam.cur }], `${fEn} take an exam`, []);
  }
};

/** "un professeur et un élève" / "l’eau et le pain" ("water and bread"). */
const genCoord: Gen = (L, out) => {
  const usable = (n: Noun) => !COORD_SKIP.has(n.bare) && !!(npIndef(L, n) || npDef(L, n));
  // English for a definite mass noun drops "the": "water and bread".
  const enOf = (np: NP) => (np.n.mass ? enN(np.n) : np.en);
  for (const conj of ['et', 'ou']) {
    if (!L.has(conj)) continue;
    for (const a of L.nouns.filter(usable)) {
      if (famCount(out, 'coord') >= LIMIT) return;
      // Same family and same countability ("l’eau et le café" mixes "water" / "the coffee").
      const b = partner(L, a, n => usable(n) && n.mass === a.mass, true);
      if (!b) continue;
      const ia = npIndef(L, a), ib = npIndef(L, b);
      const da = npDef(L, a), db = npDef(L, b);
      const [x, y] = ia && ib ? [ia, ib] : [da, db];
      if (!x || !y) continue;
      push(out, 'coord', [...x.segs, L.w(conj), ...y.segs], `${enOf(x)} ${conj === 'et' ? 'and' : 'or'} ${enOf(y)}`, [a, b]);
    }
  }
};

/** "c’est une école" / "c’est le professeur" / "c’est bon". */
const genCest: Gen = (L, out) => {
  if (!L.has("c'est")) return;
  for (const n of L.nouns) {
    if (famCount(out, 'cest') >= LIMIT) break;
    if (n.bare === 'addition') { // "c’est l’addition" — it's the bill
      const d = npDef(L, n);
      if (d) push(out, 'cest', [L.w("c'est"), ...d.segs], `it's ${d.en}`, [n]);
      continue;
    }
    // Family members read oddly as "c’est un fils" (→ "c’est mon fils" later).
    if (NO_CEST.has(n.bare) || has(n, 'weather', 'body', 'problem', 'family')) continue;
    const np = npIndef(L, n) ?? (n.mass ? null : npDef(L, n));
    if (np) push(out, 'cest', [L.w("c'est"), ...np.segs], `it's ${np.en}`, [n]);
  }
  for (const a of L.adjs.filter(x => !['person', 'living', 'size'].includes(x.info.fit))) {
    push(out, 'cest', [L.w("c'est"), { fr: a.m, cur: a.cur, cat: 'adjective' }], `it's ${a.info.en}`, []);
  }
};

/** "j’ai un livre" / "tu as une question". */
const genHave: Gen = (L, out) => {
  const frames = L.frames('have');
  if (!frames.length) return;
  let i = 0;
  for (const n of L.nouns.filter(canHave)) {
    if (famCount(out, 'have') >= LIMIT) break;
    const np = npIndef(L, n);
    if (!np) continue;
    const f = frames[i++ % frames.length];
    push(out, 'have', [L.w(f), ...np.segs], `${FRAMES[f].en} ${np.en}`, [n]);
  }
  // Every current have-frame gets at least one phrase.
  for (const f of frames.filter(k => L.cur(k))) {
    const n = L.nouns.find(x => canHave(x) && npIndef(L, x));
    const np = n && npIndef(L, n);
    if (n && np) push(out, 'have', [L.w(f), ...np.segs], `${FRAMES[f].en} ${np.en}`, [n]);
  }
};

const LOC_EN: Record<string, string> = { ici: 'here', 'là': 'there' };

/** "je suis ici" / "le livre est là". */
const genBeLoc: Gen = (L, out) => {
  const advs = ['ici', 'là'].filter(k => L.has(k));
  if (!advs.length) return;
  let i = 0;
  for (const f of L.frames('be')) {
    const adv = advs[i++ % advs.length];
    push(out, 'beloc', [L.w(f), L.w(adv)], `${FRAMES[f].en} ${LOC_EN[adv]}`, []);
  }
  if (!L.hasEst) return;
  // Things, people and buildings can be "here / there" (not ideas, events,
  // illnesses or mountains).
  const placeable = (x: Noun) => locatable(x) || (has(x, 'place') && !x.pl && !NATURE_PLACES.has(x.bare));
  for (const n of L.nouns.filter(placeable)) {
    if (famCount(out, 'beloc') >= LIMIT) break;
    const np = npDef(L, n);
    const adv = advs[i++ % advs.length];
    if (np) push(out, 'beloc', [...np.segs, { fr: 'est', cur: L.estCur }, L.w(adv)], `${np.en} is ${LOC_EN[adv]}`, [n]);
  }
};

/** "elle est contente" / "la maison est (très) grande". */
const genBeAdj: Gen = (L, out) => {
  if (!L.adjs.length) return;
  const tres = L.has('très');
  // Pronoun subjects (people). je/tu/nous: only gender-invariable adjectives.
  for (const f of L.frames('be')) {
    const F = FRAMES[f];
    if (F.subj === 'vous') continue;
    for (const a of L.adjs.filter(x => x.info.fit === 'person' || x.info.fit === 'living' || x.m === 'grand' || x.m === 'petit')) {
      if (!F.g && !invariableGender(a)) continue;
      const form = adjForm(a.info, a.m, F.g, !!F.pl);
      const en = a.info.enPerson ?? a.info.en;
      push(out, 'beadj', [L.w(f), { fr: form, cur: a.cur, cat: 'adjective' }], `${F.en} ${en}`, []);
      if (tres && !NO_TRES.has(a.m)) push(out, 'beadj', [L.w(f), L.w('très'), { fr: form, cur: a.cur, cat: 'adjective' }], `${F.en} very ${en}`, []);
    }
  }
  // Noun subjects.
  if (!L.hasEst) return;
  for (const n of L.nouns) {
    if (famCount(out, 'beadj') >= LIMIT * 2) break;
    if (n.pl) continue;
    const subj = npDef(L, n) ?? npPoss(L, 'my', n);
    if (!subj) continue;
    for (const a of L.adjs.filter(x => fits(x, n))) {
      const form = adjForm(a.info, a.m, n.g, false);
      const en = adjEn(a, n);
      const useTres = tres && !NO_TRES.has(a.m) && (a.cur || L.cur('très'));
      push(out, 'beadj', [...subj.segs, { fr: 'est', cur: L.estCur }, ...(useTres ? [L.w('très')] : []), { fr: form, cur: a.cur, cat: 'adjective' }],
        `${subj.en} is ${useTres ? 'very ' : ''}${en}`, [n]);
      break;
    }
  }
};

/** "c’est mon école" / "mon livre est petit". */
const genPoss: Gen = (L, out) => {
  const persons = (['my', 'your'] as const).filter(p => (p === 'my' ? ['mon', 'ma'] : ['ton', 'ta']).some(k => L.has(k)));
  if (!persons.length) return;
  let i = 0;
  for (const n of L.nouns) {
    if (famCount(out, 'poss') >= LIMIT) break;
    if (n.mass && n.bare !== 'santé') continue;
    if (NO_POSS.has(n.bare) || has(n, 'weather', 'problem')) continue;
    if (has(n, 'place') && !has(n, 'dwelling', 'room', 'ownablePlace') && !['école', 'université', 'quartier'].includes(n.bare)) continue;
    const np = npPoss(L, persons[i++ % persons.length], n);
    if (!np) continue;
    if (L.has("c'est")) push(out, 'poss', [L.w("c'est"), ...np.segs], `it's ${np.en}`, [n]);
    else push(out, 'poss', np.segs, np.en, [n]);
  }
};

/** "une petite maison" / "c’est un nouveau livre" / "un repas délicieux". */
const genAdjNp: Gen = (L, out) => {
  if (!L.adjs.length) return;
  const lead = L.has("c'est") ? "c'est" : L.frames('have')[0];
  for (const n of L.nouns) {
    if (famCount(out, 'adjnp') >= LIMIT) break;
    if (n.mass || n.pl || n.multi || !n.g) continue;
    const art = n.g === 'f' ? 'une' : 'un';
    if (!L.has(art)) continue;
    for (const a of L.adjs) {
      // "un médecin malade" reads oddly — states (sick, tired) are said with être.
      if (!fits(a, n) || a.info.fit === 'living') continue;
      let segs: Seg[];
      let en: string;
      const aEn = adjEn(a, n, true);
      if (a.info.pre) {
        if (!preAdjOk(a, n)) continue;
        segs = [L.w(art), { fr: adjForm(a.info, a.m, n.g, false, n.el), cur: a.cur, cat: 'adjective' }, nseg(n)];
      } else {
        if (blockKey(a.m, n.bare)) continue;
        segs = [L.w(art), nseg(n), { fr: adjForm(a.info, a.m, n.g, false), cur: a.cur, cat: 'adjective' }];
      }
      en = `${aAn(aEn)} ${aEn} ${enN(n)}`;
      if (lead) push(out, 'adjnp', [L.w(lead), ...segs], `${lead === "c'est" ? "it's" : FRAMES[lead].en} ${en}`, [n]);
      else push(out, 'adjnp', segs, en, [n]);
      break;
    }
  }
};

/** "j’ai un chien mais tu as un chat". */
const genMais: Gen = (L, out) => {
  if (!L.has('mais')) return;
  const frames = L.frames('have');
  if (frames.length < 2) return;
  const nouns = L.nouns.filter(n => canHave(n) && npIndef(L, n));
  for (let i = 0; i < nouns.length && famCount(out, 'mais') < LIMIT; i++) {
    const a = nouns[i];
    const b = partner(L, a, n => canHave(n) && !!npIndef(L, n), true);
    if (!b) continue;
    const f1 = frames[i % frames.length];
    const f2 = frames[(i + 1) % frames.length];
    if (f1 === f2) continue;
    const x = npIndef(L, a)!, y = npIndef(L, b)!;
    push(out, 'mais', [L.w(f1), ...x.segs, L.w('mais'), L.w(f2), ...y.segs],
      `${FRAMES[f1].en} ${x.en} but ${FRAMES[f2].en} ${y.en}`, [a, b]);
  }
};

/** "j’ai un chien aussi" → "I have a dog too". */
const genAussi: Gen = (L, out) => {
  if (!L.has('aussi')) return;
  const frames = L.frames('have');
  let i = 0;
  for (const n of L.nouns.filter(canHave)) {
    if (famCount(out, 'aussi') >= LIMIT || !frames.length) break;
    const np = npIndef(L, n);
    if (!np) continue;
    const f = frames[i++ % frames.length];
    push(out, 'aussi', [L.w(f), ...np.segs, L.w('aussi')], `${FRAMES[f].en} ${np.en} too`, [n]);
  }
};

/** Plurals: "nous avons des livres", "les livres et les cahiers", "ils sont contents". */
const genPlural: Gen = (L, out) => {
  const frames = L.frames('have');
  let i = 0;
  for (const n of L.nouns.filter(canHave)) {
    if (famCount(out, 'plural') >= LIMIT || !frames.length) break;
    const np = npPlural(L, n, 'des');
    if (!np) continue;
    const f = frames[i++ % frames.length];
    push(out, 'plural', [L.w(f), ...np.segs], `${FRAMES[f].en} ${np.en}`, [n]);
  }
  if (L.has('et')) {
    for (const a of L.nouns.filter(n => !COORD_SKIP.has(n.bare))) {
      if (famCount(out, 'plural') >= LIMIT * 2) break;
      const x = npPlural(L, a, 'les');
      const b = x && partner(L, a, n => !COORD_SKIP.has(n.bare) && !!npPlural(L, n, 'les'), true);
      const y = b && npPlural(L, b, 'les');
      if (x && b && y) push(out, 'plural', [...x.segs, L.w('et'), ...y.segs], `${x.en} and ${y.en}`, [a, b]);
    }
  }
  // Noun subject plural + adjective: "les maisons sont grandes".
  if (L.has('ils sont') || L.has('elles sont')) {
    const sCur = L.cur('ils sont') || L.cur('elles sont');
    for (const n of L.nouns) {
      const np = npPlural(L, n, 'les');
      if (!np) continue;
      const a = L.adjs.find(x => fits(x, n));
      if (!a) continue;
      push(out, 'plural', [...np.segs, { fr: 'sont', cur: sCur }, { fr: adjForm(a.info, a.m, n.g, true), cur: a.cur, cat: 'adjective' }],
        `${np.en} are ${adjEn(a, n)}`, [n]);
      if (famCount(out, 'plural') >= LIMIT * 3) break;
    }
  }
};

/** "il y a une gare ici". */
const genIlYa: Gen = (L, out) => {
  if (!L.has('il y a')) return;
  const advs = ['ici', 'là'].filter(k => L.has(k));
  let i = 0;
  for (const n of L.nouns) {
    if (famCount(out, 'ilya') >= LIMIT) break;
    if (has(n, 'body', 'weather', 'abstract', 'problem') || NO_HAVE.has(n.bare)) continue;
    const np = npIndef(L, n);
    if (!np) continue;
    const adv = advs.length ? advs[i++ % advs.length] : null;
    push(out, 'ilya', [L.w('il y a'), ...np.segs, ...(adv ? [L.w(adv)] : [])],
      `there is ${np.en}${adv ? ' ' + LOC_EN[adv] : ''}`, [n]);
  }
};

const PREP_EN: Record<string, string> = {
  dans: 'in', sur: 'on', sous: 'under', devant: 'in front of', derrière: 'behind', 'à côté de': 'next to',
};

function prepFits(prep: string, ref: Noun): boolean {
  switch (prep) {
    case 'dans': return has(ref, 'container', 'room', 'dwelling');
    case 'sur': return has(ref, 'surface');
    case 'sous': return ['table', 'chaise', 'lit', 'pluie', 'soleil'].includes(ref.bare);
    case 'devant': case 'derrière': return has(ref, 'place', 'dwelling') || ['porte', 'fenêtre', 'arbre'].includes(ref.bare);
    case 'à côté de': return has(ref, 'place', 'dwelling', 'furniture') || ['porte', 'fenêtre', 'arbre'].includes(ref.bare);
  }
  return false;
}

function ppLoc(L: Lex, prep: string, ref: Noun): Seg[] | null {
  if (prep === 'à côté de') return ppDe(L, prep, ref);
  const np = npDef(L, ref);
  return np ? [L.w(prep), ...np.segs] : null;
}

/** Things that can be "on the table / in the kitchen" (not places, events, ideas). */
const locatable = (n: Noun) => !n.mass && !n.pl && !n.multi
  && !has(n, 'place', 'weather', 'abstract', 'body', 'problem', 'event', 'transport');

/** Is `ref` a sensible reference point for `thing` with this preposition? */
function refOk(prep: string, thing: Noun, ref: Noun): boolean {
  if (ref === thing || !prepFits(prep, ref)) return false;
  if (has(thing, 'furniture') && has(ref, 'furniture')) return false;
  const living = has(thing, 'person', 'animal');
  if (living && SMALL_CONTAINERS.has(ref.bare)) return false;
  if (has(thing, 'person') && (prep === 'sur' || prep === 'sous')) return false;
  return true;
}

/** "le livre est sur la table" / "il y a un chat sous la table" / "je suis à l’école". */
const genPP: Gen = (L, out) => {
  const preps = Object.keys(PREP_EN).filter(p => L.has(p));
  for (const prep of preps) {
    for (const thing of L.nouns.filter(locatable)) {
      if (famCount(out, 'pp') >= LIMIT * 2) break;
      const ref = L.nouns.find(r => refOk(prep, thing, r));
      if (!ref) continue;
      const pp = ppLoc(L, prep, ref);
      if (!pp) continue;
      const subj = npDef(L, thing);
      if (L.hasEst && subj) push(out, 'pp', [...subj.segs, { fr: 'est', cur: L.estCur }, ...pp], `${subj.en} is ${PREP_EN[prep]} the ${enN(ref)}`, [thing, ref]);
      const ind = npIndef(L, thing);
      if (L.has('il y a') && ind) push(out, 'pp', [L.w('il y a'), ...ind.segs, ...pp], `there is ${ind.en} ${PREP_EN[prep]} the ${enN(ref)}`, [thing, ref]);
    }
  }
  // People: "je suis avec un ami", "il est à l’école", "elle est dans la cuisine".
  const beFrames = L.frames('be').filter(k => FRAMES[k].subj !== 'vous');
  let i = 0;
  for (const f of beFrames) {
    if (L.has('avec')) {
      const p = L.nouns.filter(n => has(n, 'person') && !n.pl)[i % 3];
      const np = p && npIndef(L, p);
      if (p && np) push(out, 'pp', [L.w(f), L.w('avec'), ...np.segs], `${FRAMES[f].en} with ${np.en}`, [p]);
    }
    // "je suis à l’école / au restaurant / à la maison (at home)".
    const aPlace = L.nouns.filter(n => A_PLACES.has(n.bare) && !n.pl && has(n, 'place'))[i % 4];
    if (aPlace) {
      const pp = ppA(L, aPlace);
      if (pp) push(out, 'pp', [L.w(f), ...pp], `${FRAMES[f].en} ${atPlaceEn(aPlace, false)}`, [aPlace]);
    }
    // "elle est dans la cuisine" (rooms / inside places).
    const inPlace = L.nouns.filter(n => has(n, 'room') || (has(n, 'place') && has(n, 'container') && !A_PLACES.has(n.bare)))[i % 3];
    if (inPlace && L.has('dans')) {
      const d = npDef(L, inPlace);
      if (d) push(out, 'pp', [L.w(f), L.w('dans'), ...d.segs], `${FRAMES[f].en} in the ${enN(inPlace)}`, [inPlace]);
    }
    i++;
  }
  // "un café sans sucre".
  if (L.has('sans')) {
    const extra = L.nouns.find(n => n.bare === 'sucre');
    for (const head of L.nouns.filter(n => ['café', 'thé'].includes(n.bare) && npIndef(L, n))) {
      if (!extra) break;
      const np = npIndef(L, head)!;
      push(out, 'pp', [...np.segs, L.w('sans'), nseg(extra)], `${np.en} without ${extra.en}`, [head, extra]);
    }
  }
};

/** Objects that fit an infinitive (with its article). */
function infObjects(L: Lex, v: Verb): NP[] {
  const spec = VERB_OBJ[v.inf];
  if (!spec) return [];
  const res: NP[] = [];
  for (const n of L.nouns) {
    const ok = (spec.nouns && spec.nouns.has(n.bare)) || (spec.cls && spec.cls.some(c => n.cls.has(c)));
    if (!ok) continue;
    const np = spec.det === 'def' ? npDef(L, n) : npIndef(L, n);
    if (np) res.push(np);
  }
  return res;
}

/** Reflexive infinitive after a je-frame: se lever → me lever, s’habiller → m’habiller. */
function reflexiveForJe(inf: string): string {
  if (inf.startsWith("s'")) return `m'${inf.slice(2)}`;
  if (inf.startsWith('se ')) return `me ${inf.slice(3)}`;
  return inf;
}

interface InfPhrase { segs: Seg[]; en: string; nouns: Noun[] }

/**
 * Infinitive phrases usable after a modal (object included when the verb
 * needs one): "fermer la porte", "me lever", "étudier". Current-level verbs
 * first; within a group, verbs with an object, then reflexives, then
 * intransitives, so a session mixes them. `okVerb` narrows the verbs (e.g.
 * only "likeable" activities after j’aime).
 */
function infPhrases(L: Lex, limit = 6, okVerb: (inf: string) => boolean = () => true): InfPhrase[] {
  const build = (v: Verb): InfPhrase | null => {
    if (!okVerb(v.inf)) return null;
    if (REFLEXIVE_OK.has(v.inf)) return { segs: [{ fr: reflexiveForJe(v.inf), cur: v.cur, cat: 'verbPhrase' }], en: v.en, nouns: [] };
    const objs = infObjects(L, v);
    const obj = objs.find(o => o.n.cur) ?? objs[0];
    if (obj) return { segs: [{ fr: v.inf, cur: v.cur, cat: 'verbPhrase' }, ...obj.segs], en: `${v.en} ${obj.en}`, nouns: [obj.n] };
    if (INTRANS.has(v.inf)) return { segs: [{ fr: v.inf, cur: v.cur, cat: 'verbPhrase' }], en: v.en, nouns: [] };
    return null;
  };
  const rank = (p: InfPhrase) => (p.nouns.length ? 0 : /^m(e |')/.test(p.segs[0].fr) ? 1 : 2);
  const group = (cur: boolean) => L.verbs.filter(v => v.cur === cur).map(build).filter((p): p is InfPhrase => !!p);
  // Interleave the three kinds inside each group so the first few are varied.
  const interleave = (list: InfPhrase[]) => {
    const buckets = [0, 1, 2].map(r => list.filter(p => rank(p) === r));
    const outList: InfPhrase[] = [];
    while (buckets.some(b => b.length)) for (const b of buckets) { const p = b.shift(); if (p) outList.push(p); }
    return outList;
  };
  return [...interleave(group(true)), ...interleave(group(false))].slice(0, limit);
}

/** Abstract nouns you can still "want" (un emploi, une réduction…). */
const WANT_ABSTRACT = set('emploi|travail|réduction|promotion|invitation|recette|menu');
/** Wantable things: count objects / food / drink / events (not people or places). */
const wantable = (n: Noun) => !has(n, 'person', 'body', 'weather', 'problem')
  && (!has(n, 'place') || has(n, 'dwelling'))
  && (!has(n, 'abstract') || WANT_ABSTRACT.has(n.bare))
  && !NO_HAVE.has(n.bare);

/** "j’aime le café", "je veux un livre", "je peux étudier", "je vais à la gare", "je parle avec le professeur". */
const genModal: Gen = (L, out) => {
  const infs = infPhrases(L);
  // After j’aime / je préfère: a bare activity ("j’aime voyager"), no object.
  const likeInfs: InfPhrase[] = [...L.verbs.filter(v => v.cur), ...L.verbs.filter(v => !v.cur)]
    .filter(v => LIKE_OK.has(v.inf))
    .slice(0, 2)
    .map(v => ({ segs: [{ fr: reflexiveForJe(v.inf), cur: v.cur, cat: 'verbPhrase' as WordCategory }], en: v.en, nouns: [] }));
  // aimer / préférer + generic noun: drinks & mass nouns stay singular
  // ("j’aime le café" = I like coffee), count nouns go plural ("les livres").
  for (const f of L.frames('like')) {
    let n = 0;
    for (const x of L.nouns) {
      if (n >= 3) break;
      if (has(x, 'person', 'body', 'problem', 'abstract') || (has(x, 'place') && !has(x, 'dwelling'))) continue;
      const generic = x.mass || has(x, 'drink');
      const np = generic ? npDef(L, x) : npPlural(L, x, 'les');
      if (!np) continue;
      push(out, 'modal', [L.w(f), ...np.segs], `${FRAMES[f].en} ${generic ? enN(x) : pluralEn(x.en) + x.tag}`, [x]);
      n++;
    }
    for (const p of likeInfs) push(out, 'modal', [L.w(f), ...p.segs], `${FRAMES[f].en} to ${p.en}`, p.nouns);
  }
  for (const f of L.frames('want')) {
    let n = 0;
    for (const x of L.nouns.filter(wantable)) {
      if (n >= 3) break;
      const np = npIndef(L, x) ?? npPartitive(L, x);
      if (!np) continue;
      push(out, 'modal', [L.w(f), ...np.segs], `${FRAMES[f].en} ${np.n.mass ? 'some ' : ''}${np.en}`, [x]);
      n++;
    }
    for (const p of infs.slice(0, 2)) push(out, 'modal', [L.w(f), ...p.segs], `${FRAMES[f].en} to ${p.en}`, p.nouns);
  }
  for (const f of L.frames('modal')) {
    for (const p of infs.slice(0, 3)) push(out, 'modal', [L.w(f), ...p.segs], `${FRAMES[f].en} ${p.en}`, p.nouns);
  }
  if (L.has('il faut')) {
    for (const x of L.nouns.filter(wantable).slice(0, 3)) {
      const np = npIndef(L, x);
      if (np) push(out, 'modal', [L.w('il faut'), ...np.segs], `you need ${np.en}`, [x]);
    }
    // Impersonal "il faut" can't take "me lever" (it would be "se lever").
    for (const p of infs.filter(x => !/^m(e |')/.test(x.segs[0].fr)).slice(0, 2)) {
      push(out, 'modal', [L.w('il faut'), ...p.segs], `you have to ${p.en}`, p.nouns);
    }
  }
  if (L.has('je vais')) {
    for (const x of L.nouns.filter(n => A_PLACES.has(n.bare) && !n.pl).slice(0, 4)) {
      const pp = ppA(L, x);
      if (pp) push(out, 'modal', [L.w('je vais'), ...pp], `I'm going ${atPlaceEn(x, true)}`, [x]);
    }
    for (const p of infs.slice(0, 2)) push(out, 'modal', [L.w('je vais'), ...p.segs], `I'm going to ${p.en}`, p.nouns);
  }
  if (L.has('je parle') && L.has('avec')) {
    for (const x of L.nouns.filter(n => has(n, 'person') && !n.pl).slice(0, 3)) {
      const np = npDef(L, x) ?? npIndef(L, x);
      if (np) push(out, 'modal', [L.w('je parle'), L.w('avec'), ...np.segs], `I speak with ${np.en}`, [x]);
    }
  }
};

/** "où est la gare ?", "quand est l’examen ?", "est-ce que tu as un livre ?". */
const genQuestion: Gen = (L, out) => {
  const est: Seg = { fr: 'est', cur: L.estCur };
  if (L.hasEst) {
    if (L.has('où')) {
      for (const n of L.nouns.filter(x => !x.mass && !x.pl && has(x, 'place', 'object', 'person', 'animal', 'device', 'clothing')).slice(0, 4)) {
        const np = npDef(L, n);
        if (np) push(out, 'question', [L.w('où'), est, ...np.segs], `where is ${np.en}`, [n], true);
      }
    }
    if (L.has('quand')) {
      for (const n of L.nouns.filter(x => has(x, 'event') && !x.pl).slice(0, 3)) {
        const np = npDef(L, n);
        if (np) push(out, 'question', [L.w('quand'), est, ...np.segs], `when is ${np.en}`, [n], true);
      }
    }
    if (L.has('qui')) {
      for (const n of L.nouns.filter(x => has(x, 'person') && !has(x, 'family') && !x.pl).slice(0, 2)) {
        const np = npDef(L, n);
        if (np) push(out, 'question', [L.w('qui'), est, ...np.segs], `who is ${np.en}`, [n], true);
      }
    }
  }
  if (L.has('est-ce que')) {
    if (L.has('tu as')) {
      for (const n of L.nouns.filter(canHave).slice(0, 3)) {
        const np = npIndef(L, n);
        if (np) push(out, 'question', [L.w('est-ce que'), L.w('tu as'), ...np.segs], `do you have ${np.en}`, [n], true);
      }
    }
    for (const adv of ['ici', 'là'].filter(k => L.has(k))) {
      if (L.has('tu es')) push(out, 'question', [L.w('est-ce que'), L.w('tu es'), L.w(adv)], `are you ${LOC_EN[adv]}`, [], true);
    }
  }
  if (L.has("qu'est-ce que") && L.has("c'est")) {
    push(out, 'question', [L.w("qu'est-ce que"), L.w("c'est")], 'what is it', [], true);
  }
  for (const q of ['quel', 'quelle']) {
    if (!L.has(q)) continue;
    for (const n of L.nouns.filter(x => x.g === (q === 'quel' ? 'm' : 'f') && !x.pl && !x.mass).slice(0, 2)) {
      push(out, 'question', [L.w(q), nseg(n)], `which ${enN(n)}`, [n], true);
    }
  }
};

/** Negation: "ce n’est pas un livre", "il n’est pas ici", "le livre n’est pas là". */
const BE_NEG: Record<string, [string, string]> = {
  'je suis': ['je ne suis', 'pas'], 'tu es': ["tu n'es", 'pas'], 'il est': ["il n'est", 'pas'],
  'elle est': ["elle n'est", 'pas'], 'nous sommes': ['nous ne sommes', 'pas'], 'vous êtes': ["vous n'êtes", 'pas'],
  'ils sont': ['ils ne sont', 'pas'], 'elles sont': ['elles ne sont', 'pas'],
};
const genNeg: Gen = (L, out) => {
  if (!L.has('ne pas')) return;
  const nc = L.cur('ne pas');
  if (L.has("c'est")) {
    for (const n of L.nouns.slice(0, 6)) {
      const np = npIndef(L, n);
      if (np) push(out, 'neg', [{ fr: "ce n'est", cur: nc || L.cur("c'est") }, { fr: 'pas', cur: nc }, ...np.segs], `it's not ${np.en}`, [n]);
    }
  }
  const advs = ['ici', 'là'].filter(k => L.has(k));
  let i = 0;
  for (const f of L.frames('be')) {
    const [a, b] = BE_NEG[f];
    const adv = advs[i++ % Math.max(1, advs.length)];
    if (adv) push(out, 'neg', [{ fr: a, cur: nc || L.cur(f) }, { fr: b, cur: nc }, L.w(adv)], `${FRAMES[f].en} not ${LOC_EN[adv]}`, []);
  }
  if (L.hasEst && advs.length) {
    for (const n of L.nouns.filter(x => !x.mass && !x.pl && !has(x, 'abstract', 'weather')).slice(0, 4)) {
      const np = npDef(L, n);
      const adv = advs[i++ % advs.length];
      if (np) push(out, 'neg', [...np.segs, { fr: "n'est", cur: nc }, { fr: 'pas', cur: nc }, L.w(adv)], `${np.en} is not ${LOC_EN[adv]}`, [n]);
    }
  }
};

/** "je suis ici parce que j’ai un cours" / "il est content parce qu’il a un chien". */
const genBecause: Gen = (L, out) => {
  if (!L.has('parce que')) return;
  const pc = L.cur('parce que');
  const pairs: [string, string][] = [['je suis', "j'ai"], ['il est', 'il a'], ['elle est', 'elle a'], ['tu es', 'tu as']];
  for (const [be, hv] of pairs) {
    if (!L.has(be) || !L.has(hv)) continue;
    const F = FRAMES[be];
    const adj = L.adjs.find(a => (a.info.fit === 'person') && (F.g || invariableGender(a)));
    const first: Seg[] = adj
      ? [L.w(be), { fr: adjForm(adj.info, adj.m, F.g, false), cur: adj.cur, cat: 'adjective' }]
      : L.has('ici') ? [L.w(be), L.w('ici')] : [];
    if (!first.length) continue;
    const firstEn = adj ? `${F.en} ${adj.info.en}` : `${F.en} here`;
    for (const n of L.nouns.filter(canHave).slice(0, 3)) {
      const np = npIndef(L, n);
      if (!np) continue;
      // parce que + il/elle → parce qu’il / parce qu’elle.
      const hvSeg: Seg[] = elides(hv)
        ? [{ fr: 'parce', cur: pc }, { fr: `qu'${hv}`, cur: pc || L.cur(hv) }]
        : [{ fr: 'parce que', cur: pc }, L.w(hv)];
      push(out, 'because', [...first, ...hvSeg, ...np.segs], `${firstEn} because ${FRAMES[hv].en} ${np.en}`, [n]);
    }
  }
};

const TIME_EN: Record<string, string> = { maintenant: 'now', "aujourd'hui": 'today', demain: 'tomorrow', hier: 'yesterday' };

/** "j’ai un examen demain", "je suis ici maintenant", "il est toujours content", "je vais bien". */
const genTime: Gen = (L, out) => {
  const times = ['maintenant', "aujourd'hui", 'demain'].filter(k => L.has(k));
  let i = 0;
  if (times.length) {
    for (const f of L.frames('have')) {
      for (const n of L.nouns.filter(x => has(x, 'event') && canHave(x)).slice(0, 3)) {
        const np = npIndef(L, n);
        const t = times[i++ % times.length];
        if (np) push(out, 'time', [L.w(f), ...np.segs, L.w(t)], `${FRAMES[f].en} ${np.en} ${TIME_EN[t]}`, [n]);
      }
      break;
    }
    if (L.has('je suis') && L.has('ici')) {
      const t = times[i++ % times.length];
      push(out, 'time', [L.w('je suis'), L.w('ici'), L.w(t)], `I am here ${TIME_EN[t]}`, []);
    }
    if (L.has('je pars')) {
      for (const t of times) push(out, 'time', [L.w('je pars'), L.w(t)], `I'm leaving ${TIME_EN[t]}`, []);
    }
  }
  if (L.has('toujours')) {
    for (const f of L.frames('be').filter(k => FRAMES[k].g)) {
      const a = L.adjs.find(x => x.info.fit === 'person' || x.info.fit === 'living');
      if (a) push(out, 'time', [L.w(f), L.w('toujours'), { fr: adjForm(a.info, a.m, FRAMES[f].g, !!FRAMES[f].pl), cur: a.cur, cat: 'adjective' }],
        `${FRAMES[f].en} always ${a.info.en}`, []);
      if (L.has('ici')) push(out, 'time', [L.w(f), L.w('toujours'), L.w('ici')], `${FRAMES[f].en} still here`, []);
    }
  }
  if (L.has('bien') && L.has('je vais')) push(out, 'time', [L.w('je vais'), L.w('bien')], "I'm fine", []);
  if (L.has('je parle')) {
    if (L.has('bien')) push(out, 'time', [L.w('je parle'), L.w('bien')], 'I speak well', []);
    if (L.has('un peu')) push(out, 'time', [L.w('je parle'), L.w('un peu')], 'I speak a little', []);
  }
  if (L.has('beaucoup') && L.has("j'aime")) {
    for (const x of L.nouns.filter(n => n.mass && !has(n, 'weather')).slice(0, 2)) {
      const np = npDef(L, x);
      if (np) push(out, 'time', [L.w("j'aime"), L.w('beaucoup'), ...np.segs], `I really like ${enN(x)}`, [x]);
    }
  }
};

/** "j’habite ici", "j’habite dans une maison", "j’habite à côté de la gare". */
const genHabiter: Gen = (L, out) => {
  if (!L.has("j'habite")) return;
  const f = L.w("j'habite");
  if (L.has('ici')) push(out, 'habiter', [f, L.w('ici')], 'I live here', []);
  if (L.has('dans')) {
    for (const n of L.nouns.filter(x => has(x, 'dwelling'))) {
      const np = npIndef(L, n);
      if (np) push(out, 'habiter', [f, L.w('dans'), ...np.segs], `I live in ${np.en}`, [n]);
    }
  }
  if (L.has('à côté de')) {
    for (const n of L.nouns.filter(x => has(x, 'place') && !has(x, 'room', 'dwelling') && !x.pl).slice(0, 3)) {
      const pp = ppDe(L, 'à côté de', n);
      if (pp) push(out, 'habiter', [f, ...pp], `I live next to the ${enN(n)}`, [n]);
    }
  }
  if (L.has('avec')) {
    for (const n of L.nouns.filter(x => has(x, 'family') && !x.pl).slice(0, 2)) {
      const np = npPoss(L, 'my', n);
      if (np) push(out, 'habiter', [f, L.w('avec'), ...np.segs], `I live with ${np.en}`, [n]);
    }
  }
};

/** "je prends le train", "je mange une pomme", "je bois un café", "j’achète un billet". */
const genAction: Gen = (L, out) => {
  if (L.has('je prends')) {
    for (const n of L.nouns.filter(x => has(x, 'transport'))) {
      const np = npDef(L, n);
      if (np) push(out, 'action', [L.w('je prends'), ...np.segs], `I take ${np.en}`, [n]);
    }
    for (const n of L.nouns.filter(x => has(x, 'food', 'drink') && !x.mass).slice(0, 2)) {
      const np = npIndef(L, n);
      if (np) push(out, 'action', [L.w('je prends'), ...np.segs], `I'll have ${np.en}`, [n]);
    }
  }
  const eatDrink: [string, Cls, string][] = [['je mange', 'food', 'I eat'], ['je bois', 'drink', 'I drink'], ["j'ai mangé", 'food', 'I ate'], ['je vais manger', 'food', "I'm going to eat"]];
  for (const [f, cls, en] of eatDrink) {
    if (!L.has(f)) continue;
    for (const n of L.nouns.filter(x => has(x, cls) && !MEALS.has(x.bare)).slice(0, 4)) {
      const np = npIndef(L, n) ?? npPartitive(L, n);
      if (np) push(out, 'action', [L.w(f), ...np.segs], `${en} ${np.en}`, [n]);
    }
  }
  if (L.has("j'achète")) {
    for (const n of L.nouns.filter(x => VERB_OBJ['acheter'].nouns!.has(x.bare) || has(x, 'clothing')).slice(0, 4)) {
      const np = npIndef(L, n);
      if (np) push(out, 'action', [L.w("j'achète"), ...np.segs], `I buy ${np.en}`, [n]);
    }
  }
  if (L.has('je viens') && L.has('avec')) {
    for (const n of L.nouns.filter(x => has(x, 'person') && !x.pl).slice(0, 2)) {
      const np = npIndef(L, n);
      if (np) push(out, 'action', [L.w('je viens'), L.w('avec'), ...np.segs], `I'm coming with ${np.en}`, [n]);
    }
  }
};

const QUANT_EN: Record<string, string> = { 'beaucoup de': 'a lot of', 'un peu de': 'a little', 'trop de': 'too much', 'assez de': 'enough' };
const FREQ_EN: Record<string, string> = { souvent: 'often', parfois: 'sometimes', rarement: 'rarely' };

/** "j’ai de l’argent", "j’ai beaucoup de livres", "je prends souvent le train". */
const genQuant: Gen = (L, out) => {
  const hv = L.frames('have')[0];
  if (hv) {
    for (const n of L.nouns.filter(x => x.mass && ['argent'].includes(x.bare))) {
      const np = npPartitive(L, n);
      if (np) push(out, 'quant', [L.w(hv), ...np.segs], `${FRAMES[hv].en} ${np.en}`, [n]);
    }
    for (const q of Object.keys(QUANT_EN).filter(k => L.has(k))) {
      // "un peu de" only goes with uncountables (un peu de sucre, not d’amis).
      const okNoun = (x: Noun) => x.mass
        ? ['argent', 'sucre', 'pain', 'fromage'].includes(x.bare)
        : q !== 'un peu de' && canHave(x) && !has(x, 'food', 'drink');
      for (const n of L.nouns.filter(okNoun).slice(0, 3)) {
        if (n.multi) continue;
        const word = n.mass ? n.bare : n.pl ? n.bare : pluralFr(n.bare);
        if (!word) continue;
        const enW = n.mass ? enN(n) : enPl(n);
        const qEn = q === 'trop de' && !n.mass ? 'too many' : QUANT_EN[q];
        push(out, 'quant', [L.w(hv), ...withDe(q, L.cur(q), word).map((s, i) => (i === 1 || s.fr === word ? { ...s, cur: s.cur || n.cur, key: true, cat: 'noun' as WordCategory } : s))],
          `${FRAMES[hv].en} ${qEn} ${enW}`, [n]);
      }
    }
  }
  for (const fq of Object.keys(FREQ_EN).filter(k => L.has(k))) {
    if (L.has('je prends')) {
      const n = L.nouns.find(x => has(x, 'transport'));
      const np = n && npDef(L, n);
      if (n && np) push(out, 'quant', [L.w('je prends'), L.w(fq), ...np.segs], `I ${FREQ_EN[fq]} take ${np.en}`, [n]);
    }
    for (const [f, cls, en] of [['je mange', 'food', 'eat'], ['je bois', 'drink', 'drink']] as [string, Cls, string][]) {
      if (!L.has(f)) continue;
      const n = L.nouns.find(x => has(x, cls) && x.mass);
      const np = n && npPartitive(L, n);
      if (n && np) push(out, 'quant', [L.w(f), L.w(fq), ...np.segs], `I ${FREQ_EN[fq]} ${en} ${np.en}`, [n]);
    }
  }
};

/** "j’ai besoin d’un billet", "j’ai envie d’un café", "j’ai besoin de partir". */
const genNeed: Gen = (L, out) => {
  for (const f of ["j'ai besoin de", "j'ai envie de"]) {
    if (!L.has(f)) continue;
    const fc = L.cur(f);
    const base = f.replace(/ de$/, '');
    const envie = f === "j'ai envie de";
    const pick = envie
      ? (n: Noun) => ENVIE_OK.has(n.bare)
      : (n: Noun) => (wantable(n) || ['médecin', 'professeur'].includes(n.bare)) && !has(n, 'abstract');
    for (const n of L.nouns.filter(pick).slice(0, 4)) {
      const d = deIndef(L, n);
      if (d) push(out, 'need', [{ fr: base, cur: fc }, ...d], `${FRAMES[f].en} ${aAn(n.en)} ${enN(n)}`, [n]);
    }
    const infs = infPhrases(L, 3, envie ? inf => LIKE_OK.has(inf) : undefined);
    for (const p of infs) {
      const [first, ...rest] = p.segs;
      const de = withDe(f, fc, first.fr);
      const en = f === "j'ai envie de" ? `I feel like ${gerund(p.en)}` : `I need to ${p.en}`;
      push(out, 'need', [de[0], { ...de[1], cur: de[1].cur || first.cur, cat: 'verbPhrase' }, ...rest], en, p.nouns);
    }
  }
};

/** "j’ai fini le livre", "elle est allée à la gare", "je viens de finir le projet". */
const genPast: Gen = (L, out) => {
  for (const f of ["j'ai fini", 'je viens de finir']) {
    if (!L.has(f)) continue;
    for (const n of L.nouns.filter(x => has(x, 'task')).slice(0, 4)) {
      const np = npDef(L, n);
      if (np) push(out, 'past', [L.w(f), ...np.segs], `${FRAMES[f].en} ${np.en}`, [n]);
    }
  }
  for (const f of L.frames('went')) {
    for (const n of L.nouns.filter(x => A_PLACES.has(x.bare) && !x.pl).slice(0, 3)) {
      const pp = ppA(L, n);
      if (pp) push(out, 'past', [L.w(f), ...pp], `${FRAMES[f].en} ${atPlaceEn(n, true)}`, [n]);
    }
  }
  if (L.has('hier')) {
    for (const f of ["j'ai fini", "j'ai mangé"].filter(k => L.has(k))) {
      const n = L.nouns.find(x => has(x, f === "j'ai fini" ? 'task' : 'food'));
      const np = n && (f === "j'ai fini" ? npDef(L, n) : npIndef(L, n) ?? npPartitive(L, n));
      if (n && np) push(out, 'past', [L.w(f), ...np.segs, L.w('hier')], `${FRAMES[f].en} ${np.en} yesterday`, [n]);
    }
  }
  for (const p of ['après', 'avant', 'pendant'].filter(k => L.has(k))) {
    const pEn = p === 'après' ? 'after' : p === 'avant' ? 'before' : 'during';
    for (const n of L.nouns.filter(x => has(x, 'event') && !x.pl).slice(0, 2)) {
      const np = npDef(L, n);
      if (!np) continue;
      if (L.has('je suis') && L.has('ici')) push(out, 'past', [L.w('je suis'), L.w('ici'), L.w(p), ...np.segs], `I am here ${pEn} ${np.en}`, [n]);
    }
  }
  if (L.has('récemment') && L.has("j'ai fini")) {
    const n = L.nouns.find(x => has(x, 'task'));
    const np = n && npDef(L, n);
    if (n && np) push(out, 'past', [L.w("j'ai fini"), ...np.segs, L.w('récemment')], `I finished ${np.en} recently`, [n]);
  }
};

/** "je me lève maintenant", "je dois me lever", "je veux fermer la porte". */
const genRoutine: Gen = (L, out) => {
  if (L.has('je me lève')) {
    push(out, 'routine', [L.w('je me lève')], 'I get up', []);
    for (const t of ['maintenant', 'demain'].filter(k => L.has(k))) push(out, 'routine', [L.w('je me lève'), L.w(t)], `I get up ${TIME_EN[t]}`, []);
  }
  const modals = [...L.frames('modal'), ...L.frames('want'), ...(L.has('je vais') ? ['je vais'] : [])];
  const infs = infPhrases(L, 8).filter(p => p.segs.some(s => s.cur));
  let i = 0;
  for (const p of infs) {
    const f = modals[i++ % Math.max(1, modals.length)];
    if (!f) break;
    const fEn = f === 'je vais' ? "I'm going to" : FRAMES[f].kind === 'modal' ? FRAMES[f].en : `${FRAMES[f].en} to`;
    push(out, 'routine', [L.w(f), ...p.segs], `${fEn} ${p.en}`, p.nouns);
  }
};

/** Object pronouns / relatives: "je le prends", "je lui parle", "c’est le livre que je veux". */
const genLink: Gen = (L, out) => {
  // Object pronouns come from the dedicated cards ("le" = him / it (object)),
  // never from the article "le". Before a vowel only "les" stays unelided, so
  // "aime" only takes "les" (je l’aime would be ambiguous between le / la).
  const objFrames: [string, string, string][] = [['je prends', 'prends', "I'll take"], ['je veux', 'veux', 'I want'], ["j'aime", 'aime', 'I like']];
  for (const [f, verb, en] of objFrames) {
    if (!L.has(f)) continue;
    for (const [pr, prEn] of [['le', 'it (m.)'], ['la', 'it (f.)'], ['les', 'them']] as [string, string][]) {
      const key = `${pr}:obj`;
      if (!L.has(key) || (elides(verb) && pr !== 'les')) continue;
      push(out, 'link', [{ fr: 'je', cur: L.cur(f) }, { fr: pr, cur: L.cur(key) }, { fr: verb, cur: L.cur(f) }], `${en} ${prEn}`, []);
    }
  }
  if (L.has('lui') && L.has('je parle')) push(out, 'link', [{ fr: 'je', cur: L.cur('je parle') }, L.w('lui'), { fr: 'parle', cur: L.cur('je parle') }], 'I speak to him / her', []);
  if (L.has('que') && L.has("c'est") && L.has('je veux')) {
    for (const n of L.nouns.filter(x => wantable(x) && !x.pl).slice(0, 3)) {
      const np = npDef(L, n);
      if (np) push(out, 'link', [L.w("c'est"), ...np.segs, L.w('que'), L.w('je veux')], `it's ${np.en} (that) I want`, [n]);
    }
  }
};

/** Generation order = selection priority (most specific / advanced first). */
const FAMILIES: [string, Gen][] = [
  ['special', genSpecial], ['link', genLink], ['routine', genRoutine], ['past', genPast], ['need', genNeed],
  ['quant', genQuant], ['action', genAction], ['habiter', genHabiter], ['time', genTime], ['because', genBecause],
  ['neg', genNeg], ['question', genQuestion], ['modal', genModal], ['pp', genPP], ['ilya', genIlYa],
  ['plural', genPlural], ['adjnp', genAdjNp], ['poss', genPoss], ['beadj', genBeAdj], ['aussi', genAussi],
  ['mais', genMais], ['beloc', genBeLoc], ['have', genHave], ['cest', genCest], ['coord', genCoord],
];

// ── Distractors ─────────────────────────────────────────────────────────────

const SWAPS: Record<string, string[]> = {
  un: ['une'], une: ['un'], le: ['la'], la: ['le'], les: ['des'], des: ['les'],
  mon: ['ma'], ma: ['mon'], ton: ['ta'], ta: ['ton'], et: ['ou'], ou: ['et'],
  au: ['à la'], suis: ['es'], es: ['est'], est: ['es'],
};
const GENDER_SWAPS = new Set(['un', 'une', 'le', 'la', 'mon', 'ma', 'ton', 'ta']);

function distractorsFor(L: Lex, c: Cand, chips: string[]): string[] {
  const inPhrase = new Set(chips.map(t => t.toLowerCase()));
  const outList: string[] = [];
  const add = (w: string | undefined) => {
    if (!w) return;
    const t = typo(w);
    if (/\s/.test(t) || inPhrase.has(t.toLowerCase()) || outList.includes(t)) return;
    outList.push(t);
  };
  const known = (w: string) => L.has(w) || [...L.words.keys()].some(k => k.split(' ').includes(w));
  for (const chip of chips) {
    const k = normFr(chip);
    for (const s of SWAPS[k] ?? []) {
      if (c.epi && GENDER_SWAPS.has(k)) continue;
      if (known(s)) add(s);
    }
  }
  // Wrong adjective agreement (petite ↔ petit).
  if (!c.epi) {
    for (const a of L.adjs) {
      if (invariableGender(a)) continue;
      if (inPhrase.has(typo(a.info.f))) add(a.m);
      else if (inPhrase.has(typo(a.m))) add(a.info.f);
    }
  }
  // A couple of other nouns (current level first) — never one with the same
  // English gloss as a phrase noun (emploi / travail are both "job": offering
  // both would make two answers correct).
  const enKey = (n: Noun) => (n.en + n.tag).toLowerCase();
  const phraseEn = new Set(L.nouns.filter(n => c.nouns.includes(n.bare)).map(enKey));
  // Same chip style as the phrase: "l’école" chips when the phrase elides its
  // noun, bare nouns ("école") after un / une / mon…
  const elidedStyle = chips.some(t => /^l’/.test(t) && t.length > 2);
  for (const n of [...L.nouns.filter(x => x.cur), ...L.nouns.filter(x => !x.cur)]) {
    if (outList.length >= 4) break;
    if (c.nouns.includes(n.bare) || n.multi || phraseEn.has(enKey(n))) continue;
    add(n.el && elidedStyle ? `l'${n.bare}` : n.bare);
  }
  return outList.slice(0, 4);
}

// ── Selection ───────────────────────────────────────────────────────────────

/** Small deterministic PRNG (mulberry32) so a seed gives a stable shuffle. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function chipsOf(c: Cand): string[] {
  return c.segs.flatMap(s => s.fr.split(' ').filter(Boolean)).map(typo);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPhrase(L: Lex, c: Cand): GeneratedPhrase {
  const tokens = chipsOf(c);
  let blankIndex: number | undefined;
  let blankCategory: WordCategory | undefined;
  let pos = 0;
  for (const s of c.segs) {
    if (s.key && blankIndex === undefined) { blankIndex = pos; blankCategory = s.cat ?? 'noun'; }
    pos += s.fr.split(' ').filter(Boolean).length;
  }
  const en = capitalise(c.en.replace(/\bi\b/g, 'I')) + (c.q ? '?' : '');
  return {
    tokens,
    target: tokens.join(' ') + (c.q ? ' ?' : ''),
    en,
    blankIndex,
    blankCategory,
    distractors: distractorsFor(L, c, tokens),
  };
}

/**
 * Generate up to `max` phrases from Tree tokens. Each phrase uses at least one
 * current-level word; families are interleaved (most advanced first) and
 * nouns are rotated so a session doesn't repeat the same word. `seed` (≠ 0)
 * shuffles the noun order for variety between sessions; 0 = deterministic.
 */
export function generateFrenchV2(tokens: BuilderToken[], max = 5, seed = 0): GeneratedPhrase[] {
  const L = analyze(tokens);
  if (seed) {
    const rnd = rng(seed);
    L.nouns = [...shuffle(L.nouns.filter(n => n.cur), rnd), ...shuffle(L.nouns.filter(n => !n.cur), rnd)];
  } else {
    L.nouns = [...L.nouns.filter(n => n.cur), ...L.nouns.filter(n => !n.cur)];
  }

  const cands: Cand[] = [];
  for (const [, gen] of FAMILIES) gen(L, cands);

  // Anchor: at least one current-level piece.
  const byFam = new Map<string, Cand[]>();
  const seen = new Set<string>();
  for (const c of cands) {
    if (!c.segs.some(s => s.cur)) continue;
    const key = chipsOf(c).join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    byFam.set(c.fam, [...(byFam.get(c.fam) ?? []), c]);
  }

  const order = FAMILIES.map(([f]) => f).filter(f => byFam.has(f));
  const picked: Cand[] = [];
  // Variety: prefer candidates whose nouns AND current-level words (verbs,
  // frames, adjectives) were used least so far in this session.
  const use = new Map<string, number>();
  const keysOf = (c: Cand) => [...c.nouns, ...c.segs.filter(s => s.cur && !s.key).map(s => s.fr)];
  while (picked.length < max) {
    let progressed = false;
    for (const f of order) {
      if (picked.length >= max) break;
      const list = byFam.get(f)!;
      if (!list.length) continue;
      let best = 0;
      let bestScore = Infinity;
      list.forEach((c, i) => {
        const score = keysOf(c).reduce((s, k) => s + (use.get(k) ?? 0), 0);
        if (score < bestScore) { bestScore = score; best = i; }
      });
      const [c] = list.splice(best, 1);
      picked.push(c);
      for (const k of keysOf(c)) use.set(k, (use.get(k) ?? 0) + 1);
      progressed = true;
    }
    if (!progressed) break;
  }
  return picked.map(c => toPhrase(L, c));
}
