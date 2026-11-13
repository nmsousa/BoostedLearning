/**
 * gen-audio-samples.mjs — hear the FREE-TIER TTS voices on OUR real content
 * before committing to a full generation run.
 *
 * It pulls 10 real words and 10 real example sentences straight from the Tree
 * curriculum (a mix of the SHORTEST and the LONGEST we have), then synthesizes
 * each one with every voice, writing the clips to:
 *
 *   src/assets/audio/_samples/<voice>/NN-<slug>.mp3
 *
 * So you get one folder per voice/model and can play them back-to-back.
 *
 * ── Cost ────────────────────────────────────────────────────────────────────
 * ONLY free-tier Cloud TTS families are included: Standard, WaveNet, Neural2,
 * Chirp3-HD. All have a monthly free allowance (1M–4M characters). This run is
 * ~200 characters per voice, so it costs €0.00. Studio and Gemini voices are
 * deliberately excluded (Studio is pricey past the free million; Gemini has no
 * free tier and uses a different API).
 *
 * Usage (PowerShell):
 *   $env:GOOGLE_TTS_API_KEY = '<your key>'
 *   node scripts/gen-audio-samples.mjs                 # all default voices
 *   node scripts/gen-audio-samples.mjs fr-FR-Neural2-A fr-FR-Chirp3-HD-Charon
 *
 * The _samples folder is throwaway — delete it once you've chosen (it is not
 * shipped and is not referenced by the app).
 */

import './load-env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const CURRICULUM = path.join(ROOT, 'src/app/maps/tree/tree-curriculum.ts');
const OUT = path.join(ROOT, 'src/assets/audio/_samples');
const API_KEY = process.env.GOOGLE_TTS_API_KEY || '';
const DUMMY_KEY = 'ABCDEF';

// Free-tier voice families only (name encodes the tier). A spread of female/
// male so you can judge both. Edit freely, or pass your own as CLI args.
const DEFAULT_VOICES = [
  // Chirp 3: HD — most natural, GA (stable). 1M chars/month free.
  'fr-FR-Chirp3-HD-Achernar',   // female
  'fr-FR-Chirp3-HD-Charon',     // male
  'fr-FR-Chirp3-HD-Kore',       // female (alt)
  // Neural2 — very good, GA. 1M chars/month free.
  'fr-FR-Neural2-A',            // female
  'fr-FR-Neural2-B',            // male
  // WaveNet — solid, older. ~4M chars/month free.
  'fr-FR-Wavenet-C',            // female
  'fr-FR-Wavenet-D',            // male
  // Standard — robotic but the biggest free allowance (~4M/month).
  'fr-FR-Standard-A',           // female
];

// ── Pull real content from the curriculum ───────────────────────────────────

function norm(s) {
  return String(s).normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

/** Pick `n` items favouring extremes of length: shortest half + longest half. */
function pickShortAndLong(items, n) {
  const uniq = [...new Set(items.map(norm))].filter(Boolean);
  uniq.sort((a, b) => a.length - b.length);
  if (uniq.length <= n) return uniq;
  const half = Math.floor(n / 2);
  const short = uniq.slice(0, half);                 // shortest
  const long = uniq.slice(uniq.length - (n - half)); // longest
  return [...short, ...long];
}

function collectSamples() {
  const src = fs.readFileSync(CURRICULUM, 'utf8');

  const words = [];
  for (const m of src.matchAll(/\bfr:\s*'([^']+)'/g)) {
    if (m[1] && m[1] !== '—') words.push(m[1]);
  }

  const sentences = [];
  for (const m of src.matchAll(/\bexample:\s*'([^']+)'/g)) {
    for (const part of m[1].split(' / ')) {
      const s = part.trim();
      if (s) sentences.push(s);
    }
  }

  return {
    words: pickShortAndLong(words, 10),
    sentences: pickShortAndLong(sentences, 10),
  };
}

// ── Synthesis ────────────────────────────────────────────────────────────────

function slug(s) {
  return norm(s).toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'x';
}

async function synthesize(text, voice) {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'fr-FR', name: voice },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 },
      }),
    },
  );
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const json = await res.json();
  if (!json.audioContent) throw new Error('no audioContent');
  return Buffer.from(json.audioContent, 'base64');
}

async function main() {
  if (!API_KEY) { console.error('Set GOOGLE_TTS_API_KEY (in .env or the environment) first.'); process.exit(1); }
  if (API_KEY === DUMMY_KEY) {
    console.error('GOOGLE_TTS_API_KEY is still the dummy value "ABCDEF". Put your real key in .env first.');
    process.exit(1);
  }
  const voices = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_VOICES;

  const { words, sentences } = collectSamples();
  const texts = [...words, ...sentences];
  const chars = texts.reduce((n, t) => n + t.length, 0);

  console.log(`Samples: ${words.length} words + ${sentences.length} sentences = ${texts.length} clips/voice`);
  console.log(`Words:     ${words.join(' | ')}`);
  console.log(`Sentences: ${sentences.join(' | ')}`);
  console.log(`~${chars} characters per voice × ${voices.length} voices = ~${chars * voices.length} total (free tier).\n`);

  fs.mkdirSync(OUT, { recursive: true });

  for (const voice of voices) {
    const dir = path.join(OUT, voice);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`▶ ${voice}`);
    let i = 1;
    let voiceBroken = false;
    for (const text of texts) {
      const file = path.join(dir, `${String(i).padStart(2, '0')}-${slug(text)}.mp3`);
      i++;
      try {
        fs.writeFileSync(file, await synthesize(text, voice));
        process.stdout.write(`  ✓ ${text}\n`);
      } catch (err) {
        console.warn(`  ✗ ${text} — ${err.message}`);
        // A bad/unavailable voice name fails every line; stop early to save calls.
        if (/^(400|404)/.test(String(err.message))) {
          console.warn('  (voice name likely invalid/unavailable — skipping rest)\n');
          voiceBroken = true;
          break;
        }
      }
      await new Promise(r => setTimeout(r, 120));
    }
    if (!voiceBroken) console.log('');
  }

  console.log(`Done. Open ${path.relative(ROOT, OUT)}\\<voice>\\ and play the clips.`);
  console.log("Delete the _samples folder once you've chosen a voice.");
}

main().catch(e => { console.error(e); process.exit(1); });
