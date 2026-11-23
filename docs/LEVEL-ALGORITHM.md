# Level, rounds, stars & word-selection algorithm

This document specifies how levels work: how a level session is built, how the
5 rounds are composed, how stars and the "time for 3 stars" are calculated, how
the next level unlocks, and why a given word is shown. It is the source of
truth for the engine and is surfaced in-app on the **Admin** page.

> Status: **IMPLEMENTED.** The 5-round model described below is the shipped
> behaviour (`flashcard.service.ts`: `ROUNDS_PER_LEVEL`, `ROUND_NEW_FRACTION`,
> `getRoundCards`, `getRoundsCompleted`, `isLevelUnlocked`, `calculateStars`).

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
  (best score ≥ 50%) — requiring 5 full rounds just to unlock felt grindy for a
  quick timed game. Match still fills its 5-round ring for stars/completion;
  that is separate from unlocking.
- **Flashcards (flip)**: no gating — every level is always open (§6b).
- Legacy records with no round data fall back to: previous level best score
  ≥ 50%.

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

- A round is **passed** when first-try accuracy ≥ **50%** (at least half right). A pass is required
  for the round to count toward the 5 (an un-passed round can be retried and
  does not advance the circle).
- **Stars** are the **best (highest) rating across the rounds played**, computed
  per round from that round's first-try accuracy and kept as the max — exactly
  like best time and best combo. Stored as `bestStars` and shown from the first
  round on, so a 3-star round shows 3 stars immediately and they **don't drop**
  if a later round scores lower (once earned, a star count sticks).
  Thresholds, per round (match `calculateStars` in code):
  - **3 stars** — **100%** first-try accuracy (a flawless round).
  - **2 stars** — ≥ 85%.
  - **1 star** — ≥ 50% (the pass line: the round is finished).
  - **0 stars** — below 50% (in practice the round stops early, §11.2).
- `bestScore` separately keeps the running **average** accuracy across rounds,
  for reference; it does not drive the star display.
- Rationale: time, combo and stars are all "your best so far", which is
  motivating (you chase your record) and avoids the confusing case where stars
  dropped after a weaker round. (An even earlier version only wrote stars once
  all 5 rounds were complete, so a just-earned 3-star round still showed 0 —
  also fixed.)

## 5. Match stars (time + mistakes)

Match uses a **fixed pace for every level**: **3 seconds per pair**
(`MATCH_SECONDS_PER_PAIR` in `src/app/shared/star-rules.ts`). There is no
level curve (levels will go away). With `P` pairs:

| Stars | Rule |
|------:|------|
| 3 | 0 mistakes **and** time ≤ `P × 3 s` |
| 2 | at most 1 mistake (any time) — e.g. 0 mistakes but too slow |
| 1 | at least half of the pairs matched without a mistake (board finished) |
| 0 | fewer than half clean (in practice it stops early, §11.2) |

- **Match Audio** uses the same table but is **untimed** (you have to wait for
  each clip), so 0 mistakes = 3 stars.
- The saved % is chosen so the shared %→stars mapping gives exactly these stars
  (`matchScorePercent`).
- Best time and best combo are records only; they don't change unlocking.

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

Flashcards flip has its own direct per-card self-rating — **don't know / know
it** (a legacy "so-so" is still tolerated but no longer offered). The breakdown
classifies from the per-card counters (`flipKnowledgeBucket`), and the **latest
rating decides the bucket** — `rateFlashcard` clears the opposite counter so a
word you re-rate flips colour:

| Bucket | Colour | Rule |
|--------|--------|------|
| **known**    | green | `correctCount > 0` and `incorrectCount === 0` (latest rating was "know it"). |
| **learning** | red   | otherwise (studied, but the latest rating was "don't know"). |

Because a "know it" rating resets `incorrectCount` to 0 (and a "don't know"
resets `correctCount`), re-studying all of a level's red words as "know it"
turns the whole level green — the counters are a snapshot of CURRENT knowledge,
not a cumulative history. (FSRS keeps its own full scheduling history
separately; this only drives the red/green display.) `familiar`/yellow is no
longer produced. The pie ring's proportions are over the **practised** words
only (untouched words don't colour the ring).

> History: an even earlier version coloured the whole level *border* from the
> long-term mastery buckets; one pass left everything "learning", so it was
> replaced by the flip-rating pie+legend. A later version also accumulated the
> counters (never resetting), which meant a word marked "don't know" once could
> never turn green — fixed by the latest-rating-wins reset above.

### Practice the words I don't know

The Flashcards list shows a prominent **"Practice what I don't know"** button
(flip mode only) whenever the deck has at least one red/`learning` word. It
launches a flip session (`/practice/flip/:id?mode=unknowns`) seeded with up to
**20** of the deck's red words (weakest first, hidden words excluded, de-duped
by prompt). It's scored under the normal `flip` namespace — no separate
progress — so rating a word "know it" there turns it green in its own level.

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

## 10. Word knowledge colour (Your words / home breakdown)

Each studied word shows **three mini dots** — the word's **last 3 graded
results**, OLDEST→NEWEST (the rightmost dot is the most recent). This **replaces
the old lifetime-accuracy percentage** for the "Your words" display.

Each dot:
- ⚪ **gray** — not enough plays yet (fewer than 3 recorded results fill from
  the right, so the empty slots sit on the left);
- 🟢 **green** — that attempt was correct;
- 🔴 **red** — that attempt was wrong.

Every graded attempt in any mode appends to a rolling, 3-long history
(`Flashcard.recentResults`, oldest→newest, capped at 3), written by
`recordAttempt` (Quiz/Write/Match/Blanks/Builder…) and by the Flashcards flip
self-rating (`easy` → correct, `hard` → wrong; `medium`/so-so records nothing).
It is persisted in IndexedDB (`FlashcardEntity.recentResults`) and restored on
load, and cleared by a progress reset.

The overall **mastery bucket** is derived from those 3 dots by
`masteryFromResults`:

| Mastery | Rule (over the last ≤3 results) |
|---------|---------------------------------|
| 🟢🟢🟢 **known**  | 3 correct |
| 🟢 **green**       | only correct + gray (1–2 correct, rest not-yet-played), **no** wrong |
| 🟡 **yellow**      | **exactly 1** wrong (e.g. 1 red + 2 green) |
| 🔴 **red**         | **2 or more** wrong |
| — **none**         | no attempts yet |

Notes:
- This is a **recency** model (the last 3 attempts), not a lifetime average, so
  a word recovers as soon as recent answers are correct and degrades quickly
  after repeated misses — matching how "do I still know this?" actually feels.
- The **Your words** list shows the three dots only — the per-word
  correct/incorrect/so-so counts and the old accuracy % stay hidden.
- The list refreshes every time the page is shown, so the dots update right
  after a session (no app restart needed).
- Flashcards' per-level pie ring still uses its SEPARATE two-way rule
  (`flipKnowledgeBucket`, §6b) based on the latest flip self-rating; that is
  independent from these per-word dots.

---

## 11. Explore rules (Core + topic levels)

All the numbers below live in ONE place, `src/app/shared/star-rules.ts`, so
scoring, the stop-early rule and the admin explanation can never disagree.

### 11.1 Stars & finishing (all games)

- Accuracy games (Quiz, Write, Mix, Blanks): **3★ = 100%, 2★ ≥ 85%, 1★ ≥ 50%**.
  Getting **at least half right finishes** the game (1★).
- Match / Match Audio: §5.
- Builder / Builder+ have **no stars**: you can only place the next correct
  word, so a phrase can't be wrong. Finishing every phrase completes them.
- Pass thresholds are all 50%: `ROUND_PASS_SCORE`, `UNLOCK_SCORE`,
  `JOURNEY_PASS_SCORE`, `TREE_PASS_SCORE`.

### 11.2 Stop early

In every game with right/wrong answers (Quiz, Write, Match, Match Audio, Mix),
once **more than half** of the questions are wrong (`tooManyMistakes`:
`wrong > total / 2`), the game stops at once with an encouraging message
("Almost there… try again") and goes back to the level page. Nothing is saved,
so the learner simply replays it. (Back to the level page, not an in-place
restart: Ionic reuses page instances.)

### 11.3 Completion = best result

An activity is **done** once its **best** result reaches 1★
(`isModePassed`: `bestStars ≥ 1` or, for old records, `bestScore ≥ 50`).
A later weaker play never undoes it. A level is complete after Learn + **5 of
the 7 games** (`REQUIRED_GAMES = 5`).

### 11.4 Progressive difficulty (Mix)

The Mix plan depends on how familiar the learner is with **this level's words**
(not on unit progress), and gradually removes assistance. Per word
(`MixSessionService.familiarity`):

- **new** (0): fewer than 2 correct, or the last answer was wrong;
- **practised** (1): ≥ 2 correct and the last answer right;
- **well practised** (2): ≥ 5 correct, streak ≥ 3 and the last answer right.

The level's stage is the average (≥ 0.75 → guided, ≥ 1.5 → independent):

| Stage | Focus | Plan (10 items, always mixed) |
|------|-------|------|
| Recognition | French → native: pick, match, listen | quiz, match, audio, quiz, blank, match, audio, quiz, match, builder |
| Guided production | native → French with word blocks | quiz, builder, match, blank, builder, audio, write, blank, builder, match |
| Independent production | type, no word bank | builder, write, match, write, blank, write, audio, write, builder, write |

Quiz/Audio prompts prefer the least familiar words; single-word Write prompts
use the most familiar ones. The later the stage, the more Write than Builder.

### 11.5 Articles

- A French noun is **always** shown and spoken **with its article**, exactly as
  written: "le café" / "un café" (screen text = audio).
- The English side mirrors it: "the coffee" / "a coffee" / "the hotel"
  (`englishWithArticle`, applied when the Tree deck is registered).
- The gender is shown as a small badge — "Masculine · un" / "Feminine · une" —
  on the Learn card and the Write answer, instead of "(m.)" / "(f.)" in the text.
  For l’ / les nouns the gender comes from the authored note.
- Bare function words ("un" = "a (m.)", "ma" = "my (f.)") keep their English as
  authored: there the note IS the meaning.

### 11.6 Admin: star rules button

In admin mode each Explore game shows an amber shield button (top right) that
opens the exact star rules for the current round (`GameRulesService.showRules`).
See `docs/ADMIN-MODE.md`.

## 12. Explore+ lessons (CEFR bands)

Explore+ has its own curriculum, separate from Explore:
`src/app/maps/explore-plus/lessons/` (one file per band), readable copy in
`docs/EXPLORE-PLUS-LESSONS.md`. Explore keeps its Core + topics unchanged.

- **Lessons, not topic levels.** Each lesson is one mission (a subject + the
  grammar it needs), with its own words (10–13) and its own **authored**
  sentences (8–9). Bands: Pre-A1 (4 lessons), A1 (12), A2 (12). CEFR labels are
  an approximate map, not a certificate.
- **Nothing French is generated at runtime.** Builder, Builder+, Write and Mix
  use the lesson's authored sentences; the games only pick and shuffle them.
  Each sentence has a focus word (the Blanks gap) and 3 authored wrong options
  (Blanks choices and extra Builder tiles); Write accepts the sentence plus any
  listed alternatives (e.g. the feminine form), ignoring punctuation and case.
- **Same activities and rules as Explore**: Learn + any 5 of the 7 games
  complete a lesson (§11.3), with the same stars and stop-early rules (§11.1–2).
  Quiz options come from the lesson's own words.
- **Unlocking is linear**: a lesson opens when the previous one is complete.
- **Bands**: Pre-A1 (4 lessons), A1 (12), A2 (12), B1 (10), B2 (10).
- **Tests** use the authored bank from `CEFR - Test` (Long version), imported
  with `node scripts/import-placement-tests.mjs` into
  `lessons/placement-bank.ts` (grammar, vocabulary, reading and listening
  items; listening is read aloud and its transcript is never shown).
  - **Initial placement** (offered only at the very beginning, 10–12 questions,
    ~5–8 min): adaptive. It starts with an easy Pre-A1 question; a right answer
    moves one band up, a wrong one moves one band down. It stops after 10
    questions once the estimate didn't change over the last 2 answers (max 12).
    Estimated level = the highest band with ≥ 2 right and ≥ 60% right there.
    Result: every lesson of the bands up to that level opens and the learner
    starts at the next band's first lesson (a total beginner starts at Pre-A1).
  - **Level-unlock test** (later, by tapping a locked lesson of a higher band):
    only that band's questions — 8 for Pre-A1–B1, 10 from B2. ≥ 90% = strong
    pass, ≥ 75% = provisional pass (with a revision tip), below = "not yet".
    A pass opens every lesson of that band (and all bands below) and moves the
    start to its first lesson.
  - A result is applied as soon as the test ends (no extra tap needed) and only
    ever RAISES what is open; a lower or failed result never locks anything.
  - Both end with a per-skill summary (strengths / to work on) and offer the
    next band's test. The result screen leads with where to start ("Start
    here: A2 · First lesson: …"); a known lower band is only mentioned as
    "already unlocked for a refresher".
  - **Answers are never revealed** (no right/wrong colours, no explanation),
    so a retake isn't a memory game. Every question is drawn at random from
    the band's whole pool (initial + level items, ~12 per band), and a level
    test always includes at least one listening question.
  - Listening items play bundled clips (`node scripts/gen-audio.mjs
    --placement`), falling back to the device voice.
- **Deck layout**: deck `lesson-<lang>` (French only for now). Each band owns 40
  fixed levels (Pre-A1 1–40, A1 41–80, A2 81–120, B1 121–160, B2 161–200), so a
  new lesson at the end of a band never shifts later bands' progress. Lessons
  must only be appended.
- **Not yet**: dialogues, per-item spaced review across days, pre-generated
  audio for the new sentences and test listening items (the device voice reads
  them for now), and C1/C2 lessons (their test items are already imported).

## Legacy fallback (pre-rounds records)

Progress saved before the 5-round model has no `roundsCompleted`. For those
records, unlocking falls back to the old rule (previous level `bestScore ≥ 70%`)
so existing progress keeps the next level open. New progress always uses the
5-round model above.
