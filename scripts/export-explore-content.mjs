/**
 * Writes docs/EXPLORE-CONTENT.md: every word and example sentence in Explore,
 * grouped by Core level and by topic + topic level. Meant to be pasted into an
 * AI chat to author more words, sentences and icons for new levels.
 *
 *   node scripts/export-explore-content.mjs
 *
 * It compiles src/app/maps/tree/tree-curriculum.ts with esbuild (already in
 * node_modules via the Angular toolchain) and reads its exports, so the list is
 * always exactly what the app ships.
 */
import { build } from 'esbuild';
import { writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(tmpdir(), `tree-curriculum-${Date.now()}.mjs`);
await build({
  entryPoints: [join(root, 'src/app/maps/tree/tree-curriculum.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'error',
});
const cur = await import(pathToFileURL(tmp).href);
rmSync(tmp, { force: true });

const { CORE_TIERS, THEME_DEFS } = cur;
if (!CORE_TIERS || !THEME_DEFS) throw new Error('tree-curriculum.ts no longer exports CORE_TIERS / THEME_DEFS');

// English topic names, from the i18n keys (best effort: fall back to the id).
const names = {};
try {
  const i18n = await build({
    entryPoints: [join(root, 'src/services/i18n/i18n-service.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const src = i18n.outputFiles[0].text;
  for (const th of THEME_DEFS) {
    const all = [...src.matchAll(new RegExp(`"${th.nameKey.replace(/\./g, '\\.')}":\\s*"([^"]+)"|'${th.nameKey.replace(/\./g, '\\.')}':\\s*'([^']+)'`, 'g'))];
    // The English block is the 3rd language block in the file (pt, fr, en, es); take the 3rd hit if present.
    const hit = all[2] ?? all[0];
    if (hit) names[th.id] = hit[1] ?? hit[2];
  }
} catch { /* names are optional */ }

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const wordTable = (words, withNote) => {
  const head = withNote ? '| French | English | Note | Icon |\n|---|---|---|---|' : '| French | English | Icon |\n|---|---|---|';
  const rows = words.map((w) => withNote
    ? `| ${esc(w.fr)} | ${esc(w.en)} | ${esc(w.note)} | ${esc(w.icon)} |`
    : `| ${esc(w.fr)} | ${esc(w.en)} | ${esc(w.icon)} |`);
  return [head, ...rows].join('\n');
};

let md = `# Explore content (French)

Every word and example sentence in Explore, as shipped in
\`src/app/maps/tree/tree-curriculum.ts\`. Regenerate with
\`node scripts/export-explore-content.mjs\`.

- **French** is shown as the app displays it today (nouns WITH their article,
  e.g. "le café").
- **English** gender notes are written as "(m.)" / "(f.)".
- **Icon** is the emoji shown on the Learn card (blank = none yet).

`;

let coreWords = 0, themeWords = 0, sentenceCount = 0;
md += `## Core\n\n`;
for (const ct of CORE_TIERS) {
  const title = ct.title ?? ct.name ?? '';
  md += `### Core level ${ct.tier}${title ? ` — ${esc(title)}` : ''}${ct.authored === false ? ' (not authored yet)' : ''}\n\n`;
  if (ct.outcome) md += `**Goal:** ${esc(ct.outcome)}\n\n`;
  if (ct.example) {
    const ex = String(ct.example).split(' / ').map((s) => s.trim()).filter(Boolean);
    sentenceCount += ex.length;
    md += `**Example sentences:**\n\n${ex.map((s) => `- ${esc(s)}`).join('\n')}\n\n`;
  }
  if (ct.words?.length) { coreWords += ct.words.length; md += wordTable(ct.words, true) + '\n\n'; }
}

md += `## Topics\n\n`;
for (const th of THEME_DEFS) {
  md += `### ${th.emoji ?? ''} ${esc(names[th.id] ?? th.id)} (\`${th.id}\`)\n\n`;
  th.tiers.forEach((words, i) => {
    themeWords += words.length;
    md += `#### ${esc(names[th.id] ?? th.id)} — level ${i + 1}\n\n${wordTable(words, words.some((w) => w.note))}\n\n`;
  });
}

md += `---\n\nTotals: ${CORE_TIERS.length} Core levels (${coreWords} words, ${sentenceCount} example sentences), ` +
  `${THEME_DEFS.length} topics (${themeWords} words).\n`;

writeFileSync(join(root, 'docs/EXPLORE-CONTENT.md'), md);

// ── Explore+ lessons → docs/EXPLORE-PLUS-LESSONS.md ──────────────────────────
const tmp2 = join(tmpdir(), `xp-lessons-${Date.now()}.mjs`);
await build({
  entryPoints: [join(root, 'src/app/maps/explore-plus/lessons/lessons.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: tmp2, logLevel: 'error',
});
const xp = await import(pathToFileURL(tmp2).href);
rmSync(tmp2, { force: true });
let xmd = `# Explore+ lessons (French)

Every Explore+ lesson, as shipped in \`src/app/maps/explore-plus/lessons/\`
(one file per band). Regenerate with \`node scripts/export-explore-content.mjs\`.

- Word **English** is bare ("coffee"); the app shows "the coffee". l’ / les nouns carry "(m.)" / "(f.)".
- Sentence **Focus** is the word blanked in Blanks; **Wrong** are its 3 wrong options (also extra Builder tiles).
- **Also accepted** are other correct answers for Write.

`;
let xw = 0, xs = 0;
for (const band of xp.BANDS) {
  const lessons = xp.LESSONS.filter((l) => l.band === band.id);
  if (!lessons.length) continue;
  xmd += `## ${band.cefr}\n\n`;
  lessons.forEach((l, i) => {
    xw += l.words.length; xs += l.sentences.length;
    xmd += `### ${band.cefr} · Lesson ${i + 1} — ${l.icon} ${esc(l.title)} (\`${l.id}\`)\n\n**Goal:** ${esc(l.goal)}\n\n**Grammar:** ${esc(l.grammar)}\n\n`;
    xmd += wordTable(l.words, true) + '\n\n';
    xmd += '| French | English | Focus | Wrong | Also accepted |\n|---|---|---|---|---|\n';
    xmd += l.sentences.map((x) => `| ${esc(x.fr)} | ${esc(x.en)} | ${esc(x.key)} | ${esc(x.wrong.join(', '))} | ${esc((x.alt ?? []).join(' / '))} |`).join('\n') + '\n\n';
  });
}
xmd += `---\n\nTotals: ${xp.LESSONS.length} lessons, ${xw} words, ${xs} sentences.\n`;
writeFileSync(join(root, 'docs/EXPLORE-PLUS-LESSONS.md'), xmd);
console.log(`docs/EXPLORE-PLUS-LESSONS.md written: ${xp.LESSONS.length} lessons, ${xw} words, ${xs} sentences.`);
console.log(`docs/EXPLORE-CONTENT.md written: ${coreWords} core words, ${themeWords} topic words, ${sentenceCount} sentences.`);
