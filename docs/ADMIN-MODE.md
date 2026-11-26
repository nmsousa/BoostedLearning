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
  active node/row on the Explore / Explore+ lists force-completes its next level
  (`toggleNode`/`adminComplete`); on the shared **level page** (`TierDetailPage`)
  double-tapping an activity force-passes just that activity
  (`onModeTap`/`adminCompleteMode`). Single-tap opens/plays as normal.

  > Level completion rule (shared by Explore, Explore+, the level page and the
  > radial Tree — `tierProgress()` in `maps/tree/tree-modes.ts`): a level is
  > complete when **Learn** is done and any **6 of the 8 games** (quiz, write,
  > match, match audio, builder, builder+, blanks, mix) are passed, in any order. The
  > games unlock once Learn is done; the rest are optional. Flashcards is an
  > optional review that never counts.

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

- **Admin look (pattern):** every admin-only control uses the amber colour
  `--admin: #f5a524` and the `shield-checkmark-outline` icon (class
  `admin-ctl`); admin tip bars use the same shield. Checked on all themes
  (all are dark: ocean, slate, forest).
- **Star rules button:** in Explore games (Quiz, Write, Match, Match Audio,
  Mix, Builder, Builder+) a shield button at the top right opens a modal with
  the exact star rules for the current round (from
  `src/app/shared/star-rules.ts`, via `GameRulesService.showRules`).

## When removing Admin mode

Flip `adminMode` to `false` by default, OR strip the feature. If stripping,
audit all of the above plus the `FlashcardService` admin helpers
(`adminForceComplete`, `adminForceCompleteAllRounds`, `adminSetFlipKnowledge`)
and the engine helpers (`adminResetProgress`, `adminCompleteNextTier`,
`adminCompleteMode`).
