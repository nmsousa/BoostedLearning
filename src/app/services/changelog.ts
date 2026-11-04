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
    version: '1.3.0',
    notes: [
      'New: patch notes — see what changed after each update (here and in Settings → About → What\'s new).',
      'Updates now reliably confirm with a "What\'s new" dialog after applying.',
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
