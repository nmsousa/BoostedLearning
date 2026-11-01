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
- Level N+1 unlocks when level N has **all 5 rounds completed** (the circle is
  full). Completing a round requires at least a passing score (see §4).
- (Current shipped rule, to be replaced: level N+1 unlocks when level N's best
  single-pass score ≥ 70%.)

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
- **Stars** are awarded on the **level**, from the user's performance across the
  rounds (best effort), using first-try accuracy of the final/consolidation
  round plus overall:
  - **3 stars** — ≥ 95% average first-try accuracy across the 5 rounds.
  - **2 stars** — ≥ 85%.
  - **1 star** — ≥ 70% (the pass line).
  - **0 stars** — below 70% (level not yet complete).
- (Current shipped rule: 3★ = 100%, 2★ ≥ 85%, 1★ ≥ 70%, computed from a single
  pass.)

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

## 7. Admin tools (dev/testing)

- **Settings → Admin → Admin mode** (toggle, default ON for now, hidden in
  production) enables the dev tools.
- In an exercise, the "⋮" menu gains **Admin: finish level** → pick 0/1/2/3
  stars to complete the level instantly (writes progress, skips play). Works in
  all modes incl. Journey.
- **Settings → Admin → How it works** opens an in-app page that renders the live
  values derived from this document (unlock rule, star thresholds, round
  composition, and — when opened for a specific word — why it's shown).

---

## Current behaviour (shipped, pre-5-round)

For transparency, today the engine does NOT yet do the 5-round model:
- A level is a single pass (one representative card per unique prompt).
- Unlock = previous level best score ≥ 70%.
- Stars = 100 / 85 / 70 thresholds on that single pass.
- Match mixes in weakest review words up to a cap of 50; other modes do not.

The 5-round model in §2–§4 replaces this once implemented.
