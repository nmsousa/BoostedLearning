# Bug List

Known bugs to fix later.

## To investigate (not confirmed bugs)

- [ ] **Missing apostrophe marked wrong (e.g. `sil vous plaît` for `s'il vous plaît`)** — TO INVESTIGATE, not a confirmed bug.
  Typing `sil vous plaît` for the expected `s'il vous plaît` is marked INCORRECT. This is the CURRENT rule working as designed: the typo grader (`src/core/answer-validator/typo-grader.ts`, docs/LEVEL-ALGORITHM.md §9) treats the apostrophe as a word separator, so `s'il` = two words (`s` + `il`) and `sil` = one word → word counts differ → wrong (never a typo).
  Question to decide: should a missing/extra apostrophe be accepted as a single typo instead (Duolingo-style — it accepts `jai`/`cest`/`sil vous plait` with a "mind the apostrophe" nudge)? Options: (A) treat a missing/extra apostrophe as the one allowed typo, or as a free pass like accents; (B) keep the strict separator rule. Decide before changing, and update the spec + §9 if we do.

## Journey++

- [ ] **Stale chapter title on enter, previous chapter nodes missing**
  When entering Journey++, the header sometimes shows the previous chapter's title (e.g. "Describe what you want to buy", 6/6, 100% completed) while the path below shows a different section (e.g. "Talk about languages"). None of the previous chapter's nodes are rendered, so the header and the visible path are out of sync.

## Navigation

- [ ] **Double back on hardware back button**
  Pressing the Android hardware back button triggers back navigation twice instead of once.

- [ ] **Hardware/swipe back skips the exercise exit flow**
  Using the Android hardware/gesture back button during an exercise doesn't go
  through the in-exercise exit handling the way the on-screen X does. Observed
  behaviours:
  - it sometimes jumps straight from the current game to the Home page (or
    otherwise closes the screen) instead of staying put / confirming;
  - other times it closes/leaves where you are, and the "end study session"
    confirm popup only appears AFTER you've already navigated back (shown too
    late, on the wrong screen).
  Expected: a hardware/swipe back press should behave exactly like the on-screen
  X — claim the back press, show the "lose progress / end session" confirm when
  there's in-session progress, and only leave once confirmed. Likely related to
  `BackInterceptorService` not being wired for all exercises (see docs/TODO.md
  "Consistent 'lose progress?' confirm on back for all exercises").
