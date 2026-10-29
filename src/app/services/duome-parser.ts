/**
 * Duome vocabulary parser
 *
 * Parses a saved duome.eu "by skill" vocabulary page (e.g.
 * https://duome.eu/vocabulary/en/fr/skills) into a structured deck.
 *
 * Pure and DOM-free (regex based) so it runs both in the build-time importer
 * (Node) and in the in-app "import from URL" feature (native fetch).
 *
 * The page structure (stable across languages):
 *   <div class="path-section-delimiter">
 *     <span title="..."> 1 <span class="small-label">Cafe</span> Order at a café </span>
 *   </div>
 *   <li>
 *     <div class="playback ..." data-src="https://.../audio"></div>
 *     <span class="_blue  wA">bonjour</span>
 *     <span class="cCCC wT"> - hello</span>
 *   </li>
 *   ... (words belong to the most recent skill delimiter)
 */

export interface ParsedWord {
  /** Target-language word. */
  text: string;
  /** English translations (split on common separators). */
  translations: string[];
  /** Recorded audio URL, if present. */
  audioUrl?: string;
  /** Skill this word belongs to (full name). */
  skill: string;
  /** 1-based order of the skill in the course. */
  skillOrder: number;
}

export interface ParsedDeck {
  words: ParsedWord[];
  /** Skill names in course order. */
  skills: string[];
}

const SKILL_DELIMITER = /<div class="path-section-delimiter">([\s\S]*?)<\/div>/g;
// Each word: a playback <div> (carrying data-src audio) followed by the word
// span (_blue wA) and the translation span (wT). Whitespace/newlines between
// tags are flexible.
const WORD_ENTRY =
  /<div class="playback[^>]*?data-src="([^"]*)"[^>]*><\/div>\s*<span class="_blue\s*wA">([\s\S]*?)<\/span>\s*<span class="[^"]*\bwT">([\s\S]*?)<\/span>/g;

/** Strip tags and decode a few common HTML entities. */
function clean(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&agrave;/g, 'à')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Extract the human-readable skill name from a delimiter block.
 * Format: `1 <span class="small-label">Cafe</span> Order at a café`.
 * We want the full name ("Order at a café"), dropping the index and the
 * short label.
 */
function parseSkillName(block: string): string {
  // Remove the short-label span entirely, then strip remaining tags.
  const withoutLabel = block.replace(/<span class="small-label">[\s\S]*?<\/span>/g, '');
  return clean(withoutLabel).replace(/^\d+\s*/, '').replace(/\s+/g, ' ').trim();
}

/** Split a duome translation string ("- hello, hi") into clean translations. */
function parseTranslations(raw: string): string[] {
  const text = clean(raw).replace(/^-\s*/, '');
  return text
    .split(/[,;/]|\bor\b/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

/**
 * Parse a duome skills-page HTML string into a structured deck.
 * Words are attributed to the most recent preceding skill delimiter.
 */
export function parseDuomeHtml(html: string): ParsedDeck {
  // Find skill delimiter positions so each word can be attributed to a skill.
  const skillMarks: { index: number; name: string }[] = [];
  const skills: string[] = [];
  SKILL_DELIMITER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SKILL_DELIMITER.exec(html)) !== null) {
    const name = parseSkillName(m[1]);
    if (name) {
      skillMarks.push({ index: m.index, name });
      skills.push(name);
    }
  }

  const skillAt = (pos: number): { name: string; order: number } => {
    let current = { name: 'Uncategorized', order: 0 };
    for (let i = 0; i < skillMarks.length; i++) {
      if (skillMarks[i].index <= pos) {
        current = { name: skillMarks[i].name, order: i + 1 };
      } else {
        break;
      }
    }
    return current;
  };

  const words: ParsedWord[] = [];
  const seen = new Set<string>();
  WORD_ENTRY.lastIndex = 0;
  let w: RegExpExecArray | null;
  while ((w = WORD_ENTRY.exec(html)) !== null) {
    const audioUrl = w[1] ? w[1].trim() : undefined;
    const text = clean(w[2]);
    const translations = parseTranslations(w[3]);
    if (!text || translations.length === 0) continue;

    // De-duplicate repeated word+skill rows.
    const { name, order } = skillAt(w.index);
    const key = `${text}|${name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    words.push({ text, translations, audioUrl, skill: name, skillOrder: order });
  }

  return { words, skills };
}
