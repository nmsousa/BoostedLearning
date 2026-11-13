/**
 * gen-audio.mjs — pre-generate bundled pronunciation audio for the Tree.
 *
 * Runs on YOUR machine (not in the app, not in CI). For every authored Tree
 * word (and the example sentences), it produces one small MP3 and writes a
 * manifest, so the app can play a LOCAL file offline instead of relying on a
 * device TTS voice that may not be installed.
 *
 * Source preference per clip (best quality first):
 *   1. the real course recording from src/assets/decks/french.json
 *      (same clips the Duolingo words use), downloaded to a local file;
 *   2. Google Cloud Text-to-Speech (neural voice) for anything with no
 *      recording — needs the GOOGLE_TTS_API_KEY env var.
 *
 * It is IDEMPOTENT: existing files are skipped, so re-runs are cheap/free and
 * only fill gaps. The API key is read from the environment and never written
 * anywhere.
 *
 * Usage (PowerShell):
 *   $env:GOOGLE_TTS_API_KEY = '<your key>'
 *   node scripts/gen-audio.mjs                   # words + example sentences
 *   node scripts/gen-audio.mjs --words           # words only
 *   node scripts/gen-audio.mjs --dry-run         # list what WOULD be generated
 *   node scripts/gen-audio.mjs --replace-duolingo  # re-make the borrowed
 *                                                  # Duolingo clips with OUR TTS
 *                                                  # voice, for one uniform voice
 *
 * Output:
 *   src/assets/audio/fr/<key>.mp3
 *   src/assets/audio/fr/manifest.json
 *     { "<normalized text>": { "file": "<key>.mp3",
 *                              "source": "duolingo" | "tts",
 *                              "voice"?: "<voice name, for tts>" } }
 *
 * The `source` tag is what lets you later swap EVERY human Duolingo clip for
 * our synthetic voice so the Tree sounds consistent: run --replace-duolingo and
 * each clip tagged "duolingo" is regenerated with the TTS voice and retagged.
 */

import './load-env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const CURRICULUM = path.join(ROOT, 'src/app/maps/tree/tree-curriculum.ts');
const FRENCH_DECK = path.join(ROOT, 'src/assets/decks/french.json');
const OUT_DIR = path.join(ROOT, 'src/assets/audio/fr');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

const LANG = 'fr-FR';
// Neural2-A (female). Chosen over Chirp3-HD because Chirp3-HD swallows very
// short isolated words (le/un/je/à/y → near-silent), which this app has a lot
// of. Neural2 is reliable on 1–2 letter words and supports SSML (for a future
// "slow" version). Override via GOOGLE_TTS_VOICE if ever needed.
const VOICE = process.env.GOOGLE_TTS_VOICE || 'fr-FR-Neural2-A';
const API_KEY = process.env.GOOGLE_TTS_API_KEY || '';

const args = new Set(process.argv.slice(2));
const WORDS_ONLY = args.has('--words');
const DRY_RUN = args.has('--dry-run');
/** Regenerate every clip currently sourced from Duolingo using OUR TTS voice,
 *  so the whole Tree shares one voice. Needs the API key. */
const REPLACE_DUOLINGO = args.has('--replace-duolingo');

// ── Text helpers ─────────────────────────────────────────────────────────────

/** Normalize for matching + manifest keys (NFC, straight apostrophe, lower). */
function norm(s) {
  return String(s).normalize('NFC').replace(/[’‘]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Stable, filesystem-safe filename for a piece of text. */
function fileKey(text) {
  const slug = norm(text)
    .replace(/'/g, '-')
    .replace(/[^a-z0-9\u00c0-\u017f]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const hash = crypto.createHash('sha1').update(norm(text)).digest('hex').slice(0, 8);
  return `${slug || 'x'}-${hash}.mp3`;
}

// ── Collect the text to voice ────────────────────────────────────────────────

function collectTexts() {
  const src = fs.readFileSync(CURRICULUM, 'utf8');
  const words = new Set();
  const sentences = new Set();

  // Words: every `fr: '...'` in a CoreWord (skip the "—" placeholder).
  for (const m of src.matchAll(/\bfr:\s*'([^']+)'/g)) {
    const w = m[1];
    if (w && w !== '—') words.add(w);
  }
  // Example sentences: `example: '...'` fields (may hold several, split on " / ").
  if (!WORDS_ONLY) {
    for (const m of src.matchAll(/\bexample:\s*'([^']+)'/g)) {
      for (const part of m[1].split(' / ')) {
        const s = part.trim();
        if (s) sentences.add(s);
      }
    }
  }
  return { words: [...words], sentences: [...sentences] };
}

/** Map normalized French text → recording URL from the course deck. */
function loadRecordingIndex() {
  const index = new Map();
  if (!fs.existsSync(FRENCH_DECK)) return index;
  const deck = JSON.parse(fs.readFileSync(FRENCH_DECK, 'utf8'));
  const cards = deck.cards || deck.flashcards || [];
  for (const c of cards) {
    if (c.audioUrl) {
      const k = norm(c.text);
      if (!index.has(k)) index.set(k, c.audioUrl);
    }
  }
  return index;
}

/** A recording for a word: exact, then article-stripped (le café → café). */
function findRecording(index, text) {
  const k = norm(text);
  if (index.has(k)) return index.get(k);
  const bare = k.replace(/^(le |la |les |un |une |des |l')/, '').trim();
  return bare !== k ? index.get(bare) : undefined;
}

// ── Audio sources ────────────────────────────────────────────────────────────

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The placeholder shipped in .env.example / .env — not a usable key. */
const DUMMY_KEY = 'ABCDEF';

async function synthesize(text) {
  if (!API_KEY) throw new Error('GOOGLE_TTS_API_KEY not set');
  if (API_KEY === DUMMY_KEY) throw new Error('GOOGLE_TTS_API_KEY is the dummy placeholder — put your real key in .env');
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: LANG, name: VOICE },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TTS ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json.audioContent) throw new Error('TTS: no audioContent');
  return Buffer.from(json.audioContent, 'base64');
}

// ── Main ─────────────────────────────────────────────────────────────────────

/** Read the manifest, upgrading any old "<key>": "<file>" entries to the
 *  richer { file, source } shape so re-runs keep the source tags. */
function loadManifest() {
  if (!fs.existsSync(MANIFEST)) return {};
  const raw = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') {
      // Legacy entry — we no longer know the source for sure; assume duolingo
      // unless it clearly isn't (the full re-run below will correct it).
      out[k] = { file: v, source: 'unknown' };
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = loadManifest();
  const recordings = loadRecordingIndex();
  const { words, sentences } = collectTexts();
  const all = [...words, ...sentences];

  const keyState = !API_KEY ? 'MISSING' : API_KEY === DUMMY_KEY ? 'DUMMY (edit .env)' : 'set';
  const stats = { total: all.length, recorded: 0, tts: 0, replaced: 0, skipped: 0, failed: 0, ttsChars: 0 };
  console.log(`Items: ${all.length} (words ${words.length}, sentences ${sentences.length})`);
  console.log(`Recording index: ${recordings.size} clips.  Voice: ${VOICE}  Key: ${keyState}`);
  if (!DRY_RUN && API_KEY === DUMMY_KEY) {
    console.error('\n⚠  GOOGLE_TTS_API_KEY is still the dummy value "ABCDEF".');
    console.error('   Edit .env and put your real key, then re-run. (TTS clips will fail until then.)\n');
  }
  if (REPLACE_DUOLINGO) console.log('--- REPLACE-DUOLINGO: re-voicing borrowed Duolingo clips with TTS ---');
  if (DRY_RUN) console.log('--- DRY RUN (no files written) ---');

  for (const text of all) {
    const key = norm(text);
    const file = fileKey(text);
    const dest = path.join(OUT_DIR, file);
    const existing = manifest[key];
    const haveFile = fs.existsSync(dest) && fs.statSync(dest).size > 0;

    // Replace mode: if this clip is (or was) a Duolingo recording, re-make it
    // with our TTS voice so the Tree ends up in one consistent voice.
    const wantReVoice =
      REPLACE_DUOLINGO && existing && existing.source !== 'tts';

    if (haveFile && !wantReVoice) {
      // Keep the file; make sure the manifest entry is present/complete.
      manifest[key] = existing ?? { file, source: 'unknown' };
      stats.skipped++;
      continue;
    }

    const url = wantReVoice ? undefined : findRecording(recordings, text);
    try {
      if (url) {
        if (!DRY_RUN) fs.writeFileSync(dest, await download(url));
        manifest[key] = { file, source: 'duolingo' };
        stats.recorded++;
        process.stdout.write(`🎧 ${text}\n`);
      } else {
        stats.ttsChars += text.length;
        if (!DRY_RUN) fs.writeFileSync(dest, await synthesize(text));
        manifest[key] = { file, source: 'tts', voice: VOICE };
        if (wantReVoice) { stats.replaced++; process.stdout.write(`♻️  ${text}\n`); }
        else { stats.tts++; process.stdout.write(`🗣️  ${text}\n`); }
      }
    } catch (err) {
      stats.failed++;
      console.warn(`✗ ${text} — ${err.message}`);
    }
    // Be gentle with both endpoints.
    await new Promise(r => setTimeout(r, 120));
  }

  if (!DRY_RUN) {
    const sorted = Object.fromEntries(Object.entries(manifest).sort());
    fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
  }

  // Source breakdown so you can see how many clips are still human vs ours.
  const bySource = {};
  for (const v of Object.values(manifest)) bySource[v.source] = (bySource[v.source] ?? 0) + 1;

  console.log('\nDone.', JSON.stringify(stats, null, 2));
  console.log('Manifest sources:', JSON.stringify(bySource));
  console.log(`~${stats.ttsChars} TTS characters used (Google free tier: ~1,000,000/month on Neural2).`);
  if (bySource.duolingo) {
    console.log(`Tip: ${bySource.duolingo} clips are still Duolingo recordings. Run with --replace-duolingo to re-voice them all with ${VOICE}.`);
  }
  if (!API_KEY && stats.tts === 0 && stats.failed > 0) {
    console.log('Tip: set GOOGLE_TTS_API_KEY to generate the non-recorded words/sentences.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
