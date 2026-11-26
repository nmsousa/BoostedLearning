/**
 * English words/expressions that mean the same thing for a learner, so the app
 * never offers two of them as different answers ("Hi" next to "Hello" for
 * bonjour) and accepts any of them as a correct answer.
 *
 * Add a group when two valid translations of one word can show up together.
 */
const GROUPS: string[][] = [
  ['hello', 'hi', 'hey', 'good morning', 'good day', 'good afternoon'],
  ['bye', 'goodbye', 'see you', 'see you later'],
  ['thanks', 'thank you'],
  ['ok', 'okay', 'agreed', 'all right', 'alright'],
  ['sorry', 'pardon', 'excuse me'],
  ['film', 'movie'],
  ['flat', 'apartment'],
  ['underground', 'subway', 'metro'],
  ['pharmacy', 'chemist', 'chemist’s', 'drugstore'],
  ['trousers', 'pants'],
  ['trip', 'journey'],
  ['ill', 'sick'],
  ['great', 'awesome'],
  ['maybe', 'perhaps'],
  ['happy', 'glad', 'pleased'],
  ['small', 'little'],
  ['sir', 'mr', 'mister'],
  ['madam', 'mrs', 'ma’am'],
  ['job', 'position', 'post'],
  ['goal', 'objective', 'aim'],
  ['rise', 'increase'],
  ['deadline', 'time limit'],
  ['landlord', 'owner'],
  ['stomach', 'belly'],
  ['finally', 'in the end'],
  ['so', 'therefore'],
];

/** Lower-case, no leading article / "to", no trailing punctuation. */
export function normMeaning(s: string): string {
  return s.toLowerCase().replace(/[.!?]+$/, '').replace(/^(the|a|an|to)\s+/, '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
}

const INDEX = new Map<string, number>();
GROUPS.forEach((g, i) => g.forEach(w => INDEX.set(normMeaning(w), i)));

/** The other English words that mean the same as `en` (empty when unknown). */
export function synonymsOf(en: string): string[] {
  const i = INDEX.get(normMeaning(en));
  return i === undefined ? [] : GROUPS[i].filter(w => normMeaning(w) !== normMeaning(en));
}

/** True when the two English meanings are the same word or known synonyms. */
export function sameMeaning(a: string, b: string): boolean {
  const x = normMeaning(a);
  const y = normMeaning(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const ix = INDEX.get(x);
  return ix !== undefined && ix === INDEX.get(y);
}
