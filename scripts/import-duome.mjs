/**
 * Build-time importer: convert a saved duome.eu "by skill" vocabulary page
 * into a bundled deck JSON for the app.
 *
 * Usage:
 *   node scripts/import-duome.mjs <input.html> <langCode> <deckName> <outFile>
 *
 * Example:
 *   node scripts/import-duome.mjs "../French words.txt" fr "French" \
 *     src/assets/flashcards/french.json
 *
 * The parsing logic mirrors src/app/services/duome-parser.ts (kept in sync).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, langCode, deckName, outPath] = process.argv;
if (!inPath || !langCode || !deckName || !outPath) {
  console.error('Usage: node scripts/import-duome.mjs <input.html> <langCode> <deckName> <outFile>');
  process.exit(1);
}

const html = readFileSync(inPath, 'utf8');

const clean = (s) =>
  s.replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();

const parseTranslations = (raw) =>
  clean(raw)
    .replace(/^-\s*/, '')
    .split(/[,;/]|\bor\b/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

// Skill delimiters -> positions + names
const SKILL_DELIMITER = /<div class="path-section-delimiter">([\s\S]*?)<\/div>/g;
const skillMarks = [];
const skills = [];
let m;
while ((m = SKILL_DELIMITER.exec(html)) !== null) {
  const withoutLabel = m[1].replace(/<span class="small-label">[\s\S]*?<\/span>/g, '');
  const name = clean(withoutLabel).replace(/^\d+\s*/, '').replace(/\s+/g, ' ').trim();
  if (name) {
    skillMarks.push({ index: m.index, name });
    skills.push(name);
  }
}
const skillAt = (pos) => {
  let cur = { name: 'Uncategorized', order: 0 };
  for (let i = 0; i < skillMarks.length; i++) {
    if (skillMarks[i].index <= pos) cur = { name: skillMarks[i].name, order: i + 1 };
    else break;
  }
  return cur;
};

const WORD_ENTRY =
  /<div class="playback[^>]*?data-src="([^"]*)"[^>]*><\/div>\s*<span class="_blue\s*wA">([\s\S]*?)<\/span>\s*<span class="[^"]*\bwT">([\s\S]*?)<\/span>/g;

const cards = [];
const seen = new Set();
let w;
while ((w = WORD_ENTRY.exec(html)) !== null) {
  const audioUrl = w[1] ? w[1].trim() : undefined;
  const text = clean(w[2]);
  const translations = parseTranslations(w[3]);
  if (!text || translations.length === 0) continue;

  const { name, order } = skillAt(w.index);
  const key = `${text}|${name}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const card = { text, translations, skill: name, skillOrder: order };
  if (audioUrl) card.audioUrl = audioUrl;
  cards.push(card);
}

const deck = {
  id: `deck-duome-${langCode}`,
  name: deckName,
  languageCode: langCode,
  description: `${deckName} vocabulary - ${cards.length} words, ${skills.length} skills`,
  cards,
};

writeFileSync(outPath, JSON.stringify(deck, null, 0), 'utf8');
console.log(`Wrote ${outPath}: ${cards.length} words across ${skills.length} skills`);
