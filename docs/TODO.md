# Boosted Learning — TODO / backlog

Tracked tasks that are deferred or in progress.

## Deferred (on standby)

### Duolingo-style "no-fail" practice (reveal translation, keep going)
Status: **not implemented** — planned.

Rework Practice to feel like Duolingo: the user plays the existing modes
(Flip / Write / Match / Quiz / Blanks) using the words they got wrong, but
there is **no "fail" state**. Instead of being marked wrong and blocked, if the
user doesn't know an answer they can tap a **"show translation / reveal"**
option to see the answer, and then simply **continue** to the next item. The
session always flows forward — practice is about exposure and recall, not
punishment.

Notes / open questions for when this is picked up:
- Source the items from the user's weak words (highest miss rate / "don't
  know" ratings) — reuse `getStudiedWords` miss-rate ordering and the
  flip/level knowledge buckets.
- "Reveal" should not count as a correct answer, but should NOT lock the input
  or flash red / block the tap either — just show the answer and offer "next".
- Decide how (or whether) a revealed item feeds back into the word's
  knowledge/SRS state (e.g. treat as a soft "still learning" without a harsh
  penalty) so weak words resurface without tanking stats.
- Applies across all existing modes; may need a shared "practice session" flow
  rather than per-mode level logic.

### Learn mode for beginners (teach before testing)
Status: **not implemented** — planned.

Real beginners can't start with Match/Quiz; they need to SEE and learn words
first. Add a "Learn" mode (on the Home grid) that introduces each word with its
translation + audio (and later an example sentence), swiping through with no
scoring, before the games unlock.

Later extension: **grammar and phrases**. Once words are learned, add grammar
explanations and example phrases/sentences that reuse the learned words, so the
user practises words in real context (not just isolated vocabulary).

### Base / origin (source) language — picker added; content still English-only
Status: **partially implemented.**

Done: the base/origin language (the language you know and translate FROM) is
now chosen in the "Add a language" flow (duome modal) via a base-language
picker, stored in the `appLanguage` setting (exposed as
`SettingsService.baseLanguage` / set via `setBaseLanguage`). It also drives the
app UI language and the "Add word" dialog field labels. The standalone
"App language" control was removed from Settings.

Still to do:
- Duome only hosts English-base courses today, so a non-English base + target
  URL (e.g. `pt/fr`) may not resolve. Expand `DUOME_COURSES` (or source) once
  other bases are available; the URL is editable as a stopgap.
- Showing deck TRANSLATIONS in the chosen base language needs translation data
  beyond English — a bigger content change. Decks still store English
  translations regardless of the chosen base.

### Daily goal, session length, reminders & push notifications
Status: **not implemented — Settings "Sessions" section is HIDDEN for now.**

The whole "Sessions" group was removed from the Settings UI
(`settings.page.html`) because none of it changes app behavior yet. The pieces
left in place so re-enabling is a one-line template change:
- `SettingsService` still stores `sessionLength`, `dailyGoal`,
  `notificationsEnabled` (with defaults).
- `SettingsPage` still has `onSessionLengthChange` / `onDailyGoalChange` /
  `onNotificationsChange` handlers + `sessionLengthOptions` / `dailyGoalOptions`.
- i18n keys still exist: `settings.secSessions`, `settings.sessionLength`,
  `settings.sessionMinutes`, `settings.dailyGoal`, `settings.dailyGoalItems`,
  `settings.reminders`, `settings.remindersDesc`.

To finish and un-hide:
- Daily goal: track words/attempts completed today vs the goal; show progress.
- Session length: cap a session's duration / number of items by the setting.
- Reminders / push notifications:
  - Local notifications via Capacitor (e.g. `@capacitor/local-notifications`).
  - Schedule a daily practice reminder; respect the `notificationsEnabled` toggle.
  - Handle Android 13+ notification permission request.
- Then restore the "Session Section" `ion-item-group` in `settings.page.html`.

### French translation review (validate the audit list)
Status: **not implemented** — list ready, awaiting validation.

An audit of ALL French translations was generated at
`docs/french-translation-audit.md` (256 entries flagged, 4 with no good
option). Each flagged entry shows the current translation vs. a suggested one.

To do: go through the list, confirm/correct the suggestions using real French
knowledge, then fold the agreed fixes into the language-scoped
`CURATED_TRANSLATIONS.fr` map in `flashcard.service.ts`. Re-run `npm test` after.

## In progress / recently decided

### App UI language (i18n) — #3
Make the "explanation language" into a real **app language**: English,
Portuguese, Spanish, French. Default to the system language if it's one of
those, else English. User can change it in Settings. This app language is also
the default **base language** when importing a new learning language (editable).

Progress: `appLanguage` setting added (en/pt/es/fr, system default). UI now
translated via the `t()` helper + catalogs in `i18n-service.ts`:
- [x] Home page
- [x] Practice list (deck/level cards)
- [x] Settings page (all sections + import/manual/duome modals)
- [x] Flip / Match / Quiz / Write mode pages (titles, ratings, feedback, summaries)
- [ ] Remaining: Your Words screen strings (spot-check), toasts/alerts in
  flashcard.service & settings import flow, any leftover hardcoded error messages.

### Audio speed — #4
Default speed in Settings, plus: on a second tap of a word's audio, show a
"slow" (turtle) button that replays at 0.5x–0.75x.

### Language lazy-loading — #3.1 (under consideration)
Move learning-language decks from bundled to download-on-demand (fetch the deck
JSON on first selection, cache in IndexedDB) so the app stays small. Host JSONs
on GitHub.
