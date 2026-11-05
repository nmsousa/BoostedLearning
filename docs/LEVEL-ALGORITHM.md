# Level, rounds, stars & word-selection algorithm

This document specifies how levels work: how a level session is built, how the
5 rounds are composed, how stars and the "time for 3 stars" are calculated, how
the next level unlocks, and why a given word is shown. It is the source of
truth for the engine and is surfaced in-app on the **Admin** page.

> Status: **PROPOSED / under review.** The current shipped engine still uses the
> single-pass model (see "Current behaviour" at the bottom). The 5-round model
> below is the agreed target; it is being implemented next.

---

## 1. Concepts

- **Level** — a themed group of words (a skill for French, or a 20-word chunk
  for decks without skills).
- **Round** — one playthrough of a level. A level has **5 rounds**. The circle
  on the level card fills 1/5 per completed round.
- **New words** — the words that belong to this level.
- **Review words** — words from EARLIER levels, weighted toward the ones the
  user scored worst on (lowest accuracy / most recent misses).

## 2. Unlocking

- Level 1 is always unlocked.
- **Write / Quiz**: level N+1 unlocks when level N has **all 5 rounds completed**
  (the circle is full). Completing a round requires at least a passing score
  (see §4).
- **Match**: unlocks on a **single passing play** of the previous level
  (best score ≥ 70%) — requiring 5 full rounds just to unlock felt grindy for a
  quick timed game. Match still fills its 5-round ring for stars/completion;
  that is separate from unlocking.
- **Flashcards (flip)**: no gating — every level is always open (§6b).
- Legacy records with no round data fall back to: previous level best score
  ≥ 70%.

## 3. Round composition (what words each round contains)

Each round focuses increasingly on the user's weakest words. Let `N` be this
level's new words and `R` be the pool of review words (earlier levels, ordered
worst-first). Target ~`S` items per round (`S` ≈ min(10, |N|)).

| Round | New words | Review words | Emphasis |
|------:|-----------|--------------|----------|
| 1 | 100% new | 0% | Introduce this level's words. |
| 2 | ~90% new | ~10% worst review | Mostly new, a little review. |
| 3 | ~75% new | ~25% worst review | More review of weak words. |
| 4 | ~60% new | ~40% worst review | Heavy review of weak words. |
| 5 (final) | ~80% new | ~20% review, biased to **the words missed most in rounds 1–4 of THIS level** | Consolidate: mostly this level, but revisit what was failed. |

Rules:
- **Order varies every round** (shuffled), and the exact words may differ
  slightly round to round (review picks rotate through the weak pool).
- "Worst" = highest miss rate (`incorrect / seen`), unseen treated as neutral
  (0.5). Ties broken by most recently missed.
- Round 5's review slice is drawn first from **words failed during rounds 1–4
  of this same level**, then falls back to the global weak pool if there aren't
  enough.
- If a level has very few words, percentages round to whole words and review is
  capped so a round never exceeds `S + a small margin`.

## 4. Scoring a round & stars

- A round is **passed** when first-try accuracy ≥ **70%**. A pass is required
  for the round to count toward the 5 (an un-passed round can be retried and
  does not advance the circle).
- **Stars** are the **best (highest) rating across the rounds played**, computed
  per round from that round's first-try accuracy and kept as the max — exactly
  like best time and best combo. Stored as `bestStars` and shown from the first
  round on, so a 3-star round shows 3 stars immediately and they **don't drop**
  if a later round scores lower (once earned, a star count sticks).
  Thresholds, per round:
  - **3 stars** — ≥ 95% first-try accuracy.
  - **2 stars** — ≥ 85%.
  - **1 star** — ≥ 70% (the pass line).
  - **0 stars** — below 70%.
- `bestScore` separately keeps the running **average** accuracy across rounds,
  for reference; it does not drive the star display.
- Rationale: time, combo and stars are all "your best so far", which is
  motivating (you chase your record) and avoids the confusing case where stars
  dropped after a weaker round. (An even earlier version only wrote stars once
  all 5 rounds were complete, so a just-earned 3-star round still showed 0 —
  also fixed.)

## 5. Time for 3 stars (Match mode only)

Match is timed. Time thresholds scale with the number of pairs `P`:

- **3-star time** = `P * BASE_SECONDS_PER_PAIR` where `BASE_SECONDS_PER_PAIR`
  starts at 2.2s and tightens with level depth (−0.2s every 3 levels, floor
  1.1s). So deeper levels demand faster play.
- Time only affects Match's star bonus; Write/Quiz/Flip are untimed.
- Combo (consecutive correct matches) is tracked for a "best combo" record but
  does not change unlocking.

## 6. Why is this word shown so often? (word frequency)

A word's chance of appearing in a review slice is proportional to its
**weakness weight**:

```
weight(word) = missRate(word) * recencyBoost(word) * priorityFactor(word)
missRate     = incorrect / max(1, seen)   (unseen = 0.5 neutral)
recencyBoost = 1 + (was missed in the last session ? 0.5 : 0)
priorityFactor = boost:1.5 | normal:1.0 | hide:0  (hidden never shown)
```

So a word appears often when: you miss it a lot, you missed it recently, or you
marked it "boost". It stops appearing when marked "hide".

## 6b. Flashcards mode — free practice & knowledge breakdown

Flashcards (flip) is **free practice**: every level is always unlocked and
there are **no rounds, no stars, no unlock gating**. No "current level"
highlight either (there is no next level to funnel toward).

Each level instead shows a **knowledge breakdown**: a pie ring around the level
number (red/yellow/green) plus a grey count legend under the title. The legend
reuses the **same wording as the flip rating buttons** ("don't know" / "so-so"
/ "know it") so the user maps the colours to the buttons they tap, e.g.
"8 don't know · 7 so-so · 9 know it". Each legend part is hidden when its count
is 0, and never-practised levels show a plain grey ring with no legend.
The level's word set is **fixed and known up front** (a skill group, or a fixed
20-card slice for decks without skills), so the breakdown is well-defined.

### Why a Flashcards-specific bucket rule (not the "Your words" one)

The long-term mastery buckets used by the home breakdown / "Your words" list
(`levelForCard`) require a **streak of 2–3 correct answers** before a word
counts as familiar/known. That is right for a mastery view, but wrong for the
Flashcards list: a single flip pass can never build a streak, so a level the
user had just aced (mostly "I know") showed up **all red** ("24 a aprender").
That looked broken.

Flashcards flip has its own direct per-card self-rating — **don't know /
so-so / know** — stored as `incorrectCount` / `mediumCount` / `correctCount`.
The breakdown classifies from those counts (`flipKnowledgeBucket`), reflecting
what the user actually said:

| Bucket | Colour | Rule |
|--------|--------|------|
| **known**    | green  | said "know" ≥ 1, never "don't know", and `know ≥ so-so`. |
| **learning** | red    | never said "know", **or** "don't know" outweighs `know + so-so`. |
| **familiar** | yellow | anything else studied (mixed / mostly "so-so"). |

So a pass of 9 "know" / 7 "so-so" / 8 "don't know" reads ≈ 9 green · 7 yellow ·
8 red — matching the session. The pie ring's proportions are over the
**practised** words only (untouched words don't colour the ring).

> History: an even earlier version coloured the whole level *border* green/
> yellow/red from the mastery buckets. It was removed because one pass left
> everything "learning". The current pie+legend uses the flip-rating rule above
> instead, which does not have that problem.

Other modes (Write / Quiz / Match) keep the round ring + stars and the
"current level" highlight; those already convey performance.

## 6c. Journey mode — one skill, five activity nodes

Journey is a game-style map built **on top of** the other modes; it never
changes them. The map is a vertical list of **chapters**, and:

- **A chapter = ONE skill** (one level). Its title is the skill name and it
  carries a 1-based chapter number badge.
- **Each chapter has 5 fixed nodes** (6 on French decks — see Blanks below),
  always in the same order and the same in every chapter:
  **Flashcards → Quiz → Write → Match → Builder (→ Blanks)**. Each node is a
  **single pass** of that activity (no 5-round loop, no interstitial) — so a
  chapter is a handful of distinct one-pass activities rather than five Write
  levels.
- The nodes are drawn on the original **serpentine trail** (a soft zig-zag arc,
  28/50/72/50/28, with a dashed tilde path threading through them); only the
  node *content* changed — each node is now a different mode, shown with that
  mode's homepage icon/colour instead of a level number.
- Chapter N reuses skill N's words; as in every other mode the exercise's round
  composition mixes in weaker/earlier words, so later chapters naturally revisit
  earlier vocabulary.

Each node uses its own progress namespace so Journey scoring stays fully
independent of the standalone modes:

| Node | Mode key | Exercise route | Icon / colour |
|------|----------|----------------|---------------|
| Flashcards | `journey-flip`    | `/practice/flip`            | `albums-outline` / primary |
| Quiz       | `journey-quiz`    | `/practice/quiz`            | `help-circle-outline` / success |
| Write      | `journey-write`   | `/practice/journey-play`    | `create-outline` / secondary |
| Match      | `journey-match`   | `/practice/match`           | `git-compare-outline` / tertiary |
| Builder    | `journey-builder` | `/practice/journey-builder` | `construct-outline` / warning |
| Blanks (FR only) | `journey-blanks` | `/practice/blanks`      | `reorder-four-outline` / danger |

Each exercise reads `?mode=journey-*&level=N` from the route, runs one pass,
saves its result under the node mode via the normal `saveRoundProgress`
(reusing `LevelProgressEntity` — no separate store), then returns to the map.

### Unlocking (Journey gates it itself)

- A node is **passed** when its `LevelProgress.bestScore ≥ 70` (same 70% bar as
  everywhere else).
- Nodes unlock **left → right**: node 1 is open once the chapter is reachable;
  each later node opens when the previous node is passed.
- A **chapter** is reachable when the **previous chapter's nodes are all
  passed** (chapter 1 is always reachable). A chapter is **complete** when all
  its nodes are passed (5, or 6 on French decks), and gets a green accent.
- Because the node modes are `journey-*`, `isLevelUnlocked` returns `true` for
  them (the Journey page owns the gating), so the per-mode round-unlock rule
  does not interfere.

### Node specifics

- **Flashcards node** has no real fail (it's self-rated), so going through the
  cards forces `max(score, 70)` — the pass is guaranteed once you finish.
- **Builder node** teaches grammar groups then has you assemble short phrases.
  Phrases are produced by the phrase-builder core (`src/core/phrase-builder`),
  which classifies the chapter's French words by closed-class lists + heuristics
  and fills simple templates (possessive+noun, article+noun[+adj],
  verb+article+noun). If it can generate **no** phrases for a chapter, the node
  **auto-passes** (saves 100) so the chapter is never blocked.
- **Blanks node (French only)** is the 6th node and is also powered by the
  phrase-builder. It generates a sentence, blanks the key content word (the
  `blankIndex` the generator marks), and offers 4 options (the correct word +
  distractors of the same grammatical category). It's **French-only** — the
  generator is French — so non-French chapters simply have 5 nodes; a French
  chapter that yields no phrases auto-passes like Builder. Standalone, the same
  page is reachable from Home (`Blanks` card, shown only when learning French).

## 7. Admin tools (dev/testing)

- **Settings → Admin → Admin mode** (toggle, default ON for now, hidden in
  production) enables the dev tools.
- In an exercise, the "⋮" menu gains **Admin: finish level** → pick 0/1/2/3
  stars to complete the level instantly (writes progress, skips play). Works in
  all modes incl. Journey.
- **Settings → Admin → How it works** opens an in-app page that renders the live
  values derived from this document (unlock rule, star thresholds, round
  composition, and — when opened for a specific word — why it's shown).

## 8. Per-word priority overrides ("mostrar mais vezes" / "ocultar da prática")

In **As tuas palavras** (Your words) the "⋮" menu on a word opens an action
sheet with three choices, stored as the word's `priority` (`WordPriority =
'boost' | 'normal' | 'hide'`, persisted per card and applied to every form that
shares the prompt, e.g. de/het). They only change **how often a word is shown in
practice** — never its stats, its knowledge bucket, or which level it belongs
to.

### "Mostrar mais vezes" → `boost`
Surfaces the word sooner, across modes:
- **Quick Study** (`getFlashcardQueue`-style scoring): a boosted word gets a flat
  `BOOST_SCORE = 600` added to its priority score, pushing it up the queue.
- **Flashcards queue** (`getFlashcardQueue`): boosted words are sorted **first,
  regardless of their FSRS due date** (ahead of due/new words).
- Row shows an ▲ `arrow-up-circle` badge.

### "Ocultar da prática" → `hide`
Removes the word from practice entirely:
- Excluded from Quick Study and the Flashcards queue (`excludeHidden`) and from
  the playable set used by Match and friends (`playableCards`).
- Row shows an 🚫 `eye-off` badge and dims; a status filter (All / Enabled /
  Hidden) appears in Your words once at least one word is hidden, so hidden
  words remain findable and can be restored.
- **Not** removed from level membership or the Flashcards knowledge breakdown
  (§6b) — `getLevelCards` counts the fixed word set and does not filter hidden
  words. Hiding affects *practice selection only*, not the level's definition.

### "Normal" → `normal`
Clears any override: default scheduling, no badge.

Hiding/boosting is a pure practice-queue override and does not unlock levels,
award stars, or alter round composition.

## 9. Typed-answer acceptance: typos, accents & the amber "close" state

Applies to **typed** answers (the **Write** mode — and Journey's Write node).
Multiple-choice (Quiz) and tile modes don't type free text, so this doesn't
apply there. Implemented by the pure grader `src/core/answer-validator/
typo-grader.ts` (unit-tested in `typo-grader.spec.ts`).

A submission is graded against each accepted answer and the best result wins
(`exact` > `accent` > `typo` > `wrong`). **`exact`, `accent` and `typo` are all
ACCEPTED** (the card completes); only `wrong` is a miss.

### What counts as a typo (accepted, "You have a typo in your answer")

A typo is **at most one letter wrong**, measured **per word** and summed over
the whole answer (so the whole answer may carry a single typo). Per word, any
ONE of these is the single allowed edit:

- one extra letter — `gath → gaath`
- one missing letter — `gath → gth`
- one changed letter — `gath → cath` (so most, but not all, wrong-letter slips pass)
- two **adjacent** letters swapped — `gath → gaht`

Further rules (deliberately the same for every language — the grader does not
know what's "important" in a given language):

- **Word boundaries are respected.** The two answers must have the **same number
  of words**. Two words joined, one word split, one extra word, or one missing
  word (even a one-letter word) are **errors, not typos**.
- **Accents are ignored** for the edit count. If everything else is perfect and
  **only accents differ**, the result is `accent` (accepted, "Pay attention to
  the accents"). An accent difference plus a letter edit is still just a `typo`.
- **Apostrophes count as word separators.** `i'r` is two words; typing `ir` is
  one word, so they don't align → **wrong**. (A human teacher would call a
  missing apostrophe a typo; the grader does not — it's consistent, not clever.)
- **A "letter" is a single character** (English notion). Digraphs like Welsh
  `ch`/`ll` are two letters, so `gath → chath` is two letters in place of one →
  **wrong**, even though Welsh treats `ch` as one letter.

Scoring: an accepted typo/accent still counts as a **mistake** for stars (it does
not earn the perfect-first-try bonus), but the card **completes** so the learner
is never blocked. A perfect `exact` first try (no hint) is the only "clean"
correct.

### The amber "close but not quite" state — reserved for the tile trap

The yellow/amber "almost" state (fix-it-and-retry) is **only** appropriate when
the learner has been marked slightly off **but cannot edit the text to fix it**.
That is the **word-bank / tile** situation, not free typing:

- **The word-bank trap** — the answer is built from preset word tiles, so a
  detected typo/accent can't be corrected by the user. The app must either
  accept it or clearly explain, rather than demand an impossible edit.
- **Gender/article mismatch** — e.g. a wrong article (`el` vs `la`) where the
  validator accepts the article but flags the noun, which confuses the learner.
- **System accents / hidden characters** — smart quotes, mixed keyboard input,
  or trailing spaces that trick the validator into "slightly off".

In free-text **Write**, none of these apply (the user can always retype), so
Write never shows the amber retry — it simply accepts (`exact`/`accent`/`typo`)
or marks `wrong`. The amber path is retained only for the tile-based flow.

### "Previous mistake" banner

When a card the learner got **wrong earlier in the same session** is requeued
and comes around again, the Write screen shows a small amber **"Previous
mistake"** badge above the prompt (Duolingo-style), so they know this one bit
them before.

---

## Current behaviour (shipped, pre-5-round)

For transparency, today the engine does NOT yet do the 5-round model:
- A level is a single pass (one representative card per unique prompt).
- Unlock = previous level best score ≥ 70%.
- Stars = 100 / 85 / 70 thresholds on that single pass.
- Match mixes in weakest review words up to a cap of 50; other modes do not.

The 5-round model in §2–§4 replaces this once implemented.
