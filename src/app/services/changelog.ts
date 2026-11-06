/**
 * In-app changelog (patch notes).
 *
 * Keep this in sync with the GitHub Release notes passed to
 * scripts/publish-ota.ps1 (`-Notes`). The newest version goes FIRST. Each entry
 * is a short list of user-facing bullet points. Shown:
 *   - as a "What's new in x.y.z" dialog once, right after an OTA update applies;
 *   - on demand from Settings → About → "What's new".
 *
 * Only the running version's notes need to exist for the post-update dialog;
 * older entries are kept so the Settings "What's new" can show recent history.
 *
 * @module app/services
 */

export interface ChangelogEntry {
  version: string;
  /** Short, user-facing bullet points. */
  notes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.22',
    notes: [
      'Journey++: the "go to current" button now jumps on the first tap even while the page is still scrolling, and its arrow points up or down depending on where the current node is.',
    ],
  },
  {
    version: '1.3.21',
    notes: [
      'Blanks (fill-in-the-blank) now works for Dutch too — short sentences are built from your Dutch words, so you can test the mode. It\'s on the Home screen when Dutch is your learning language.',
    ],
  },
  {
    version: '1.3.20',
    notes: [
      'Your words: the list now refreshes right after a lesson (no need to reopen the app), and the speaker actually plays the word.',
      'Your words: a slower-replay button appears after you play a word twice.',
      'Journey++: tapping a locked node now tells you why it\'s locked.',
      'Journey++: removed the small lock icon after a chapter title, and the "jump to current" button now works on the first tap even while the page is still scrolling.',
      'Clearer "play slower" icon across the exercises.',
      'Between-round message is now accurate — it only says a round focuses on your missed words when it actually does.',
    ],
  },
  {
    version: '1.3.19',
    notes: [
      'Fixed the phone back gesture re-opening an exercise after you finished it — back now returns to the previous screen properly.',
    ],
  },
  {
    version: '1.3.18',
    notes: [
      'Your words: tap the speaker on a row to hear the word (tap elsewhere still opens its options).',
      'Journey++: chapter titles have more room (removed the word count), and the "jump to current" button now stays put above the bar instead of scrolling.',
    ],
  },
  {
    version: '1.3.17',
    notes: [
      'Write mode: the keyboard now stays open after you answer (you just can\'t edit a graded answer until you continue).',
      'Your words: the list refreshes right after a session, shows only the colour dot (counts and % hidden), and the colour now reflects accuracy — green above 70%, yellow 50–70%, red below 50%.',
      'Removed the round counter (1/5…) from exercise headers — the level ring already shows round progress.',
      'Fixed the swipe-back gesture re-opening an exercise after you finished it.',
    ],
  },
  {
    version: '1.3.16',
    notes: [
      'Journey/Journey+/Journey++: fixed the back gesture — leaving a map after playing a few nodes no longer walks back through old exercises; one back press leaves the map.',
    ],
  },
  {
    version: '1.3.15',
    notes: [
      'Flashcards: re-studying a word now updates its colour — mark a red word "know it" and it turns green (the latest rating wins).',
      'Flashcards: new "Practice what I don\'t know" button drills up to 20 of your red words; marking one "know it" turns it green in its level.',
      'Fixed the progress bar at the top of an exercise sometimes not showing until you switched theme.',
    ],
  },
  {
    version: '1.3.14',
    notes: [
      'Write mode: after you answer, the input locks (you can no longer edit a judged answer) and you tap Continue to move on.',
      'Write mode: a correct answer now waits for you to tap Continue instead of jumping to the next card on its own.',
    ],
  },
  {
    version: '1.3.13',
    notes: [
      'Admin → How it works now explains when a typed answer is accepted as a typo or accent slip, and corrects the star rules.',
    ],
  },
  {
    version: '1.3.12',
    notes: [
      'Write mode: small typos (one letter off) and missing accents are now accepted, with a note — like Duolingo — so a slip no longer blocks you.',
      'Write mode: a "Previous mistake" marker shows when a word you missed earlier comes back around.',
      'Journey: the connecting line no longer shows through the locked stops.',
    ],
  },
  {
    version: '1.3.11',
    notes: [
      'Fixed the "What\'s new" page crashing when opened. It now opens correctly and shows the full version history.',
    ],
  },
  {
    version: '1.3.10',
    notes: [
      'Fixed the blank screen on launch — a startup crash introduced with the "What\'s new" page is resolved, so the app opens reliably every time.',
    ],
  },
  {
    version: '1.3.9',
    notes: [
      'Fixed the blank screen on relaunch and the app being stuck on an old version: updates now correctly replace the previous one instead of a stale copy lingering after reinstall.',
      'Catching up: Write mode focuses the answer box on open; swipe typing and keyboard suggestions work; Journey+ and Journey++ scroll through all chapters continuously; the full "What\'s new" history page.',
    ],
  },
  {
    version: '1.3.8',
    notes: [
      'Fixed a black screen that could appear after installing a new app build — the app now always falls back to its built-in version instead of getting stuck on an old downloaded update.',
    ],
  },
  {
    version: '1.3.7',
    notes: [
      'Write mode: the answer box is now focused the moment the screen opens, so you can start typing right away (no more tapping the field first).',
      '"What\'s new" is now a full page showing every version\'s changes, so you never miss updates that landed between app opens.',
    ],
  },
  {
    version: '1.3.6',
    notes: [
      'Write mode: swipe/glide typing and the keyboard\'s suggestion dictionary now work again.',
      'Journey++: all chapters now flow in one continuous scroll — just keep scrolling, no more chapter arrows. The language picker shows just the flag.',
      'Journey+ and Journey++: the map now auto-scrolls to the next step when you finish one.',
      'Journey: the trail now connects through the centre of each stop for a cleaner path.',
      'Builder: dragging a word to a later position now works, and fixed a bug where it could open to a blank screen.',
    ],
  },
  {
    version: '1.3.5',
    notes: [
      'New "Journey++" map: a polished, high-fidelity version of the journey with a night-sky scene, glowing stops and a redesigned progress bar.',
      'Open it from the home screen — the classic Journey and Journey+ are still there so you can compare.',
    ],
  },
  {
    version: '1.3.4',
    notes: [
      'Write mode: the keyboard no longer closes when you tap elsewhere (e.g. to hear the audio) — only tapping the header closes it.',
      'Write mode: the keyboard no longer shows a number row.',
      'Write mode: the wrong answer is no longer repeated inside the card — it stays visible in the input below.',
    ],
  },
  {
    version: '1.3.3',
    notes: [
      'Flashcards: simpler rating — tap 👎 (don\'t know) or 👍 (know it). The "so-so" option was removed.',
      'Flashcards: the level list no longer shows the "so-so" state.',
      'Flashcards: each level now has only that skill\'s words — no more repeated words across levels.',
    ],
  },
  {
    version: '1.3.2',
    notes: [
      'Flashcards: the level ring now shows your progress over the whole level — unstudied words stay grey instead of one word filling the whole circle.',
      'Builder: the group tiles are now the same size, so a long name no longer towers over its row.',
      'Fixed the "What\'s new" dialog showing "<br>" instead of line breaks.',
    ],
  },
  {
    version: '1.3.1',
    notes: [
      'Builder: the word bank now includes a few extra words, so building a phrase isn\'t just "tap every chip".',
      'Builder: dragging a word to reorder it is smoother and you can see the word move with your finger.',
      'Settings: new "Delete learning data" option wipes progress and added words for the current language (with a confirmation).',
    ],
  },
  {
    version: '1.3.0',
    notes: [
      'New: patch notes — see what changed after each update (here and in Settings → About → What\'s new).',
      'Updates now confirm with a "What\'s new" dialog after applying.',
      'Journey now looks right in the Light theme (chapters were dark).',
      'Match: you can tap the next pair immediately after a correct match.',
      'Write: the answer field stays editable after a wrong answer so the keyboard stays open.',
      'Feedback reports carry your tester name so issues show who reported them.',
    ],
  },
  {
    version: '1.2.9',
    notes: [
      'Feedback: reports now include a tester name (set it in Settings) so GitHub issues show who sent them.',
    ],
  },
  {
    version: '1.2.8',
    notes: [
      'Write mode: the keyboard now opens when you enter an exercise and reopens after a wrong or misspelled answer.',
    ],
  },
  {
    version: '1.2.7',
    notes: [
      'After an update applies, the app confirms the new version on the home screen.',
    ],
  },
  {
    version: '1.2.6',
    notes: [
      'Write mode: the keyboard stays open when moving on after a correct answer.',
    ],
  },
  {
    version: '1.2.5',
    notes: [
      'Write mode: fixed accented words being cut (e.g. "café"); removed the number row from the keyboard.',
    ],
  },
];

/** Notes for a specific version, or null if none are recorded. */
export function changelogFor(version: string): ChangelogEntry | null {
  return CHANGELOG.find(e => e.version === version) ?? null;
}

/** The newest recorded changelog entry. */
export function latestChangelog(): ChangelogEntry | null {
  return CHANGELOG[0] ?? null;
}
