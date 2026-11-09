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
    version: '1.3.46',
    notes: [
      'Tree: you can now drag to pan around the map and pinch (or scroll) to zoom, so nodes that fall off-screen are reachable.',
      'Tree: when a node is expanded, the lines to the other nodes fade back and no longer cross over them.',
      'Tree admin (testing): double-tap now also works on an individual activity node inside an open sub-star to complete just that activity, as well as on the Core node.',
    ],
  },
  {
    version: '1.3.45',
    notes: [
      'Tree: each Core and theme level is now a set of 5 activities (Cards → Quiz → Write → Match → Builder), done in order like Journey. A level is complete only when all 5 are done.',
      'Tapping a node opens a sub-star: that node in the middle with its 5 activity nodes around it. Only one node expands at a time; close it with the X.',
      'Every node now shows its last completed level, so it\'s clear where you are. A theme can only reach the level the Core has reached.',
    ],
  },
  {
    version: '1.3.44',
    notes: [
      'Tree: Core Levels 2 and 3 are now playable. The loop flows end to end: finish Core L1 to open every theme at Level 1; finish Core L2 to open Level 2; finish Core L3 to open Level 3.',
      'Theme lessons now mix in a few Core words you\'ve already learned, so core vocabulary keeps coming back as you practise topics.',
    ],
  },
  {
    version: '1.3.43',
    notes: [
      'Tree: every theme now has Levels 1, 2 and 3 of vocabulary. Open a theme to see all its levels.',
      'Admin (testing): double-tap a theme or the Core node to instantly complete its next available level. A tip shows at the top when admin mode is on.',
      'Tree: the Core node now shows just "Level x" (the redundant "Core" label was removed).',
    ],
  },
  {
    version: '1.3.42',
    notes: [
      'Fixed "What\'s new": it now lists every update again (it had been stuck showing 1.3.30 even after newer updates installed).',
    ],
  },
  {
    version: '1.3.41',
    notes: [
      'Tree: fixed a bug where opening a theme could start a different theme\'s lesson (e.g. Travel launched Education). Each lesson now opens its own words, even when a word is shared across themes.',
    ],
  },
  {
    version: '1.3.40',
    notes: [
      'Tree mode: Core Vocabulary is now a real, playable unit. Core Level 1 is the first node; completing it unlocks the themes; completing three themes unlocks Core Level 2, and so on.',
      'Each theme shows around ten topic words. (The French content is a first draft pending review.)',
    ],
  },
  {
    version: '1.3.39',
    notes: [
      'Tree: the central Core Vocabulary hub is a progress marker and no longer opens a theme when tapped.',
    ],
  },
  {
    version: '1.3.38',
    notes: [
      'Tree mode is now readable: the many skills are grouped into about a dozen themed units around the Core Vocabulary hub. Tap a theme to see its lessons.',
    ],
  },
  {
    version: '1.3.37',
    notes: [
      'New experimental Tree mode: a radial "learning network" map, opened from the home screen. Shares the same progress and exercises as the Journey maps.',
    ],
  },
  {
    version: '1.3.36',
    notes: [
      'Journey++: long chapter names are now readable — they wrap to two lines in both the chapter header and the top title instead of being cut off.',
    ],
  },
  {
    version: '1.3.35',
    notes: [
      'Fixed phone back when returning from a Journey node exercise: it no longer skips past the map straight to Home.',
    ],
  },
  {
    version: '1.3.34',
    notes: [
      'Journey++: the header no longer briefly flashes the wrong chapter when you switch language.',
    ],
  },
  {
    version: '1.3.33',
    notes: [
      'Journey++: more header polish when switching language (the title settles on the on-screen chapter before the view is shown).',
    ],
  },
  {
    version: '1.3.32',
    notes: [
      'Journey++: admin double-tap-to-complete now only works on the current (blue) node. Admin mode is on by default during testing.',
    ],
  },
  {
    version: '1.3.31',
    notes: [
      'Journey++: clearer decorative lines beside chapter titles, more spacing above the active node, and the Continue button now works while the map is still scrolling.',
      'Flashcards: the flip card back is a deeper blue (not red), no flicker when advancing, and no stars on the complete screen.',
    ],
  },
  {
    version: '1.3.30',
    notes: [
      'Journey++ visual polish: cleaner purple rings on the back/flag buttons and locked nodes, decorative lines beside chapter titles, brighter completed nodes with a check + chevron badge, bigger and clearer Quiz and Write icons, larger nodes with the lock tucked into the corner, a more premium blue action button and a more 3D "Continue" button, plus a nicer top progress bar.',
      'The Quiz and Write mode icons are refreshed everywhere they appear (Home, mode lists and the Journey maps).',
    ],
  },
  {
    version: '1.3.29',
    notes: [
      'Fixed icons sometimes failing to load (a blank square instead of the icon).',
      'Journey++: the background illustration now fills the screen properly instead of showing only a strip at the bottom with blue above.',
    ],
  },
  {
    version: '1.3.28',
    notes: [
      'Journey++ tidied up: chapter titles are centred (no number/emoji), the header now shows the section you\'re on plus its progress bar, "N/total" and % completed. Removed the "Great job!" caption and the XP trophy; a locked node now explains itself only when you tap it.',
    ],
  },
  {
    version: '1.3.27',
    notes: [
      'The "lose progress?" prompt on back now also appears in Quiz, Match and Builder (not just Write), when you\'re mid-exercise: back shows it, back again closes it and leaves.',
    ],
  },
  {
    version: '1.3.26',
    notes: [
      'Write mode back flow fixed properly: mid-exercise, back shows the "lose progress?" prompt on the exercise (no longer jumping to the list first). Back again closes it and returns to the list; back again goes Home.',
    ],
  },
  {
    version: '1.3.25',
    notes: [
      'Write mode: fixed the swipe-back still flickering the "lose progress?" prompt — a back swipe now shows it once and a second back closes it cleanly.',
      '"Check for updates" now reports the real result: if the check itself fails it says so (and falls back to a direct check) instead of wrongly claiming you\'re on the latest version.',
    ],
  },
  {
    version: '1.3.24',
    notes: [
      'Fixed the back gesture / hardware back across the exercises: in Write it now shows the "lose progress?" prompt once (no more flicker loop), and from Flashcards, Quiz, Match and Blanks — whether started from the level list or a Journey map — back now returns to where you came from instead of jumping to the home screen.',
    ],
  },
  {
    version: '1.3.23',
    notes: [
      'Admin/testing: a temporary "Level 0" (2 quick words) now appears at the top of every mode\'s level list when dev tools are on, for fast testing. It saves no progress and is invisible to normal users.',
    ],
  },
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
