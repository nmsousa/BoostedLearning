/**
 * Admin / "how it works" page (dev + testing).
 *
 * Surfaces the level/stars/rounds/word-selection rules in-app so they can be
 * inspected without reading code. Mirrors docs/LEVEL-ALGORITHM.md. Reachable
 * only via Settings → Admin (hidden in production builds).
 *
 * @module app/admin
 */

import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

interface RoundRow { round: string; newPct: string; reviewPct: string; emphasis: string; }
interface StarRow { stars: string; rule: string; }

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: false,
})
export class AdminPage {
  private router = inject(Router);

  // Pulled from docs/LEVEL-ALGORITHM.md — kept in sync by hand for now.
  readonly unlockRule =
    'Level 1 is always open. The next level unlocks when the current level has all 5 rounds completed (circle full). A round counts once you score ≥ 70%.';

  readonly rounds: RoundRow[] = [
    { round: '1', newPct: '100%', reviewPct: '0%', emphasis: 'Introduce this level\'s words.' },
    { round: '2', newPct: '~90%', reviewPct: '~10% worst', emphasis: 'Mostly new, a little review.' },
    { round: '3', newPct: '~75%', reviewPct: '~25% worst', emphasis: 'More review of weak words.' },
    { round: '4', newPct: '~60%', reviewPct: '~40% worst', emphasis: 'Heavy review of weak words.' },
    { round: '5', newPct: '~80%', reviewPct: '~20% (words you missed this level)', emphasis: 'Consolidation.' },
  ];

  // Stars are computed PER ROUND from that round's first-try accuracy, and the
  // stored rating is the BEST (highest) across the rounds played (it never
  // drops). Thresholds match calculateStars() in flashcard.service.ts.
  readonly stars: StarRow[] = [
    { stars: '★★★', rule: '100% first-try accuracy in a round' },
    { stars: '★★☆', rule: '≥ 85%' },
    { stars: '★☆☆', rule: '≥ 70% (pass line)' },
    { stars: '☆☆☆', rule: 'below 70% — round not passed' },
  ];
  readonly starsNote =
    'Stars = the BEST single round\'s rating (kept like best time / best combo), from that round\'s first-try accuracy — not an average. Once earned, a star count sticks even if a later round scores lower.';

  readonly timeRule =
    'Match only: 3-star time = pairs × seconds-per-pair. Seconds-per-pair starts at 2.2s and tightens by 0.2s every 3 levels (floor 1.1s), so deeper levels demand faster play. Other modes are untimed.';

  readonly frequencyRule =
    'A word appears in review proportionally to its weakness: missRate × recency × priority. missRate = incorrect / seen (unseen = 0.5). Missed recently adds +50%. "Boost" ×1.5, "Hide" never shows.';

  // ── Typed-answer acceptance (Write): typos & accents ──────────────────────
  readonly typoIntro =
    'Typed answers (Write) accept small slips, Duolingo-style. A submission is graded against every accepted answer; exact, accent and typo all COUNT AS CORRECT (the card completes) — only a real miss is wrong. An accepted typo/accent still counts as a mistake for stars (no perfect-first-try bonus).';

  readonly typoAccepted: string[] = [
    'One extra letter (gath → gaath).',
    'One missing letter (gath → gth).',
    'One changed letter (gath → cath).',
    'Two ADJACENT letters swapped (gath → gaht).',
    'Only accents differ → accepted with "Pay attention to the accents".',
  ];

  readonly typoRejected: string[] = [
    'More than one letter off in a word, or a typo in more than one word.',
    'Different number of words — two words joined, one split, an extra or missing word (even a 1-letter word).',
    'Apostrophes count as word separators: "ir" ≠ "i\'r" (1 word vs 2) → wrong.',
    'A letter = one character (English): "chath" vs "gath" is two letters for one → wrong.',
  ];

  readonly typoAmber =
    'The amber "close, but fix it" state is reserved for tile/word-bank answers you CAN\'T edit (the word-bank trap, gender/article mismatch, system-accent/hidden-character glitches). Free-text Write never shows it — it just accepts or marks wrong.';

  readonly previousMistakeNote =
    '"Previous mistake" badge: shown on Write when a word you got wrong earlier in the session comes back around.';

  close(): void {
    this.router.navigate(['/settings']);
  }
}
