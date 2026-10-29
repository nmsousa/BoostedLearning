---
inclusion: fileMatch
fileMatchPattern: 'src/assets/flashcards/*.json'
---

# Flashcard deck content conventions

Rules for flashcard decks (`src/assets/flashcards/*.json`) and the code that
presents them. These exist so every language — Dutch today, French/Spanish
later — gets consistent, high-quality practice without re-discovering the same
problems. The decks are often imported from external sources (e.g. Duolingo)
whose translation lists are noisy, so the app must defend against bad data.

## Deck JSON shape

Each deck file:

```json
{
  "id": "deck-<source>-<lang>",
  "name": "Vocabulary",
  "languageCode": "nl",          // ISO code: nl, fr, es, ...
  "description": "Core vocabulary - N words",
  "cards": [
    { "text": "<target-language word>", "translations": ["best", "...others"], "audioUrl": "..." }
  ]
}
```

- `text` is the word in the language being learned.
- `translations` is an ordered list of English translations. **Do not assume
  `translations[0]` is the best one** — imported data frequently leads with
  contractions, possessives, inflections, or the wrong sense.

## Rule 1 — Never pick `translations[0]` blindly for display

Use `FlashcardService.bestTranslation(card)` to choose what to show. It:
1. applies a curated override map for high-frequency words where meaning matters
   (pronouns, articles, common verbs);
2. otherwise drops apostrophe forms (contractions/possessives like `he'd`,
   `man's`) and 1–2 char fragments (`ve`, `th`);
3. deprioritizes `-ing` gerunds and negations (`didn't`);
4. prefers the shortest remaining clean form (usually the base word).

When adding a new language, review the high-frequency words (pronouns, articles,
`to be`/`to have`, numbers) and extend `CURATED_TRANSLATIONS` for any whose
heuristic pick is wrong. Keys are the target-language word, lowercased.

## Rule 2 — Exclude words identical in both languages (match/quiz)

Words whose target form equals their English translation (e.g. nl `water` =
`water`) make trivial or ambiguous questions. The matching and quiz modes MUST
filter these out via `FlashcardService.playableCards(cards)` /
`isSameInBothLanguages(card)`. Flip and write keep them (still worth reviewing).

Apply `playableCards()` to the card list in any NEW mode that pairs a word with
its translation or offers it among options.

## Rule 3 — Keep content rules centralized

`bestTranslation`, `isSameInBothLanguages`, and `playableCards` live on
`FlashcardService`. Do not reimplement these per mode or per language — call the
shared methods so a fix benefits every mode and every language at once.

## When adding a new language (checklist)

1. Add the deck JSON under `src/assets/flashcards/` and register it in
   `BUNDLED_DECKS`.
2. Spot-check the first few levels for: identical-word pairs (Rule 2 handles
   display, but flag if a whole level is identical), and bad primary
   translations (extend `CURATED_TRANSLATIONS` per Rule 1).
3. Confirm every pairing/choice mode runs the deck through `playableCards()`.
4. Add/extend tests in `flashcard-translation.spec.ts` for any new curated words.
