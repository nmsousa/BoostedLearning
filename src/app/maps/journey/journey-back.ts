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
/** `from` value passed by the Tree+ map (vertical list). */
export const JOURNEY_TREE_PLUS_FROM = 'tree-plus';

/** Return route for a Journey node exercise. */
export function journeyBackUrl(query: ParamMap): string {
  switch (query.get('from')) {
    case JOURNEY_PLUS_FROM: return '/practice/journey-plus';
    case JOURNEY_PLUS_PLUS_FROM: return '/practice/journey-plus-plus';
    case JOURNEY_TREE_FROM: return '/practice/tree';
    case JOURNEY_TREE_PLUS_FROM: return '/practice/tree-plus';
    default: return '/practice/journey';
  }
}

// NOTE: the maps launch node exercises with NavController.navigateForward (NOT
// a plain router.navigate), so the map is pushed onto the ion-router-outlet
// stack and stays a poppable entry. Exercises RETURN with
// NavController.navigateBack(backUrl), which pops to the existing map page with
// no duplication. Each exercise also registers a BackInterceptor handler that
// calls navigateBack(backUrl) on hardware/gesture back, so back never falls
// through to the global /home fallback even if the outlet stack is uncertain.
