# Boosted Learning (Boostionary)

A local-first language-learning app (French and Dutch), built with Angular 22,
Ionic 9, and Capacitor 8. Runs in the browser for development and ships as an
Android app with over-the-air (OTA) web updates.

## Highlights

- **Tree / Tree+ curriculum** — an authored Core-vocabulary + thematic path on
  top of the imported Duolingo decks, with its own level/progress engine.
- **Many exercise modes** — Flip (flashcards), Quiz, Match, Match Audio
  (listen → pick), Write (typed translation, word + phrase), Blanks
  (fill-in-the-blank), Builder, and a teaching "Learn" step.
- **Spaced repetition** — FSRS scheduling (`ts-fsrs`) plus a per-mode mastery
  engine for the Tree drills.
- **Offline-first** — all progress lives in IndexedDB (Dexie). Pronunciation
  audio is being moved to bundled files so it works with no internet (see
  [Pronunciation audio](#pronunciation-audio-tts)).
- **OTA updates** — ship web-layer changes to installed testers without a new
  APK (see [Releases](#releases-ota-updates)).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- [Android Studio](https://developer.android.com/studio) (for Android builds)
- [GitHub CLI](https://cli.github.com/) (`gh`), authenticated — only needed to
  publish OTA releases

## Setup

```bash
git clone <repository-url>
cd boosted-learning
npm install
cp .env.example .env   # then edit .env (see Environment below)
```

## Development

```bash
npm start        # ng serve — http://localhost:4200, hot reload
# or
ionic serve
```

### Tests

The suite runs on Vitest (launched via `ng test`) with `fast-check` for
property-based tests.

```bash
npm test          # run once (CI mode)
npm run test:watch
npm run test:core # core domain tests only (src/core)
```

### Lint

```bash
npm run lint
```

## Environment

Build-time scripts read secrets from a git-ignored `.env` at the project root.
Start from the template and replace the dummy values:

```bash
cp .env.example .env
```

| Variable             | Used by                     | Notes                                                  |
| -------------------- | --------------------------- | ------------------------------------------------------ |
| `GOOGLE_TTS_API_KEY` | `scripts/gen-audio*.mjs`    | Google Cloud Text-to-Speech key. Dummy is `ABCDEF`.    |
| `GOOGLE_TTS_VOICE`   | `scripts/gen-audio.mjs`     | Optional voice override (default `fr-FR-Neural2-A`).   |

Real environment variables override the `.env` file, so you can still do
`$env:GOOGLE_TTS_API_KEY = '...'` for a one-off run. `.env` is never committed;
`.env.example` is.

## Explore words & sentences (editing the curriculum)

All Explore content (Core levels + topic levels: words, English, notes, icons
and example sentences) lives in ONE source file:

- **Source (edit this):** `src/app/maps/tree/tree-curriculum.ts`
- **Readable export (generated, don't edit by hand):** `docs/EXPLORE-CONTENT.md`
  — a Markdown list of every level, ready to hand to an AI to suggest more
  words, sentences or icons.

### Step 1 — Edit the words in `tree-curriculum.ts`

- **Core levels:** `CORE_TIERS` — each level has `title`, `outcome` (the goal),
  `example` (its example sentences in one string, separated by ` / `) and
  `words: [{ fr, en, note?, icon? }]`.
- **Topic levels:** `THEME_DEFS` — each topic has `tiers: [[...level 1 words], [...level 2], ...]`,
  each word `{ fr, en, icon }`.

Authoring rules (keep them, the app relies on them):

- `fr` is exactly what the learner types and hears: nouns WITH their article
  (`'le café'`, `'l’hôtel'`), no notes, no `a / b` alternatives.
- `en` is the bare English (`'coffee'`); the app adds "the / a" itself.
  For nouns starting with `l’` or `les`, add the gender note: `'hotel (m.)'`,
  `'water (f.)'` — it drives the Masculine / Feminine badge.
- `icon` is a single emoji (optional).

### Step 2 — Regenerate the readable export

```powershell
node scripts/export-explore-content.mjs
```

This rewrites `docs/EXPLORE-CONTENT.md` from the curriculum (and prints how many
words / sentences it found).

### Step 3 — Generate audio for any new words or sentences

```powershell
node scripts/gen-audio.mjs
```

Needs `GOOGLE_TTS_API_KEY` in `.env` (see [Pronunciation audio](#pronunciation-audio-tts)).
Existing clips are skipped, so only the new items are generated.

### Step 4 — Build and test

```powershell
npm run build
npm test
```

### Step 5 — Commit and (optionally) release

Commit `tree-curriculum.ts`, `docs/EXPLORE-CONTENT.md` and the new files under
`src/assets/audio/`, then follow [Releasing a new version](#releasing-a-new-version-ota-update).

### Using an AI to add content

1. Regenerate the export (Step 2).
2. Give the AI `docs/EXPLORE-CONTENT.md` plus the authoring rules above, and ask
   for more words / sentences / icons per level in the same format.
3. Paste the result back into `tree-curriculum.ts` (or ask Kiro to merge it),
   then do Steps 2–5.

## Explore+ lessons (editing the lessons)

Explore+ has its OWN content, separate from Explore: lessons grouped by CEFR
band, each with its words AND its authored sentences (nothing is generated).

- **Source (edit this):** `src/app/maps/explore-plus/lessons/`
  - `lessons-pre-a1.ts`, `lessons-a1.ts`, `lessons-a2.ts` — one file per band;
  - `lesson-types.ts` — the format and the authoring rules;
  - `lessons.ts` — the order of the bands (add a new band file here).
- **Readable export (generated):** `docs/EXPLORE-PLUS-LESSONS.md`.

### Step 1 — Edit a band file

Each lesson looks like this:

```ts
{
  id: 'a1-03', band: 'a1', icon: '☕',
  title: 'At the café',
  goal: 'Order a drink and something to eat, and ask for the bill.',
  grammar: 'je voudrais (I would like) as a polite fixed chunk; avec / sans.',
  words: [
    { fr: 'un café', en: 'coffee', icon: '☕' },
    { fr: 'l’addition', en: 'bill (f.)', icon: '🧾' },
  ],
  sentences: [
    //   French                              English                           focus word  3 wrong options
    s('Je voudrais un café, s’il vous plaît.', 'I would like a coffee, please.', 'voudrais', ['voudrait', 'voudrez', 'veut']),
    // optional 5th argument: other accepted answers for Write
    s('Je suis anglais.', 'I am English.', 'suis', ['es', 'est', 'êtes'], ['Je suis anglaise.']),
  ],
},
```

Rules (the tests check them): at least 10 words and 8 sentences per lesson;
the curly apostrophe `’` everywhere; nouns with their article; `(m.)`/`(f.)`
for l’/les nouns; the focus word must be in the sentence; 3 different
one-word wrong options; say "(tu)" or "(vous)" in the English when both fit.

**Add new lessons at the END of their band file; never reorder, remove or
insert lessons in the middle.** Progress is saved by position: each band owns
40 fixed slots (Pre-A1 = levels 1–40, A1 = 41–80, A2 = 81–120), so a new
lesson at the end of A1 doesn't touch A2's progress. A new band (B1) goes at
the end of `BANDS` in `lesson-types.ts` and of `LESSONS` in `lessons.ts`.

### Step 2 — Regenerate the export, then build and test

```powershell
node scripts/export-explore-content.mjs
npm run build
npm test
```

Audio for the new sentences isn't generated yet; until it is, the device voice
reads them.

### Placement and level-unlock tests

The test questions come from `CEFR - Test` (next to this project). To change
them, edit the JSON there and re-import:

```powershell
node scripts/import-placement-tests.mjs                     # Long version (default)
node scripts/import-placement-tests.mjs "..\CEFR - Test\Short version\boostionary-french-placement-tests-short-v1.json"
```

It rewrites `src/app/maps/explore-plus/lessons/placement-bank.ts` (don't edit
that file by hand). The rules are in `docs/LEVEL-ALGORITHM.md` §12.

## Pronunciation audio (TTS)

The Tree curriculum needs audio for its words and example sentences. To make it
work **offline**, we pre-generate small MP3s on the dev machine and bundle them
under `src/assets/audio/<lang>/`, with a `manifest.json` mapping each normalized
text to its file. The app prefers a bundled local clip, then a streamed course
recording, then device TTS.

Each clip's origin is tracked in the manifest so the mix of voices can be made
uniform later:

```json
"café":               { "file": "cafe-ab12cd34.mp3", "source": "duolingo" },
"je viens de finir":  { "file": "je-viens-...-ef56.mp3", "source": "tts", "voice": "fr-FR-Neural2-A" }
```

- `source: "duolingo"` — the real course recording, downloaded to a local file.
- `source: "tts"` — generated by us (Google Cloud TTS, voice recorded).

### Generate the audio

Put your real key in `.env` (`GOOGLE_TTS_API_KEY=...`) first, then pick one of
two approaches. Both write `src/assets/audio/fr/*.mp3` + `manifest.json`; both
need internet (to pull the Duolingo clips) and the key (for TTS). No app wiring
is needed afterwards — the app already prefers the bundled local clip.

**Option A — mixed voices (default, recommended to start):**

```powershell
node scripts/gen-audio.mjs
```

Downloads the ~430 real **Duolingo recordings** to local files and generates
only the ~113 missing items (conjugated chunks + example sentences) with TTS
(Neural2-A). You keep the human voice on most words; whole sentences are TTS.
Downside: a single word (human) followed by its example sentence (TTS) won't be
the same voice. Each clip is tagged in the manifest (`source: "duolingo"` or
`"tts"`), so you can unify later.

**Option B — one uniform voice:**

```powershell
node scripts/gen-audio.mjs --replace-duolingo
```

Re-voices **every** clip (including the borrowed Duolingo ones) with the TTS
voice, so the whole Tree sounds consistent end to end. Downside: you lose the
human recordings. You can switch from A to B at any time — this command rebuilds
the clips currently tagged `duolingo` and retags them `tts`.

> Either way, run `npm run build` afterwards and the Tree/Tree+ audio plays from
> the bundled files, offline.

The generator is **idempotent** — existing files are skipped, so re-runs only
fill gaps and are cheap/free. Google's free tier (≈1M characters/month on
Neural2) covers this app's usage many times over.

Useful flags:

| Command                                   | What it does                                                        |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `node scripts/gen-audio.mjs`              | Words **and** example sentences.                                    |
| `node scripts/gen-audio.mjs --words`      | Words only (skip example sentences).                                |
| `node scripts/gen-audio.mjs --dry-run`    | List what *would* be generated; writes nothing.                     |
| `node scripts/gen-audio.mjs --replace-duolingo` | Re-voice every borrowed Duolingo clip with our TTS voice, for one consistent voice across the Tree. |

### Compare voices first (optional)

Before committing to a voice, generate a few sample clips per voice into
`src/assets/audio/_samples/<voice>/` (a throwaway folder) and listen:

```powershell
node scripts/gen-audio-samples.mjs                        # a curated set of free-tier voices
node scripts/gen-audio-samples.mjs fr-FR-Neural2-A fr-FR-Neural2-B
```

Only free-tier Cloud TTS families are sampled (Standard, WaveNet, Neural2,
Chirp3-HD). Note: Chirp3-HD is the most natural but swallows very short isolated
words (le/un/je) — which is why the app defaults to **Neural2-A**. Delete the
`_samples` folder once you've chosen.

## Releasing a new version (OTA update)

The app ships OTA **web-layer** updates to installed testers via
`@capgo/capacitor-updater` in self-hosted mode: a web bundle is attached to this
repo's GitHub Releases, and the installed app downloads it on next launch when
the published version is newer than what it has. Native changes (a new plugin,
native config, or a Capacitor bump) still need a fresh APK — see
[Building for Android](#building-for-android). Everything else (Angular/Ionic
code, styles, assets, curriculum, audio) ships OTA.

> This is the full manual procedure. It replaces nothing you need to remember —
> follow it top to bottom. All commands run from the `boosted-learning/` folder
> in **PowerShell** on Windows.

### One-time setup (first release only)

```powershell
winget install --id GitHub.cli   # the GitHub CLI (gh)
gh auth login                    # GitHub.com -> HTTPS -> browser, as the repo owner
```

Confirm you're authenticated before releasing:

```powershell
gh auth status
```

### Step 1 — Pick the new version number

Use a semantic version **strictly higher** than the last published one (the
publish script refuses to overwrite an existing release tag). To see what's
currently live:

```powershell
curl.exe -sL "https://github.com/nmsousa/BoostedLearning/releases/latest/download/updates.json"
```

The `version` field in that JSON is the current OTA version. Bump the patch
number for a normal release (e.g. `1.3.55` -> `1.3.56`).

### Step 2 — Bump the version in `package.json`

Edit `package.json` and set `"version"` to your new number:

```jsonc
{
  "version": "1.3.56"   // <- change this line
}
```

That single edit is enough for Android too: the `prebuild` hook
(`scripts/gen-build-info.mjs`) runs on every build and automatically syncs the
Android `versionName` and `versionCode` in `android/app/build.gradle` from
`package.json` (e.g. `1.3.56` -> `versionName "1.3.56"`, `versionCode 10356`).
**Do not** edit `build.gradle` by hand.

### Step 3 — Add the in-app changelog entry

Edit `src/app/services/changelog.ts` and add a new entry at the **top** of the
`CHANGELOG` array (newest first). Match the `version` to `package.json`, set
`date` to the current UTC time, and write short, user-facing bullet points:

```ts
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.56',
    date: '2026-11-15T20:00:00Z',   // ISO 8601 UTC
    notes: [
      'Short, user-facing description of what changed.',
      'One bullet per noticeable change.',
    ],
  },
  // ...older entries stay below
];
```

This drives the "What's new in x.y.z" dialog shown once after the update applies
(and the Settings -> About -> "What's new" history). Keep these notes in sync
with the GitHub Release notes you pass in Step 6.

### Step 4 — Verify locally before shipping

```powershell
npm test          # expect "Tests NNN passed"; exit code 1 is a harmless warning
npm run build     # must finish with "Application bundle generation complete"
```

The SCSS "exceeded maximum budget" warnings are pre-existing and harmless. Only
real `error TS...` / build failures should stop you.

### Step 5 — (Optional) Dry-run the package

Build and package the bundle **without** publishing, to inspect it first:

```powershell
./scripts/publish-ota.ps1 -Version 1.3.56 -NoPublish
```

This writes `scripts/ota-out/bundle-1.3.56.zip` and `scripts/ota-out/updates.json`
but creates no GitHub Release.

### Step 6 — Commit, push, and publish

Commit the version + changelog (and all the feature work this release covers):

```powershell
git add -A
git commit -m "Release 1.3.56: <one-line summary>"
git push
```

> `.env` is git-ignored (it holds the real `GOOGLE_TTS_API_KEY`) and will not be
> committed — that's expected and correct.

Then build, package, and publish the OTA release in one command:

```powershell
./scripts/publish-ota.ps1 -Version 1.3.56 -Notes "What changed in this release"
```

The script runs four steps: builds the web bundle, zips it with the Capgo CLI,
writes `updates.json`, and creates a GitHub Release tagged `v1.3.56` with both
files attached. It refuses to run if the tag already exists or if `gh` isn't
authenticated.

> `gh` sometimes prints progress to stderr and may report a non-zero exit even
> when the release landed. The script double-checks that the release exists with
> both assets and only fails if they're genuinely missing — trust its final
> "Published release ..." message.

### Step 7 — Verify the published release

```powershell
curl.exe -sL "https://github.com/nmsousa/BoostedLearning/releases/latest/download/updates.json"
```

The returned `version` should now be your new one. Installed testers get the
update automatically on their next launch.

Full background and the OTA test loop are in
[docs/OTA-UPDATES.md](./docs/OTA-UPDATES.md).

### Quick checklist

1. Pick a version higher than the live one.
2. Bump `version` in `package.json`.
3. Add a top entry in `src/app/services/changelog.ts` (same version + date).
4. `npm test` and `npm run build` pass.
5. (Optional) `./scripts/publish-ota.ps1 -Version X.Y.Z -NoPublish` to inspect.
6. `git add -A; git commit; git push`.
7. `./scripts/publish-ota.ps1 -Version X.Y.Z -Notes "..."`.
8. Verify `updates.json` shows the new version.

## Issues & bugs

Known bugs and the working backlog are tracked in-repo as Markdown, not in an
external tracker:

- [docs/BUGLIST.md](./docs/BUGLIST.md) — known bugs.
- [docs/TODO.md](./docs/TODO.md) — planned work and feature ideas.

Add a dated entry when you find or fix something, and reference the relevant
file/mode so it's easy to pick up later.

## Building for Android

First-time setup:

```bash
ionic build
ionic cap add android
ionic cap sync
ionic cap open android
```

Subsequent builds:

```bash
ionic build
ionic cap sync
ionic cap open android   # Build > Build Bundle(s)/APK(s) > Build APK(s)
```

The debug APK lands in `android/app/build/outputs/apk/debug/`. To run on a
device, enable USB debugging, connect, pick the device in Android Studio, and
Run.

## Project structure

```
src/
├── app/
│   ├── exercises/      # Exercise pages: flip, quiz, match, learn, study, builder, blanks
│   ├── maps/           # Curriculum maps (tree/, journey-plus/, journey-plus-plus/)
│   │   └── tree/       # Tree curriculum data + engine (tree-curriculum.ts, ...)
│   ├── flashcards/     # Flashcards landing + routing
│   ├── home/ course/ progress/ session/ settings/ words/
│   └── services/       # Angular services (flashcard, audio, settings, i18n, ...)
├── core/               # Pure domain logic (scheduler, phrase-builder, validators) — no framework deps
├── persistence/        # Dexie/IndexedDB layer
├── services/           # Platform services (TTS, ...)
└── assets/
    ├── decks/          # Bundled course decks (french.json, duolingo-dutch.json)
    └── audio/<lang>/   # Bundled pronunciation MP3s + manifest.json (generated)
```

## Scripts reference

All live in `scripts/`. Audio and release scripts are described above.

| Script                     | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `gen-audio.mjs`            | Pre-generate bundled Tree pronunciation audio (download Duolingo clips + TTS the rest). |
| `gen-audio-samples.mjs`    | Generate per-voice sample clips to A/B compare TTS voices (throwaway).  |
| `publish-ota.ps1`          | Build, package, and publish an OTA web update as a GitHub Release.       |
| `gen-build-info.mjs`       | Write `src/build-info.ts` (version + build date) and sync Android version. Runs automatically on prebuild/prestart. |
| `load-env.mjs`             | Zero-dependency `.env` loader imported by the audio scripts.            |
| `import-duome.mjs`         | Convert a saved duome.eu "by skill" page into a bundled deck JSON.       |
| `audit-french.mjs`         | Generate a French translation-quality review document.                  |
| `peek-french.mjs`          | Quick ad-hoc inspection of French deck entries.                         |
| `make-adaptive-icon.mjs`   | Generate the Android adaptive launcher icon (background + foreground).  |
| `make-transparent-favicon.mjs` | Build transparent-background web favicons from the app icon.        |
| `fix-icon-format.mjs`      | Re-encode copied launcher icons to true PNG for Android/aapt.           |

## Technology stack

- **Frontend:** Angular 22 + Ionic 9
- **Mobile:** Capacitor 8 (Android), `@capgo/capacitor-updater` for OTA
- **Database:** Dexie.js (IndexedDB)
- **Scheduling:** `ts-fsrs` (FSRS algorithm)
- **Testing:** Vitest + fast-check

## License

See [docs/DEPENDENCIES.md](./docs/DEPENDENCIES.md) for third-party license
information.
