/**
 * Tree progression — the Core↔theme tiered unlock engine (brief §6).
 *
 * The loop:
 *   Core L1 is the only initial node.
 *   Completing Core L(n) unlocks Theme L(n) for every theme.
 *   Completing X distinct Theme L(n) milestones unlocks Core L(n+1).
 *   Repeat up to coreTiers.
 *
 * Pure & deterministic: it takes the SET of completed milestone ids and returns
 * what is unlocked. The ids are stable strings so state can be recomputed from
 * completion records after reinstall/sync (brief §6.4). No Angular here.
 *
 * Milestone id conventions:
 *   Core tier n           → "core:<n>"
 *   Theme <id> tier n     → "theme:<id>:<n>"
 *
 * @module app/flashcards/tree
 */

export interface ProgressionConfig {
  coreTiers: number;
  themesToAdvance: number;
}

export interface ProgressionInput {
  config: ProgressionConfig;
  /** All theme ids that HAVE content at a given tier. themeHasTier(id, n). */
  themeHasTier: (themeId: string, tier: number) => boolean;
  /** The themes in play (ids). */
  themeIds: string[];
  /** Set of completed milestone ids. */
  completed: ReadonlySet<string>;
}

export interface ProgressionState {
  /** Highest Core tier the learner may currently play (1-based). */
  unlockedCoreTier: number;
  /** For each theme id → highest theme tier currently available (0 = none). */
  unlockedThemeTier: Record<string, number>;
}

export function coreMilestoneId(tier: number): string { return `core:${tier}`; }
export function themeMilestoneId(themeId: string, tier: number): string { return `theme:${themeId}:${tier}`; }

/** How many DISTINCT themes have their tier-n milestone completed. */
export function distinctThemesCompletedAtTier(
  themeIds: string[], tier: number, completed: ReadonlySet<string>,
): number {
  let count = 0;
  for (const id of themeIds) {
    if (completed.has(themeMilestoneId(id, tier))) count++;
  }
  return count;
}

/**
 * Compute what is unlocked from the completed-set.
 *
 * Core tier n+1 unlocks when:
 *   - Core tier n is completed, AND
 *   - at least `themesToAdvance` distinct themes completed their tier-n
 *     milestone (or, if fewer than that many themes even HAVE tier-n content,
 *     all available ones are completed — brief §6.4 safe lowering).
 *
 * A theme's tier n is available when Core tier n is unlocked AND the theme has
 * content at tier n.
 */
export function computeProgression(input: ProgressionInput): ProgressionState {
  const { config, completed, themeIds, themeHasTier } = input;

  // Core L1 is always unlocked. Walk tiers upward while the gate is satisfied.
  let unlockedCoreTier = 1;
  for (let n = 1; n < config.coreTiers; n++) {
    const coreNdone = completed.has(coreMilestoneId(n));
    if (!coreNdone) break;

    // How many themes even have tier-n content? When NONE do (the Core runs
    // ahead of the authored theme tiers), the Core continues on its own —
    // requiring a theme milestone that can't exist would dead-end the tree.
    const available = themeIds.filter(id => themeHasTier(id, n)).length;
    const needed = available === 0 ? 0 : Math.min(config.themesToAdvance, available);
    const done = distinctThemesCompletedAtTier(themeIds, n, completed);
    if (done < needed) break;

    unlockedCoreTier = n + 1;
  }

  // Theme tiers: a theme's tier t is available only once Core tier t is
  // COMPLETED (brief §6.1: "Completing Core L(n) unlocks Theme L(n)") and the
  // theme has content at tier t. Available tier = the highest such t.
  const unlockedThemeTier: Record<string, number> = {};
  for (const id of themeIds) {
    let t = 0;
    for (let tier = 1; tier <= unlockedCoreTier; tier++) {
      if (completed.has(coreMilestoneId(tier)) && themeHasTier(id, tier)) t = tier;
    }
    unlockedThemeTier[id] = t;
  }

  return { unlockedCoreTier, unlockedThemeTier };
}
