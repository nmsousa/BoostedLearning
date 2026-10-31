# Boosted Learning — TODO / backlog

Tracked tasks that are deferred or in progress.

## Deferred (on standby)

### Learn mode for beginners (teach before testing)
Status: **not implemented** — planned.

Real beginners can't start with Match/Quiz; they need to SEE and learn words
first. Add a "Learn" mode (on the Home grid) that introduces each word with its
translation + audio (and later an example sentence), swiping through with no
scoring, before the games unlock.

Later extension: **grammar and phrases**. Once words are learned, add grammar
explanations and example phrases/sentences that reuse the learned words, so the
user practises words in real context (not just isolated vocabulary).

### Base / origin (source) language — not yet defined
Status: **not implemented** — currently hardcoded to English.

Translations in all decks are stored in English, and the app assumes English
as the base/origin language everywhere (e.g. the "Add word" dialog labels the
second field "Word in English" via `AddWordService.BASE_LANGUAGE = 'en'`).

To do: let the user pick their base/origin language (the language they already
know / translate from). This affects:
- the "Add word" dialog field labels/placeholders,
- the Duolingo import default,
- potentially showing deck translations in the chosen base language (requires
  translation data beyond English — bigger content change).
Start by turning `AddWordService.BASE_LANGUAGE` into a real setting.

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
