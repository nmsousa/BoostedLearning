---
inclusion: fileMatch
fileMatchPattern: 'src/app/services/flashcard.service.ts|src/app/flashcards/**|docs/LEVEL-ALGORITHM.md'
---

# Keep docs/LEVEL-ALGORITHM.md in sync with the rules

`docs/LEVEL-ALGORITHM.md` is the **single source of truth** for how levels,
rounds, stars, unlocking, the Flashcards knowledge breakdown, and per-word
practice priorities work. It is also surfaced in-app on the **Admin → How it
works** page. If the doc and the code disagree, that is a bug.

## Rule — update the doc in the SAME change as the rule

Whenever you change any of the behaviours below in code, update
`docs/LEVEL-ALGORITHM.md` in the same change (same commit), and keep the numbers
in the doc equal to the constants/logic in `FlashcardService`:

- **Rounds**: `ROUNDS_PER_LEVEL`, `ROUND_PASS_SCORE`, `ROUND_NEW_FRACTION`,
  `ROUND_TARGET_ITEMS`, and how a round's cards are composed (§2–§4).
- **Stars**: how `bestStars` is computed and the star thresholds. Current rule:
  stars are the **best (highest)** rating across the rounds played (max per
  round), like best time and best combo — they never drop after a weaker round.
  `bestScore` keeps the running average for reference only (§4).
- **Time for 3 stars** (Match): the time thresholds and how they scale with the
  pair count (§5).
- **Unlocking**: when the next level unlocks (all 5 rounds done; legacy
  score-based fallback) (§2, isLevelUnlocked).
- **Flashcards (flip)**: free-practice behaviour (no rounds/stars/unlock), and
  the knowledge breakdown — the pie ring + legend, and the `flipKnowledgeBucket`
  classification (don't know / so-so / know), which is DISTINCT from the
  long-term `levelForCard` mastery buckets used by Home / "Your words" (§6b).
- **Per-word priorities**: `boost` / `hide` / `normal` semantics and how they
  affect practice queues (§8).

## What to keep consistent

- Section numbers and titles in the doc are referenced from code comments and
  the Admin page — if you renumber, update those references too.
- When you add a NEW scored mode or a NEW rule, add a matching section to the
  doc rather than leaving it undocumented.
- If a shipped value differs from the "intended" design, say so explicitly in
  the doc (the doc already distinguishes shipped vs planned in places).

## Why

The rules are subtle and have changed several times (e.g. stars went from
"average" to "best"; the Flashcards breakdown was removed and then re-added with
a flip-rating classifier). Without the doc as the authority, the Admin page and
future changes drift out of sync and users get contradictory behaviour.
