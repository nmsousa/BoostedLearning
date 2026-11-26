/**
 * Word glossary: French word → its meaning(s), for tap-to-translate.
 *
 * A pure, framework-free module (the Angular wiring is glossary.service.ts).
 * The lookup works on the tokens of one sentence, so it can also recognise
 * multi-word phrases that cover a word ("je voudrais" = I would like): the
 * phrase is shown on each of its words, because "voudrais" alone has no
 * meaning worth showing.
 *
 * Sources are added in priority order (hand-written common words, lesson
 * words, curriculum words), then big noisy dictionaries as `fallback`, which
 * never override an existing entry.
 */
import { frenchArticle } from './articles';

export interface GlossEntry { fr: string; en: string }

/** What a tapped word shows: one line per meaning group (never empty strings). */
export interface TokenGloss { lines: string[] }

// Everything that is not part of the word itself: quotes, brackets, punctuation.
const EDGE = /^[\s«»"“”‘'’(\[¿¡…,.;:!?)\]—–-]+|[\s«»"“”‘'’)\]¿¡…,.;:!?(\[—–-]+$/g;

/** Lookup key: lower case, straight apostrophe, no edge punctuation. */
export function normKey(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[’‘]/g, "'").replace(EDGE, '').replace(/\s+/g, ' ');
}

/** Pretty form of a key for display ("j'ai" → "j’ai"). */
const curly = (s: string): string => s.replace(/'/g, '’');

/**
 * The meanings in an English gloss ("hello / good morning" → two). The gender
 * note of an article + noun ("hotel (m.)") belongs to the gender badge, not here.
 */
export function meaningsOf(fr: string, en: string): string[] {
  const e = frenchArticle(fr) ? en.replace(/\s*\((m|f)\.\)\s*$/, '') : en;
  return e.split(/\s+\/\s+|\s*;\s*/).map(x => x.trim()).filter(Boolean);
}

/** Elided little words: "j’" in j’habite. */
const ELISIONS: Record<string, string> = {
  "j'": 'I', "m'": 'me / myself', "t'": 'you / yourself', "s'": 'oneself / it', "l'": 'the / him / her / it',
  "n'": 'not', "d'": 'of / from', "c'": 'it / this', "qu'": 'that / what', "jusqu'": 'until',
  "lorsqu'": 'when', "puisqu'": 'since', "quoiqu'": 'although',
};

/** Plural / feminine endings → [ending, dictionary ending, note] ("petites" → "petit (plural)"). */
const VARIANTS: ReadonlyArray<readonly [string, string, string]> = [
  ['ées', 'é', 'f. plural'], ['ée', 'é', 'f.'], ['és', 'é', 'plural'], ['ienne', 'ien', 'f.'], ['euse', 'eux', 'f.'],
  ['ive', 'if', 'f.'], ['elle', 'el', 'f.'], ['ette', 'et', 'f.'], ['aux', 'al', 'plural'],
  ['es', '', 'plural'], ['s', '', 'plural'], ['x', '', 'plural'], ['e', '', 'f.'],
];

const MAX_MEANINGS = 5;
const SHOWN_MEANINGS = 3;

export interface AddOptions {
  /** Only fill keys nobody else has (noisy dictionaries). */
  fallback?: boolean;
  /** The keys of this source are final: later sources never add to them. */
  lock?: boolean;
}

export class Glossary {
  private readonly map = new Map<string, string[]>();
  private readonly locked = new Set<string>();
  private maxLen = 1;

  /** Number of keys (for tests / diagnostics). */
  get size(): number { return this.map.size; }

  /** Add entries (see AddOptions). */
  add(entries: Iterable<GlossEntry>, options: AddOptions = {}): this {
    const { fallback = false, lock = false } = options;
    for (const { fr, en } of entries) {
      const meanings = meaningsOf(fr, en);
      if (!meanings.length) continue;
      const keys = new Set<string>();
      const full = normKey(fr);
      if (full) keys.add(full);
      // "le café" / "l’hôtel": the bare noun too, so tokens match inside a sentence.
      if (frenchArticle(fr)) {
        const rest = normKey(fr.replace(/^(le|la|les|un|une|des)\s+|^l['’]/i, ''));
        if (rest) keys.add(rest);
      }
      // "ne… pas": each part is a word of its own.
      if (fr.replace(/\s*…\s*\?\s*$/, '').includes('…')) {
        for (const part of fr.split('…')) { const k = normKey(part); if (k) keys.add(k); }
      }
      for (const k of keys) this.put(k, meanings, fallback, lock);
    }
    return this;
  }

  private put(key: string, meanings: string[], fallback: boolean, lock: boolean): void {
    if (this.locked.has(key) && !lock) return;
    if (lock) this.locked.add(key);
    const have = this.map.get(key);
    if (have && fallback) return;
    if (!have) { this.map.set(key, meanings.slice(0, MAX_MEANINGS)); }
    else {
      const seen = new Set(have.map(m => m.toLowerCase()));
      for (const m of meanings) {
        if (have.length >= MAX_MEANINGS) break;
        if (!seen.has(m.toLowerCase())) { have.push(m); seen.add(m.toLowerCase()); }
      }
    }
    this.maxLen = Math.max(this.maxLen, key.split(' ').length);
  }

  /** Meanings of one word: exact, then elision, then plural / feminine forms. */
  private single(key: string): { meanings: string[]; extra: string[] } {
    const exact = this.map.get(key);
    if (exact) return { meanings: exact, extra: [] };
    const ap = key.indexOf("'");
    if (ap > 0 && ap < key.length - 1) {
      const prefix = key.slice(0, ap + 1);
      const el = ELISIONS[prefix];
      if (el) {
        const rest = key.slice(ap + 1);
        return { meanings: this.map.get(rest) ?? this.variant(rest) ?? [], extra: [`${curly(prefix)} = ${el}`] };
      }
    }
    return { meanings: this.variant(key) ?? [], extra: [] };
  }

  private variant(key: string): string[] | undefined {
    for (const [from, to, note] of VARIANTS) {
      if (key.length > from.length + 2 && key.endsWith(from)) {
        const m = this.map.get(key.slice(0, key.length - from.length) + to);
        if (m) return m.map(x => `${x} (${note})`);
      }
    }
    return undefined;
  }

  /** What to show for every token of ONE sentence (same length as `tokens`). */
  lookup(tokens: readonly string[]): TokenGloss[] {
    const keys = tokens.map(normKey);
    const covering: Array<Array<{ label: string; meanings: string[] }>> = tokens.map(() => []);
    // Longest phrase starting at each word; it is shown on every word it covers.
    for (let i = 0; i < tokens.length; i++) {
      for (let len = Math.min(this.maxLen, tokens.length - i); len >= 2; len--) {
        const label = keys.slice(i, i + len).join(' ');
        const meanings = this.map.get(label);
        if (!meanings) continue;
        for (let j = i; j < i + len; j++) covering[j].push({ label, meanings });
        break;
      }
    }
    return tokens.map((_t, i) => {
      const lines: string[] = [];
      const { meanings, extra } = this.single(keys[i]);
      if (meanings.length) lines.push(meanings.slice(0, SHOWN_MEANINGS).join(' / '));
      lines.push(...extra);
      for (const p of covering[i].slice(0, 2)) {
        const line = `${curly(p.label)} = ${p.meanings.slice(0, 2).join(' / ')}`;
        if (!lines.includes(line)) lines.push(line);
      }
      return { lines };
    });
  }
}

/** A sentence cut into tappable words: punctuation stays attached to its word. */
export interface SentenceWord { text: string; token: string }

/**
 * Split a sentence on spaces. A token that is only punctuation ("!" in
 * "Bonjour !") joins the previous word with a no-break space, so it never wraps
 * onto a line of its own and stays attached to its word.
 */
export function splitSentence(text: string): SentenceWord[] {
  const out: SentenceWord[] = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    if (!normKey(raw) && out.length) out[out.length - 1].text += '\u00A0' + raw;
    else out.push({ text: raw, token: raw });
  }
  return out;
}
