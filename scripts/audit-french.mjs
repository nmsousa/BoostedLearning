/**
 * French translation review generator.
 *
 * Applies the SAME heuristic + curated map the app now uses, and produces a
 * review document listing, per unique French word:
 *   - what the app displays now,
 *   - whether a curated override is in effect,
 *   - the full options,
 * focusing on the cases most likely to be wrong (possessive-heavy arrays,
 * no clean option, curated overrides) so a French speaker can verify.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const deck = JSON.parse(readFileSync('src/assets/flashcards/french.json', 'utf8'));
const cards = deck.cards;

// Curated FR overrides (mirror of CURATED_TRANSLATIONS.fr in the service).
const CURATED = {
  de: 'of', 'à': 'to', es: 'are', 'tu parles': 'you talk',
  master: "master's degree", maternel: 'maternal', 'nouvel an': 'New Year',
  chambre: 'bedroom', des: 'some',
};

const OK = new Set(["he's","she's","it's","that's","there's","here's","what's","who's","let's","i'm","you're","we're","they're","i've","i'd","i'll","can't","won't","don't","doesn't","didn't","isn't","aren't","wasn't","weren't","couldn't","wouldn't","shouldn't","haven't","hasn't","o'clock"]);
const isJunk = (raw) => { const s = raw.trim(), low = s.toLowerCase().replace('\u2019', "'"); if (!s) return true; if (low === "'s") return true; if (s.length === 1 && low !== 'i' && low !== 'a') return true; if (/^[a-z]\.$/i.test(s)) return true; if (/['\u2019]s$/i.test(s) && !OK.has(low)) return true; return false; };
const isGerund = (s) => { const t = s.trim(); if (/^(.?ring|thing|spring|string|king|wing|ceiling|evening|morning|building|meeting|feeling|boarding|landing|wedding|something|nothing|everything)$/i.test(t)) return false; return /\w+ing$/i.test(t); };
const isNeg = (s) => /n['\u2019]t$/i.test(s.trim());
function pick(text, tr) {
  const c = CURATED[text.trim().toLowerCase()];
  if (c) return c;
  const all = (tr || []).map(s => s.trim()).filter(Boolean);
  if (!all.length) return '';
  if (!isJunk(all[0]) && !isGerund(all[0]) && !isNeg(all[0])) return all[0];
  const nonJunk = all.filter(s => !isJunk(s));
  if (!nonJunk.length) return [...all].sort((a, b) => a.length - b.length)[0];
  const pref = nonJunk.filter(s => !isGerund(s) && !isNeg(s));
  return pref.length ? pref[0] : nonJunk[0];
}

const seen = new Set();
const curatedRows = [];
const noClean = [];
const possessiveHeavy = [];

for (const card of cards) {
  if (seen.has(card.text)) continue;
  seen.add(card.text);
  const all = (card.translations || []).map(s => s.trim()).filter(Boolean);
  const shown = pick(card.text, card.translations);
  const curated = CURATED[card.text.trim().toLowerCase()];

  if (curated) {
    curatedRows.push({ text: card.text, shown, all });
    continue;
  }
  if (!all.some(s => !isJunk(s))) {
    noClean.push({ text: card.text, shown, all, skill: card.skill });
    continue;
  }
  const poss = all.filter(s => /['\u2019]s$/i.test(s) && !OK.has(s.toLowerCase().replace('\u2019', "'"))).length;
  if (all.length > 1 && poss / all.length >= 0.4) {
    possessiveHeavy.push({ text: card.text, shown, all, skill: card.skill });
  }
}

const esc = (s) => s.replace(/\|/g, '\\|');
let md = `# French translation review\n\n`;
md += `Unique French words: **${seen.size}**. The app now trusts the first scraped sense unless it is junk/gerund/negation, with a small curated override map for words whose data is wrong.\n\n`;
md += `Please skim the three sections and tell me any you disagree with (give the French word and the English you'd prefer).\n\n`;

md += `## A. Curated overrides (I hard-set these because the data was wrong)\n\n`;
md += `| French | Now shows | All scraped options |\n|---|---|---|\n`;
for (const r of curatedRows) md += `| ${esc(r.text)} | **${esc(r.shown)}** | ${esc(r.all.join(' · '))} |\n`;

md += `\n## B. No clean option in the data (verify these — may still be imperfect)\n\n`;
md += `| French | Now shows | All scraped options | Skill |\n|---|---|---|---|\n`;
for (const r of noClean) md += `| ${esc(r.text)} | ${esc(r.shown)} | ${esc(r.all.join(' · '))} | ${esc(r.skill || '')} |\n`;

md += `\n## C. Possessive-heavy arrays (function/ambiguous words — spot-check)\n\n`;
md += `${possessiveHeavy.length} words. The app picks the first non-possessive sense; verify a few.\n\n`;
md += `| French | Now shows | All scraped options | Skill |\n|---|---|---|---|\n`;
for (const r of possessiveHeavy) md += `| ${esc(r.text)} | ${esc(r.shown)} | ${esc(r.all.join(' · '))} | ${esc(r.skill || '')} |\n`;

writeFileSync('scripts/french-translation-audit.md', md, 'utf8');
console.log('unique', seen.size, 'curated', curatedRows.length, 'noClean', noClean.length, 'possessiveHeavy', possessiveHeavy.length);
