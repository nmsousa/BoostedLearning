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
