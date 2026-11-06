# Boosted Learning — TODO / backlog

Tracked tasks that are deferred or in progress.

## Deferred (on standby)

### End-to-end (e2e) tests — options to evaluate
Status: **not implemented** — for later evaluation.

We have unit tests (Vitest, ~420) but nothing exercises the real installed app.
Several bugs this project hit were NATIVE-only (soft-keyboard focus, Android
hardware/gesture back, OTA apply) and slipped past unit tests and the headless
desktop-Chromium screenshot checks (which are desktop web, not the Android
WebView + Capacitor layer). Options, most-faithful first:

1. **Appium + Android emulator (or a real device)** — drives the installed APK
   through the real Android WebView + Capacitor. The ONLY option that catches
   the native bugs we keep hitting (keyboard opening on Write entry, swipe/
   hardware back leaving a screen, OTA applying). Cost: heavy setup (emulator or
   device + Appium server), slower, flakier in CI. Best used as a SMALL manual/
   occasional smoke suite for native-only flows, not every CI run.
2. **Playwright (or Cypress) against the web build** — fast, stable, easy in CI;
   great for logic/flow/layout regressions (e.g. "typo accepted", "practice
   unknowns launches", "What's new opens", "Your words colours"). Runs in desktop
   Chromium, so it does NOT catch native keyboard/back/OTA issues (same class as
   the current screenshot checks).
3. **Capacitor + WebdriverIO** — like Appium, drives the native app; comparable
   setup cost.

Recommendation when picked up: Playwright web-e2e for the bulk of flows (cheap,
CI-friendly) PLUS a tiny Appium native smoke suite for the handful of
native-only things (keyboard, back gesture, OTA) run manually/occasionally.
Decide CI vs local-only for the Appium part given emulator cost/flakiness.

### Consistent "lose progress?" confirm on back for all exercises
Status: **partially implemented.**

Hardware/gesture back now runs through a `BackInterceptorService`: the active
page can claim the back press and do what its on-screen X does. The **Write**
exercise uses it to show the existing "you'll lose progress" confirm (and to
just close when nothing was started). The other exercises (Quiz, Match, Flip,
Blanks, Builder) don't track multi-step in-session progress the same way, so
their X / back just closes. If we later want a progress-loss confirm on those
too, register a similar handler per page — the service is already in place.

### Rename the app identity to "Boostionary" everywhere
Status: **not implemented** — planned.

The product is now **Boostionary**, but the old "Boosted Learning" / "boostedlearning"
name is still baked into identifiers and metadata. Replace it everywhere so the
app is Boostionary end to end.

Known spots to change (audit for more before doing it):
- `capacitor.config.ts` → `appId: 'com.boostedlearning.app'` should become a
  Boostionary id, e.g. `com.boostionary.app`. `appName` is already `Boostionary`.
- Android native: `applicationId` in `android/app/build.gradle`, the package
  path under `android/app/src/main/java/...`, `android/app/src/main/res/values/strings.xml`
  (`app_name`, `package_name`, `custom_url_scheme`), and `AndroidManifest.xml`
  references.
- `package.json` `name` ("boosted-learning"), and any workspace folder naming.
- Source references/comments and docs that say "Boosted Learning" where the
  user-facing product name is meant (keep historical notes intact).
- Storage keys that embed the old name — e.g. localStorage
  `boosted-learning-settings`, `boosted-builder-progress-*`, and the IndexedDB
  database name `BoostedLearningDB`. ⚠️ CAUTION: renaming these is a DATA
  MIGRATION — changing them without migrating loses existing users' settings and
  progress. Either keep the old keys/DB name as-is, or add a one-time migration
  that copies old → new on first launch.

⚠️ Changing `appId` / Android `applicationId` makes the store treat it as a
DIFFERENT app (no in-place upgrade over an existing install). Decide whether to
do this before any public release, and coordinate with the OTA setup.

### Keyboard: try removing `android.captureInput` (swipe typing + dictionary)
Status: **not implemented — experiment to validate on a real device.**

The Write keyboard still has no glide/swipe typing and no suggestion dictionary
on Android (unlike Duolingo on the same phone). The remaining suspect is the
native setting `android.captureInput: true` in `capacitor.config.ts`.

Why it's plausible: `captureInput: true` makes the native WebView intercept key
input. That was originally a workaround (Capacitor issue #1753) for Android 8+
where typed text didn't reach the web input until the keyboard closed. The same
report documents a side effect: with it on, the keyboard's autocomplete/
suggestion behaviour goes abnormal. Swipe typing and the suggestion strip both
need the IME to drive the field directly, which `captureInput` interferes with —
so this likely explains why the HTML-attribute changes alone didn't fix it.

Experiment to run (needs a device build — can't be verified in CI/web):
- Set `android.captureInput` to `false` (or remove it) in `capacitor.config.ts`,
  `npx cap sync android`, build the APK, and test on the real phone:
  1. swipe/glide typing works in Write,
  2. the suggestion dictionary appears,
  3. typing an accented word still REGISTERS correctly (e.g. "café" is accepted).
- #3 is the original reason `captureInput` was turned on. We since added
  `syncNativeValue()` (reads the live DOM value at submit) + composition
  handlers, so the original problem may already be covered without it — but this
  MUST be confirmed on-device before shipping, because it's exactly the kind of
  regression `captureInput` was meant to prevent.
- Note: the Gboard "number row" is a keyboard user-preference and is NOT
  controllable by the app — don't expect removing `captureInput` to change it.


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
