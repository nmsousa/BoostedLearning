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

  readonly stars: StarRow[] = [
    { stars: '★★★', rule: '≥ 95% average first-try accuracy across the 5 rounds' },
    { stars: '★★☆', rule: '≥ 85%' },
    { stars: '★☆☆', rule: '≥ 70% (pass line)' },
    { stars: '☆☆☆', rule: 'below 70% — level not complete yet' },
  ];

  readonly timeRule =
    'Match only: 3-star time = pairs × seconds-per-pair. Seconds-per-pair starts at 2.2s and tightens by 0.2s every 3 levels (floor 1.1s), so deeper levels demand faster play. Other modes are untimed.';

  readonly frequencyRule =
    'A word appears in review proportionally to its weakness: missRate × recency × priority. missRate = incorrect / seen (unseen = 0.5). Missed recently adds +50%. "Boost" ×1.5, "Hide" never shows.';

  readonly pending =
    'NOTE: the 5-round model is the agreed target and is being implemented. The shipped engine still uses a single pass (unlock at ≥70%, stars 100/85/70). See docs/LEVEL-ALGORITHM.md.';

  close(): void {
    this.router.navigate(['/settings']);
  }
}
