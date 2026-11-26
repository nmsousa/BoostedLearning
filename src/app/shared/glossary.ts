/**
 * Word glossary for tap-to-translate: French ⇄ English meanings, per sentence.
 *
 * A pure, framework-free module (the Angular wiring is glossary.service.ts).
 * A sentence is cut into SEGMENTS: one word, or a block of words that has ONE
 * meaning together ("s’il vous plaît" = please, "je voudrais" = I would like).
 * Two directions:
 *  - segmentSentence(): a French sentence → each segment's English meaning(s);
 *  - alignNative(): the English sentence of an exercise → the French for each
 *    word or block, found by matching it against the French sentence it
 *    translates (so "the bill" → l’, l’addition) with a reverse dictionary as a
 *    fallback.
 *
 * Sources are added in priority order (hand-written common words, lesson
 * words, curriculum words), then big noisy dictionaries as `fallback`, which
 * never override an existing entry and never form blocks.
 */
import { frenchArticle } from './articles';

export interface GlossEntry { fr: string; en: string }

/** One tappable piece of a sentence. No `lines` = nothing to show (plain text). */
export interface GlossSegment { text: string; lines: string[] }

// Everything that is not part of the word itself: quotes, brackets, punctuation.
const EDGE = /^[\s«»"“”‘'’(\[¿¡…,.;:!?)\]—–-]+|[\s«»"“”‘'’)\]¿¡…,.;:!?(\[—–-]+$/g;

/** Lookup key: lower case, straight apostrophe, no edge punctuation. */
export function normKey(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[’‘]/g, "'").replace(EDGE, '').replace(/\s+/g, ' ');
}

/** Pretty form of a key for display ("j'ai" → "j’ai"). */
const curly = (s: string): string => s.replace(/'/g, '’');

/** A word as shown in a popup: no punctuation around it, keeps its case. */
const plain = (s: string): string => s.replace(EDGE, '').replace(/\s+/g, ' ');

/**
 * The meanings in an English gloss ("hello / good morning" → two). The gender
 * note of an article + noun ("hotel (m.)") belongs to the gender badge, not here.
 */
export function meaningsOf(fr: string, en: string): string[] {
  const e = frenchArticle(fr) ? en.replace(/\s*\((m|f)\.\)\s*$/, '') : en;
  return e.split(/\s+\/\s+|\s*;\s*/).map(x => x.trim()).filter(Boolean);
}

/** Irregular English forms → the base word (both sides of a match are reduced the same way). */
const IRREGULAR: Record<string, string> = {
  went: 'go', gone: 'go', going: 'go', saw: 'see', seen: 'see', took: 'take', taken: 'take', told: 'tell', did: 'do', done: 'do',
  doing: 'do', made: 'make', had: 'have', ate: 'eat', eaten: 'eat', bought: 'buy', found: 'find', got: 'get', came: 'come',
  left: 'leave', lost: 'lose', paid: 'pay', sent: 'send', spent: 'spend', wrote: 'write', written: 'write', gave: 'give',
  given: 'give', knew: 'know', known: 'know', thought: 'think', children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth',
};

/**
 * An English word reduced for matching: lower case, no punctuation, contractions
 * undone ("I’m" → i, "don’t" → not), irregular forms and -s / -ing / -ed removed.
 * It only needs to be the SAME for both sides of a comparison, not a real stem.
 */
export function normEn(s: string): string {
  let w = s.normalize('NFC').toLowerCase().replace(/[’‘]/g, "'").replace(EDGE, '');
  if (/n't$/.test(w)) return 'not';
  w = w.replace(/'(s|re|ve|ll|d|m)$/, '');
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length > 3) {
    if (/ies$/.test(w)) w = w.slice(0, -3) + 'y';
    else if (/(sses|shes|ches|xes)$/.test(w)) w = w.slice(0, -2);
    else if (/s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
  }
  if (w.length > 5 && /(ing|ed)$/.test(w)) {
    w = w.replace(/(ing|ed)$/, '');
    if (/([^aeiou])\1$/.test(w)) w = w.slice(0, -1);   // stopped → stop
  }
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);   // make / making → mak
  return w;
}

/** The English words of one meaning ("to speak (formal)" → [speak], [to, speak]). */
export function enVariants(meaning: string): string[][] {
  const base = meaning.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) return [];
  const out: string[][] = [];
  const add = (s: string): void => {
    const w = s.split(' ').map(normEn).filter(Boolean);
    if (w.length && w.length <= 5) out.push(w);
  };
  add(base);
  if (/^to /i.test(base)) add(base.slice(3));
  if (base.toLowerCase() === 'a') add('an');
  return out;
}

/** Elided little words: "j’" in j’habite. */
const ELISIONS: Record<string, string> = {
  "j'": 'I', "m'": 'me / myself', "t'": 'you / yourself', "s'": 'oneself / it', "l'": 'the / him / her / it',
  "n'": 'not', "d'": 'of / from', "c'": 'it / this', "qu'": 'that / what', "jusqu'": 'until',
  "lorsqu'": 'when', "puisqu'": 'since', "quoiqu'": 'although',
};

/** English word → elided French word ("the" → l’). Lowest priority in the reverse dictionary. */
const ELISION_INVERSE = new Map<string, string[]>();
for (const [prefix, en] of Object.entries(ELISIONS)) {
  for (const m of en.split(' / ')) {
    for (const v of enVariants(m)) {
      const key = v.join(' ');
      ELISION_INVERSE.set(key, [...(ELISION_INVERSE.get(key) ?? []), curly(prefix)]);
    }
  }
}

/** English helper words with no French word of their own ("Do you…?", "I will…"): never guessed. */
const NO_FRENCH = new Set(['do', 'will', 'would', 'may', 'might', 'shall', 'to']);

/** Plural / feminine endings → [ending, dictionary ending, note] ("petites" → "petit (plural)"). */
const VARIANTS: ReadonlyArray<readonly [string, string, string]> = [
  ['ées', 'é', 'f. plural'], ['ée', 'é', 'f.'], ['és', 'é', 'plural'], ['ienne', 'ien', 'f.'], ['euse', 'eux', 'f.'],
  ['ive', 'if', 'f.'], ['elle', 'el', 'f.'], ['ette', 'et', 'f.'], ['aux', 'al', 'plural'],
  ['es', '', 'plural'], ['s', '', 'plural'], ['x', '', 'plural'], ['e', '', 'f.'],
];

const MAX_MEANINGS = 5;
const SHOWN_MEANINGS = 3;
/** The longest block of words with one meaning. */
const MAX_BLOCK = 7;

export interface AddOptions {
  /** Only fill keys nobody else has (noisy dictionaries); never forms blocks. */
  fallback?: boolean;
  /** The keys of this source are final: later sources never add to them. */
  lock?: boolean;
}

/** A French word or block of words, with its English meanings. */
interface FrSeg {
  from: number;
  to: number;
  /** French as shown in a popup (no punctuation). */
  display: string;
  /** English meanings (before cleaning). */
  meanings: string[];
  /** Extra lines for the learning direction ("j’ = I"). */
  extra: string[];
  /** Elided prefix of a single word ("l'"), for the native direction. */
  elision?: string;
}

export class Glossary {
  private readonly map = new Map<string, string[]>();
  private readonly locked = new Set<string>();
  /** Multi-word keys that count as ONE unit (idioms, fixed chunks; never article + noun). */
  private readonly blocks = new Set<string>();
  /** Reverse dictionary: reduced English meaning → French forms, best first (broad: "please" ≈ "pleased"). */
  private readonly inverse = new Map<string, string[]>();
  /** Reverse dictionary on the exact English words (precise: used for alternatives). */
  private readonly exact = new Map<string, string[]>();
  private maxBlock = 2;

  /** Number of keys (for tests / diagnostics). */
  get size(): number { return this.map.size; }

  /** Add entries (see AddOptions). */
  add(entries: Iterable<GlossEntry>, options: AddOptions = {}): this {
    const { fallback = false, lock = false } = options;
    for (const { fr, en } of entries) {
      const meanings = meaningsOf(fr, en);
      if (!meanings.length) continue;
      const articleNoun = !!frenchArticle(fr);
      const full = normKey(fr);
      const keys = new Set<string>();
      // "un café" is two words ("un" + "café"), not a block: only its bare noun is a key.
      if (full && !(articleNoun && full.includes(' '))) keys.add(full);
      let bareBlock = '';
      if (articleNoun) {
        const rest = normKey(fr.replace(/^(le|la|les|un|une|des)\s+|^l['’]/i, ''));
        if (rest) keys.add(rest);
        if (rest.includes(' ')) bareBlock = rest;   // "salle de bain", "jus d’orange": one unit
      }
      // "ne… pas": each part is a word of its own.
      const discontinuous = fr.replace(/\s*…\s*\?\s*$/, '').includes('…');
      if (discontinuous) for (const part of fr.split('…')) { const k = normKey(part); if (k) keys.add(k); }

      for (const k of keys) {
        if (fallback && k.includes(' ')) continue; // dictionary phrases never become blocks
        this.put(k, meanings, fallback, lock);
      }
      if (!fallback) {
        this.addInverse(fr, meanings);
        const words = full.split(' ').length;
        if (words >= 2 && words <= MAX_BLOCK && !articleNoun && !discontinuous) {
          this.blocks.add(full);
          this.maxBlock = Math.max(this.maxBlock, words);
        }
        const bareWords = bareBlock ? bareBlock.split(' ').length : 0;
        if (bareWords >= 2 && bareWords <= MAX_BLOCK && !discontinuous) {
          this.blocks.add(bareBlock);
          this.maxBlock = Math.max(this.maxBlock, bareWords);
        }
      }
    }
    return this;
  }

  private put(key: string, meanings: string[], fallback: boolean, lock: boolean): void {
    if (this.locked.has(key) && !lock) return;
    if (lock) this.locked.add(key);
    const have = this.map.get(key);
    if (have && fallback) return;
    if (!have) { this.map.set(key, meanings.slice(0, MAX_MEANINGS)); return; }
    const seen = new Set(have.map(m => m.toLowerCase()));
    for (const m of meanings) {
      if (have.length >= MAX_MEANINGS) break;
      if (!seen.has(m.toLowerCase())) { have.push(m); seen.add(m.toLowerCase()); }
    }
  }

  private addInverse(fr: string, meanings: string[]): void {
    const shown = curly(fr);
    for (const m of meanings) {
      const base = m.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      for (const k of base ? [base, ...(base.startsWith('to ') ? [base.slice(3)] : [])] : []) {
        const e = this.exact.get(k) ?? [];
        if (!e.some(x => normKey(x) === normKey(shown))) e.push(shown);
        this.exact.set(k, e);
      }
      for (const v of enVariants(m)) {
        const key = v.join(' ');
        const list = this.inverse.get(key) ?? [];
        if (!list.some(x => normKey(x) === normKey(shown))) list.push(shown);
        this.inverse.set(key, list);
      }
    }
  }

  /** Meanings of one word: exact, then elision, then plural / feminine forms. */
  private single(key: string): { meanings: string[]; extra: string[]; elision?: string } {
    const exact = this.map.get(key);
    if (exact) return { meanings: exact, extra: [] };
    const ap = key.indexOf("'");
    if (ap > 0 && ap < key.length - 1) {
      const prefix = key.slice(0, ap + 1);
      const el = ELISIONS[prefix];
      if (el) {
        const rest = key.slice(ap + 1);
        return { meanings: this.map.get(rest) ?? this.variant(rest) ?? [], extra: [`${curly(prefix)} = ${el}`], elision: prefix };
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

  /** The longest block starting at `i`: its length and its key (null = none). */
  private blockAt(keys: readonly string[], i: number): { len: number; label: string } | null {
    for (let len = Math.min(this.maxBlock, keys.length - i); len >= 2; len--) {
      const part = keys.slice(i, i + len);
      if (!part.every(Boolean)) continue;
      const label = part.join(' ');
      if (this.blocks.has(label)) return { len, label };
      // "L’intelligence artificielle": the elided article is stuck to the first word.
      const ap = part[0].indexOf("'");
      if (ap > 0 && ELISIONS[part[0].slice(0, ap + 1)]) {
        const bare = [part[0].slice(ap + 1), ...part.slice(1)].join(' ');
        if (this.blocks.has(bare)) return { len, label: bare };
      }
    }
    return null;
  }

  /** Cut French tokens into words and blocks, each with its English meanings. */
  private frSegments(tokens: readonly string[]): FrSeg[] {
    const keys = tokens.map(normKey);
    const out: FrSeg[] = [];
    for (let i = 0; i < tokens.length;) {
      const block = this.blockAt(keys, i);
      if (block) {
        out.push({
          from: i, to: i + block.len - 1, display: tokens.slice(i, i + block.len).map(plain).join(' '),
          meanings: this.map.get(block.label) ?? [], extra: [],
        });
        i += block.len;
        continue;
      }
      const { meanings, extra, elision } = this.single(keys[i]);
      out.push({ from: i, to: i, display: plain(tokens[i]), meanings, extra, elision });
      i++;
    }
    return out;
  }

  /** The lines a French segment shows: its main meanings, then notes like "j’ = I". */
  private linesOf(seg: FrSeg): string[] {
    const lines: string[] = [];
    if (seg.meanings.length) lines.push(seg.meanings.slice(0, SHOWN_MEANINGS).join(' / '));
    lines.push(...seg.extra);
    return lines;
  }

  /** A French sentence → tappable segments with their English meaning(s). */
  segmentSentence(text: string): GlossSegment[] {
    const words = splitSentence(text);
    return this.frSegments(words.map(w => w.token)).map(seg => ({
      text: words.slice(seg.from, seg.to + 1).map(w => w.text).join(' '),
      lines: this.linesOf(seg),
    }));
  }

  /** French forms for an English word / phrase; the ones inside the sentence come first. */
  private inverseFor(key: string, raw: string, frKeys: readonly string[], onlyInSentence: boolean): string[] {
    const list = [...(this.exact.get(raw) ?? []), ...(this.inverse.get(key) ?? []), ...(ELISION_INVERSE.get(key) ?? [])]
      .filter((c, i, all) => all.findIndex(x => normKey(x) === normKey(c)) === i);
    if (!frKeys.length) return list.slice(0, 3);
    const padded = ` ${frKeys.join(' ')} `;
    const inSentence = (c: string): boolean => {
      const ck = normKey(c);
      const bare = normKey(c.replace(/^(le|la|les|un|une|des)\s+|^l['’]/i, ''));
      if (ck.endsWith("'")) return frKeys.some(k => k.startsWith(ck));
      return padded.includes(` ${ck} `) || (!!bare && padded.includes(` ${bare} `));
    };
    const here = list.filter(inSentence);
    if (here.length) return here.slice(0, 3);
    return onlyInSentence ? [] : list.slice(0, 3);
  }

  /**
   * An English sentence → tappable segments with the French for each word or
   * block. `frTokens` is the French sentence it translates (the exercise's
   * answer): each French word or block claims the English words that match one
   * of its meanings, so the right French is shown, not every possible one.
   * Words nothing claims fall back to the reverse dictionary.
   */
  alignNative(text: string, frTokens: readonly string[] = []): GlossSegment[] {
    const words = splitSentence(text);
    // "(tu)" / "(vous)" notes in a prompt are not words to translate.
    const norm = words.map(w => (/^\(.*\)$/.test(w.token) ? '' : normEn(w.token)));
    const n = words.length;
    const owner: number[] = new Array(n).fill(-1);
    const claims: Array<{ start: number; len: number; lines: string[] }> = [];
    const frKeys = frTokens.map(normKey);

    const free = (i: number, len: number): boolean => {
      for (let k = 0; k < len; k++) if (owner[i + k] !== -1) return false;
      return true;
    };
    const claim = (variants: string[][], display: string): void => {
      for (const v of [...variants].sort((a, b) => b.length - a.length)) {
        for (let i = 0; i + v.length <= n; i++) {
          if (!free(i, v.length) || !v.every((w, k) => norm[i + k] === w)) continue;
          const raw = words.slice(i, i + v.length).map(w => normKey(w.token)).join(' ');
          const alts = (this.exact.get(raw) ?? [])
            .filter(c => normKey(c) !== normKey(display) && normKey(c.replace(/^(le|la|les|un|une|des)\s+|^l['’]/i, '')) !== normKey(display))
            .slice(0, 2);
          claims.push({ start: i, len: v.length, lines: [display, ...(alts.length ? [alts.join(' / ')] : [])] });
          for (let k = 0; k < v.length; k++) owner[i + k] = claims.length - 1;
          return;
        }
      }
    };

    const fr = this.frSegments(frTokens);
    for (const seg of fr) claim(seg.meanings.flatMap(enVariants), seg.display);            // each French word / block
    for (const seg of fr) {                                                                  // then elisions: l’ = the
      if (seg.elision) claim(ELISIONS[seg.elision].split(' / ').flatMap(enVariants), curly(seg.elision));
    }

    // Then the last word of a longer meaning ("train station" → station), if it is unambiguous.
    for (const seg of fr) {
      if (claims.some(c => c.lines[0] === seg.display)) continue;
      const tails = seg.meanings.flatMap(enVariants).filter(v => v.length >= 2).map(v => v[v.length - 1]).filter(w => w.length >= 4);
      for (const t of tails) {
        const at = norm.map((w, i) => (w === t && free(i, 1) ? i : -1)).filter(i => i >= 0);
        if (at.length === 1) { claim([[t]], seg.display); break; }
      }
    }
    // Finally, one word left on each side: they go together.
    const unclaimedFr = fr.filter(seg => !claims.some(c => c.lines[0] === seg.display || c.lines[0] === (seg.elision ? curly(seg.elision) : '')));
    const leftoverEn = norm.map((w, i) => (w && owner[i] === -1 && !/^(a|an|the|of|to|is|are)$/.test(w) ? i : -1)).filter(i => i >= 0);
    if (leftoverEn.length > 0 && leftoverEn.length === unclaimedFr.length && leftoverEn.length <= 2) {
      leftoverEn.forEach((i, k) => claim([[norm[i]]], unclaimedFr[k].display));
    }

    const claimAt = new Map(claims.map(c => [c.start, c]));
    const out: GlossSegment[] = [];
    for (let i = 0; i < n;) {
      const c = claimAt.get(i);
      if (c) {
        out.push({ text: words.slice(i, i + c.len).map(w => w.text).join(' '), lines: c.lines });
        i += c.len;
        continue;
      }
      let done = false;
      for (let len = Math.min(3, n - i); len >= 1 && !done; len--) {
        if (!free(i, len) || norm.slice(i, i + len).some(w => !w)) continue;
        if (len === 1 && NO_FRENCH.has(norm[i])) continue;
        const raw = words.slice(i, i + len).map(w => normKey(w.token)).join(' ');
        const cands = this.inverseFor(norm.slice(i, i + len).join(' '), raw, frKeys, false);
        if (!cands.length) continue;
        out.push({ text: words.slice(i, i + len).map(w => w.text).join(' '), lines: [cands.join(' / ')] });
        i += len;
        done = true;
      }
      if (!done) { out.push({ text: words[i].text, lines: [] }); i++; }
    }
    return out;
  }
}

/** A sentence cut into words: punctuation stays attached to its word. */
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
