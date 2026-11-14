# Admin mode — what differs from a regular user

Admin mode is a **temporary testing convenience**, currently ON by default
(`DEFAULT_SETTINGS.adminMode = true` in `settings.service.ts`). Before a public
release it must be turned off or removed (see docs/TODO.md → "Remove Admin mode
before public release"). This file lists every place behaviour differs so the
audit is easy later.

Gate used everywhere: `SettingsService.adminMode()`.

## Differences (admin sees / can do, regular user does not)

- **Unavailable mode cards (home):** a practice mode with no content for the
  current learning language is HIDDEN for regular users, but SHOWN for admins
  with a grey **"Not available"** badge (so admins can still open/inspect it).
  Driver: `HomePage.showModeCard(available)` + `.na-badge`. Today this applies
  to the Tree-based modes (Explore, Explore+, radial Tree), which only have an
  authored curriculum for **French** (`HomePage.TREE_LANGS = {'fr'}`).

- **Explore / Explore+ / Tree "complete level" double-tap:** double-tapping an
  active node/row (or a single activity) force-completes it. Single-tap opens as
  normal. (`toggleNode`/`adminComplete` and `onModeTap`/`adminCompleteMode`.)

- **Explore reset:** the red **"Reset progress"** button in the admin tip bar
  wipes all Tree/Explore progress (shared `tree-v2-<lang>` deck).

- **Journey++ node double-tap-to-complete:** `onNodeTap`/`adminCompleteNode` in
  `journey-plus-plus.page.ts`.

- **Flashcards level list "complete level / complete 5 rounds":** offered via
  the mode menu (`add-word.service.ts` → `onAdminComplete`/`onAdminCompleteAll`).

- **"Level 0" test level:** a synthetic always-unlocked level (2 fixed words)
  shown at the top of the Flashcards level list (`flashcard.service.ts` test
  level + `FlashcardsPage.testLevelRow()`).

- **"Your words" audio-source badge:** the speaker icon is green for clips that
  still come from a borrowed Duolingo recording (vs our generated TTS). Admin
  only. (`WordsPage.isDuolingoAudio`.)

## When removing Admin mode

Flip `adminMode` to `false` by default, OR strip the feature. If stripping,
audit all of the above plus the `FlashcardService` admin helpers
(`adminForceComplete`, `adminForceCompleteAllRounds`, `adminSetFlipKnowledge`)
and the engine helpers (`adminResetProgress`, `adminCompleteNextTier`,
`adminCompleteMode`).
