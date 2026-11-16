/**
 * Where a Journey node exercise returns to when it finishes / closes.
 *
 * The classic Journey map, Journey+ and Journey++ all launch the SAME node
 * exercises (journey-flip, journey-quiz, …). The redesigned maps add
 * `?from=<page>` to the node route so the exercise returns to the page that
 * started it.
 *
 * @module app/maps/journey
 */
import type { ParamMap } from '@angular/router';

/** `from` value passed by Journey+. */
export const JOURNEY_PLUS_FROM = 'journey-plus';
/** `from` value passed by Journey++. */
export const JOURNEY_PLUS_PLUS_FROM = 'journey-plus-plus';
/** `from` value passed by the Tree map (radial star). */
export const JOURNEY_TREE_FROM = 'tree';
/** `from` value passed by the Tree+ / "Explore" map (vertical list). */
export const JOURNEY_TREE_PLUS_FROM = 'tree-plus';
/** `from` value passed by the "Explore+" stacked map. */
export const JOURNEY_EXPLORE_PLUS_FROM = 'explore-plus';

/** `from` value passed by the shared level page (opened from Explore / Explore+). */
export const JOURNEY_TIER_DETAIL_FROM = 'tier-detail';

/** Route of the shared level page for a node + tier (Core 'core' or a theme id).
 *  `origin` is the list page to go back to ('tree-plus' = Explore, 'explore-plus'). */
export function tierDetailUrl(nodeId: string, tier: number, origin: string): string {
  return `/practice/tier/${encodeURIComponent(nodeId)}/${tier}?origin=${encodeURIComponent(origin)}`;
}

/** The list page a level page returns to (Explore by default). */
export function tierOriginUrl(origin: string | null | undefined): string {
  return origin === JOURNEY_EXPLORE_PLUS_FROM ? '/practice/explore-plus' : '/practice/tree-plus';
}

/** Return route for a Journey node exercise. */
export function journeyBackUrl(query: ParamMap): string {
  switch (query.get('from')) {
    // Launched from the shared level page: come back to that exact level page
    // (it carries which node/tier/origin it was, as extra query params).
    case JOURNEY_TIER_DETAIL_FROM: {
      const node = query.get('tierNode');
      const tier = Number(query.get('tierTier'));
      return node && tier > 0
        ? tierDetailUrl(node, tier, query.get('tierOrigin') ?? JOURNEY_TREE_PLUS_FROM)
        : tierOriginUrl(query.get('tierOrigin'));
    }
    case JOURNEY_PLUS_FROM: return '/practice/journey-plus';
    case JOURNEY_PLUS_PLUS_FROM: return '/practice/journey-plus-plus';
    case JOURNEY_TREE_FROM: return '/practice/tree';
    case JOURNEY_TREE_PLUS_FROM: return '/practice/tree-plus';
    case JOURNEY_EXPLORE_PLUS_FROM: return '/practice/explore-plus';
    // Mix orchestrator: it passes `mixReturn=/practice/mix/<deckId>` so each
    // sub-exercise returns to the Mix page, which then advances to the next.
    case 'mix': return query.get('mixReturn') ?? '/practice';
    // The classic Journey map was removed; send any stale/unknown `from`
    // (and the old 'journey' value) to the practice home instead of a dead route.
    default: return '/practice';
  }
}

// NOTE: the maps launch node exercises with NavController.navigateForward (NOT
// a plain router.navigate), so the map is pushed onto the ion-router-outlet
// stack and stays a poppable entry. Exercises RETURN with
// NavController.navigateBack(backUrl), which pops to the existing map page with
// no duplication. Each exercise also registers a BackInterceptor handler that
// calls navigateBack(backUrl) on hardware/gesture back, so back never falls
// through to the global /home fallback even if the outlet stack is uncertain.
