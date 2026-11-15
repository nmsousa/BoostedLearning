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
 * @module app/maps/tree
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

  // The highest theme tier that ANY theme has content for. Once the learner is
  // gating past this, "finish the matching theme tier" means "finish each
  // theme's LAST authored tier" — themes can't follow Core beyond their content.
  let maxThemeTier = 0;
  for (let tier = 1; tier <= config.coreTiers; tier++) {
    if (themeIds.some(id => themeHasTier(id, tier))) maxThemeTier = tier;
  }

  // How many themes have completed their LAST authored tier (their final
  // milestone). Used to decide whether Core may run on alone once it has passed
  // the tiers themes can offer: enough themes (per `themesToAdvance`, clamped to
  // how many themes exist) must be fully done first.
  const themesAtMax = maxThemeTier === 0 ? 0 : themeIds.filter(id => {
    let last = 0;
    for (let tier = 1; tier <= maxThemeTier; tier++) if (themeHasTier(id, tier)) last = tier;
    return last > 0 && completed.has(themeMilestoneId(id, last));
  }).length;
  const themesWithContent = maxThemeTier === 0 ? 0 : themeIds.filter(id => {
    for (let tier = 1; tier <= maxThemeTier; tier++) if (themeHasTier(id, tier)) return true;
    return false;
  }).length;
  const allThemesMaxed = themesAtMax >= Math.min(config.themesToAdvance, themesWithContent);

  // Core L1 is always unlocked. Walk tiers upward while the gate is satisfied.
  let unlockedCoreTier = 1;
  for (let n = 1; n < config.coreTiers; n++) {
    const coreNdone = completed.has(coreMilestoneId(n));
    if (!coreNdone) break;

    const available = themeIds.filter(id => themeHasTier(id, n)).length;
    if (available > 0) {
      // Normal case: themes have tier-n content. Core n+1 needs the distinct
      // theme-tier-n milestones (clamped to how many themes actually have it).
      const needed = Math.min(config.themesToAdvance, available);
      const done = distinctThemesCompletedAtTier(themeIds, n, completed);
      if (done < needed) break;
    } else {
      // Core has passed the last tier themes can offer (no theme has tier-n
      // content). Before it runs ahead ALONE, every theme must have finished
      // its last authored tier — otherwise the learner could grind Core
      // forever and never touch topics (the bug: themes maxed at tier 3 but
      // Core climbed to 7). Once topics are fully done, Core continues solo.
      if (!allThemesMaxed) break;
    }

    unlockedCoreTier = n + 1;
  }

  // Theme tiers: a theme's tier t is available only once Core tier t is
  // COMPLETED (brief §6.1: "Completing Core L(n) unlocks Theme L(n)") and the
  // theme has content at tier t. So at the very start — before Core 1 is done —
  // every theme is locked; finishing Core N opens each theme's Level N.
  // Available tier = the highest such t.
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
