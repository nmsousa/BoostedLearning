/**
 * Article rule (see docs/LEVEL-ALGORITHM.md, "Articles"):
 * a French noun is ALWAYS shown and spoken with its article ("le café",
 * "un café"), and the English side mirrors it ("the coffee", "a coffee").
 * The gender is shown as a small badge ("Masculine · le") instead of a
 * "(m.)" note in the English text.
 *
 * Only words that are article + noun are changed. Bare function words
 * ("un" = "a (m.)", "le" = "the (m.)", "ma" = "my (f.)") keep their English
 * as authored, because there the note IS the meaning.
 */

export type Gender = 'm' | 'f';

const NOTE_RE = /\s*\((m|f)\.\)\s*$/;
const DEF_RE = /^(le|la|les)\s+\S/i;
const INDEF_RE = /^(un|une|des)\s+\S/i;
const ELIDED_RE = /^l['’]\S/i;

/** The article a French phrase starts with, or null if it isn't article + noun. */
export function frenchArticle(fr: string): string | null {
  const t = fr.trim();
  if (ELIDED_RE.test(t)) return 'l’';
  const m = DEF_RE.exec(t) ?? INDEF_RE.exec(t);
  return m ? m[1].toLowerCase() : null;
}

/** Gender of an article + noun phrase (from the article, or the "(m.)/(f.)" note for l’/les/des). */
export function genderOf(fr: string, en = ''): Gender | null {
  const art = frenchArticle(fr);
  if (!art) return null;
  if (art === 'le' || art === 'un') return 'm';
  if (art === 'la' || art === 'une') return 'f';
  const note = NOTE_RE.exec(en);
  return note ? (note[1] as Gender) : null;
}

/**
 * English for a French article + noun, with the matching English article and
 * without the gender note: ("l’hôtel", "hotel (m.)") → "the hotel",
 * ("un café", "coffee") → "a coffee". Anything else is returned unchanged.
 */
export function englishWithArticle(fr: string, en: string): string {
  const art = frenchArticle(fr);
  if (!art) return en;
  const bare = en.replace(NOTE_RE, '').trim();
  if (/^(the|a|an|some)\s/i.test(bare)) return bare;
  if (art === 'un' || art === 'une') return `${/^[aeiou]/i.test(bare) ? 'an' : 'a'} ${bare}`;
  if (art === 'des') return `some ${bare}`;
  return `the ${bare}`;
}
